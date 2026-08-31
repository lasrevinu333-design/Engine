package org.memphiszoo.custodial.sync

import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import kotlinx.coroutines.CancellationException
import org.memphiszoo.custodial.domain.CanonicalReceiptCommand
import org.memphiszoo.custodial.domain.LeaseToken

/** Immutable endpoint configuration for the native operation journal. */
data class OperationEndpointConfiguration(
    val baseUrl: String,
    val operationPathPrefix: String = "/scan-api/native-v1/operations",
) {
    init {
        require(baseUrl.startsWith("https://")) { "Native operation transport requires HTTPS." }
        require(!baseUrl.endsWith('/')) { "Base URL must not end with a slash." }
        require(operationPathPrefix.startsWith('/'))
        require(!operationPathPrefix.endsWith('/'))
    }

    fun operationUrl(operationId: String): String =
        "$baseUrl$operationPathPrefix/${URLEncoder.encode(operationId, StandardCharsets.UTF_8.name())}"
}

data class OperationHttpRequest(
    val method: String,
    val url: String,
    val headers: Map<String, String>,
    val body: ByteArray?,
)

data class OperationHttpResponse(
    val statusCode: Int,
    val headers: Map<String, String> = emptyMap(),
    val body: ByteArray = byteArrayOf(),
) {
    fun header(name: String): String? = headers.entries
        .firstOrNull { it.key.equals(name, ignoreCase = true) }
        ?.value
}

fun interface OperationHttpClient {
    suspend fun execute(request: OperationHttpRequest): OperationHttpResponse
}

fun interface CanonicalReceiptDecoder {
    fun decode(operation: LeaseToken, response: OperationHttpResponse): CanonicalReceiptCommand?
}

/** The request was proven not to have left the phone. */
class OperationRequestNotSentException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** The request may have reached the server, so the canonical status must be read before resending. */
class OperationDeliveryUnknownException(message: String, cause: Throwable? = null) : Exception(message, cause)

/**
 * Sends the exact Room-journal bytes. It never reconstructs or normalizes an operation body.
 *
 * HTTP is isolated behind [OperationHttpClient], allowing deterministic tests and a separately
 * audited Android implementation. A success response is not accepted unless the response decoder
 * returns a canonical receipt bound to the same operation.
 */
class HttpOperationTransport(
    private val configuration: OperationEndpointConfiguration,
    private val client: OperationHttpClient,
    private val receiptDecoder: CanonicalReceiptDecoder,
    private val defaultRetryDelayMs: Long = 30_000L,
) : OperationTransport {
    init {
        require(defaultRetryDelayMs > 0)
    }

    override suspend fun sendExact(operation: LeaseToken): TransportOutcome {
        val request = OperationHttpRequest(
            method = "POST",
            url = configuration.operationUrl(operation.operationId),
            headers = operationHeaders(operation) + mapOf(
                "Content-Type" to "application/json",
            ),
            body = operation.canonicalRequestBytes.copyOf(),
        )
        return execute(operation, request, isStatusRead = false)
    }

    override suspend fun readCanonicalStatus(operation: LeaseToken): TransportOutcome {
        val request = OperationHttpRequest(
            method = "GET",
            url = configuration.operationUrl(operation.operationId),
            headers = operationHeaders(operation),
            body = null,
        )
        return execute(operation, request, isStatusRead = true)
    }

    private suspend fun execute(
        operation: LeaseToken,
        request: OperationHttpRequest,
        isStatusRead: Boolean,
    ): TransportOutcome {
        val response = try {
            client.execute(request)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (notSent: OperationRequestNotSentException) {
            return TransportOutcome.Retryable(
                code = "REQUEST_NOT_SENT",
                detailDigest = digest(notSent),
                retryDelayMs = defaultRetryDelayMs,
            )
        } catch (unknown: OperationDeliveryUnknownException) {
            return TransportOutcome.Ambiguous(
                code = "DELIVERY_OUTCOME_UNKNOWN",
                detailDigest = digest(unknown),
                retryDelayMs = defaultRetryDelayMs,
            )
        } catch (unexpected: Throwable) {
            return TransportOutcome.Ambiguous(
                code = "TRANSPORT_FAILURE_UNCLASSIFIED",
                detailDigest = digest(unexpected),
                retryDelayMs = defaultRetryDelayMs,
            )
        }

        return classify(operation, response, isStatusRead)
    }

    private fun classify(
        operation: LeaseToken,
        response: OperationHttpResponse,
        isStatusRead: Boolean,
    ): TransportOutcome {
        val retryDelay = retryAfterMs(response) ?: defaultRetryDelayMs
        return when (response.statusCode) {
            200, 201 -> receiptDecoder.decode(operation, response)
                ?.let { TransportOutcome.Accepted(it) }
                ?: TransportOutcome.Ambiguous(
                    code = "CANONICAL_RECEIPT_INVALID",
                    detailDigest = digest(response.body),
                    retryDelayMs = retryDelay,
                )

            202, 204 -> TransportOutcome.Ambiguous(
                code = "SERVER_ACCEPTANCE_PENDING",
                detailDigest = digest(response.body),
                retryDelayMs = retryDelay,
            )

            401, 403 -> TransportOutcome.Retryable(
                code = "DEVICE_AUTH_REFRESH_REQUIRED",
                detailDigest = digest(response.body),
                retryDelayMs = retryDelay,
            )

            404 -> if (isStatusRead) {
                // SyncDrainEngine records a non-ambiguous failure, which switches the operation
                // back to SEND_EXACT_BYTES after canonical status proves no accepted receipt exists.
                TransportOutcome.Retryable(
                    code = "CANONICAL_STATUS_NOT_FOUND",
                    detailDigest = digest(response.body),
                    retryDelayMs = retryDelay,
                )
            } else {
                TransportOutcome.PermanentConflict(
                    code = "OPERATION_ENDPOINT_NOT_FOUND",
                    detailDigest = digest(response.body),
                )
            }

            409 -> response.header("X-Custodial-Conflict-Code")
                ?.trim()
                ?.uppercase()
                ?.let { code ->
                    if (code in PERMANENT_CONFLICT_CODES) {
                        TransportOutcome.PermanentConflict(
                            code = code,
                            detailDigest = digest(response.body),
                        )
                    } else {
                        TransportOutcome.Ambiguous(
                            code = "OPERATION_CONFLICT_REQUIRES_STATUS",
                            detailDigest = digest(response.body),
                            retryDelayMs = retryDelay,
                        )
                    }
                }
                ?: TransportOutcome.Ambiguous(
                    code = "OPERATION_CONFLICT_REQUIRES_STATUS",
                    detailDigest = digest(response.body),
                    retryDelayMs = retryDelay,
                )

            400, 405, 410, 422 -> TransportOutcome.PermanentConflict(
                code = response.header("X-Custodial-Error-Code")
                    ?.uppercase()
                    ?: "OPERATION_REJECTED_${response.statusCode}",
                detailDigest = digest(response.body),
            )

            408, 425, 429 -> TransportOutcome.Retryable(
                code = "HTTP_${response.statusCode}",
                detailDigest = digest(response.body),
                retryDelayMs = retryDelay,
            )

            in 500..599 -> TransportOutcome.Retryable(
                code = "HTTP_${response.statusCode}",
                detailDigest = digest(response.body),
                retryDelayMs = retryDelay,
            )

            else -> TransportOutcome.Ambiguous(
                code = "UNEXPECTED_HTTP_${response.statusCode}",
                detailDigest = digest(response.body),
                retryDelayMs = retryDelay,
            )
        }
    }

    private companion object {
        val PERMANENT_CONFLICT_CODES = setOf(
            "OPERATION_ID_MISMATCH",
            "BODY_OPERATION_ID_MISMATCH",
            "BODY_OPERATION_TYPE_MISMATCH",
            "PAYLOAD_HASH_MISMATCH",
            "IDEMPOTENCY_PAYLOAD_MISMATCH",
            "OPERATION_ID_CONFLICT",
            "IDENTITY_MISMATCH",
            "PREDECESSOR_MISMATCH",
            "PREDECESSOR_MISSING",
            "TERMINAL_DOMAIN_CONFLICT",
            "DOMAIN_UNIQUE_CONFLICT",
        )
    }

    private fun operationHeaders(operation: LeaseToken): Map<String, String> = linkedMapOf(
        "Accept" to "application/json",
        "Idempotency-Key" to operation.operationId,
        "X-Custodial-Operation-Id" to operation.operationId,
        "X-Custodial-Operation-Type" to operation.operationType.name,
        "X-Custodial-Payload-SHA256" to operation.payloadSha256,
    )

    private fun retryAfterMs(response: OperationHttpResponse): Long? {
        val seconds = response.header("Retry-After")?.trim()?.toLongOrNull() ?: return null
        return seconds.coerceIn(1L, 3_600L) * 1_000L
    }

    private fun digest(value: Throwable): String = digest(
        "${value::class.java.name}|${value.message.orEmpty()}".toByteArray(StandardCharsets.UTF_8),
    )

    private fun digest(value: String): String = digest(value.toByteArray(StandardCharsets.UTF_8))

    private fun digest(value: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(value)
        .joinToString("") { "%02x".format(it) }
}

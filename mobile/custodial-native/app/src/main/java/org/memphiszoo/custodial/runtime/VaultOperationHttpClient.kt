package org.memphiszoo.custodial.runtime

import java.net.URI
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.memphiszoo.custodial.sync.OperationDeliveryUnknownException
import org.memphiszoo.custodial.sync.OperationHttpClient
import org.memphiszoo.custodial.sync.OperationHttpRequest
import org.memphiszoo.custodial.sync.OperationHttpResponse
import org.memphiszoo.custodial.sync.OperationRequestNotSentException

/** Executes exact operation bytes through the native vault without exposing its credential. */
internal class VaultOperationHttpClient(
    private val gateway: NativeDeviceGateway,
    private val expectedDeviceId: String,
    baseUrl: String,
) : OperationHttpClient {
    private val origin = parseOrigin(baseUrl)

    override suspend fun execute(request: OperationHttpRequest): OperationHttpResponse = withContext(Dispatchers.IO) {
        val path = requestPath(request.url)
        refuseCredentialHeaders(request.headers)
        try {
            gateway.authorized(
                expectedDeviceId = expectedDeviceId,
                path = path,
                method = request.method,
                headers = request.headers,
                body = request.body ?: byteArrayOf(),
            ).let { response ->
                OperationHttpResponse(
                    statusCode = response.status,
                    headers = response.headers,
                    body = response.body.copyOf(),
                )
            }
        } catch (failure: SecureRequestException) {
            when (failure.code) {
                "custodial_native_request_not_sent",
                "custodial_native_pending_state_refused",
                "custodial_native_device_binding_mismatch",
                "custodial_native_method_refused",
                "custodial_native_request_too_large",
                "custodial_native_body_refused",
                "custodial_native_origin_refused",
                "custodial_native_path_refused",
                "custodial_native_credential_path_refused",
                "custodial_native_headers_refused",
                "custodial_native_query_refused" -> throw OperationRequestNotSentException(
                    "The vault refused the operation before delivery.",
                    failure,
                )

                else -> throw OperationDeliveryUnknownException(
                    "The vault could not prove whether the operation reached the server.",
                    failure,
                )
            }
        }
    }

    private fun requestPath(url: String): String {
        val target = try { URI(url) } catch (failure: Exception) {
            throw OperationRequestNotSentException("The operation URL is invalid.", failure)
        }
        if (
            target.scheme != origin.scheme ||
            target.host != origin.host ||
            effectivePort(target) != effectivePort(origin) ||
            target.rawUserInfo != null ||
            target.rawFragment != null ||
            target.rawPath.isNullOrBlank()
        ) throw OperationRequestNotSentException("The operation URL left the configured secure origin.")
        return target.rawPath + (target.rawQuery?.let { "?$it" } ?: "")
    }

    private fun refuseCredentialHeaders(headers: Map<String, String>) {
        val forbidden = headers.keys.firstOrNull { key ->
            key.lowercase() in FORBIDDEN_HEADERS
        }
        if (forbidden != null) {
            throw OperationRequestNotSentException("The operation transport attempted to supply vault-owned authority.")
        }
    }

    private fun parseOrigin(value: String): URI {
        val parsed = URI(value)
        require(
            parsed.scheme == "https" &&
            !parsed.host.isNullOrBlank() &&
            parsed.rawUserInfo == null &&
            parsed.rawQuery == null &&
            parsed.rawFragment == null &&
            (parsed.rawPath.isNullOrEmpty() || parsed.rawPath == "/")
        ) { "A canonical HTTPS API origin is required." }
        return parsed
    }

    private fun effectivePort(uri: URI): Int = when {
        uri.port >= 0 -> uri.port
        uri.scheme == "https" -> 443
        else -> -1
    }

    private companion object {
        val FORBIDDEN_HEADERS = setOf(
            "authorization",
            "cookie",
            "x-device-credential",
            "x-memphis-device-credential",
            "x-memphis-native-attestation-version",
            "x-memphis-native-request-id",
            "x-memphis-native-request-timestamp",
            "x-memphis-native-request-attestation",
        )
    }
}

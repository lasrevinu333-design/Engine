package org.memphiszoo.custodial.runtime

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test
import org.memphiszoo.custodial.sync.OperationDeliveryUnknownException
import org.memphiszoo.custodial.sync.OperationHttpRequest
import org.memphiszoo.custodial.sync.OperationRequestNotSentException

class VaultOperationHttpClientTest {
    @Test
    fun exactBytesAndNonSecretHeadersReachVaultRelativePath() = runBlocking {
        val gateway = RecordingGateway()
        val client = VaultOperationHttpClient(gateway, DEVICE, BASE)
        val body = "{\"operation_id\":\"$OPERATION\"}".toByteArray()

        val response = client.execute(
            OperationHttpRequest(
                method = "POST",
                url = "$BASE/scan-api/native-v1/operations/$OPERATION",
                headers = mapOf(
                    "Content-Type" to "application/json",
                    "X-Custodial-Operation-Id" to OPERATION,
                ),
                body = body,
            ),
        )

        assertEquals("/scan-api/native-v1/operations/$OPERATION", gateway.path)
        assertEquals(DEVICE, gateway.expectedDeviceId)
        assertArrayEquals(body, gateway.body)
        assertFalse(gateway.headers.keys.any { it.contains("authorization", ignoreCase = true) })
        assertEquals(201, response.statusCode)
        assertArrayEquals("receipt".toByteArray(), response.body)
    }

    @Test
    fun originEscapeIsProvenNotSent() {
        val gateway = RecordingGateway()
        val client = VaultOperationHttpClient(gateway, DEVICE, BASE)
        assertThrows(OperationRequestNotSentException::class.java) {
            runBlocking {
                client.execute(OperationHttpRequest("POST", "https://other.invalid/path", emptyMap(), byteArrayOf(1)))
            }
        }
        assertEquals(0, gateway.calls)
    }

    @Test
    fun callerSuppliedCredentialAuthorityIsProvenNotSent() {
        val gateway = RecordingGateway()
        val client = VaultOperationHttpClient(gateway, DEVICE, BASE)
        assertThrows(OperationRequestNotSentException::class.java) {
            runBlocking {
                client.execute(OperationHttpRequest("POST", "$BASE/path", mapOf("Authorization" to "secret"), byteArrayOf(1)))
            }
        }
        assertEquals(0, gateway.calls)
    }

    @Test
    fun vaultDeliveryClassesRemainDistinct() {
        val notSent = VaultOperationHttpClient(FailingGateway("custodial_native_request_not_sent"), DEVICE, BASE)
        val unknown = VaultOperationHttpClient(FailingGateway("custodial_native_delivery_unknown"), DEVICE, BASE)
        val request = OperationHttpRequest("POST", "$BASE/path", emptyMap(), byteArrayOf(1))

        assertThrows(OperationRequestNotSentException::class.java) { runBlocking { notSent.execute(request) } }
        assertThrows(OperationDeliveryUnknownException::class.java) { runBlocking { unknown.execute(request) } }
    }

    private class RecordingGateway : NativeDeviceGateway {
        var calls = 0
        var expectedDeviceId = ""
        var path = ""
        var headers: Map<String, String> = emptyMap()
        var body = byteArrayOf()

        override fun state(): SecureDeviceState = error("not used")

        override fun authorized(
            expectedDeviceId: String,
            path: String,
            method: String,
            headers: Map<String, String>,
            body: ByteArray,
        ): SecureHttpResponse {
            calls += 1
            this.expectedDeviceId = expectedDeviceId
            this.path = path
            this.headers = headers
            this.body = body.copyOf()
            return SecureHttpResponse(201, mapOf("X-Test" to "safe"), "receipt".toByteArray())
        }
    }

    private class FailingGateway(private val code: String) : NativeDeviceGateway {
        override fun state(): SecureDeviceState = error("not used")
        override fun authorized(
            expectedDeviceId: String,
            path: String,
            method: String,
            headers: Map<String, String>,
            body: ByteArray,
        ): SecureHttpResponse = throw SecureRequestException(code)
    }

    private companion object {
        const val BASE = "https://memphis-zoo-mcp.onrender.com"
        const val DEVICE = "KIOSK_08"
        const val OPERATION = "11111111-1111-4111-8111-111111111111"
    }
}

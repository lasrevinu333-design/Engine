package org.memphiszoo.custodial.runtime

import org.memphiszoo.custodial.vault.NativeVaultClient

internal data class SecureDeviceState(
    val phase: String,
    val revision: Long,
    val active: Boolean,
    val blocked: Boolean,
    val recoveryRequired: Boolean,
    val reason: String,
    val recoveryReason: String,
    val deviceId: String,
    val installationId: String,
    val employeeId: String,
    val employeeName: String,
    val credentialId: String,
    val credentialExpiresAt: String,
    val deviceName: String,
)

internal data class SecureHttpResponse(
    val status: Int,
    val headers: Map<String, String>,
    val body: ByteArray,
)

internal interface NativeDeviceGateway {
    @Throws(Exception::class)
    fun state(): SecureDeviceState

    @Throws(Exception::class)
    fun authorized(
        expectedDeviceId: String,
        path: String,
        method: String = "GET",
        headers: Map<String, String> = emptyMap(),
        body: ByteArray = byteArrayOf(),
    ): SecureHttpResponse
}

internal class NativeVaultDeviceGateway(
    private val vault: NativeVaultClient,
) : NativeDeviceGateway {
    override fun state(): SecureDeviceState = vault.state().let { state ->
        SecureDeviceState(
            phase = state.phase,
            revision = state.revision,
            active = state.active,
            blocked = state.blocked,
            recoveryRequired = state.recoveryRequired,
            reason = state.reason,
            recoveryReason = state.recoveryReason,
            deviceId = state.deviceId,
            installationId = state.installationId,
            employeeId = state.employeeId,
            employeeName = state.employeeName,
            credentialId = state.credentialId,
            credentialExpiresAt = state.credentialExpiresAt,
            deviceName = state.deviceName,
        )
    }

    override fun authorized(
        expectedDeviceId: String,
        path: String,
        method: String,
        headers: Map<String, String>,
        body: ByteArray,
    ): SecureHttpResponse = vault.authorized(expectedDeviceId, path, method, headers, body).let { response ->
        SecureHttpResponse(response.status, response.headers, response.body())
    }
}

package org.memphiszoo.custodial.runtime

import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.memphiszoo.custodial.data.JournalRepository
import org.memphiszoo.custodial.domain.CutoverState
import org.memphiszoo.custodial.domain.DeviceBootstrap
import org.memphiszoo.custodial.domain.JournalResult
import org.memphiszoo.custodial.domain.TrustedTimeState

internal sealed interface BootstrapOutcome {
    data class Ready(val employeeName: String, val snapshotCount: Int) : BootstrapOutcome
    data class SetupRequired(val message: String) : BootstrapOutcome
    data class Retryable(val message: String) : BootstrapOutcome
}

internal class NativeBootstrapper(
    private val gateway: NativeDeviceGateway,
    private val parser: NativeBootstrapPayloadParser,
    private val repository: JournalRepository,
    private val clock: AndroidRuntimeClock,
) {
    suspend fun bootstrap(): BootstrapOutcome = withContext(Dispatchers.IO) {
        try {
            val secure = gateway.state()
            if (secure.blocked || secure.recoveryRequired) {
                return@withContext BootstrapOutcome.SetupRequired("This phone needs manager recovery before work can continue.")
            }
            if (!secure.active || secure.deviceId.isBlank() || secure.installationId.isBlank() || secure.credentialId.isBlank()) {
                return@withContext BootstrapOutcome.SetupRequired("This phone needs manager setup before work can begin.")
            }
            val statusResponse = gateway.authorized(
                expectedDeviceId = secure.deviceId,
                path = "/device-auth/status?device_id=${secure.deviceId}",
            )
            val status = parser.parseStatus(statusResponse)
            requireIdentity(secure, status)

            val existingDevice = repository.deviceState()
            if (existingDevice != null) {
                if (
                    existingDevice.installationId != secure.installationId ||
                    existingDevice.enrolledDeviceIdentifier != status.canonicalDeviceId ||
                    existingDevice.employeeId != status.employeeId ||
                    existingDevice.assignmentEpoch != status.assignmentEpoch
                ) return@withContext BootstrapOutcome.SetupRequired("This phone assignment changed. A manager must safely move any saved work first.")
            } else {
                val boot = clock.bootObservation(null)
                val credentialEpoch = stablePositiveEpoch(status.credentialId)
                when (val initialized = repository.initializeDevice(
                    DeviceBootstrap(
                        installationId = secure.installationId,
                        originalInstallationNamespaceId = secure.installationId,
                        enrolledDeviceIdentifier = status.canonicalDeviceId,
                        employeeId = status.employeeId,
                        employeeName = status.employeeName,
                        assignmentEpoch = status.assignmentEpoch,
                        attributionCredentialEpoch = credentialEpoch,
                        creationEpoch = credentialEpoch,
                        bootSessionId = boot.bootSessionId,
                        cutoverState = CutoverState.COMPLETE,
                        trustedTimeState = TrustedTimeState.VERIFIED,
                    ),
                    wallEpochMs = boot.wallEpochMs,
                )) {
                    is JournalResult.Rejected -> return@withContext BootstrapOutcome.SetupRequired(initialized.message)
                    is JournalResult.Success -> Unit
                }
            }

            val bootstrapResponse = gateway.authorized(
                expectedDeviceId = secure.deviceId,
                path = "/scan-api/native-v1/bootstrap",
                headers = mapOf("X-Custodial-Installation-Id" to secure.installationId),
            )
            val parsed = parser.parseBootstrap(bootstrapResponse, status, secure.installationId)
            parsed.snapshots.forEach { candidate ->
                when (val accepted = repository.acceptAssignmentSnapshot(candidate, parsed.generatedAtEpochMs)) {
                    is JournalResult.Rejected -> return@withContext BootstrapOutcome.Retryable(accepted.message)
                    is JournalResult.Success -> Unit
                }
            }
            BootstrapOutcome.Ready(status.employeeName, parsed.snapshots.size)
        } catch (failure: BootstrapPayloadException) {
            BootstrapOutcome.Retryable(failure.message ?: "This phone could not refresh its saved schedule.")
        } catch (failure: Exception) {
            BootstrapOutcome.Retryable("This phone could not connect. Saved work is safe. Try again when service returns.")
        }
    }

    private fun requireIdentity(secure: SecureDeviceState, status: AuthenticatedDeviceStatus) {
        if (status.canonicalDeviceId != secure.deviceId) throw BootstrapPayloadException("The secure phone identity does not match the assigned device.")
        if (secure.credentialId.isNotBlank() && status.credentialId != secure.credentialId) throw BootstrapPayloadException("The secure phone credential changed. Ask a manager for help.")
        if (secure.employeeId.isNotBlank() && status.employeeId != secure.employeeId) throw BootstrapPayloadException("This phone is assigned to a different employee. Ask a manager for help.")
    }

    private fun stablePositiveEpoch(value: String): Long {
        val bytes = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
        var result = 0L
        repeat(8) { index -> result = (result shl 8) or (bytes[index].toLong() and 0xffL) }
        return (result and Long.MAX_VALUE).coerceAtLeast(1L)
    }
}

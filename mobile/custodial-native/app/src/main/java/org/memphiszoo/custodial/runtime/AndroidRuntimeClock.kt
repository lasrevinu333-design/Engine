package org.memphiszoo.custodial.runtime

import android.content.Context
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.UUID
import org.memphiszoo.custodial.data.BootSessionEntity
import org.memphiszoo.custodial.domain.BootObservation
import org.memphiszoo.custodial.domain.TrustedTimeInterval

data class RuntimeMoment(
    val bootSessionId: String,
    val elapsedMs: Long,
    val wallEpochMs: Long,
    val trustedTime: TrustedTimeInterval?,
)

class AndroidRuntimeClock(context: Context) {
    private val applicationContext = context.applicationContext
    @Volatile private var activeObservation: BootObservation? = null

    fun bootObservation(existing: BootSessionEntity?): BootObservation {
        val elapsed = SystemClock.elapsedRealtime()
        val wall = System.currentTimeMillis()
        val automatic = automaticTimeEnabled()
        val observation = if (existing != null && elapsed >= existing.firstElapsedMs) {
            BootObservation(
                bootSessionId = existing.bootSessionId,
                bootIdentityHash = existing.bootIdentityHash,
                elapsedMs = elapsed,
                wallEpochMs = wall,
                automaticTimeEnabled = automatic,
            )
        } else {
            val identityMaterial = listOf(
                Build.FINGERPRINT,
                readBootCount().toString(),
                if (readBootCount() >= 0) "counted" else wall.toString(),
            ).joinToString("|")
            val digest = sha256(identityMaterial.toByteArray(StandardCharsets.UTF_8))
            BootObservation(
                bootSessionId = UUID.nameUUIDFromBytes("custodial-boot|$digest".toByteArray(StandardCharsets.UTF_8)).toString(),
                bootIdentityHash = digest,
                elapsedMs = elapsed,
                wallEpochMs = wall,
                automaticTimeEnabled = automatic,
            )
        }
        activeObservation = observation
        return observation
    }

    fun moment(): RuntimeMoment {
        val observation = activeObservation
            ?: error("Boot observation must be reconciled before work commands are created.")
        val elapsed = SystemClock.elapsedRealtime()
        val wall = System.currentTimeMillis()
        val expectedWall = observation.wallEpochMs + (elapsed - observation.elapsedMs)
        val drift = kotlin.math.abs(wall - expectedWall)
        val trusted = if (automaticTimeEnabled() && drift <= MAX_CLOCK_DRIFT_MS) {
            TrustedTimeInterval(
                earliestEpochMs = minOf(wall, expectedWall) - TRUST_MARGIN_MS,
                latestEpochMs = maxOf(wall, expectedWall) + TRUST_MARGIN_MS,
            )
        } else {
            null
        }
        return RuntimeMoment(observation.bootSessionId, elapsed, wall, trusted)
    }

    fun syncTime(): org.memphiszoo.custodial.sync.SyncTime {
        val moment = moment()
        return org.memphiszoo.custodial.sync.SyncTime(moment.bootSessionId, moment.elapsedMs, moment.wallEpochMs)
    }

    private fun automaticTimeEnabled(): Boolean = runCatching {
        Settings.Global.getInt(applicationContext.contentResolver, Settings.Global.AUTO_TIME, 1) == 1
    }.getOrDefault(false)

    private fun readBootCount(): Int = runCatching {
        Settings.Global.getInt(applicationContext.contentResolver, Settings.Global.BOOT_COUNT, -1)
    }.getOrDefault(-1)

    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }

    private companion object {
        const val MAX_CLOCK_DRIFT_MS = 2 * 60_000L
        const val TRUST_MARGIN_MS = 2_000L
    }
}

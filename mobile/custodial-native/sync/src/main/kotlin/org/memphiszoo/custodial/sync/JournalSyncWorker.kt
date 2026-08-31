package org.memphiszoo.custodial.sync

import android.content.Context
import android.content.Intent
import android.content.BroadcastReceiver
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.security.MessageDigest
import java.time.Duration
import java.util.concurrent.TimeUnit

object SyncRuntimeRegistry {
    @Volatile private var provider: (() -> SyncDrainEngine)? = null

    fun install(factory: () -> SyncDrainEngine) {
        provider = factory
    }

    fun create(): SyncDrainEngine? = provider?.invoke()

    fun clearForTests() {
        provider = null
    }
}

class JournalSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val engine = SyncRuntimeRegistry.create() ?: return Result.retry()
        return when (engine.drain()) {
            is DrainResult.Complete -> Result.success()
            is DrainResult.LimitReached -> Result.retry()
            is DrainResult.RetryScheduled -> Result.retry()
            is DrainResult.Paused -> Result.retry()
        }
    }
}

object SyncScheduler {
    private val connected = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    fun requestDrain(context: Context, installationId: String) {
        val request = OneTimeWorkRequestBuilder<JournalSyncWorker>()
            .setConstraints(connected)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            drainName(installationId),
            ExistingWorkPolicy.KEEP,
            request,
        )
    }

    fun ensurePeriodicDrain(context: Context, installationId: String) {
        val request = PeriodicWorkRequestBuilder<JournalSyncWorker>(Duration.ofMinutes(15))
            .setConstraints(connected)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            periodicName(installationId),
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    internal fun drainName(installationId: String) = "custodial-outbox-${stableName(installationId)}"
    internal fun periodicName(installationId: String) = "custodial-outbox-periodic-${stableName(installationId)}"

    private fun stableName(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .take(12)
        .joinToString("") { "%02x".format(it) }
}

class SyncWakeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        val installationId = SyncInstallationIdentity.read(context) ?: return
        SyncScheduler.requestDrain(context, installationId)
        SyncScheduler.ensurePeriodicDrain(context, installationId)
    }
}

object SyncInstallationIdentity {
    private const val PREFERENCES = "custodial_sync_identity"
    private const val INSTALLATION_ID = "installation_id"

    fun store(context: Context, installationId: String) {
        require(installationId.isNotBlank())
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(INSTALLATION_ID, installationId)
            .apply()
    }

    fun read(context: Context): String? = context
        .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        .getString(INSTALLATION_ID, null)
        ?.takeIf(String::isNotBlank)
}

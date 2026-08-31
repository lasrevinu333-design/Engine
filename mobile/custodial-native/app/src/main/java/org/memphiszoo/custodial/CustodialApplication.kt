package org.memphiszoo.custodial

import android.app.Application
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.memphiszoo.custodial.data.CustodialDatabase
import org.memphiszoo.custodial.data.CustodialDatabaseFactory
import org.memphiszoo.custodial.data.JournalRepository
import org.memphiszoo.custodial.domain.Ed25519AssignmentSnapshotVerifier
import org.memphiszoo.custodial.runtime.AndroidRuntimeClock
import org.memphiszoo.custodial.runtime.BootstrapOutcome
import org.memphiszoo.custodial.runtime.CustodialCoordinator
import org.memphiszoo.custodial.runtime.NativeBootstrapPayloadParser
import org.memphiszoo.custodial.runtime.NativeBootstrapper
import org.memphiszoo.custodial.runtime.NativeVaultDeviceGateway
import org.memphiszoo.custodial.sync.RepositorySyncJournal
import org.memphiszoo.custodial.sync.SyncClock
import org.memphiszoo.custodial.sync.SyncDrainEngine
import org.memphiszoo.custodial.sync.SyncInstallationIdentity
import org.memphiszoo.custodial.sync.SyncRuntimeRegistry
import org.memphiszoo.custodial.sync.SyncScheduler
import org.memphiszoo.custodial.sync.UnconfiguredOperationTransport
import org.memphiszoo.custodial.vault.NativeVaultClient

class CustodialApplication : Application() {
    lateinit var database: CustodialDatabase
        private set
    lateinit var repository: JournalRepository
        private set
    lateinit var coordinator: CustodialCoordinator
        private set
    lateinit var runtimeClock: AndroidRuntimeClock
        private set

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val bootstrapInFlight = AtomicBoolean(false)
    private lateinit var bootstrapper: NativeBootstrapper

    override fun onCreate() {
        super.onCreate()
        database = CustodialDatabaseFactory.open(this)
        runtimeClock = AndroidRuntimeClock(this)
        val verifier = Ed25519AssignmentSnapshotVerifier.fromBase64X509(
            mapOf(BuildConfig.ASSIGNMENT_SIGNING_KEY_ID to BuildConfig.ASSIGNMENT_SIGNING_PUBLIC_KEY_X509_B64),
        )
        repository = JournalRepository(database = database, snapshotVerifier = verifier)
        val gateway = NativeVaultDeviceGateway(NativeVaultClient(this))
        bootstrapper = NativeBootstrapper(
            gateway = gateway,
            parser = NativeBootstrapPayloadParser(BuildConfig.ASSIGNMENT_SIGNING_KEY_ID, verifier),
            repository = repository,
            clock = runtimeClock,
        )
        coordinator = CustodialCoordinator(
            repository = repository,
            clock = runtimeClock,
            onDeviceReady = { device ->
                SyncInstallationIdentity.store(this, device.installationId)
                SyncRuntimeRegistry.install {
                    SyncDrainEngine(
                        journal = RepositorySyncJournal(repository),
                        transport = UnconfiguredOperationTransport(),
                        clock = SyncClock(runtimeClock::syncTime),
                        workerIdentity = "workmanager-${UUID.randomUUID()}",
                    )
                }
                SyncScheduler.ensurePeriodicDrain(this, device.installationId)
                SyncScheduler.requestDrain(this, device.installationId)
            },
            onOperationSaved = { installationId -> SyncScheduler.requestDrain(this, installationId) },
        )
        coordinator.start()
        refreshBootstrap()
    }

    fun retryCurrentAction() {
        applicationScope.launch {
            if (repository.deviceState() == null) refreshBootstrap() else {
                refreshBootstrap()
                repository.deviceState()?.let { SyncScheduler.requestDrain(this@CustodialApplication, it.installationId) }
            }
        }
    }

    fun refreshBootstrap() {
        if (!bootstrapInFlight.compareAndSet(false, true)) return
        coordinator.onBootstrapStarted()
        applicationScope.launch {
            val outcome = bootstrapper.bootstrap()
            coordinator.onBootstrapOutcome(outcome)
            if (outcome is BootstrapOutcome.Ready) {
                repository.deviceState()?.let { SyncScheduler.requestDrain(this@CustodialApplication, it.installationId) }
            }
            bootstrapInFlight.set(false)
        }
    }
}

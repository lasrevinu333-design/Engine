package org.memphiszoo.custodial.sync

import org.memphiszoo.custodial.domain.JournalResult
import org.memphiszoo.custodial.domain.LeaseToken
import org.memphiszoo.custodial.domain.ReconciliationKind

fun interface SyncClock {
    fun now(): SyncTime
}

data class SyncTime(
    val bootSessionId: String,
    val elapsedMs: Long,
    val wallEpochMs: Long,
)

sealed interface DrainResult {
    data class Complete(val processed: Int) : DrainResult
    data class RetryScheduled(val processed: Int, val code: String) : DrainResult
    data class Paused(val processed: Int, val message: String) : DrainResult
    data class LimitReached(val processed: Int) : DrainResult
}

class SyncDrainEngine(
    private val journal: SyncJournal,
    private val transport: OperationTransport,
    private val clock: SyncClock,
    private val workerIdentity: String,
    private val leaseDurationMs: Long = 90_000L,
    private val maxOperationsPerRun: Int = 50,
) {
    init {
        require(workerIdentity.isNotBlank())
        require(leaseDurationMs > 0)
        require(maxOperationsPerRun > 0)
    }

    suspend fun drain(): DrainResult {
        var processed = 0
        while (processed < maxOperationsPerRun) {
            val now = clock.now()
            val leased = when (val lease = journal.leaseNext(
                owner = workerIdentity,
                bootSessionId = now.bootSessionId,
                elapsedMs = now.elapsedMs,
                durationMs = leaseDurationMs,
                wallEpochMs = now.wallEpochMs,
            )) {
                is JournalResult.Success -> lease.value
                is JournalResult.Rejected -> return DrainResult.Paused(processed, lease.message)
            } ?: return DrainResult.Complete(processed)

            val outcome = execute(leased)
            when (outcome) {
                is TransportOutcome.Accepted -> {
                    when (val applied = journal.acceptReceipt(outcome.receipt)) {
                        is JournalResult.Success -> processed += 1
                        is JournalResult.Rejected -> return DrainResult.Paused(processed, applied.message)
                    }
                }
                is TransportOutcome.Retryable -> {
                    val changed = journal.recordFailure(
                        operationId = leased.operationId,
                        owner = leased.leaseOwner,
                        generation = leased.leaseGeneration,
                        ambiguous = false,
                        code = outcome.code,
                        detailDigest = outcome.detailDigest,
                        retryDelayMs = outcome.retryDelayMs,
                        wallEpochMs = clock.now().wallEpochMs,
                    )
                    if (changed is JournalResult.Rejected) return DrainResult.Paused(processed, changed.message)
                    return DrainResult.RetryScheduled(processed, outcome.code)
                }
                is TransportOutcome.Ambiguous -> {
                    val changed = journal.recordFailure(
                        operationId = leased.operationId,
                        owner = leased.leaseOwner,
                        generation = leased.leaseGeneration,
                        ambiguous = true,
                        code = outcome.code,
                        detailDigest = outcome.detailDigest,
                        retryDelayMs = outcome.retryDelayMs,
                        wallEpochMs = clock.now().wallEpochMs,
                    )
                    if (changed is JournalResult.Rejected) return DrainResult.Paused(processed, changed.message)
                    return DrainResult.RetryScheduled(processed, outcome.code)
                }
                is TransportOutcome.PermanentConflict -> {
                    when (val applied = journal.recordPermanentConflict(
                        operationId = leased.operationId,
                        code = outcome.code,
                        detailDigest = outcome.detailDigest,
                        wallEpochMs = clock.now().wallEpochMs,
                    )) {
                        is JournalResult.Success -> processed += 1
                        is JournalResult.Rejected -> return DrainResult.Paused(processed, applied.message)
                    }
                }
            }
        }
        return DrainResult.LimitReached(processed)
    }

    private suspend fun execute(operation: LeaseToken): TransportOutcome = when (operation.reconciliationKind) {
        ReconciliationKind.SEND_EXACT_BYTES -> transport.sendExact(operation)
        ReconciliationKind.READ_CANONICAL_STATUS -> transport.readCanonicalStatus(operation)
    }
}

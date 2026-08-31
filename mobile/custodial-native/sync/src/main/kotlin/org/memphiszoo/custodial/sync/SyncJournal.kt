package org.memphiszoo.custodial.sync

import org.memphiszoo.custodial.data.JournalRepository
import org.memphiszoo.custodial.domain.CanonicalReceiptCommand
import org.memphiszoo.custodial.domain.JournalResult
import org.memphiszoo.custodial.domain.LeaseToken

interface SyncJournal {
    suspend fun leaseNext(
        owner: String,
        bootSessionId: String,
        elapsedMs: Long,
        durationMs: Long,
        wallEpochMs: Long,
    ): JournalResult<LeaseToken?>

    suspend fun acceptReceipt(command: CanonicalReceiptCommand): JournalResult<*>

    suspend fun recordFailure(
        operationId: String,
        owner: String,
        generation: Long,
        ambiguous: Boolean,
        code: String,
        detailDigest: String,
        retryDelayMs: Long,
        wallEpochMs: Long,
    ): JournalResult<Boolean>

    suspend fun recordPermanentConflict(
        operationId: String,
        code: String,
        detailDigest: String,
        wallEpochMs: Long,
    ): JournalResult<*>
}

class RepositorySyncJournal(private val repository: JournalRepository) : SyncJournal {
    override suspend fun leaseNext(
        owner: String,
        bootSessionId: String,
        elapsedMs: Long,
        durationMs: Long,
        wallEpochMs: Long,
    ) = repository.leaseNextRunnable(owner, bootSessionId, elapsedMs, durationMs, wallEpochMs)

    override suspend fun acceptReceipt(command: CanonicalReceiptCommand) = repository.applyCanonicalReceipt(command)

    override suspend fun recordFailure(
        operationId: String,
        owner: String,
        generation: Long,
        ambiguous: Boolean,
        code: String,
        detailDigest: String,
        retryDelayMs: Long,
        wallEpochMs: Long,
    ) = repository.applyLeaseFailure(
        operationId = operationId,
        leaseOwner = owner,
        leaseGeneration = generation,
        ambiguous = ambiguous,
        code = code,
        detailDigest = detailDigest,
        retryDelayMs = retryDelayMs,
        wallEpochMs = wallEpochMs,
    )

    override suspend fun recordPermanentConflict(
        operationId: String,
        code: String,
        detailDigest: String,
        wallEpochMs: Long,
    ) = repository.applyPermanentOperationConflict(operationId, code, detailDigest, wallEpochMs)
}

package org.memphiszoo.custodial.sync

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.memphiszoo.custodial.domain.CanonicalReceiptCommand
import org.memphiszoo.custodial.domain.JournalResult
import org.memphiszoo.custodial.domain.LeaseToken
import org.memphiszoo.custodial.domain.OperationType
import org.memphiszoo.custodial.domain.ReconciliationKind

class SyncDrainEngineTest {
    @Test fun acceptedOperationsDrainSequentially() = runBlocking {
        val journal = FakeJournal(mutableListOf(lease("one"), lease("two")))
        val transport = QueueTransport(mutableListOf(accepted("one"), accepted("two")))
        val result = engine(journal, transport).drain()
        assertEquals(DrainResult.Complete(2), result)
        assertEquals(listOf("one", "two"), journal.receipts)
        assertEquals(listOf("one", "two"), transport.sent)
    }

    @Test fun retryableFailureStopsWithoutBusyLoop() = runBlocking {
        val journal = FakeJournal(mutableListOf(lease("one"), lease("two")))
        val transport = QueueTransport(mutableListOf(TransportOutcome.Retryable("OFFLINE", "d", 30_000)))
        val result = engine(journal, transport).drain()
        assertEquals(DrainResult.RetryScheduled(0, "OFFLINE"), result)
        assertEquals(listOf("one:false:SEND_EXACT_BYTES"), journal.failures)
        assertEquals(1, transport.sent.size)
    }

    @Test fun ambiguousLeaseUsesCanonicalStatusOnNextRun() = runBlocking {
        val journal = FakeJournal(mutableListOf(lease("one", ReconciliationKind.READ_CANONICAL_STATUS)))
        val transport = QueueTransport(mutableListOf(accepted("one")))
        val result = engine(journal, transport).drain()
        assertEquals(DrainResult.Complete(1), result)
        assertEquals(emptyList<String>(), transport.sent)
        assertEquals(listOf("one"), transport.statusReads)
    }

    @Test fun permanentConflictIsRecordedAndDrainContinues() = runBlocking {
        val journal = FakeJournal(mutableListOf(lease("one"), lease("two")))
        val transport = QueueTransport(mutableListOf(
            TransportOutcome.PermanentConflict("DUPLICATE", "d"),
            accepted("two"),
        ))
        val result = engine(journal, transport).drain()
        assertEquals(DrainResult.Complete(2), result)
        assertEquals(listOf("one:DUPLICATE"), journal.conflicts)
        assertEquals(listOf("two"), journal.receipts)
    }

    @Test fun unconfiguredTransportNeverFabricatesReceipt() = runBlocking {
        val outcome = UnconfiguredOperationTransport().sendExact(lease("one"))
        assertTrue(outcome is TransportOutcome.Retryable)
    }

    private fun engine(journal: SyncJournal, transport: OperationTransport) = SyncDrainEngine(
        journal = journal,
        transport = transport,
        clock = SyncClock { SyncTime("boot", 1_000, 2_000) },
        workerIdentity = "worker",
    )

    private fun lease(id: String, kind: ReconciliationKind = ReconciliationKind.SEND_EXACT_BYTES) = LeaseToken(
        operationId = id,
        operationType = OperationType.START,
        canonicalRequestBytes = id.toByteArray(),
        payloadSha256 = "payload-$id",
        reconciliationKind = kind,
        leaseOwner = "worker",
        leaseGeneration = 1,
    )

    private fun accepted(id: String) = TransportOutcome.Accepted(
        CanonicalReceiptCommand(
            operationId = id,
            expectedPayloadSha256 = "payload-$id",
            canonicalReceiptBytes = "receipt-$id".toByteArray(),
            canonicalServerDigest = "server-$id",
            serverEffectId = "effect-$id",
            acceptedAtEpochMs = 2_000,
        ),
    )

    private class QueueTransport(private val outcomes: MutableList<TransportOutcome>) : OperationTransport {
        val sent = mutableListOf<String>()
        val statusReads = mutableListOf<String>()
        override suspend fun sendExact(operation: LeaseToken): TransportOutcome {
            sent += operation.operationId
            return outcomes.removeAt(0)
        }
        override suspend fun readCanonicalStatus(operation: LeaseToken): TransportOutcome {
            statusReads += operation.operationId
            return outcomes.removeAt(0)
        }
    }

    private class FakeJournal(private val queue: MutableList<LeaseToken>) : SyncJournal {
        val receipts = mutableListOf<String>()
        val failures = mutableListOf<String>()
        val conflicts = mutableListOf<String>()
        override suspend fun leaseNext(owner: String, bootSessionId: String, elapsedMs: Long, durationMs: Long, wallEpochMs: Long) =
            JournalResult.Success(if (queue.isEmpty()) null else queue.removeAt(0))
        override suspend fun acceptReceipt(command: CanonicalReceiptCommand): JournalResult<*> {
            receipts += command.operationId
            return JournalResult.Success(Unit)
        }
        override suspend fun recordFailure(operationId: String, owner: String, generation: Long, ambiguous: Boolean, code: String, detailDigest: String, retryDelayMs: Long, wallEpochMs: Long): JournalResult<Boolean> {
            failures += "$operationId:$ambiguous:${if (ambiguous) ReconciliationKind.READ_CANONICAL_STATUS else ReconciliationKind.SEND_EXACT_BYTES}"
            return JournalResult.Success(true)
        }
        override suspend fun recordPermanentConflict(operationId: String, code: String, detailDigest: String, wallEpochMs: Long): JournalResult<*> {
            conflicts += "$operationId:$code"
            return JournalResult.Success(Unit)
        }
    }
}

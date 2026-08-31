package org.memphiszoo.custodial.sync

import org.memphiszoo.custodial.domain.CanonicalReceiptCommand
import org.memphiszoo.custodial.domain.LeaseToken

interface OperationTransport {
    suspend fun sendExact(operation: LeaseToken): TransportOutcome
    suspend fun readCanonicalStatus(operation: LeaseToken): TransportOutcome
}

sealed interface TransportOutcome {
    data class Accepted(val receipt: CanonicalReceiptCommand) : TransportOutcome
    data class Retryable(
        val code: String,
        val detailDigest: String,
        val retryDelayMs: Long,
    ) : TransportOutcome
    data class Ambiguous(
        val code: String,
        val detailDigest: String,
        val retryDelayMs: Long,
    ) : TransportOutcome
    data class PermanentConflict(
        val code: String,
        val detailDigest: String,
    ) : TransportOutcome
}

/** Safe foundation default. It never fabricates server acceptance. */
class UnconfiguredOperationTransport : OperationTransport {
    override suspend fun sendExact(operation: LeaseToken): TransportOutcome = unavailable()
    override suspend fun readCanonicalStatus(operation: LeaseToken): TransportOutcome = unavailable()

    private fun unavailable() = TransportOutcome.Retryable(
        code = "BACKEND_NOT_CONFIGURED",
        detailDigest = "native-foundation-no-live-transport",
        retryDelayMs = 15 * 60 * 1_000L,
    )
}

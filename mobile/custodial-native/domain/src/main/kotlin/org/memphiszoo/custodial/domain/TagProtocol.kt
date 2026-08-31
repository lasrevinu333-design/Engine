package org.memphiszoo.custodial.domain

import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.UUID

/** Platform-neutral representation used to test NFC admission without Android framework objects. */
class RawNdefRecord(
    val tnf: Int,
    type: ByteArray,
    payload: ByteArray,
) {
    val type: ByteArray = type.copyOf()
    val payload: ByteArray = payload.copyOf()

    fun contentEquals(other: RawNdefRecord): Boolean =
        tnf == other.tnf && type.contentEquals(other.type) && payload.contentEquals(other.payload)
}

data class NdefEnvelope(val records: List<RawNdefRecord>)

enum class TagParseFailureCode {
    MESSAGE_EMPTY,
    TOO_MANY_RECORDS,
    TARGET_NOT_FIRST,
    TARGET_MISSING,
    MULTIPLE_TARGET_RECORDS,
    WRONG_TNF,
    WRONG_EXTERNAL_TYPE,
    PAYLOAD_TOO_LARGE,
    PAYLOAD_LENGTH_INVALID,
    VERSION_UNSUPPORTED,
    TAG_ID_INVALID,
}

data class CustodialTag(
    val version: Int,
    val tagId: String,
    val payloadSha256: String,
)

sealed interface TagParseResult {
    data class Accepted(val tag: CustodialTag) : TagParseResult
    data class Rejected(val code: TagParseFailureCode) : TagParseResult
}

object CustodialTagProtocol {
    const val TNF_EXTERNAL_TYPE: Int = 4
    const val DOMAIN: String = "org.memphiszoo"
    const val TYPE: String = "custodial-scan-v1"
    const val EXTERNAL_TYPE: String = "$DOMAIN:$TYPE"
    const val VERSION: Int = 1
    const val PAYLOAD_LENGTH: Int = 17
    const val MAX_RECORDS: Int = 8
    const val MAX_RECORD_PAYLOAD_BYTES: Int = 256

    private val expectedType = EXTERNAL_TYPE.toByteArray(StandardCharsets.US_ASCII)

    fun encode(tagId: UUID): ByteArray = ByteBuffer.allocate(PAYLOAD_LENGTH)
        .put(VERSION.toByte())
        .putLong(tagId.mostSignificantBits)
        .putLong(tagId.leastSignificantBits)
        .array()

    fun parseEnvelope(envelope: NdefEnvelope): TagParseResult {
        if (envelope.records.isEmpty()) return TagParseResult.Rejected(TagParseFailureCode.MESSAGE_EMPTY)
        if (envelope.records.size > MAX_RECORDS) return TagParseResult.Rejected(TagParseFailureCode.TOO_MANY_RECORDS)
        val targets = envelope.records.filter(::isTargetRecord)
        if (targets.isEmpty()) return TagParseResult.Rejected(TagParseFailureCode.TARGET_MISSING)
        if (targets.size > 1) return TagParseResult.Rejected(TagParseFailureCode.MULTIPLE_TARGET_RECORDS)
        if (envelope.records.first() !== targets.first()) return TagParseResult.Rejected(TagParseFailureCode.TARGET_NOT_FIRST)
        return parseRecord(targets.first())
    }

    fun parseRecord(record: RawNdefRecord): TagParseResult {
        if (record.tnf != TNF_EXTERNAL_TYPE) return TagParseResult.Rejected(TagParseFailureCode.WRONG_TNF)
        if (!record.type.contentEquals(expectedType)) return TagParseResult.Rejected(TagParseFailureCode.WRONG_EXTERNAL_TYPE)
        if (record.payload.size > MAX_RECORD_PAYLOAD_BYTES) return TagParseResult.Rejected(TagParseFailureCode.PAYLOAD_TOO_LARGE)
        if (record.payload.size != PAYLOAD_LENGTH) return TagParseResult.Rejected(TagParseFailureCode.PAYLOAD_LENGTH_INVALID)
        val version = record.payload[0].toInt() and 0xff
        if (version != VERSION) return TagParseResult.Rejected(TagParseFailureCode.VERSION_UNSUPPORTED)
        return try {
            val buffer = ByteBuffer.wrap(record.payload, 1, 16)
            val id = UUID(buffer.long, buffer.long)
            if (id == UUID(0, 0)) TagParseResult.Rejected(TagParseFailureCode.TAG_ID_INVALID)
            else TagParseResult.Accepted(CustodialTag(version, id.toString(), fingerprint(record)))
        } catch (_: RuntimeException) {
            TagParseResult.Rejected(TagParseFailureCode.TAG_ID_INVALID)
        }
    }

    fun isTargetRecord(record: RawNdefRecord): Boolean =
        record.tnf == TNF_EXTERNAL_TYPE && record.type.contentEquals(expectedType)

    fun fingerprint(record: RawNdefRecord): String {
        val digest = MessageDigest.getInstance("SHA-256")
        digest.update(record.tnf.toByte())
        digest.update(0)
        digest.update(record.type)
        digest.update(0)
        digest.update(record.payload)
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}

enum class NfcAdmissionFailureCode {
    LIVE_TAG_REQUIRED,
    REREAD_REQUIRED,
    DECLARED_MESSAGE_REQUIRED,
    DECLARED_REREAD_MISMATCH,
    AUTHENTICATED_HANDOFF_REQUIRED,
    INVALID_TAG,
}

data class NfcAdmissionEvidence(
    val source: ScanSource,
    val liveTagPresent: Boolean,
    val rereadEnvelope: NdefEnvelope?,
    val declaredEnvelope: NdefEnvelope? = null,
    val tagUidHash: String? = null,
    val authenticatedHandoffIdentity: String? = null,
)

data class AdmittedCustodialTag(
    val tag: CustodialTag,
    val tagUidHash: String?,
    val source: ScanSource,
    val authenticatedHandoffIdentity: String?,
)

sealed interface NfcAdmissionResult {
    data class Accepted(val value: AdmittedCustodialTag) : NfcAdmissionResult
    data class Rejected(
        val code: NfcAdmissionFailureCode,
        val parseFailure: TagParseFailureCode? = null,
    ) : NfcAdmissionResult
}

object NfcAdmissionPolicy {
    fun admit(evidence: NfcAdmissionEvidence): NfcAdmissionResult {
        if (!evidence.liveTagPresent) {
            return NfcAdmissionResult.Rejected(NfcAdmissionFailureCode.LIVE_TAG_REQUIRED)
        }
        val reread = evidence.rereadEnvelope
            ?: return NfcAdmissionResult.Rejected(NfcAdmissionFailureCode.REREAD_REQUIRED)
        if (evidence.source == ScanSource.RECOVERED_HANDOFF && evidence.authenticatedHandoffIdentity.isNullOrBlank()) {
            return NfcAdmissionResult.Rejected(NfcAdmissionFailureCode.AUTHENTICATED_HANDOFF_REQUIRED)
        }
        val parsed = CustodialTagProtocol.parseEnvelope(reread)
        if (parsed is TagParseResult.Rejected) {
            return NfcAdmissionResult.Rejected(NfcAdmissionFailureCode.INVALID_TAG, parsed.code)
        }
        if (evidence.source == ScanSource.COLD_INTENT || evidence.source == ScanSource.WARM_INTENT) {
            val declared = evidence.declaredEnvelope
                ?: return NfcAdmissionResult.Rejected(NfcAdmissionFailureCode.DECLARED_MESSAGE_REQUIRED)
            val declaredTarget = targetRecord(declared)
            val rereadTarget = targetRecord(reread)
            if (declaredTarget == null || rereadTarget == null || !declaredTarget.contentEquals(rereadTarget)) {
                return NfcAdmissionResult.Rejected(NfcAdmissionFailureCode.DECLARED_REREAD_MISMATCH)
            }
        }
        val tag = (parsed as TagParseResult.Accepted).tag
        return NfcAdmissionResult.Accepted(
            AdmittedCustodialTag(tag, evidence.tagUidHash, evidence.source, evidence.authenticatedHandoffIdentity),
        )
    }

    private fun targetRecord(envelope: NdefEnvelope): RawNdefRecord? {
        if (envelope.records.size > CustodialTagProtocol.MAX_RECORDS) return null
        val targets = envelope.records.filter(CustodialTagProtocol::isTargetRecord)
        if (targets.size != 1 || envelope.records.firstOrNull() !== targets.first()) return null
        return targets.first()
    }
}

package org.memphiszoo.custodial.domain

import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TagProtocolTest {
    private val id = UUID.fromString("f9b4ecce-2241-4fe8-9e9a-38dd4d60aa17")
    private fun record(payload: ByteArray = CustodialTagProtocol.encode(id), type: String = CustodialTagProtocol.EXTERNAL_TYPE) =
        RawNdefRecord(
            tnf = CustodialTagProtocol.TNF_EXTERNAL_TYPE,
            type = type.toByteArray(Charsets.US_ASCII),
            payload = payload,
        )

    @Test fun validExternalRecordIsAccepted() {
        val result = CustodialTagProtocol.parseEnvelope(NdefEnvelope(listOf(record())))
        assertTrue(result is TagParseResult.Accepted)
        assertEquals(id.toString(), (result as TagParseResult.Accepted).tag.tagId)
        assertEquals(64, result.tag.payloadSha256.length)
    }

    @Test fun unknownVersionIsRejected() {
        val payload = CustodialTagProtocol.encode(id).also { it[0] = 2 }
        val result = CustodialTagProtocol.parseEnvelope(NdefEnvelope(listOf(record(payload))))
        assertEquals(TagParseFailureCode.VERSION_UNSUPPORTED, (result as TagParseResult.Rejected).code)
    }

    @Test fun malformedAndOversizedPayloadsAreRejected() {
        val short = CustodialTagProtocol.parseEnvelope(NdefEnvelope(listOf(record(byteArrayOf(1, 2)))))
        val huge = CustodialTagProtocol.parseEnvelope(NdefEnvelope(listOf(record(ByteArray(300)))))
        assertEquals(TagParseFailureCode.PAYLOAD_LENGTH_INVALID, (short as TagParseResult.Rejected).code)
        assertEquals(TagParseFailureCode.PAYLOAD_TOO_LARGE, (huge as TagParseResult.Rejected).code)
    }

    @Test fun wrongTypeIsRejected() {
        val result = CustodialTagProtocol.parseEnvelope(NdefEnvelope(listOf(record(type = "org.memphiszoo:wrong"))))
        assertEquals(TagParseFailureCode.TARGET_MISSING, (result as TagParseResult.Rejected).code)
    }

    @Test fun payloadOnlyIntentIsRejected() {
        val result = NfcAdmissionPolicy.admit(
            NfcAdmissionEvidence(
                source = ScanSource.COLD_INTENT,
                liveTagPresent = false,
                declaredEnvelope = NdefEnvelope(listOf(record())),
                rereadEnvelope = null,
            ),
        )
        assertEquals(NfcAdmissionFailureCode.LIVE_TAG_REQUIRED, (result as NfcAdmissionResult.Rejected).code)
    }

    @Test fun declaredIntentMustMatchLiveReread() {
        val other = UUID.fromString("f6498f73-6591-4bfc-8029-cd28120aba43")
        val result = NfcAdmissionPolicy.admit(
            NfcAdmissionEvidence(
                source = ScanSource.WARM_INTENT,
                liveTagPresent = true,
                declaredEnvelope = NdefEnvelope(listOf(record())),
                rereadEnvelope = NdefEnvelope(listOf(record(CustodialTagProtocol.encode(other)))),
            ),
        )
        assertEquals(NfcAdmissionFailureCode.DECLARED_REREAD_MISMATCH, (result as NfcAdmissionResult.Rejected).code)
    }

    @Test fun readerCallbackUsesTheLiveReread() {
        val result = NfcAdmissionPolicy.admit(
            NfcAdmissionEvidence(
                source = ScanSource.READER,
                liveTagPresent = true,
                rereadEnvelope = NdefEnvelope(listOf(record())),
                tagUidHash = "uid-hash",
            ),
        )
        assertTrue(result is NfcAdmissionResult.Accepted)
        assertEquals("uid-hash", (result as NfcAdmissionResult.Accepted).value.tagUidHash)
    }

    @Test
    fun backendAndAndroidTagFingerprintsStayIdentical() {
        val locationId = UUID.fromString("9eb69196-c103-4a9f-873a-227d32c42ccd")
        val record = RawNdefRecord(
            tnf = CustodialTagProtocol.TNF_EXTERNAL_TYPE,
            type = CustodialTagProtocol.EXTERNAL_TYPE.toByteArray(Charsets.US_ASCII),
            payload = CustodialTagProtocol.encode(locationId),
        )

        assertEquals(
            "f3361a748f0751517ac9ee0093689b91239faf2d9e4e64fd1b766e0dda6151e4",
            CustodialTagProtocol.fingerprint(record),
        )
    }
}

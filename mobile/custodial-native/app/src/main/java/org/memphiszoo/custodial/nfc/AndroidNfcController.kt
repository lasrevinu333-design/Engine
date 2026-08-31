package org.memphiszoo.custodial.nfc

import android.app.Activity
import android.content.Intent
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.TagLostException
import android.nfc.tech.Ndef
import android.os.Build
import android.os.Bundle
import android.os.Parcelable
import android.os.SystemClock
import java.io.IOException
import java.security.MessageDigest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.memphiszoo.custodial.domain.AdmittedCustodialTag
import org.memphiszoo.custodial.domain.NdefEnvelope
import org.memphiszoo.custodial.domain.NfcAdmissionEvidence
import org.memphiszoo.custodial.domain.NfcAdmissionPolicy
import org.memphiszoo.custodial.domain.NfcAdmissionResult
import org.memphiszoo.custodial.domain.RawNdefRecord
import org.memphiszoo.custodial.domain.ScanSource
import org.memphiszoo.custodial.runtime.CustodialCoordinator

class AndroidNfcController(
    private val activity: Activity,
    private val scope: CoroutineScope,
    private val coordinator: CustodialCoordinator,
) : NfcAdapter.ReaderCallback {
    private val adapter: NfcAdapter? = NfcAdapter.getDefaultAdapter(activity)
    private var removalMonitor: Job? = null

    fun enableReaderMode() {
        val value = adapter
        if (value == null) {
            coordinator.onTagReadFailure("NFC is not available on this phone.")
            return
        }
        if (!value.isEnabled) {
            coordinator.onTagReadFailure("NFC is turned off. Ask a manager for help.")
            return
        }
        val options = Bundle().apply {
            putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, PRESENCE_CHECK_DELAY_MS)
        }
        value.enableReaderMode(
            activity,
            this,
            NfcAdapter.FLAG_READER_NFC_A or
                NfcAdapter.FLAG_READER_NFC_B or
                NfcAdapter.FLAG_READER_NFC_F or
                NfcAdapter.FLAG_READER_NFC_V or
                NfcAdapter.FLAG_READER_NFC_BARCODE,
            options,
        )
    }

    fun disableReaderMode() {
        runCatching { adapter?.disableReaderMode(activity) }
    }

    fun close() {
        removalMonitor?.cancel()
        removalMonitor = null
        disableReaderMode()
    }

    fun handleIntent(intent: Intent?, source: ScanSource) {
        if (intent?.action != NfcAdapter.ACTION_NDEF_DISCOVERED) return
        val tag = intent.parcelableExtra<Tag>(NfcAdapter.EXTRA_TAG)
        if (tag == null) {
            coordinator.onTagReadFailure("Hold the phone to the location tag and try again.")
            return
        }
        val declared = intent.parcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES)
            ?.filterIsInstance<NdefMessage>()
            ?.firstOrNull()
            ?.toEnvelope()
        processTag(tag, source, declared)
    }

    override fun onTagDiscovered(tag: Tag) {
        processTag(tag, ScanSource.READER, declared = null)
    }

    private fun processTag(tag: Tag, source: ScanSource, declared: NdefEnvelope?) {
        scope.launch(Dispatchers.IO) {
            when (val read = readLive(tag)) {
                is LiveReadResult.Failure -> coordinator.onTagReadFailure(read.message)
                is LiveReadResult.Success -> {
                    val admission = NfcAdmissionPolicy.admit(
                        NfcAdmissionEvidence(
                            source = source,
                            liveTagPresent = true,
                            rereadEnvelope = read.envelope,
                            declaredEnvelope = declared,
                            tagUidHash = read.tagUidHash,
                        ),
                    )
                    when (admission) {
                        is NfcAdmissionResult.Accepted -> {
                            coordinator.onAdmittedTag(admission.value)
                            monitorRemoval(tag, admission.value)
                        }
                        is NfcAdmissionResult.Rejected -> coordinator.onTagReadFailure(
                            when (admission.code) {
                                org.memphiszoo.custodial.domain.NfcAdmissionFailureCode.DECLARED_REREAD_MISMATCH ->
                                    "The tag changed while reading. Move the phone away and try again."
                                else -> "This is not a valid Custodial location tag."
                            },
                        )
                    }
                }
            }
        }
    }

    private fun monitorRemoval(tag: Tag, admitted: AdmittedCustodialTag) {
        removalMonitor?.cancel()
        removalMonitor = scope.launch(Dispatchers.IO) {
            val technology = Ndef.get(tag)
            if (technology == null) {
                coordinator.onTagRemoved(removalProof(admitted, "technology-unavailable"))
                return@launch
            }
            try {
                technology.connect()
                while (isActive) {
                    delay(PRESENCE_CHECK_DELAY_MS.toLong())
                    technology.ndefMessage
                }
            } catch (_: TagLostException) {
                coordinator.onTagRemoved(removalProof(admitted, "tag-lost"))
            } catch (_: IOException) {
                coordinator.onTagRemoved(removalProof(admitted, "io-disconnected"))
            } finally {
                runCatching { technology.close() }
            }
        }
    }

    private fun readLive(tag: Tag): LiveReadResult {
        val technology = Ndef.get(tag)
            ?: return LiveReadResult.Failure("This tag does not contain a Custodial location record.")
        return try {
            technology.connect()
            val message = technology.ndefMessage
                ?: return LiveReadResult.Failure("This tag does not contain a Custodial location record.")
            LiveReadResult.Success(message.toEnvelope(), hash(tag.id))
        } catch (_: TagLostException) {
            LiveReadResult.Failure("The tag moved before it finished reading. Hold the phone still and try again.")
        } catch (_: IOException) {
            LiveReadResult.Failure("The tag could not be read. Move the phone away and try again.")
        } finally {
            runCatching { technology.close() }
        }
    }

    private fun NdefMessage.toEnvelope() = NdefEnvelope(records.map { it.toRawRecord() })

    private fun NdefRecord.toRawRecord() = RawNdefRecord(
        tnf = tnf.toInt(),
        type = type ?: byteArrayOf(),
        payload = payload ?: byteArrayOf(),
    )

    private fun removalProof(admitted: AdmittedCustodialTag, reason: String): String = hash(
        listOf(
            admitted.tag.payloadSha256,
            admitted.tagUidHash.orEmpty(),
            reason,
            SystemClock.elapsedRealtime().toString(),
        ).joinToString("|").toByteArray(),
    ) ?: reason

    private fun hash(value: ByteArray?): String? {
        if (value == null || value.isEmpty()) return null
        return MessageDigest.getInstance("SHA-256")
            .digest(value)
            .joinToString("") { "%02x".format(it) }
    }

    private sealed interface LiveReadResult {
        data class Success(val envelope: NdefEnvelope, val tagUidHash: String?) : LiveReadResult
        data class Failure(val message: String) : LiveReadResult
    }

    private inline fun <reified T : Parcelable> Intent.parcelableExtra(name: String): T? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) getParcelableExtra(name, T::class.java)
        else @Suppress("DEPRECATION") getParcelableExtra(name) as? T

    private fun Intent.parcelableArrayExtra(name: String): Array<Parcelable>? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) getParcelableArrayExtra(name, Parcelable::class.java)
        else @Suppress("DEPRECATION") getParcelableArrayExtra(name)

    private companion object {
        const val PRESENCE_CHECK_DELAY_MS = 250
    }
}

package org.memphiszoo.custodial.notification

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.io.Closeable
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.memphiszoo.custodial.domain.PlaybackCommand
import org.memphiszoo.custodial.domain.PlaybackSignal
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Android audio adapter. Queue order and replay authority remain in Room. */
class AndroidNotificationAudioOutput(
    context: Context,
    private val toneDurationMs: Int = 450,
    private val pauseAfterToneMs: Long = 250,
    private val pauseAfterSpeechMs: Long = 350,
) : NotificationAudioOutput, Closeable {
    private val ready = CompletableDeferred<Boolean>()
    private val completions = ConcurrentHashMap<String, CompletableDeferred<Unit>>()
    private val appContext = context.applicationContext
    private val textToSpeech = TextToSpeech(appContext) { status ->
        ready.complete(status == TextToSpeech.SUCCESS)
    }

    init {
        textToSpeech.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build(),
        )
        textToSpeech.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) = Unit
            override fun onDone(utteranceId: String?) {
                if (utteranceId != null) completions.remove(utteranceId)?.complete(Unit)
            }
            @Deprecated("Deprecated by Android")
            override fun onError(utteranceId: String?) {
                fail(utteranceId, IllegalStateException("Text-to-speech failed"))
            }
            override fun onError(utteranceId: String?, errorCode: Int) {
                fail(utteranceId, IllegalStateException("Text-to-speech failed with code $errorCode"))
            }
            override fun onStop(utteranceId: String?, interrupted: Boolean) {
                if (interrupted) fail(utteranceId, IllegalStateException("Text-to-speech was interrupted"))
            }
            private fun fail(utteranceId: String?, error: Throwable) {
                if (utteranceId != null) completions.remove(utteranceId)?.completeExceptionally(error)
            }
        })
    }

    override suspend fun play(command: PlaybackCommand) {
        when (command.signal) {
            PlaybackSignal.ALERT_TONE -> playTone()
            PlaybackSignal.FULL_SPOKEN_MESSAGE -> speak(requireNotNull(command.spokenMessage))
        }
    }

    private suspend fun playTone() = withContext(Dispatchers.Main.immediate) {
        val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
        try {
            check(tone.startTone(ToneGenerator.TONE_PROP_ACK, toneDurationMs)) { "Alert tone could not start" }
            delay(toneDurationMs.toLong() + pauseAfterToneMs)
        } finally {
            tone.release()
        }
    }

    private suspend fun speak(message: String) {
        check(ready.await()) { "Text-to-speech is unavailable" }
        val utteranceId = "custodial-${UUID.randomUUID()}"
        val completion = CompletableDeferred<Unit>()
        completions[utteranceId] = completion
        val status = withContext(Dispatchers.Main.immediate) {
            textToSpeech.language = Locale.US
            textToSpeech.setSpeechRate(0.92f)
            textToSpeech.speak(message, TextToSpeech.QUEUE_FLUSH, Bundle(), utteranceId)
        }
        if (status != TextToSpeech.SUCCESS) {
            completions.remove(utteranceId)
            error("Text-to-speech request was rejected")
        }
        try {
            completion.await()
            delay(pauseAfterSpeechMs)
        } finally {
            completions.remove(utteranceId)
        }
    }

    override fun close() {
        completions.values.forEach { it.cancel() }
        completions.clear()
        textToSpeech.stop()
        textToSpeech.shutdown()
    }
}

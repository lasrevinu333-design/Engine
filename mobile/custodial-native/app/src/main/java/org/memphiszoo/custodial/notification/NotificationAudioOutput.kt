package org.memphiszoo.custodial.notification

import org.memphiszoo.custodial.domain.PlaybackCommand

fun interface NotificationAudioOutput {
    suspend fun play(command: PlaybackCommand)
}

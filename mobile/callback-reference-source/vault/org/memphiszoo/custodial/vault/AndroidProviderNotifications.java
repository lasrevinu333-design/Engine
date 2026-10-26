package org.memphiszoo.custodial.vault;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;

/** Exact tagged NotificationManager surface; never owns a receipt or generic cancellation.
 * Components are private/exact; their manifest and runtime owners must exist before wiring. */
final class AndroidProviderNotifications implements NativeProviderDisplayDriver.Surface {
    static final int ID = 0x4D5A5002;
    static final String OPEN_ACTIVITY = NativeProviderActionIntent.OPEN_ACTIVITY;
    static final String ACTION_RECEIVER = NativeProviderActionIntent.ACTION_RECEIVER;
    static final String ACTION_PREFIX = NativeProviderActionIntent.ACTION_PREFIX;
    private final Context application;
    private final NotificationManager manager;
    private final boolean nativeAudio;
    AndroidProviderNotifications(Context context) {
        this(context,false);
    }
    AndroidProviderNotifications(Context context,boolean nativeAudio) {
        this.nativeAudio=nativeAudio;
        application = context.getApplicationContext(); manager = (NotificationManager) application.getSystemService(Context.NOTIFICATION_SERVICE);
    }
    private String channel(NativeProviderPayload payload) {
        return payload.get("channel_id")+(nativeAudio?".native-audio.v1":"");
    }
    @Override public boolean enabled(NativeProviderPayload payload) throws VaultFailure {
        if (manager == null) throw new VaultFailure("custodial_provider_notification_manager_unavailable");
        String channel = channel(payload);
        String title = NativeProviderNotificationPolicy.channelTitle(payload.get("channel_id"));
        if (Build.VERSION.SDK_INT >= 26) {
            // Creating an existing channel cannot reset the user's settings. Never delete/recreate
            // to bypass a disabled channel or change the established channels' sound settings.
            if (manager.getNotificationChannel(channel) == null) {
                NotificationChannel fresh=new NotificationChannel(channel, title, NotificationManager.IMPORTANCE_HIGH);
                // Separate exact native-audio channels; never reset/delete the
                // legacy/user channels or let OS audio bypass the private lane.
                if(nativeAudio){fresh.setSound(null,null);fresh.enableVibration(false);}
                manager.createNotificationChannel(fresh);
            }
            NotificationChannel actual = manager.getNotificationChannel(channel);
            if (actual == null || actual.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
            if(nativeAudio&&(actual.getSound()!=null||actual.shouldVibrate()))return false;
            if (Build.VERSION.SDK_INT >= 28 && actual.getGroup() != null) {
                android.app.NotificationChannelGroup group = manager.getNotificationChannelGroup(actual.getGroup());
                if (group != null && group.isBlocked()) return false;
            }
        }
        return manager.areNotificationsEnabled(); // Android13 permission included; registration never depends on this.
    }
    @Override public NativeProviderDisplayDriver.Active active(NativeProviderJournal.OsDisplayIntent intent) throws Exception {
        StatusBarNotification[] active = manager.getActiveNotifications(); if (active == null) throw new VaultFailure("custodial_provider_os_inventory_unavailable");
        for (StatusBarNotification item : active) if (intent.tag.equals(item.getTag()) && item.getId() == ID) {
            Notification notification = item.getNotification(); Bundle extras = notification.extras;
            if (!application.getPackageName().equals(item.getPackageName()) || extras == null
                || !intent.presentation.payload.recordId.equals(extras.getString("mz_provider_record"))
                || !intent.presentation.payload.contentHash.equals(extras.getString("mz_provider_content"))
                || !intent.attemptId.equals(extras.getString("mz_provider_attempt"))
                || !intent.presentation.payload.get("title").contentEquals(extras.getCharSequence(Notification.EXTRA_TITLE, ""))
                || !intent.presentation.payload.get("body").contentEquals(extras.getCharSequence(Notification.EXTRA_TEXT, ""))
                || (Build.VERSION.SDK_INT >= 26 && !channel(intent.presentation.payload).equals(notification.getChannelId())))
                return NativeProviderDisplayDriver.Active.CONFLICT;
            PendingIntent expectedOpen = pending(intent, "opened", false), expectedDelete = pending(intent, "dismissed", false);
            PendingIntent expectedAction = pending(intent, NativeProviderNotificationPolicy.action(intent.presentation.payload), false);
            if (expectedOpen == null || expectedDelete == null || expectedAction == null || !expectedOpen.equals(notification.contentIntent)
                || !expectedDelete.equals(notification.deleteIntent) || notification.actions == null || notification.actions.length != 1
                || notification.actions[0].title == null
                || !NativeProviderNotificationPolicy.actionLabel(intent.presentation.payload).contentEquals(notification.actions[0].title)
                || !expectedAction.equals(notification.actions[0].actionIntent)) return NativeProviderDisplayDriver.Active.CONFLICT;
            return NativeProviderDisplayDriver.Active.MATCH;
        }
        return NativeProviderDisplayDriver.Active.ABSENT;
    }
    @Override public void show(NativeProviderJournal.OsDisplayIntent intent) throws Exception {
        if (!enabled(intent.presentation.payload)) throw new VaultFailure("custodial_provider_notifications_blocked");
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(application, channel(intent.presentation.payload)) : new Notification.Builder(application);
        Bundle extras = new Bundle(); extras.putString("mz_provider_record", intent.presentation.payload.recordId);
        extras.putString("mz_provider_content", intent.presentation.payload.contentHash); extras.putString("mz_provider_attempt", intent.attemptId);
        builder.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(intent.presentation.payload.get("title"))
            .setContentText(intent.presentation.payload.get("body")).setStyle(new Notification.BigTextStyle().bigText(intent.presentation.payload.get("body")))
            .setCategory(Notification.CATEGORY_REMINDER).setPriority(Notification.PRIORITY_HIGH).setVisibility(Notification.VISIBILITY_PRIVATE)
            .setOnlyAlertOnce(true).setAutoCancel(false).addExtras(extras)
            .setContentIntent(pending(intent, "opened", true)).setDeleteIntent(pending(intent, "dismissed", true))
            .addAction(new Notification.Action.Builder(null, NativeProviderNotificationPolicy.actionLabel(intent.presentation.payload),
                pending(intent, NativeProviderNotificationPolicy.action(intent.presentation.payload), true)).build());
        manager.notify(intent.tag, ID, builder.build()); // NOT itself a displayed receipt.
    }
    private PendingIntent pending(NativeProviderJournal.OsDisplayIntent record, String action, boolean create) {
        boolean open = "opened".equals(action);
        Intent intent = new Intent().setClassName(application, open ? OPEN_ACTIVITY : ACTION_RECEIVER)
            .setAction(ACTION_PREFIX + action).setData(new Uri.Builder().scheme("mz-custodial-provider").authority("notification")
                .appendPath(record.presentation.payload.recordId).appendPath(record.attemptId).appendPath(action).build());
        // Identity appears only in exact component/action/data; no authority-bearing payload extras.
        int flags = PendingIntent.FLAG_IMMUTABLE | (create ? PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_NO_CREATE);
        return open ? PendingIntent.getActivity(application, 1, intent, flags) : PendingIntent.getBroadcast(application, "acknowledged".equals(action) ? 2 : 3, intent, flags);
    }
    @Override public void cancel(String tag) throws VaultFailure { requireTag(tag); manager.cancel(tag, ID); }
    @Override public boolean absent(String tag) throws VaultFailure {
        requireTag(tag); StatusBarNotification[] items = manager.getActiveNotifications(); if (items == null) throw new VaultFailure("custodial_provider_os_inventory_unavailable");
        for (StatusBarNotification item : items) if (tag.equals(item.getTag()) && item.getId() == ID) return false; return true;
    }
    private static void requireTag(String tag) throws VaultFailure {
        if (tag == null || !tag.matches("mz-provider:[a-f0-9]{64}")) throw new VaultFailure("custodial_provider_os_tag_invalid");
    }
}

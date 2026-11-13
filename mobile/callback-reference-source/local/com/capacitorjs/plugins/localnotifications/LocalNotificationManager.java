package com.capacitorjs.plugins.localnotifications;

import org.memphiszoo.custodial.vault.CustodialNativeNotificationWriter;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;
import com.getcapacitor.CapConfig;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginConfig;
import com.getcapacitor.plugin.util.AssetUtil;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Contains implementations for all notification actions
 */
public class LocalNotificationManager {

    private static int defaultSoundID = AssetUtil.RESOURCE_ID_ZERO_VALUE;
    private static int defaultSmallIconID = AssetUtil.RESOURCE_ID_ZERO_VALUE;
    // Action constants
    public static final String NOTIFICATION_INTENT_KEY = "LocalNotificationId";
    public static final String NOTIFICATION_OBJ_INTENT_KEY = "LocalNotficationObject";
    public static final String ACTION_INTENT_KEY = "LocalNotificationUserAction";
    public static final String NOTIFICATION_IS_REMOVABLE_KEY = "LocalNotificationRepeating";
    public static final String REMOTE_INPUT_KEY = "LocalNotificationRemoteInput";

    public static final String DEFAULT_NOTIFICATION_CHANNEL_ID = "default";
    private static final String DEFAULT_PRESS_ACTION = "tap";

    private Context context;
    private Activity activity;
    private NotificationStorage storage;
    private PluginConfig config;

    public LocalNotificationManager(NotificationStorage notificationStorage, Activity activity, Context context, CapConfig config) {
        storage = notificationStorage;
        this.activity = activity;
        this.context = context;
        this.config = config.getPluginConfiguration("LocalNotifications");
    }

    /**
     * Method extecuted when notification is launched by user from the notification bar.
     */
    public JSObject handleNotificationActionPerformed(Intent data, NotificationStorage notificationStorage) {
        synchronized (CustodialNativeNotificationWriter.class) {
        final CustodialNativeNotificationWriter.MutationScope nativeMutation;
        try { nativeMutation = CustodialNativeNotificationWriter.beginVendorMutation(); }
        catch (CustodialNativeNotificationWriter.BeforeEffectRefusal refused) {
            return null;
        }
        try (nativeMutation) {
            try {
        Logger.debug(Logger.tags("LN"), "LocalNotification received: " + data.getDataString());
        int notificationId = data.getIntExtra(LocalNotificationManager.NOTIFICATION_INTENT_KEY, Integer.MIN_VALUE);
        if (notificationId == Integer.MIN_VALUE) {
            Logger.debug(Logger.tags("LN"), "Activity started without notification attached");
            return null;
        }
        boolean isRemovable = data.getBooleanExtra(LocalNotificationManager.NOTIFICATION_IS_REMOVABLE_KEY, true);
        if (isRemovable) {
            notificationStorage.deleteNotification(Integer.toString(notificationId));
        }
        JSObject dataJson = new JSObject();

        Bundle results = RemoteInput.getResultsFromIntent(data);
        if (results != null) {
            CharSequence input = results.getCharSequence(LocalNotificationManager.REMOTE_INPUT_KEY);
            dataJson.put("inputValue", input.toString());
        }
        String menuAction = data.getStringExtra(LocalNotificationManager.ACTION_INTENT_KEY);

        dismissVisibleNotification(notificationId);

        dataJson.put("actionId", menuAction);
        JSONObject request = null;
        try {
            String notificationJsonString = data.getStringExtra(LocalNotificationManager.NOTIFICATION_OBJ_INTENT_KEY);
            if (notificationJsonString != null) {
                request = new JSObject(notificationJsonString);
            }
        } catch (JSONException e) {}
        dataJson.put("notification", request);
        return dataJson;

            } catch (RuntimeException | Error originalFailure) {
                nativeMutation.originalFailed();
                throw originalFailure;
            }
        }
}
    }

    /**
     * Create notification channel
     */
    public void createNotificationChannel() {
        synchronized (CustodialNativeNotificationWriter.class) {
        final CustodialNativeNotificationWriter.MutationScope nativeMutation;
        try { nativeMutation = CustodialNativeNotificationWriter.beginVendorMutation(); }
        catch (CustodialNativeNotificationWriter.BeforeEffectRefusal refused) {
            return;
        }
        try (nativeMutation) {
            try {
        // Create the NotificationChannel, but only on API 26+ because
        // the NotificationChannel class is new and not in the support library
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Default";
            String description = "Default";
            int importance = android.app.NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(DEFAULT_NOTIFICATION_CHANNEL_ID, name, importance);
            channel.setDescription(description);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            Uri soundUri = this.getDefaultSoundUrl(context);
            if (soundUri != null) {
                channel.setSound(soundUri, audioAttributes);
            }
            // Register the channel with the system; you can't change the importance
            // or other notification behaviors after this
            android.app.NotificationManager notificationManager = context.getSystemService(android.app.NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }

            } catch (RuntimeException | Error originalFailure) {
                nativeMutation.originalFailed();
                throw originalFailure;
            }
        }
}
    }

    @Nullable
    public JSONArray schedule(PluginCall call, List<LocalNotification> localNotifications) {
        synchronized (CustodialNativeNotificationWriter.class) {
        final CustodialNativeNotificationWriter.MutationScope nativeMutation;
        try { nativeMutation = CustodialNativeNotificationWriter.beginVendorMutation(); }
        catch (CustodialNativeNotificationWriter.BeforeEffectRefusal refused) {
            if (call != null) call.reject("custodial_native_recurring_journal_pending");
            return null;
        }
        try (nativeMutation) {
            try {
        JSONArray ids = new JSONArray();
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);

        boolean notificationsEnabled = notificationManager.areNotificationsEnabled();
        if (!notificationsEnabled) {
            if (call != null) {
                call.reject("Notifications not enabled on this device");
            }
            return null;
        }
        for (LocalNotification localNotification : localNotifications) {
            Integer id = localNotification.getId();
            if (localNotification.getId() == null) {
                if (call != null) {
                    call.reject("LocalNotification missing identifier");
                }
                return null;
            }
            dismissVisibleNotification(id);
            cancelTimerForNotification(id);
            try {
                buildNotification(notificationManager, localNotification, call);
            } catch (CustodialNativeNotificationWriter.BeforeEffectRefusal refused) {
                // Earlier rows/attempts are retained. No retry, rollback or
                // success is inferred for this original operation.
                if (call != null) call.reject("custodial_native_recurring_journal_pending");
                return null;
            }
            ids.put(id);
        }
        return ids;

            } catch (RuntimeException | Error originalFailure) {
                nativeMutation.originalFailed();
                throw originalFailure;
            }
        }
}
    }

    // TODO Progressbar support
    // TODO System categories (DO_NOT_DISTURB etc.)
    // TODO control visibility by flag Notification.VISIBILITY_PRIVATE
    // TODO Group notifications (setGroup, setGroupSummary, setNumber)
    // TODO use NotificationCompat.MessagingStyle for latest API
    // TODO expandable notification NotificationCompat.MessagingStyle
    // TODO media style notification support NotificationCompat.MediaStyle
    // TODO custom small/large icons
    private void buildNotification(NotificationManagerCompat notificationManager, LocalNotification localNotification, PluginCall call) {
        String channelId = DEFAULT_NOTIFICATION_CHANNEL_ID;
        if (localNotification.getChannelId() != null) {
            channelId = localNotification.getChannelId();
        }
        NotificationCompat.Builder mBuilder = new NotificationCompat.Builder(this.context, channelId)
            .setContentTitle(localNotification.getTitle())
            .setContentText(localNotification.getBody())
            .setAutoCancel(localNotification.isAutoCancel())
            .setOngoing(localNotification.isOngoing())
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setGroupSummary(localNotification.isGroupSummary());

        if (localNotification.getLargeBody() != null) {
            // support multiline text
            mBuilder.setStyle(
                new NotificationCompat.BigTextStyle()
                    .bigText(localNotification.getLargeBody())
                    .setSummaryText(localNotification.getSummaryText())
            );
        }

        if (localNotification.getInboxList() != null) {
            NotificationCompat.InboxStyle inboxStyle = new NotificationCompat.InboxStyle();
            for (String line : localNotification.getInboxList()) {
                inboxStyle.addLine(line);
            }
            inboxStyle.setBigContentTitle(localNotification.getTitle());
            inboxStyle.setSummaryText(localNotification.getSummaryText());
            mBuilder.setStyle(inboxStyle);
        }

        String sound = localNotification.getSound(context, getDefaultSound(context));
        if (sound != null) {
            Uri soundUri = Uri.parse(sound);
            // Grant permission to use sound
            context.grantUriPermission("com.android.systemui", soundUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            mBuilder.setSound(soundUri);
            mBuilder.setDefaults(Notification.DEFAULT_VIBRATE | Notification.DEFAULT_LIGHTS);
        } else {
            mBuilder.setDefaults(Notification.DEFAULT_ALL);
        }

        String group = localNotification.getGroup();
        if (group != null) {
            mBuilder.setGroup(group);
            if (localNotification.isGroupSummary()) {
                mBuilder.setSubText(localNotification.getSummaryText());
            }
        }

        mBuilder.setVisibility(NotificationCompat.VISIBILITY_PRIVATE);
        mBuilder.setOnlyAlertOnce(true);

        mBuilder.setSmallIcon(localNotification.getSmallIcon(context, getDefaultSmallIcon(context)));
        mBuilder.setLargeIcon(localNotification.getLargeIcon(context));

        String iconColor = localNotification.getIconColor(config.getString("iconColor"));
        if (iconColor != null) {
            try {
                mBuilder.setColor(Color.parseColor(iconColor));
            } catch (IllegalArgumentException ex) {
                if (call != null) {
                    call.reject("Invalid color provided. Must be a hex string (ex: #ff0000");
                }
                return;
            }
        }

        createActionIntents(localNotification, mBuilder);
        // notificationId is a unique int for each localNotification that you must define
        Notification buildNotification = mBuilder.build();
        if (localNotification.isScheduled()) {
            triggerScheduledNotification(buildNotification, localNotification);
        } else {
            if (!CustodialNativeNotificationWriter.beforeDispatch(context, localNotification.custodialNativeGeneration,
                localNotification.getId(), localNotification.getGroup())) return;
            try {
                JSObject notificationJson = new JSObject(localNotification.getSource());
                LocalNotificationsPlugin.fireReceived(notificationJson);
            } catch (JSONException e) {}
            CustodialNativeNotificationWriter.SemanticCall semanticNotify = CustodialNativeNotificationWriter.semanticBeforeNotify(
                context, localNotification.custodialNativeGeneration, localNotification.getId(), buildNotification);
            CustodialNativeNotificationWriter.requireDispatchCurrent(context, localNotification.custodialNativeGeneration,
                localNotification.getId(), localNotification.getGroup());
            notificationManager.notify(localNotification.getId(), buildNotification);
            CustodialNativeNotificationWriter.semanticReturned(semanticNotify);
            CustodialNativeNotificationWriter.dispatchCalled(context, localNotification.custodialNativeGeneration);
        }
    }

    // Create intents for open/dissmis actions
    private void createActionIntents(LocalNotification localNotification, NotificationCompat.Builder mBuilder) {
        // Open intent
        Intent intent = buildIntent(localNotification, DEFAULT_PRESS_ACTION);
        int flags = PendingIntent.FLAG_CANCEL_CURRENT;
        if (android.os.Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags = flags | PendingIntent.FLAG_MUTABLE;
        }
        int semanticContentId = localNotification.getId();
        CustodialNativeNotificationWriter.SemanticIntent semanticContentFactory = CustodialNativeNotificationWriter.semanticActivityIntentStarting(
            context, localNotification.custodialNativeGeneration, semanticContentId, intent, semanticContentId, flags);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, semanticContentId, intent, flags);
        CustodialNativeNotificationWriter.semanticIntentReturned(semanticContentFactory, pendingIntent);
        mBuilder.setContentIntent(pendingIntent);

        // Build action types
        String actionTypeId = localNotification.getActionTypeId();
        if (actionTypeId != null) {
            NotificationAction[] actionGroup = storage.getActionGroup(actionTypeId);
            for (NotificationAction notificationAction : actionGroup) {
                // TODO Add custom icons to actions
                Intent actionIntent = buildIntent(localNotification, notificationAction.getId());
                int semanticActionId = localNotification.getId();
                int semanticActionRequestCode = semanticActionId + notificationAction.getId().hashCode();
                CustodialNativeNotificationWriter.SemanticIntent semanticActionFactory = CustodialNativeNotificationWriter.semanticActivityIntentStarting(
                    context, localNotification.custodialNativeGeneration, semanticActionId, actionIntent, semanticActionRequestCode, flags);
                PendingIntent actionPendingIntent = PendingIntent.getActivity(
                    context,
                    semanticActionRequestCode,
                    actionIntent,
                    flags
                );
                CustodialNativeNotificationWriter.semanticIntentReturned(semanticActionFactory, actionPendingIntent);
                NotificationCompat.Action.Builder actionBuilder = new NotificationCompat.Action.Builder(
                    R.drawable.ic_transparent,
                    notificationAction.getTitle(),
                    actionPendingIntent
                );
                if (notificationAction.isInput()) {
                    RemoteInput remoteInput = new RemoteInput.Builder(REMOTE_INPUT_KEY).setLabel(notificationAction.getTitle()).build();
                    actionBuilder.addRemoteInput(remoteInput);
                }
                mBuilder.addAction(actionBuilder.build());
            }
        }

        // Dismiss intent
        Intent dissmissIntent = new Intent(context, NotificationDismissReceiver.class);
        dissmissIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        dissmissIntent.putExtra(NOTIFICATION_INTENT_KEY, localNotification.getId());
        dissmissIntent.putExtra(ACTION_INTENT_KEY, "dismiss");
        LocalNotificationSchedule schedule = localNotification.getSchedule();
        dissmissIntent.putExtra(NOTIFICATION_IS_REMOVABLE_KEY, schedule == null || schedule.isRemovable());
        flags = 0;
        if (android.os.Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags = PendingIntent.FLAG_MUTABLE;
        }
        int semanticDeleteId = localNotification.getId();
        CustodialNativeNotificationWriter.SemanticIntent semanticDeleteFactory = CustodialNativeNotificationWriter.semanticDeleteIntentStarting(
            context, localNotification.custodialNativeGeneration, semanticDeleteId, dissmissIntent, semanticDeleteId, flags);
        PendingIntent deleteIntent = PendingIntent.getBroadcast(context, semanticDeleteId, dissmissIntent, flags);
        CustodialNativeNotificationWriter.semanticIntentReturned(semanticDeleteFactory, deleteIntent);
        mBuilder.setDeleteIntent(deleteIntent);
    }

    @NonNull
    private Intent buildIntent(LocalNotification localNotification, String action) {
        Intent intent;
        if (activity != null) {
            intent = new Intent(context, activity.getClass());
        } else {
            String packageName = context.getPackageName();
            intent = context.getPackageManager().getLaunchIntentForPackage(packageName);
        }
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(NOTIFICATION_INTENT_KEY, localNotification.getId());
        intent.putExtra(ACTION_INTENT_KEY, action);
        intent.putExtra(NOTIFICATION_OBJ_INTENT_KEY, localNotification.getSource());
        LocalNotificationSchedule schedule = localNotification.getSchedule();
        intent.putExtra(NOTIFICATION_IS_REMOVABLE_KEY, schedule == null || schedule.isRemovable());
        return intent;
    }

    /**
     * Build a notification trigger, such as triggering each N seconds, or
     * on a certain date "shape" (such as every first of the month)
     */
    // TODO support different AlarmManager.RTC modes depending on priority
    private void triggerScheduledNotification(Notification notification, LocalNotification request) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        LocalNotificationSchedule schedule = request.getSchedule();
        if (request.custodialNativeRestore) {
            Date originalAt = schedule == null ? null : schedule.getAt();
            CustodialNativeNotificationWriter.requireRestoreCurrent(context, request.custodialNativeGeneration,
                request.getId(), request.getSource(), originalAt == null ? Long.MIN_VALUE : originalAt.getTime());
        }
        Intent notificationIntent = new Intent(context, TimedNotificationPublisher.class);
        notificationIntent.putExtra(NOTIFICATION_INTENT_KEY, request.getId());
        if (request.custodialNativeGeneration != null) {
            notificationIntent.putExtra(CustodialNativeNotificationWriter.GENERATION_EXTRA, request.custodialNativeGeneration);
        }
        notificationIntent.putExtra(TimedNotificationPublisher.NOTIFICATION_KEY, notification);
        int flags = PendingIntent.FLAG_CANCEL_CURRENT;
        if (android.os.Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags = flags | PendingIntent.FLAG_MUTABLE;
        }
        int semanticAlarmId = request.getId();
        CustodialNativeNotificationWriter.SemanticIntent semanticAlarmFactory = CustodialNativeNotificationWriter.semanticAlarmIntentStarting(
            context, request.custodialNativeGeneration, semanticAlarmId, notificationIntent, semanticAlarmId, flags);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, semanticAlarmId, notificationIntent, flags);
        CustodialNativeNotificationWriter.semanticIntentReturned(semanticAlarmFactory, pendingIntent);

        // Schedule at specific time (with repeating support)
        Date at = schedule.getAt();
        if (at != null) {
            if (at.getTime() < new Date().getTime()) {
                if (request.custodialNativeRestore) throw new IllegalStateException("Known original restore deadline expired; original attempt remains unknown");
                Logger.error(Logger.tags("LN"), "Scheduled time must be *after* current time", null);
                return;
            }
            if (schedule.isRepeating()) {
                long interval = at.getTime() - new Date().getTime();
                alarmManager.setRepeating(AlarmManager.RTC, at.getTime(), interval, pendingIntent);
            } else {
                setExactIfPossible(alarmManager, schedule, at.getTime(), pendingIntent, request, notification, flags);
            }
            return;
        }

        // Schedule at specific intervals
        String every = schedule.getEvery();
        if (every != null) {
            Long everyInterval = schedule.getEveryInterval();
            if (everyInterval != null) {
                long startTime = new Date().getTime() + everyInterval;
                alarmManager.setRepeating(AlarmManager.RTC, startTime, everyInterval, pendingIntent);
            }
            return;
        }

        // Cron like scheduler
        DateMatch on = schedule.getOn();
        if (on != null) {
            long trigger = on.nextTrigger(new Date());
            notificationIntent.putExtra(TimedNotificationPublisher.CRON_KEY, on.toMatchString());
            pendingIntent = PendingIntent.getBroadcast(context, request.getId(), notificationIntent, flags);
            setExactIfPossible(alarmManager, schedule, trigger, pendingIntent, request, notification, flags);
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
            Logger.debug(Logger.tags("LN"), "notification " + request.getId() + " will next fire at " + sdf.format(new Date(trigger)));
        }
    }

    private void setExactIfPossible(
        AlarmManager alarmManager,
        LocalNotificationSchedule schedule,
        long trigger,
        PendingIntent pendingIntent,
        LocalNotification original,
        Notification semanticNotification,
        int semanticPendingIntentFlags
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            Logger.warn(
                "Capacitor/LocalNotification",
                "Exact alarms not allowed in user settings.  Notification scheduled with non-exact alarm."
            );
            if (schedule.allowWhileIdle()) {
                CustodialNativeNotificationWriter.SemanticCall semanticAlarm = CustodialNativeNotificationWriter.semanticBeforeAlarmSetIdle(
                    context, original.custodialNativeGeneration, original.getId(), semanticNotification, pendingIntent, trigger, semanticPendingIntentFlags);
                if (original.custodialNativeRestore) CustodialNativeNotificationWriter.requireRestoreCurrent(context,
                    original.custodialNativeGeneration, original.getId(), original.getSource(), trigger);
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent);
                CustodialNativeNotificationWriter.semanticReturned(semanticAlarm);
            } else {
                CustodialNativeNotificationWriter.SemanticCall semanticAlarm = CustodialNativeNotificationWriter.semanticBeforeAlarmSet(
                    context, original.custodialNativeGeneration, original.getId(), semanticNotification, pendingIntent, trigger, semanticPendingIntentFlags);
                if (original.custodialNativeRestore) CustodialNativeNotificationWriter.requireRestoreCurrent(context,
                    original.custodialNativeGeneration, original.getId(), original.getSource(), trigger);
                alarmManager.set(AlarmManager.RTC, trigger, pendingIntent);
                CustodialNativeNotificationWriter.semanticReturned(semanticAlarm);
            }
        } else {
            if (schedule.allowWhileIdle()) {
                CustodialNativeNotificationWriter.SemanticCall semanticAlarm = CustodialNativeNotificationWriter.semanticBeforeAlarmExactIdle(
                    context, original.custodialNativeGeneration, original.getId(), semanticNotification, pendingIntent, trigger, semanticPendingIntentFlags);
                if (original.custodialNativeRestore) CustodialNativeNotificationWriter.requireRestoreCurrent(context,
                    original.custodialNativeGeneration, original.getId(), original.getSource(), trigger);
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent);
                CustodialNativeNotificationWriter.semanticReturned(semanticAlarm);
            } else {
                CustodialNativeNotificationWriter.SemanticCall semanticAlarm = CustodialNativeNotificationWriter.semanticBeforeAlarmExact(
                    context, original.custodialNativeGeneration, original.getId(), semanticNotification, pendingIntent, trigger, semanticPendingIntentFlags);
                if (original.custodialNativeRestore) CustodialNativeNotificationWriter.requireRestoreCurrent(context,
                    original.custodialNativeGeneration, original.getId(), original.getSource(), trigger);
                alarmManager.setExact(AlarmManager.RTC, trigger, pendingIntent);
                CustodialNativeNotificationWriter.semanticReturned(semanticAlarm);
            }
        }
    }

    public void cancel(PluginCall call) {
        synchronized (CustodialNativeNotificationWriter.class) {
        final CustodialNativeNotificationWriter.MutationScope nativeMutation;
        try { nativeMutation = CustodialNativeNotificationWriter.beginVendorMutation(); }
        catch (CustodialNativeNotificationWriter.BeforeEffectRefusal refused) {
            if (call != null) call.reject("custodial_native_recurring_journal_pending");
            return;
        }
        try (nativeMutation) {
            try {
        List<Integer> notificationsToCancel = LocalNotification.getLocalNotificationPendingList(call);
        if (notificationsToCancel != null) {
            for (Integer id : notificationsToCancel) {
                final String generation;
                try {
                    generation = CustodialNativeNotificationWriter.beforeCancel(context, id);
                } catch (CustodialNativeNotificationWriter.BeforeEffectRefusal refused) {
                    call.reject("custodial_native_recurring_journal_pending");
                    return;
                }
                dismissVisibleNotification(id);
                cancelTimerForNotification(id);
                storage.deleteNotification(Integer.toString(id));
                CustodialNativeNotificationWriter.cancelCalled(context, generation);
                CustodialNativeNotificationWriter.semanticTerminal(context, generation);
            }
        }
        call.resolve();

            } catch (RuntimeException | Error originalFailure) {
                nativeMutation.originalFailed();
                throw originalFailure;
            }
        }
}
    }

    private void cancelTimerForNotification(Integer notificationId) {
        Intent intent = new Intent(context, TimedNotificationPublisher.class);
        int flags = 0;
        if (android.os.Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags = PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(context, notificationId, intent, flags);
        if (pi != null) {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            CustodialNativeNotificationWriter.SemanticCall semanticCancel = CustodialNativeNotificationWriter.semanticBeforeAlarmCancel(context, notificationId, pi, flags);
            alarmManager.cancel(pi);
            CustodialNativeNotificationWriter.semanticReturned(semanticCancel);
        }
    }

    private void dismissVisibleNotification(int notificationId) {
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this.context);
        CustodialNativeNotificationWriter.SemanticCall semanticCancel = CustodialNativeNotificationWriter.semanticBeforeNotificationCancel(context, notificationId);
        notificationManager.cancel(notificationId);
        CustodialNativeNotificationWriter.semanticReturned(semanticCancel);
    }

    public boolean areNotificationsEnabled() {
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        return notificationManager.areNotificationsEnabled();
    }

    public Uri getDefaultSoundUrl(Context context) {
        int soundId = this.getDefaultSound(context);
        if (soundId != AssetUtil.RESOURCE_ID_ZERO_VALUE) {
            return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/" + soundId);
        }
        return null;
    }

    private int getDefaultSound(Context context) {
        if (defaultSoundID != AssetUtil.RESOURCE_ID_ZERO_VALUE) return defaultSoundID;

        int resId = AssetUtil.RESOURCE_ID_ZERO_VALUE;
        String soundConfigResourceName = config.getString("sound");
        soundConfigResourceName = AssetUtil.getResourceBaseName(soundConfigResourceName);

        if (soundConfigResourceName != null) {
            resId = AssetUtil.getResourceID(context, soundConfigResourceName, "raw");
        }

        defaultSoundID = resId;
        return resId;
    }

    private int getDefaultSmallIcon(Context context) {
        if (defaultSmallIconID != AssetUtil.RESOURCE_ID_ZERO_VALUE) return defaultSmallIconID;

        int resId = AssetUtil.RESOURCE_ID_ZERO_VALUE;
        String smallIconConfigResourceName = config.getString("smallIcon");
        smallIconConfigResourceName = AssetUtil.getResourceBaseName(smallIconConfigResourceName);

        if (smallIconConfigResourceName != null) {
            resId = AssetUtil.getResourceID(context, smallIconConfigResourceName, "drawable");
        }

        if (resId == AssetUtil.RESOURCE_ID_ZERO_VALUE) {
            resId = android.R.drawable.ic_dialog_info;
        }

        defaultSmallIconID = resId;
        return resId;
    }
}

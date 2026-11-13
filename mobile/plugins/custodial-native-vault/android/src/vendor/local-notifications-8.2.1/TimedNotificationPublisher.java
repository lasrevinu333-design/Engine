package com.capacitorjs.plugins.localnotifications;

import org.memphiszoo.custodial.vault.CustodialNativeNotificationWriter;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Class used to create notification from timer event
 * Note: Class is being registered in Android manifest as broadcast receiver
 */
public class TimedNotificationPublisher extends BroadcastReceiver {

    public static String NOTIFICATION_KEY = "NotificationPublisher.notification";
    public static String CRON_KEY = "NotificationPublisher.cron";

    /**
     * Restore and present notification
     */
    @Override
    public void onReceive(Context context, Intent intent) {
        synchronized (CustodialNativeNotificationWriter.class) {
        final CustodialNativeNotificationWriter.MutationScope nativeMutation;
        try { nativeMutation = CustodialNativeNotificationWriter.beginVendorMutation(); }
        catch (CustodialNativeNotificationWriter.BeforeEffectRefusal refused) {
            return;
        }
        try (nativeMutation) {
            try {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        Notification notification;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notification = intent.getParcelableExtra(NOTIFICATION_KEY, Notification.class);
        } else {
            notification = getParcelableExtraLegacy(intent, NOTIFICATION_KEY);
        }

        notification.when = System.currentTimeMillis();

        int id = intent.getIntExtra(LocalNotificationManager.NOTIFICATION_INTENT_KEY, Integer.MIN_VALUE);
        if (id == Integer.MIN_VALUE) {
            Logger.error(Logger.tags("LN"), "No valid id supplied", null);
        }
        String generation = intent.getStringExtra(CustodialNativeNotificationWriter.GENERATION_EXTRA);
        if (generation != null && intent.hasExtra(CRON_KEY)) {
            throw new IllegalStateException("Original native one-shot notification generation has an unexpected repeat");
        }
        try {
            if (!CustodialNativeNotificationWriter.beforeDispatch(context, generation, id, notification.getGroup())) return;
        } catch (CustodialNativeNotificationWriter.BeforeEffectRefusal refused) {
            return;
        }
        NotificationStorage storage = new NotificationStorage(context);
        JSObject notificationJson = storage.getSavedNotificationAsJSObject(Integer.toString(id));
        LocalNotificationsPlugin.fireReceived(notificationJson);
        CustodialNativeNotificationWriter.SemanticCall semanticNotify = CustodialNativeNotificationWriter.semanticBeforeNotify(context, generation, id, notification);
        try {
            CustodialNativeNotificationWriter.requireDispatchCurrent(context, generation, id, notification.getGroup());
        } catch (CustodialNativeNotificationWriter.BeforeEffectRefusal refused) {
            return;
        }
        notificationManager.notify(id, notification);
        CustodialNativeNotificationWriter.semanticReturned(semanticNotify);
        CustodialNativeNotificationWriter.dispatchCalled(context, generation);
        if (!rescheduleNotificationIfNeeded(context, intent, id)) {
            storage.deleteNotification(Integer.toString(id));
        }
        CustodialNativeNotificationWriter.semanticTerminal(context, generation);

            } catch (RuntimeException | Error originalFailure) {
                nativeMutation.originalFailed();
                throw originalFailure;
            }
        }
}
    }

    @SuppressWarnings("deprecation")
    private Notification getParcelableExtraLegacy(Intent intent, String string) {
        return intent.getParcelableExtra(NOTIFICATION_KEY);
    }

    private boolean rescheduleNotificationIfNeeded(Context context, Intent intent, int id) {
        String dateString = intent.getStringExtra(CRON_KEY);

        if (dateString != null) {
            DateMatch date = DateMatch.fromMatchString(dateString);
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            long trigger = date.nextTrigger(new Date());
            Intent clone = (Intent) intent.clone();
            int flags = PendingIntent.FLAG_CANCEL_CURRENT;
            if (android.os.Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags = flags | PendingIntent.FLAG_MUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, id, clone, flags);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                Logger.warn(
                    "Capacitor/LocalNotification",
                    "Exact alarms not allowed in user settings.  Notification scheduled with non-exact alarm."
                );
                alarmManager.set(AlarmManager.RTC, trigger, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC, trigger, pendingIntent);
            }
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
            Logger.debug(Logger.tags("LN"), "notification " + id + " will next fire at " + sdf.format(new Date(trigger)));
            return true;
        }

        return false;
    }
}

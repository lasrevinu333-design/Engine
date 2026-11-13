package com.capacitorjs.plugins.localnotifications;

import org.memphiszoo.custodial.vault.CustodialNativeNotificationWriter;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.UserManager;
import com.getcapacitor.CapConfig;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public class LocalNotificationRestoreReceiver extends BroadcastReceiver {

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
        UserManager um = context.getSystemService(UserManager.class);
        if (um == null || !um.isUserUnlocked()) return;

        NotificationStorage storage = new NotificationStorage(context);
        List<String> ids = storage.getSavedNotificationIds();

        ArrayList<LocalNotification> notifications = new ArrayList<>(ids.size());
        ArrayList<LocalNotification> updatedNotifications = new ArrayList<>();
        for (String id : ids) {
            // Known native originals are checked BEFORE vendor parse/skip or
            // its ordinary past-time retiming branch can erase provenance.
            try {
                CustodialNativeNotificationWriter.requireRestoreCandidate(context, id);
            } catch (CustodialNativeNotificationWriter.BeforeEffectRefusal refused) {
                return;
            }
            LocalNotification notification = storage.getSavedNotification(id);
            if (notification == null) {
                continue;
            }

            LocalNotificationSchedule schedule = notification.getSchedule();
            if (notification.getId() != null) {
                Date originalAt = schedule == null ? null : schedule.getAt();
                try {
                    notification.custodialNativeGeneration = CustodialNativeNotificationWriter.beforeRestore(
                        context, notification.getId(), notification.getSource(), originalAt == null ? Long.MIN_VALUE : originalAt.getTime());
                } catch (CustodialNativeNotificationWriter.BeforeEffectRefusal refused) {
                    return;
                }
                notification.custodialNativeRestore = notification.custodialNativeGeneration != null;
            }
            if (schedule != null) {
                Date at = schedule.getAt();
                if (at != null && at.before(new Date())) {
                    // modify the scheduled date in order to show notifications that would have been delivered while device was off.
                    long newDateTime = new Date().getTime() + 15 * 1000;
                    schedule.setAt(new Date(newDateTime));
                    notification.setSchedule(schedule);
                    updatedNotifications.add(notification);
                }
            }

            notifications.add(notification);
        }

        if (updatedNotifications.size() > 0) {
            storage.appendNotifications(updatedNotifications);
        }

        CapConfig config = CapConfig.loadDefault(context);
        LocalNotificationManager localNotificationManager = new LocalNotificationManager(storage, null, context, config);

        org.json.JSONArray restored = localNotificationManager.schedule(null, notifications);
        if (restored != null) {
            for (LocalNotification notification : notifications) {
                if (notification.custodialNativeRestore) {
                    CustodialNativeNotificationWriter.restoreCalled(context, notification.custodialNativeGeneration);
                    CustodialNativeNotificationWriter.semanticTerminal(context, notification.custodialNativeGeneration);
                }
            }
        }

            } catch (RuntimeException | Error originalFailure) {
                nativeMutation.originalFailed();
                throw originalFailure;
            }
        }
}
    }
}

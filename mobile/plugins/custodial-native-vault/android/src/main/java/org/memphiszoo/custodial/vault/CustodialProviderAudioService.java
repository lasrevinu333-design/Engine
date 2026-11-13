package org.memphiszoo.custodial.vault;
import android.app.Service;import android.app.Notification;import android.app.NotificationChannel;import android.app.NotificationManager;
import android.content.Intent;import android.content.pm.ServiceInfo;import android.os.IBinder;import java.util.HashMap;import java.util.Map;

/** Private non-exported finite media host. Intents contain no alert/token/body.
 * A same-process reserved opaque capability is required before promotion. */
public final class CustodialProviderAudioService extends Service {
    private static final Map<String,AndroidProviderAudioSurface> OWNED=new HashMap<>();
    private static long ordinaryReservationRevision;private static boolean ordinaryReservationUnknown;
    static final class OrdinaryIdleRead {
        private final long revision;
        private OrdinaryIdleRead(long revision){this.revision=revision;}
        void requireCurrent()throws VaultFailure {synchronized(CustodialProviderAudioService.class){
            if(ordinaryReservationUnknown||ordinaryReservationRevision!=revision||!OWNED.isEmpty())
                throw new VaultFailure("custodial_recurring_native_audio_not_idle");
        }}
    }
    static synchronized OrdinaryIdleRead captureOrdinaryIdle()throws VaultFailure {
        if(ordinaryReservationUnknown||!OWNED.isEmpty())throw new VaultFailure("custodial_recurring_native_audio_not_idle");
        return new OrdinaryIdleRead(ordinaryReservationRevision);
    }
    private static void ordinaryReservationEntered(){if(ordinaryReservationRevision==Long.MAX_VALUE)ordinaryReservationUnknown=true;else ordinaryReservationRevision++;}

    private static final String CHANNEL="custodial-native-audio-service";private static final int ID=0x4d5a5003;
    private String operation;private AndroidProviderAudioSurface surface;
    static synchronized void reserve(String id,AndroidProviderAudioSurface value){ordinaryReservationEntered();if(!OWNED.isEmpty()||!id.matches("[a-f0-9-]{36}"))throw new IllegalStateException("audio_service_already_owned");OWNED.put(id,value);}
    static synchronized void release(String id,AndroidProviderAudioSurface value){if(OWNED.get(id)==value){ordinaryReservationEntered();OWNED.remove(id);}}
    private static synchronized AndroidProviderAudioSurface take(String id){return OWNED.get(id);}
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        android.net.Uri uri=intent==null?null:intent.getData();String id=uri==null?null:uri.getLastPathSegment();
        if(uri==null||!"mz-custodial-audio".equals(uri.getScheme())||!"owned".equals(uri.getAuthority())||uri.getPathSegments().size()!=1
            ||uri.getQuery()!=null||uri.getFragment()!=null||id==null){stopSelf(startId);return START_NOT_STICKY;}
        AndroidProviderAudioSurface candidate=take(id);
        if(candidate==null||(surface!=null&&(surface!=candidate||!id.equals(operation)))){stopSelf(startId);return START_NOT_STICKY;}
        // Bind the exact reserved host before its synchronous lifecycle claim.
        // Even a stopping/rejected host must retain this association until its
        // actual onDestroy; prospective invalid starts never overwrite it.
        surface=candidate;operation=id;
        if(!candidate.acceptServiceHost(id,this)){stopSelf(startId);return START_NOT_STICKY;}
        try{NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
            NotificationChannel channel=new NotificationChannel(CHANNEL,"Custodial audio processing",NotificationManager.IMPORTANCE_LOW);channel.setSound(null,null);channel.enableVibration(false);manager.createNotificationChannel(channel);
            Notification notice=new Notification.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("Custodial alerts")
                .setContentText("Processing an approved notification").setOngoing(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PRIVATE).build();
            startForeground(ID,notice,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);surface.promoted(id,this);
        }catch(Exception denied){surface.promotionFailed(id,this);stopSelf(startId);}return START_NOT_STICKY;
    }
    @Override public void onDestroy(){AndroidProviderAudioSurface old=surface;String id=operation;surface=null;operation=null;if(old!=null)old.destroyed(id,this);super.onDestroy();}
}

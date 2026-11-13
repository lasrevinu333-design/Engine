package org.memphiszoo.custodial.vault;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeFormatterBuilder;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** Private latest-position channel. No session, scan, geofence or queue mutation.
 * Started only from a visible Activity with already-granted location permission.
 * Memory holds one latest sample; offline gaps never become invented history.
 * Android foreground notification remains visible while collection runs. */
public final class CustodialPhoneLocationService extends Service {
    static final String PATH="/scan-api/phone-position";
    private static final String CHANNEL="custodial-phone-location";
    private static final int ID=0x4d5a5004;
    private final Object lock=new Object();
    private volatile Stream stream;

    private static final class Stream {
        final CustodialNativeRuntime runtime;
        final NativeProviderPrincipal owner;
        final JSONObject identity;
        int startId;
        boolean closed;
        LocationManager locations;
        LocationListener listener;
        ScheduledExecutorService sender;
        Location latest;
        String sampleId;
        long delivered=-1;
        Stream(CustodialNativeRuntime runtime,NativeProviderPrincipal owner,int startId)throws VaultFailure{
            this.runtime=runtime;this.owner=owner;this.identity=owner.json();this.startId=startId;
        }
    }

    static void startFromVisible(Activity activity) {
        if(activity==null||activity.isFinishing()||activity.isDestroyed()
            ||Looper.myLooper()!=Looper.getMainLooper()||!activity.hasWindowFocus())return;
        if(activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED
            &&activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED)return;
        try{activity.startForegroundService(new Intent(activity,CustodialPhoneLocationService.class));}
        catch(RuntimeException refused){/* No permission/settings bypass or background restart loop. */}
    }

    @Override public IBinder onBind(Intent intent){return null;}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        Stream next=null;
        try{
            NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
            NotificationChannel channel=new NotificationChannel(CHANNEL,"Assigned phone location",NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null,null);channel.enableVibration(false);manager.createNotificationChannel(channel);
            Notification notice=new Notification.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("Custodial phone location")
                .setContentText("Sharing this assigned phone's location with Custodial managers")
                .setVisibility(Notification.VISIBILITY_PRIVATE).setOngoing(true).setOnlyAlertOnce(true).build();
            if(Build.VERSION.SDK_INT>=29)startForeground(ID,notice,ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(ID,notice);
            CustodialNativeRuntime runtime=CustodialNativeRuntime.get(this);
            NativeProviderPrincipal owner=runtime.readProviderPrincipal();
            if(owner==null)throw new IllegalStateException("assigned_phone_principal_unavailable");
            Stream previous;
            synchronized(lock){
                previous=stream;
                if(previous!=null&&!previous.closed&&previous.owner.same(owner)){
                    previous.startId=startId;return START_NOT_STICKY;
                }
                stream=null;
            }
            closeStream(previous);
            next=new Stream(runtime,owner,startId);
            final Stream owned=next;
            synchronized(lock){stream=owned;}
            owned.locations=(LocationManager)getSystemService(LOCATION_SERVICE);
            owned.listener=new LocationListener(){
                @Override public void onLocationChanged(Location position){acceptPosition(owned,position);}
                @Override public void onProviderDisabled(String provider){}
                @Override public void onProviderEnabled(String provider){}
                @Override public void onStatusChanged(String provider,int status,android.os.Bundle extras){}
            };
            boolean requested=false;
            for(String provider:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER}){
                if(!owned.locations.getAllProviders().contains(provider))continue;
                try{owned.locations.requestLocationUpdates(provider,30000,0,owned.listener,Looper.getMainLooper());requested=true;}
                catch(SecurityException unavailable){/* Approximate-only grant may refuse GPS. */}
            }
            if(!requested)throw new IllegalStateException("location_permission_unavailable");
            owned.sender=Executors.newSingleThreadScheduledExecutor();
            owned.sender.scheduleWithFixedDelay(()->sendLatest(owned),0,30,TimeUnit.SECONDS);
            return START_NOT_STICKY;
        }catch(Exception refused){
            if(next!=null)stopStream(next);
            else{
                Stream previous; synchronized(lock){previous=stream;stream=null;}
                closeStream(previous);stopSelf(startId);
            }
            return START_NOT_STICKY;
        }
    }

    private void acceptPosition(Stream owned,Location position){
        if(position==null||position.isFromMockProvider()||!position.hasAccuracy()
            ||!Double.isFinite(position.getLatitude())||!Double.isFinite(position.getLongitude())
            ||!Float.isFinite(position.getAccuracy())||position.getAccuracy()<=0
            ||Math.abs(position.getLatitude())>90||Math.abs(position.getLongitude())>180
            ||position.getTime()<=0||position.getTime()>System.currentTimeMillis()
            ||position.getElapsedRealtimeNanos()<=0)return;
        synchronized(lock){
            if(stream!=owned||owned.closed)return;
            if(owned.latest!=null&&position.getElapsedRealtimeNanos()<=owned.latest.getElapsedRealtimeNanos())return;
            owned.latest=new Location(position);owned.sampleId=UUID.randomUUID().toString();
        }
    }

    private boolean currentAuthority(Stream owned){
        synchronized(lock){if(stream!=owned||owned.closed)return false;}
        try{
            boolean permitted=checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
                ||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
            if(permitted&&owned.owner.same(owned.runtime.readProviderPrincipal())){
                synchronized(lock){return stream==owned&&!owned.closed;}
            }
        }catch(VaultFailure|RuntimeException unavailable){/* Unknown local authority cannot continue collection. */}
        stopStream(owned);return false;
    }

    private void sendLatest(Stream owned){
        if(!currentAuthority(owned))return;
        try{
            final Location sample;final String id;
            synchronized(lock){
                if(stream!=owned||owned.closed||owned.latest==null||owned.latest.getElapsedRealtimeNanos()==owned.delivered)return;
                sample=new Location(owned.latest);id=owned.sampleId;
            }
            JSONObject body=new JSONObject().put("schema","custodial.assigned-phone-location.v1")
                .put("employee_id",owned.identity.getString("employee_id")).put("assignment_epoch",owned.identity.getLong("assignment_epoch"))
                .put("sample_id",id).put("observed_at",new DateTimeFormatterBuilder().appendInstant(3).toFormatter().format(Instant.ofEpochMilli(sample.getTime())))
                .put("latitude",sample.getLatitude()).put("longitude",sample.getLongitude()).put("accuracy_m",sample.getAccuracy());
            if(!currentAuthority(owned))return;
            AuthorizedResponse result=owned.runtime.engine.authorizedRequest(owned.identity.getString("device_id"),
                new AuthorizedRequest(PATH,"POST",Map.of("Content-Type","application/json"),body.toString().getBytes(StandardCharsets.UTF_8)));
            if(result.status==401||result.status==403){stopStream(owned);return;}
            if(result.status>=200&&result.status<300){
                JSONObject reply=new JSONObject(new String(result.body,StandardCharsets.UTF_8));
                if(reply.optBoolean("ok")&&reply.optJSONObject("data")!=null
                    &&id.equals(reply.getJSONObject("data").optString("sample_id")))
                    synchronized(lock){if(stream==owned&&!owned.closed)owned.delivered=sample.getElapsedRealtimeNanos();}
            }
        }catch(Exception unavailable){/* Keep original capture timestamp; next fresh fix may supersede it. */}
    }

    private void closeStream(Stream owned){
        if(owned==null)return;
        synchronized(lock){owned.closed=true;owned.latest=null;owned.sampleId=null;}
        if(owned.locations!=null&&owned.listener!=null)try{owned.locations.removeUpdates(owned.listener);}catch(RuntimeException ignored){}
        if(owned.sender!=null)owned.sender.shutdownNow();
    }
    private void stopStream(Stream owned){
        final int startId;
        synchronized(lock){if(stream!=owned)return;stream=null;startId=owned.startId;}
        closeStream(owned);stopSelf(startId);
    }
    @Override public void onDestroy(){
        Stream previous;synchronized(lock){previous=stream;stream=null;}
        closeStream(previous);stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();
    }
}

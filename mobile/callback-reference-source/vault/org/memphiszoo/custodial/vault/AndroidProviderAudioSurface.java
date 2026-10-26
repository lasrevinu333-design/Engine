package org.memphiszoo.custodial.vault;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import java.io.InputStream;
import java.security.MessageDigest;

/** Actual SDK adapter. Every callback belongs to one private operation/utterance.
 * No global volume/voice/system setting, activity wake, download or audio bypass. */
final class AndroidProviderAudioSurface implements NativeProviderAudioSequence.Surface,NativeProviderAudioSequence.Scheduler {
    private final Context app;private final NativeProviderAudioPolicy policy;private final Handler main=new Handler(Looper.getMainLooper());
    private String operation,utterance;private Service service;private TextToSpeech tts;private MediaPlayer player;
    private AudioManager manager;private AudioFocusRequest focus;private boolean focused,stopping,speechPending;private int serial;
    private NativeProviderAudioSequence.Result prepared,toneResult,speechResult,quietResult,releasedResult;
    private boolean releasing,focusRequested,releaseConfirmed,serviceLaunchPending,serviceHostsUnknown,serviceInitialized;
    private final Service[] serviceHosts=new Service[4];private int serviceHostCount;
    AndroidProviderAudioSurface(Context context,NativeProviderAudioPolicy policy){if(context==null||policy==null)throw new IllegalArgumentException("provider_audio_policy_required");app=context.getApplicationContext();this.policy=policy;}
    public Object after(Runnable callback,long millis){main.postDelayed(callback,millis);return callback;}
    public void cancel(Object handle){if(handle instanceof Runnable)main.removeCallbacks((Runnable)handle);}
    public void prepare(String id,NativeProviderAudioSequence.Result callback){main.post(()->{
        if(operation!=null||!id.matches("[a-f0-9-]{36}")){callback.done(false);return;}
        operation=id;prepared=callback;stopping=false;
        try{
            // This supported route uses ONLY the app's existing exemption, not
            // Fully DPC or an assumed FCM priority. Never requests a new grant.
            PowerManager power=(PowerManager)app.getSystemService(Context.POWER_SERVICE);
            if(power==null||!power.isIgnoringBatteryOptimizations(app.getPackageName()))throw new IllegalStateException("existing_app_exemption_required");
            ServiceInfo info=app.getPackageManager().getServiceInfo(new ComponentName(app,CustodialProviderAudioService.class),0);
            if(info.exported||info.getForegroundServiceType()!=ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                ||app.checkSelfPermission("android.permission.FOREGROUND_SERVICE")!=PackageManager.PERMISSION_GRANTED
                ||app.checkSelfPermission("android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK")!=PackageManager.PERMISSION_GRANTED)throw new IllegalStateException("exact_audio_manifest_required");
            MessageDigest digest=MessageDigest.getInstance("SHA-256");int bytes=0;byte[] buffer=new byte[4096];
            try(InputStream in=app.getAssets().open(NativeProviderAudioPolicy.TONE_ASSET)){for(int n;(n=in.read(buffer))!=-1;){bytes+=n;if(bytes>1048576)throw new IllegalStateException("tone_budget");digest.update(buffer,0,n);}}
            StringBuilder actual=new StringBuilder();for(byte b:digest.digest())actual.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
            if(!actual.toString().equals(policy.toneSha256))throw new IllegalStateException("tone_identity");
            CustodialProviderAudioService.reserve(id,this);
            // A successful or ambiguous dispatch can have a live host before
            // its promotion runnable. Only the actual host lifecycle settles it.
            serviceLaunchPending=true;
            app.startForegroundService(new Intent(app,CustodialProviderAudioService.class).setData(new Uri.Builder().scheme("mz-custodial-audio").authority("owned").appendPath(id).build()));
        }catch(Exception denied){prepared=null;callback.done(false);}
    });}
    // Called synchronously by the actual main-thread Service lifecycle BEFORE
    // any promotion post, foreground API or readiness callback. A bounded host
    // ledger keeps late/secondary destruction from certifying another host.
    boolean acceptServiceHost(String id,Service host){
        if(Looper.myLooper()!=Looper.getMainLooper())throw new IllegalStateException("service_main_thread_required");
        if(!owns(id)||host==null)return false;
        if(!hasServiceHost(host)){
            int slot=-1;for(int i=0;i<serviceHosts.length;i++)if(serviceHosts[i]==null){slot=i;break;}
            if(slot<0){serviceHostsUnknown=true;return false;}
            serviceHosts[slot]=host;serviceHostCount++;
        }
        serviceLaunchPending=false;if(service==null&&!serviceInitialized)service=host;
        return service==host&&!stopping;
    }
    private boolean hasServiceHost(Service host){for(Service value:serviceHosts)if(value==host)return true;return false;}
    void promotionFailed(String id,Service host){
        if(Looper.myLooper()!=Looper.getMainLooper())throw new IllegalStateException("service_main_thread_required");
        if(owns(id)&&hasServiceHost(host))failPreparation(); // Failure is NOT destruction.
    }
    void promoted(String id,Service host){main.post(()->{
        if(!owns(id)||!hasServiceHost(host)){host.stopSelf();return;}
        if(stopping||service!=host){host.stopSelf();return;}if(serviceInitialized)return;serviceInitialized=true;
        try{tts=new TextToSpeech(app,status->main.post(()->initialized(id,status)),policy.engine);}
        catch(Exception unavailable){failPreparation();}
    });}
    private void initialized(String id,int status){
        if(!owns(id)||stopping)return;
        try{
            if(status!=TextToSpeech.SUCCESS||tts==null||!policy.engine.equals(tts.getDefaultEngine()))throw new IllegalStateException("engine_unavailable");
            Voice selected=null;for(Voice v:tts.getVoices())if(v.getName().equals(policy.voice))selected=v;
            if(selected==null||selected.isNetworkConnectionRequired()||!java.util.Locale.US.equals(selected.getLocale())
                ||tts.setVoice(selected)!=TextToSpeech.SUCCESS||tts.setSpeechRate(policy.rateMilli/1000f)!=TextToSpeech.SUCCESS)throw new IllegalStateException("accepted_local_voice_unavailable");
            if(tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){
                public void onStart(String u){}
                public void onDone(String u){main.post(()->speechFinished(id,u,true));}
                public void onError(String u){main.post(()->speechFinished(id,u,false));}
                public void onStop(String u,boolean interrupted){main.post(()->speechFinished(id,u,false));}
            })!=TextToSpeech.SUCCESS)throw new IllegalStateException("completion_listener_required");
            manager=(AudioManager)app.getSystemService(Context.AUDIO_SERVICE);
            AudioAttributes attributes=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
            focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE).setAudioAttributes(attributes).setWillPauseWhenDucked(true)
                .setOnAudioFocusChangeListener(change->{if(change!=AudioManager.AUDIOFOCUS_GAIN)main.post(()->focusLost(id));},main).build();
            // Set before the SDK call: a throw has an UNKNOWN focus outcome.
            // A normal refusal is known not to own a request and needs no abandon.
            if(manager!=null){focusRequested=true;int result=manager.requestAudioFocus(focus);
                focused=result==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
                if(result==AudioManager.AUDIOFOCUS_REQUEST_FAILED)focusRequested=false;}
            if(!focused)throw new IllegalStateException("actual_focus_required");
            NativeProviderAudioSequence.Result cb=prepared;prepared=null;if(cb!=null)cb.done(true);
        }catch(Exception denied){failPreparation();}
    }
    private void failPreparation(){NativeProviderAudioSequence.Result cb=prepared;prepared=null;if(cb!=null)cb.done(false);}
    private boolean owns(String id){return operation!=null&&operation.equals(id);}
    public void tone(String id,NativeProviderAudioSequence.Authority authority,NativeProviderAudioSequence.Result callback){main.post(()->{
        if(!owns(id)||stopping||!focused||player!=null||speechPending){callback.done(false);return;}
        try{MediaPlayer next=new MediaPlayer();player=next;toneResult=callback;
            next.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            try(AssetFileDescriptor asset=app.getAssets().openFd(NativeProviderAudioPolicy.TONE_ASSET)){next.setDataSource(asset.getFileDescriptor(),asset.getStartOffset(),asset.getLength());}
            next.setOnPreparedListener(ready->{try{authority.perform(()->{if(!owns(id)||stopping||!focused||player!=ready)throw new IllegalStateException("exact_effect_owner_required");ready.start();});}
                catch(Exception denied){finishTone(id,ready,false);}});
            next.setOnCompletionListener(done->finishTone(id,done,true));next.setOnErrorListener((failed,what,extra)->{finishTone(id,failed,false);return true;});next.prepareAsync();
        }catch(Exception error){finishTone(id,player,false);}
    });}
    // A failed SDK disposal retains the exact player for cleanup-only retry.
    // No missing reference may turn UNKNOWN disposal into quiet or release.
    private boolean disposePlayer(MediaPlayer actual){
        if(actual==null)return true;
        try{actual.release();if(player==actual)player=null;return true;}
        catch(Exception unknown){return false;}
    }
    private void finishTone(String id,MediaPlayer actual,boolean complete){if(!owns(id)||actual!=player)return;
        NativeProviderAudioSequence.Result cb=toneResult;toneResult=null;
        boolean disposed=disposePlayer(actual);if(cb!=null)cb.done(complete&&!stopping&&disposed);checkQuiet();}
    public void speak(String id,String fullText,NativeProviderAudioSequence.Authority authority,NativeProviderAudioSequence.Result callback){main.post(()->{
        if(!owns(id)||stopping||!focused||tts==null||player!=null||speechPending){callback.done(false);return;}
        utterance=id+":"+(++serial);speechPending=true;speechResult=callback;
        Bundle parameters=new Bundle();parameters.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM,AudioManager.STREAM_MUSIC);
        try{authority.perform(()->{if(!owns(id)||stopping||!focused)throw new IllegalStateException("exact_effect_owner_required");
            if(tts.speak(fullText,TextToSpeech.QUEUE_FLUSH,parameters,utterance)!=TextToSpeech.SUCCESS)throw new IllegalStateException("utterance_refused");});}
        catch(Exception denied){speechFinished(id,utterance,false);}
    });}
    private void speechFinished(String id,String u,boolean complete){if(!owns(id)||!speechPending||!u.equals(utterance))return;
        speechPending=false;utterance=null;NativeProviderAudioSequence.Result cb=speechResult;speechResult=null;if(cb!=null)cb.done(complete&&!stopping);checkQuiet();}
    private void focusLost(String id){if(!owns(id))return;focused=false;
        if(prepared!=null){failPreparation();return;}
        if(toneResult!=null)finishTone(id,player,false);else if(speechResult!=null){NativeProviderAudioSequence.Result cb=speechResult;speechResult=null;cb.done(false);}
    }
    public void stop(String id,NativeProviderAudioSequence.Result callback){main.post(()->{
        if(!owns(id)){callback.done(true);return;}stopping=true;quietResult=callback;prepared=null;
        toneResult=null;boolean playerDisposed=disposePlayer(player),speechStopped=true;
        // Independent speech cleanup still runs when player disposal is unknown.
        try{if(tts!=null&&speechPending&&tts.stop()!=TextToSpeech.SUCCESS)speechStopped=false;}
        catch(Exception unknown){speechStopped=false;}
        if(!playerDisposed||!speechStopped){NativeProviderAudioSequence.Result cb=quietResult;quietResult=null;if(cb!=null)cb.done(false);return;}checkQuiet();
    });}
    private void checkQuiet(){if(quietResult==null||player!=null||speechPending)return;
        boolean quiet=true;try{if(tts!=null&&tts.isSpeaking())return;}catch(Exception unknown){quiet=false;}
        NativeProviderAudioSequence.Result cb=quietResult;quietResult=null;cb.done(quiet);}
    public void release(String id,NativeProviderAudioSequence.Result callback){main.post(()->{
        if(!owns(id)){callback.done(true);return;}
        if(releasing||player!=null||speechPending){callback.done(false);return;}
        releasing=true;releasedResult=callback;releaseConfirmed=true;
        // Focus uncertainty may retain a small fail-closed operation tombstone,
        // but must never skip independent TTS/service teardown. Reconciliation
        // retries only unresolved cleanup; it cannot repeat an audible effect.
        if(focusRequested){
            try{if(manager!=null&&focus!=null&&manager.abandonAudioFocusRequest(focus)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED){
                focusRequested=false;focused=false;
            }else releaseConfirmed=false;}
            catch(Exception unknown){releaseConfirmed=false;}
        }
        try{if(tts!=null){tts.shutdown();tts=null;}}
        catch(Exception unknown){releaseConfirmed=false;}
        boolean stopUnknown=false;
        for(int i=0;i<serviceHosts.length;i++){
            Service host=serviceHosts[i];if(host==null)continue;
            try{host.stopForeground(Service.STOP_FOREGROUND_REMOVE);}catch(Exception ignored){}
            try{host.stopSelf();}catch(Exception unknown){stopUnknown=true;}
        }
        if(!owns(id)||!releasing)return; // A synchronous actual destroy may settle it.
        if(stopUnknown||serviceHostsUnknown){releasing=false;releasedResult=null;callback.done(false);return;}
        // No host is not proof of disposal while the original SDK dispatch is
        // pending. Keep this exact callback until actual onDestroy, never a timer.
        if(!serviceLaunchPending&&serviceHostCount==0)finishRelease(id);
    });}
    private void finishRelease(String id){if(!owns(id)||!releasing||serviceLaunchPending||serviceHostCount!=0||serviceHostsUnknown)return;
        NativeProviderAudioSequence.Result cb=releasedResult;releasedResult=null;releasing=false;
        if(!releaseConfirmed){if(cb!=null)cb.done(false);return;}
        operation=null;service=null;serviceInitialized=false;tts=null;manager=null;focus=null;focused=false;focusRequested=false;prepared=null;quietResult=null;
        CustodialProviderAudioService.release(id,this);if(cb!=null)cb.done(true);
    }
    void destroyed(String id,Service host){
        if(Looper.myLooper()!=Looper.getMainLooper())throw new IllegalStateException("service_main_thread_required");
        if(!owns(id)||!hasServiceHost(host))return;
        for(int i=0;i<serviceHosts.length;i++)if(serviceHosts[i]==host){serviceHosts[i]=null;serviceHostCount--;break;}
        boolean primary=service==host;if(primary)service=null;
        if(releasing)finishRelease(id);else if(primary)focusLost(id);
    }
}

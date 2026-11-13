package org.memphiszoo.custodial.vault;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Ephemeral native attachment capability. No record/time/principal authority and
 * no persisted callback. Only the existing renderer's stopped/readback transition
 * releases a fresh attachment's audio barrier; uncertainty is never completion. */
final class NativeProviderMirrorAttachment {
    interface Hint { void available(String incarnation, String revision); }
    final String incarnation;
    final String id = UUID.randomUUID().toString();
    final Object plugin;
    final Object claimsOwner = new Object();
    private final Hint hint;
    private boolean valid = true, audioReady;
    NativeProviderMirrorAttachment(String incarnation,Object plugin, Hint hint) throws VaultFailure {
        if(incarnation==null||plugin==null||hint==null)throw invalid();this.incarnation=incarnation;this.plugin=plugin;this.hint=hint;
    }
    void require(Object plugin,String id) throws VaultFailure {
        if(!valid||this.plugin!=plugin||!this.id.equals(id))throw invalid();
    }
    void stopped(Object plugin,String id) throws VaultFailure {require(plugin,id);audioReady=true;}
    void requireReady(Object plugin,String id) throws VaultFailure {
        require(plugin,id);if(!audioReady)throw new VaultFailure("custodial_provider_audio_stop_unconfirmed");
    }
    void invalidate(){valid=false;audioReady=false;}
    void publish(long revision){hint.available(incarnation,Long.toString(revision));}
    Map<String,Object> snapshot(long revision,boolean qualified) {
        Map<String,Object> out=new LinkedHashMap<>();out.put("schema","custodial.provider-mirror-attachment.v1");
        out.put("attachment_id",id);out.put("runtime_incarnation",incarnation);out.put("revision",Long.toString(revision));
        out.put("state",qualified?"ATTACHED":"SUSPENDED");out.put("audio_ready",audioReady);return out;
    }
    static VaultFailure invalid(){return new VaultFailure("custodial_provider_attachment_invalid");}
}

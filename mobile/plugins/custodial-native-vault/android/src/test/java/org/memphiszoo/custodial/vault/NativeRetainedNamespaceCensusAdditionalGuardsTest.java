package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Set;
import org.junit.Test;

/** Four NEW coverage guards after the separate 17/4 source passes. Existing
 * source bytes are unchanged; no old test group is replayed. All auth/cipher/
 * original journals/admission/clock/storage/transport replies are synthetic. */
public final class NativeRetainedNamespaceCensusAdditionalGuardsTest {
    static NativeRetainedNamespaceCensusTest.Fixture ready() throws Exception {
        var x=new NativeRetainedNamespaceCensusTest.Fixture();
        x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");return x;
    }
    static NativeRetainedBatchJournal rebound(NativeRetainedNamespaceCensusTest.Fixture x,CredentialCipher index,
        NativeRetainedAttemptJournal zero) {
        var f=x.f.batch;
        return new AndroidRetainedBatchStore(f.root.preferences(),index,(query,i)->{
            String domain=AndroidRetainedBatchStore.AAD+":"+(query?"query:":"write:")+i;
            return f.domains.computeIfAbsent(domain,NativeRetainedBatchOwnerTest.DomainCipher::new);
        },zero,f.queryZero).journal();
    }
    @Test public void hmacValidRepeatedOriginalRequestIdentitiesRemainAmbiguousNotFirstWinner() throws Exception {
        var x=ready();var f=x.f.batch;var zero=f.old.journal.observe().record();var manifest=f.journal.observe();
        x.removeSlot(false,1);x.removeSlot(true,1);
        char[] credential=f.old.vaultCipher.decrypt(f.old.persistence.current().secret);
        try {
            var capture=NativeRetainedWorkCapture.capture(f.old.work);
            byte[] wire=capture.wire().toString().getBytes(StandardCharsets.UTF_8);
            try(var attempt=NativeRetainedAttempt.prepareChunk(wire,capture.values,
                NativeProviderPrincipal.fromNativeJournal(f.old.principal.readFor(f.old.engine.getState())),f.old.persistence.current().revision,
                credential,manifest.operationId,manifest.generationId,1,zero.getString("native_request_id"),f.old.clock.now)){
                f.write(1).prepare(attempt);
            }finally{Arrays.fill(wire,(byte)0);}
        }finally{Arrays.fill(credential,'\0');}
        var result=x.inspect();assertEquals(3,result.originalWriteCount);
        assertEquals("AMBIGUOUS_ORIGINAL_REQUEST_IDENTITIES_RETAINED",NativeRetainedNamespaceCensusTest.chunk(result,0).get("state"));
        assertEquals("AMBIGUOUS_ORIGINAL_REQUEST_IDENTITIES_RETAINED",NativeRetainedNamespaceCensusTest.chunk(result,1).get("state"));
        assertEquals(2,result.unresolvedChunkCount);
    }
    @Test public void unknownNamespaceMutationDuringJournalDecryptionPreventsCensusPublication() throws Exception {
        var x=ready();var name="MemphisZooCustodialNativeVaultV1";
        var wrapped=new CredentialCipher(){
            boolean changed;
            public EncryptedSecret encrypt(char[] clear){throw new AssertionError("create");}
            public EncryptedSecret encryptWithExistingKey(char[] clear){throw new AssertionError("write");}
            public void destroyKey(){throw new AssertionError("destroy");}
            public char[] decrypt(EncryptedSecret value)throws VaultFailure{
                char[] clear=x.f.batch.indexCipher.decrypt(value);
                if(!changed){changed=true;x.unknown.get(name).put("legacy","changed during retained journal decode");}return clear;
            }
        };
        x.f.batch.journal=rebound(x,wrapped,x.f.batch.old.journal);
        try(var generation=x.f.generation();var namespaces=x.observe()){
            var stable=new NativeRetainedNamespaceCensusTest.Stable(x);
            NativeRetainedNamespaceCensusTest.denied(()->x.f.batch.old.engine.inspectRetainedCapturedJournalCensus(generation,namespaces,x.f.batch.journal));
            stable.raw.put(name,new HashMap<>(x.raw(name)));stable.check();
        }x.f.preserved();
    }
    @Test public void wrongCipherAadCannotInterpretOriginalWriteEvenWhenRawCaptureMatches() throws Exception {
        var x=ready();var wrong=new NativeRetainedQueryTest.QueryCipher();
        var zero=new AndroidRetainedAttemptStore(x.f.batch.old.journalDisk.preferences(),wrong).journal();
        x.f.batch.journal=rebound(x,x.f.batch.indexCipher,zero);
        var result=x.inspect();assertEquals(2,result.originalWriteCount);assertEquals(1,result.unresolvedChunkCount);
        assertFalse(NativeRetainedNamespaceCensusTest.chunk(result,0).getBoolean("original_write_hmac_validated"));
        assertEquals(0,wrong.creates);assertEquals(0,wrong.destroys);
    }
    @Test public void everyUnknownTypedRowRetainsExactRawIdentityWithoutContentDiagnostics() throws Exception {
        var x=ready();var name="WSSecureStorageSharedPreferences";var map=x.unknown.get(name);
        map.put("private-float",Float.intBitsToFloat(0x7fc00001));map.put("private-long",17L);map.put("private-integer",17);
        map.put("private-boolean",true);map.put("private-string","private unpaired \ud800");
        map.put("private-set",Set.of("unpaired \ud800","private original"));
        var value=x.inspect();var rows=value.json().getJSONArray("records");int matches=0;
        for(int i=0;i<rows.length();i++){var row=rows.getJSONObject(i);if(name.equals(row.get("namespace")))matches++;}
        assertEquals(map.size(),matches);String text=value.json().toString();
        assertFalse(text.contains("private-float"));assertFalse(text.contains("private original"));assertFalse(text.contains("private unpaired"));
        assertNotEquals(NativeProtectedNamespaceObservation.retainedCensusRowIdentity(name,"n",17),
            NativeProtectedNamespaceObservation.retainedCensusRowIdentity(name,"n",17L));
        assertNotEquals(NativeProtectedNamespaceObservation.retainedCensusRowIdentity(name,"n",Float.intBitsToFloat(0x7fc00001)),
            NativeProtectedNamespaceObservation.retainedCensusRowIdentity(name,"n",Float.intBitsToFloat(0x7fc00002)));
    }
}

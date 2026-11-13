package org.memphiszoo.custodial.vault;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import org.json.JSONObject;

/** NEW fixture producer ONLY: production native capsule+file codec and host
 * file effects, synthetic all8/provider/enrollment/clock/JCE key. No Android
 * keystore/real credential, transport, DB, old suite or operational proof.
 * Qualifier removes the exact entire owned fixture root after Node readback.
 */
public final class NativePrivateCustodyRecordInteropFixture {
    public static void main(String[]args)throws Exception {
        if(args.length!=1)throw new IllegalArgumentException("one owned fixture root");Path root=Path.of(args[0]);
        if(!root.isAbsolute()||!Files.isDirectory(root)||Files.isSymbolicLink(root))throw new IllegalArgumentException("owned root");
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        f.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var capsule=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1))){
            var store=NativePrivateCapsuleFileStore.fromNativeNoBackupRoot(root.toFile());
            try(var existing=store.retainExactOriginal(capsule)){
                JSONObject expected=new JSONObject().put("schema","custodial.synthetic-native-private-record-interop-fixture.v1")
                    .put("capsule",capsule.metadata()).put("saved_record",existing.originalEncryptedRecord().metadata()).put("layout",l.projection())
                    .put("file_observation",existing.metadata())
                    .put("actual_Android_keystore_qualified",false).put("normal_current_backend_auth_qualified",false).put("synthetic_only",true);
                byte[] json=expected.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
                try{Files.write(root.resolve("expected-metadata.json"),json,StandardOpenOption.CREATE_NEW);}finally{Arrays.fill(json,(byte)0);}
            }
            stable.check();if(capsule.metadata().getInt("chunk_count")<2)throw new AssertionError("multi-chunk golden required");
        }finally{f.x.f.preserved();}
        System.out.println("NEW_NATIVE_SYNTHETIC_MULTI_CHUNK_RECORD_PRODUCED_NO_BODY_OR_KEYS_LOGGED");
    }
}

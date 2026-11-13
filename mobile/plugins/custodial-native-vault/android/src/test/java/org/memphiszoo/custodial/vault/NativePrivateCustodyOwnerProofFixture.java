package org.memphiszoo.custodial.vault;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import org.json.JSONObject;

/** ONE synthetic source interoperability input, exact native owner HMAC and
 * record. Qualifier removes whole owned root after Node qualification. */
public final class NativePrivateCustodyOwnerProofFixture {
    public static void main(String[] args)throws Exception {
        if(args.length!=1)throw new IllegalArgumentException("owned root");Path root=Path.of(args[0]);
        if(!root.isAbsolute()||!Files.isDirectory(root)||Files.isSymbolicLink(root))throw new IllegalArgumentException("owned root");
        System.setProperty("custodial.custody.fixture.root",root.toString());
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()) {f.commit();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
            try(var owner=f.inspect();var proof=f.engine().prepareOriginalPrivateCustodyOwnerProof(owner)) {
                var old=f.x.f.x.f.batch.old;var capture=NativeRetainedWorkCapture.capture(old.work);byte[] wire=capture.wire().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
                try {
                    var manifest=new JSONObject(new JSONObject(new String(wire,java.nio.charset.StandardCharsets.UTF_8)).getString("manifest_body"));
                    var facts=new JSONObject().put("schema","custodial.synthetic-private-custody-owner-fixture.v1")
                        .put("original_generation",f.h.g.projection()).put("context",manifest.getJSONObject("separation_context"))
                        .put("original_wire_base64",java.util.Base64.getEncoder().encodeToString(wire)).put("record_relative_path",root.relativize(f.committed).toString())
                        .put("proof",proof.projection()).put("synthetic_only",true).put("actual_Android",false).put("actual_SQL",false);
                    Files.writeString(root.resolve("facts.json"),facts.toString(),StandardOpenOption.CREATE_NEW);
                }finally{java.util.Arrays.fill(wire,(byte)0);}
                stable.check();if(owner.projection().getJSONObject("capsule").getInt("chunk_count")<2)throw new AssertionError("multi-chunk required");
            }
        }
        System.out.println("NEW_SYNTHETIC_NATIVE_CLOSED_OWNER_HMAC_RECORD_FIXTURE_CREATED_NO_KEY_OR_TOKEN_LOGGED");
    }
}

package org.memphiszoo.custodial.vault;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import org.json.JSONObject;

/** One NEW synthetic original frame. Test-only reflection copies a closed
 * production object's bytes to the exact owned temporary fixture. No product
 * exporter or transport exists; qualifier removes this synthetic root. */
public final class NativePrivateCustodyTransportFrameFixture {
    public static void main(String[] args)throws Exception {
        if(args.length!=1)throw new IllegalArgumentException("owned root");Path root=Path.of(args[0]);
        if(!root.isAbsolute()||!Files.isDirectory(root)||Files.isSymbolicLink(root))throw new IllegalArgumentException("owned root");
        System.setProperty("custodial.custody.fixture.root",root.toString());
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){f.commit();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
            try(var owner=f.inspect();var frame=f.engine().prepareOriginalPrivateCustodyTransportFrame(owner)){
                var old=f.x.f.x.f.batch.old;var capture=NativeRetainedWorkCapture.capture(old.work);byte[] wire=capture.wire().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8),encoded=NativePrivateCustodyTransportFrameTest.ownedTestCopy(frame);
                try {var manifest=new JSONObject(new JSONObject(new String(wire,java.nio.charset.StandardCharsets.UTF_8)).getString("manifest_body"));
                    Files.write(root.resolve("frame.bin"),encoded,StandardOpenOption.CREATE_NEW);
                    var facts=new JSONObject().put("schema","custodial.synthetic-private-custody-frame-fixture.v1")
                        .put("original_generation",f.h.g.projection()).put("context",manifest.getJSONObject("separation_context"))
                        .put("original_wire_base64",java.util.Base64.getEncoder().encodeToString(wire)).put("frame_relative_path","frame.bin")
                        .put("frame_metadata",frame.metadata()).put("test_only_reflection_no_product_byte_exporter",true)
                        .put("synthetic_only",true).put("actual_Android",false).put("actual_SQL",false);
                    Files.writeString(root.resolve("facts.json"),facts.toString(),StandardOpenOption.CREATE_NEW);
                }finally{Arrays.fill(wire,(byte)0);Arrays.fill(encoded,(byte)0);}
                stable.check();if(owner.projection().getJSONObject("capsule").getInt("chunk_count")<2)throw new AssertionError("multichunk required");
            }
        }
        System.out.println("NEW_SYNTHETIC_NATIVE_CLOSED_FRAME_FIXTURE_NO_PRODUCT_BYTE_GETTER_KEY_OR_TOKEN_LOGGED");
    }
}

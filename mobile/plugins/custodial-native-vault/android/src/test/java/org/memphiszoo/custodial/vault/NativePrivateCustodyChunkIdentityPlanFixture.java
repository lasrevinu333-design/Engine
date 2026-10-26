package org.memphiszoo.custodial.vault;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import org.json.JSONObject;
/** ONE synthetic TEST-copy golden. Reflection reads only owned fake frame;
 * no product raw getter or real data/key. Qualifier removes both files. */
public final class NativePrivateCustodyChunkIdentityPlanFixture {
    public static void main(String[] args)throws Exception {
        if(args.length!=1)throw new IllegalArgumentException("owned fixture only");Path root=Path.of(args[0]);if(!root.isAbsolute()||!Files.isDirectory(root)||Files.isSymbolicLink(root))throw new IllegalArgumentException("owned fixture only");
        try(var x=new NativePrivateCustodyOperationTest.Fixture();var op=x.prepare();var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(op)){
            JSONObject p=plan.projection();var rows=new org.json.JSONArray();for(int i=0;i<p.getInt("chunk_count");i++)rows.put(plan.chunkMetadata(i));
            byte[] bytes=NativePrivateCustodyTransportFrameTest.ownedTestCopy(x.frame);try{Files.write(root.resolve("frame.bin"),bytes,java.nio.file.StandardOpenOption.CREATE_NEW);}
            finally{Arrays.fill(bytes,(byte)0);}
            Files.writeString(root.resolve("facts.json"),new JSONObject().put("synthetic_only",true).put("plan",p).put("chunks",rows).put("frame_relative_path","frame.bin").toString(),java.nio.file.StandardOpenOption.CREATE_NEW);
        }
    }
}

package org.memphiszoo.custodial.vault;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import org.json.JSONObject;
/** Synthetic golden only, own TEST-reflection copy. No token/key or actual
 * user body is exported. The known fake signing secret remains test source. */
public final class NativePrivateCustodyExchangeFixture {
    public static void main(String[] args)throws Exception {
        if(args.length==2&&"--current-query-one-owner".equals(args[1])){exportCurrentOneQuery(Path.of(args[0]));return;}
        if(args.length==2&&"--current-query".equals(args[1])){exportCurrentQueries(Path.of(args[0]),false);return;}
        if(args.length==2&&"--current-query-first-piece".equals(args[1])){exportCurrentQueries(Path.of(args[0]),true);return;}
        if(args.length!=1)throw new IllegalArgumentException("owned fixture only");Path root=Path.of(args[0]);if(!root.isAbsolute()||!Files.isDirectory(root)||Files.isSymbolicLink(root))throw new IllegalArgumentException("owned fixture only");
        try(var f=new NativePrivateCustodyExchangeTest.Fixture();var write=f.write(0)){
            byte[] body=NativePrivateCustodyExchangeTest.body(write);JSONObject parsed;
            try{parsed=ProviderWireJson.object(body,NativeRetainedAttempt.MAX_BODY);Files.write(root.resolve("write.bin"),body,java.nio.file.StandardOpenOption.CREATE_NEW);}finally{Arrays.fill(body,(byte)0);}
            var wire=ProviderWireJson.object(NativeRetainedAttempt.base64(parsed.getString("original_signed_wire_base64"),262144),262144);var manifest=new JSONObject(wire.getString("manifest_body"));
            f.engine.fenceOriginalPrivateCustodyExchange(write);f.clock.now+=1000;
            try(var query=f.query(0)){byte[] q=NativePrivateCustodyExchangeTest.body(query);try{Files.write(root.resolve("query.bin"),q,java.nio.file.StandardOpenOption.CREATE_NEW);}finally{Arrays.fill(q,(byte)0);}
                var principalField=f.plan.getClass().getDeclaredField("operation");principalField.setAccessible(true);
                Files.writeString(root.resolve("facts.json"),new JSONObject().put("synthetic_only",true).put("write",write.projection()).put("query",query.projection())
                    .put("write_headers",new JSONObject((java.util.Map<?,?>)NativePrivateCustodyExchangeTest.field(write,"headers")))
                    .put("query_headers",new JSONObject((java.util.Map<?,?>)NativePrivateCustodyExchangeTest.field(query,"headers")))
                    .put("manifest",manifest).put("plan",f.plan.projection()).put("chunk",f.plan.chunkMetadata(0)).toString(),java.nio.file.StandardOpenOption.CREATE_NEW);
            }
        }
    }
    /** Exact query0 route fixture. The full frame is the actual native source
     * image, not proof that all chunks were written/read on a real server. */
    private static void exportCurrentOneQuery(Path root)throws Exception {
        if(!root.isAbsolute()||!Files.isDirectory(root)||Files.isSymbolicLink(root))throw new IllegalArgumentException("owned fixture only");
        if(!Boolean.getBoolean("custodial.fixture.backend-admissible-credential"))throw new IllegalArgumentException("backend-admissible synthetic fixture issuer required");
        try(var f=new NativePrivateCustodyExchangeTest.Fixture();var write=f.write(0)){
            byte[] body=NativePrivateCustodyExchangeTest.body(write),frame=null,wire=null;
            JSONObject manifest,writeHeaders=new JSONObject((java.util.Map<?,?>)NativePrivateCustodyExchangeTest.field(write,"headers"));
            try{var p=ProviderWireJson.object(body,393216);wire=NativeRetainedAttempt.base64(p.getString("original_signed_wire_base64"),262144);
                manifest=new JSONObject(ProviderWireJson.object(wire,262144).getString("manifest_body"));
                Files.write(root.resolve("write-0.bin"),body,java.nio.file.StandardOpenOption.CREATE_NEW);
                frame=NativePrivateCustodyTransportFrameTest.ownedTestCopy(f.x.frame);
                Files.write(root.resolve("frame.bin"),frame,java.nio.file.StandardOpenOption.CREATE_NEW);
            }finally{Arrays.fill(body,(byte)0);if(frame!=null)Arrays.fill(frame,(byte)0);if(wire!=null)Arrays.fill(wire,(byte)0);}
            f.engine.fenceOriginalPrivateCustodyExchange(write);f.clock.now+=1;
            try(var query=f.query(0)){
                byte[] bytes=NativePrivateCustodyExchangeTest.body(query);
                try{Files.write(root.resolve("query-0.bin"),bytes,java.nio.file.StandardOpenOption.CREATE_NEW);}finally{Arrays.fill(bytes,(byte)0);}
                var queryHeaders=new JSONObject((java.util.Map<?,?>)NativePrivateCustodyExchangeTest.field(query,"headers"));
                f.engine.fenceOriginalPrivateCustodyExchange(query);var originals=NativePrivateCustodyOwnerTest.files(f.dir);
                var plan=f.plan.projection();f.clock.now+=86_400_000;JSONObject currentHeaders;
                try(var dispatch=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,0)){
                    var request=dispatch.takeRequest();try{Files.write(root.resolve("current-query-0.bin"),request.body,java.nio.file.StandardOpenOption.CREATE_NEW);
                        currentHeaders=new JSONObject(request.headers);
                    }finally{Arrays.fill(request.body,(byte)0);}
                }
                NativePrivateCustodyOwnerTest.sameFiles(originals,f.dir);
                Files.writeString(root.resolve("facts.json"),new JSONObject().put("synthetic_only",true).put("manifest",manifest).put("plan",plan)
                    .put("chunks",new org.json.JSONArray().put(new JSONObject().put("index",0).put("query_headers",queryHeaders)
                        .put("write_headers",writeHeaders).put("current_query_headers",currentHeaders)))
                    .put("current_query_fixture",true).put("current_query_scope","ONE_ISSUED_QUERY_WITH_NATIVE_FRAME_SOURCE_ONLY")
                    .put("current_query_indexes",new org.json.JSONArray().put(0)).put("original_records_unchanged",true)
                    .put("credential_policy","BACKEND_ADMISSIBLE_SYNTHETIC_FIXTURE_ONLY")
                    .put("actual_complete_server_write_or_SQL",false).toString(),java.nio.file.StandardOpenOption.CREATE_NEW);
            }
        }
    }
    private static void exportCurrentQueries(Path root,boolean firstPieceOnly)throws Exception {
        if(!root.isAbsolute()||!Files.isDirectory(root)||Files.isSymbolicLink(root))throw new IllegalArgumentException("owned fixture only");
        try(var f=new NativePrivateCustodyExchangeTest.Fixture()){
            int count=f.plan.projection().getInt("chunk_count");var chunks=new org.json.JSONArray();JSONObject manifest=null;
            for(int i=0;i<count;i++){
                try(var write=f.write(i)){
                    byte[] body=NativePrivateCustodyExchangeTest.body(write);
                    try{Files.write(root.resolve("write-"+i+".bin"),body,java.nio.file.StandardOpenOption.CREATE_NEW);
                        var p=ProviderWireJson.object(body,393216);byte[] wire=NativeRetainedAttempt.base64(p.getString("original_signed_wire_base64"),262144);
                        try{manifest=new JSONObject(ProviderWireJson.object(wire,262144).getString("manifest_body"));}finally{Arrays.fill(wire,(byte)0);}
                    }finally{Arrays.fill(body,(byte)0);}
                    f.engine.fenceOriginalPrivateCustodyExchange(write);f.clock.now+=1;
                    try(var query=f.query(i)){
                        byte[] bytes=NativePrivateCustodyExchangeTest.body(query);
                        try{Files.write(root.resolve("query-"+i+".bin"),bytes,java.nio.file.StandardOpenOption.CREATE_NEW);}finally{Arrays.fill(bytes,(byte)0);}
                        f.engine.fenceOriginalPrivateCustodyExchange(query);
                        chunks.put(new JSONObject().put("index",i).put("query_headers",new JSONObject((java.util.Map<?,?>)NativePrivateCustodyExchangeTest.field(query,"headers")))
                            .put("write_headers",new JSONObject((java.util.Map<?,?>)NativePrivateCustodyExchangeTest.field(write,"headers"))));
                    }
                }
            }
            var originals=NativePrivateCustodyOwnerTest.files(f.dir);f.clock.now+=86_400_000;
            // The bounded current-route fixture needs index0 only, but retains
            // ALL original chunks/queries. This is not all-current-piece proof.
            for(int i=0;i<(firstPieceOnly?1:count);i++)try(var dispatch=f.engine.prepareCurrentOriginalPrivateCustodyQueryRead(f.plan,f.journal,i)){
                var request=dispatch.takeRequest();try{Files.write(root.resolve("current-query-"+i+".bin"),request.body,java.nio.file.StandardOpenOption.CREATE_NEW);
                    chunks.getJSONObject(i).put("current_query_headers",new JSONObject(request.headers));
                }finally{Arrays.fill(request.body,(byte)0);}
            }
            NativePrivateCustodyOwnerTest.sameFiles(originals,f.dir);
            var currentIndexes=new org.json.JSONArray();for(int i=0;i<(firstPieceOnly?1:count);i++)currentIndexes.put(i);
            Files.writeString(root.resolve("facts.json"),new JSONObject().put("synthetic_only",true).put("manifest",manifest)
                .put("plan",f.plan.projection()).put("chunks",chunks).put("current_query_fixture",true)
                .put("current_query_scope",firstPieceOnly?"ONE_FIXED_ORIGINAL_QUERY_READ":"ALL_FIXED_ORIGINAL_QUERY_READS")
                .put("current_query_indexes",currentIndexes)
                .put("original_records_unchanged",true).toString(),java.nio.file.StandardOpenOption.CREATE_NEW);
        }
    }
}

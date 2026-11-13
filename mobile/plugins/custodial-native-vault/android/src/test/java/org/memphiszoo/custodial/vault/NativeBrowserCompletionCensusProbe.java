package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;

/** NEW whole-census SOURCE composition. Original actor/cipher/records/disk are
 * synthetic existing factories only. No transport, SQL, real browser, phone,
 * raw local data file, writes after freeze, new credential or key authority. */
public final class NativeBrowserCompletionCensusProbe {
    public static void main(String[] options)throws Exception {
        if(options.length!=1||!java.util.Set.of("fixture","observe").contains(options[0]))throw new AssertionError("bounded source case required");
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();
        byte[] input=null;var arguments=new ArrayList<byte[]>();
        try {
            f.record(true);NativeRetainedCompletionCensusTest.anotherReceipt(f,false);
            String secondKey=f.owner.workDisk.memory.keySet().stream().filter(k->k.startsWith(NativeRetainedCompletionSemanticsTest.PREFIX)&&!k.endsWith(f.receiptKey))
                .findFirst().orElseThrow().substring(NativeRetainedCompletionSemanticsTest.PREFIX.length());
            if("fixture".equals(options[0])) {
                try(var original=NativeCompletionJournal.inspectRetainedOriginalRequest("KIOSK_08",secondKey,f.owner.work.loadCompletionReceipt(secondKey))) {
                    System.out.println(new JSONArray().put(f.args).put(original.originalArgs()));return;
                }
            }
            // Test-copy envelope stays within the owning strict parser's 8MiB
            // ceiling. This fixture transport is NOT a mounted bulk bridge.
            final int limit=8*1024*1024;
            input=System.in.readNBytes(limit+1);if(input.length>limit)throw new AssertionError("bounded census stdin");
            JSONObject packet=ProviderWireJson.object(input,limit);NativeRetainedAttempt.keys(packet,"arguments_base64");
            JSONArray values=packet.getJSONArray("arguments_base64");if(values.length()>NativeRetainedCompletionCensus.MAX_CANDIDATES)throw new AssertionError("bounded census rows");
            int total=0;
            for(int i=0;i<values.length();i++) {
                Object value=values.get(i);if(!(value instanceof String))throw new AssertionError("original bytes only");
                byte[] bytes=Base64.getDecoder().decode((String)value);arguments.add(bytes);
                if(!Base64.getEncoder().encodeToString(bytes).equals(value)||bytes.length>RequestPolicy.MAX_REQUEST_BYTES
                    ||(total+=bytes.length)>NativeRetainedCompletionCensus.MAX_TOTAL_BYTES)throw new AssertionError("bounded canonical original bytes");
            }
            f.freeze();var result=NativeRetainedCompletionCensusTest.inspect(f,arguments);
            System.out.println(result.json());
        }finally{if(input!=null)Arrays.fill(input,(byte)0);for(byte[] bytes:arguments)Arrays.fill(bytes,(byte)0);f.owner.wiped();}
    }
}

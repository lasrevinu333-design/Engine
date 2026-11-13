"""Run the actual pure Java time owner in a root-provided empty scratch directory."""
from pathlib import Path
import hashlib,json,subprocess,sys

root=Path(__file__).resolve().parents[2]
scratch=Path(sys.argv[1]).resolve()
assert scratch.is_dir() and not any(scratch.iterdir()), 'Root must supply an empty owned compile directory'
base=root/'mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault'
sources=['OfflineAuthorityTime.java','VaultTimestamps.java','VaultFailure.java','PhysicalNfcTagIdentity.java']
try:
    for name in sources:(scratch/name).write_bytes((base/name).read_bytes())
    models=(base/'VaultModels.java').read_text();start=models.index('final class VaultValidation {')
    # Exact production class; no synthetic validation of the time inputs.
    validation=models[start:];end=validation.find('\nfinal class ',1)
    if end>=0:validation=validation[:end]
    imports='\n'.join(line for line in models.splitlines() if line.startswith('import '))
    (scratch/'VaultValidation.java').write_text('package org.memphiszoo.custodial.vault;\n'+imports+'\n'+validation)
    (scratch/'JSONObject.java').write_text('package org.json; public final class JSONObject { public JSONObject(String text) { throw new AssertionError("Readiness JSON is outside this time-owner probe"); } public Object opt(String key) { throw new AssertionError("Unexercised readiness port"); } public Object get(String key) { throw new AssertionError("Unexercised readiness port"); } }')
    (scratch/'NativeProviderJournal.java').write_text('package org.memphiszoo.custodial.vault; final class NativeProviderJournal { static final class Observation { Observation(Object unused,long elapsed,int boot) {} } }')
    (scratch/'NativeCompletionJournal.java').write_text('package org.memphiszoo.custodial.vault; final class NativeCompletionJournal { static final String FAILURE="custodial_native_server_receipt_required"; interface Store { String loadCompletionReceipt(String key) throws VaultFailure; void saveCompletionReceipt(String key,String value) throws VaultFailure; void deleteCompletionReceipt(String key) throws VaultFailure; } }')
    # Actual capture method and pure handoff validators; only Android URI/storage
    # ports are synthetic. This is not an Android compile or persistence proof.
    handoff=(base/'NativeNfcScanHandoff.java').read_text()
    def section(a,b):
        begin=handoff.index(a);return handoff[begin:handoff.index(b,begin)]
    constants=section('    public static final String QUERY_PARAMETER','    private NativeNfcScanHandoff()')
    result=section('    public static final class ReadResult','    public static ReadResult recordPhysicalRead(Context context, String url, String identity)')
    capture=section('    static ReadResult recordResult(','    static Map<String, Object> require(')
    validators=section('    private static boolean purgeInvalid(','    private static int currentBootCount(')
    helpers=handoff[handoff.index('    private static String canonicalUuid('):handoff.rfind('}')]
    uri='static final class Uri {\n      final java.net.URI value; Uri(String text){value=java.net.URI.create(text);}\n      static Uri parse(String text){return new Uri(text);} String getScheme(){return value.getScheme();}\n      java.util.List<String> getQueryParameters(String key){var result=new java.util.ArrayList<String>();String query=value.getRawQuery();if(query!=null)for(String pair:query.split("&")){String[] parts=pair.split("=",2);if(parts[0].equals(key))result.add(parts.length==2?parts[1]:"");}return result;}\n    }'
    (scratch/'NativeNfcScanHandoff.java').write_text('package org.memphiszoo.custodial.vault;\nimport java.util.*;\nfinal class NativeNfcScanHandoff {\n'+constants+result+capture+validators+helpers+uri+'\n}')
    (scratch/'AndroidOfflineAuthorityTimeStore.java').write_text('package org.memphiszoo.custodial.vault;\nimport java.util.*;\nfinal class AndroidOfflineAuthorityTimeStore {\n OfflineAuthorityTime.OfflineOccurrence occurrence; int loads,writes;\n final Map<String,Map<String,Object>> records=new LinkedHashMap<>();\n boolean ignoresPhysicalScanDuringInitialWork(long elapsed,int boot)throws VaultFailure{return OfflineAuthorityTime.ignoresPhysicalScan(occurrence,elapsed,boot);}\n static final class NfcHandoffCapture {final Map<String,Map<String,Object>> handoffs;NfcHandoffCapture(Map<String,Map<String,Object>> rows){handoffs=rows;}}\n enum NfcWriteResult{REFUSED,DURABLE}\n NfcHandoffCapture loadNfcHandoffsForPhysicalRead(){loads++;return new NfcHandoffCapture(records);}\n NfcWriteResult persistPhysicalNfcHandoffs(NfcHandoffCapture capture){writes++;return NfcWriteResult.DURABLE;}\n}')
    test=Path(__file__).with_name('SealedOfflineTimeBoundaryTest.java');(scratch/test.name).write_bytes(test.read_bytes())
    print(json.dumps({'scope':'Actual OfflineAuthorityTime/clock arithmetic/validation/tag identity; synthetic storage, unexercised provider/receipt type ports','scratch':str(scratch),'source_sha256':{n:hashlib.sha256((base/n).read_bytes()).hexdigest() for n in sources+['NativeNfcScanHandoff.java']}}),flush=True)
    compile_result=subprocess.run(['javac','-d',str(scratch),*[str(p) for p in scratch.glob('*.java')]],timeout=30)
    if compile_result.returncode:sys.exit(compile_result.returncode)
    run=subprocess.run(['java','-cp',str(scratch),'org.memphiszoo.custodial.vault.SealedOfflineTimeBoundaryTest'],timeout=15)
    sys.exit(run.returncode)
finally:
    # This exact root-owned directory was empty on entry; remove only its probe outputs.
    for p in sorted(scratch.rglob('*'),key=lambda p:len(p.parts),reverse=True):
        p.rmdir() if p.is_dir() else p.unlink()
    print(json.dumps({'owned_compile_outputs_removed':not any(scratch.iterdir())}),flush=True)

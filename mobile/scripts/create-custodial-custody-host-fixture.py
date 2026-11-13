"""Explicit separate-classpath synthetic JCE key adapter for existing custody host tests.
Never included in shipping main/test source sets; never AndroidKeyStore qualification.
"""
from pathlib import Path
import argparse,hashlib,json,os
EXPECTED='04257ca59fd0b34cd896447f2445cb7b67b54597ccaf9ec5b1f17446ec9b39cb'
BADGE='EXPLICIT_SYNTHETIC_JCE_NO_HARDWARE_AUTHORITY'
MOBILE=Path(__file__).resolve().parent.parent
SOURCE=MOBILE/'plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/AndroidKeystoreCipher.java'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--workspace',required=True,help='new owned disk-backed secondary directory')
parser.add_argument('--npm-fixture',required=True,help='owned directory containing exactly pinned Capacitor dependencies')
a=parser.parse_args();W=Path(a.workspace);N=Path(a.npm_fixture)
for p in [W,N]:
 if not p.is_absolute() or p.resolve()!=p or p.is_symlink():parser.error('exact absolute non-symlink paths required')
if W.exists() or not W.parent.is_dir() or not N.is_dir():parser.error('new workspace and existing owned npm fixture required')
if W.parent.stat().st_dev==Path('/').stat().st_dev:parser.error('secondary disk workspace required')
raw=SOURCE.read_bytes();assert hashlib.sha256(raw).hexdigest()==EXPECTED,'Exact shipping cipher preimage required'
packages=[]
for name,version in [('@capacitor/android','8.4.3'),('@capacitor/core','8.4.3'),('@capacitor-firebase/messaging','8.3.0')]:
 p=N/'node_modules'/name/'package.json';d=json.loads(p.read_text());assert d['name']==name and d['version']==version
 packages.append({'name':name,'version':version,'package_json_sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
s=raw.decode();s=s.replace('import android.security.keystore.KeyGenParameterSpec;\n','').replace('import android.security.keystore.KeyProperties;\n','').replace('import android.util.Base64;\n','')
# This adapter alone uses JVM Base64; all shipping sources compile unchanged.
for expression in ['encrypted','cipher.getIV()']:
 old='Base64.encodeToString('+expression+', Base64.NO_WRAP)';assert s.count(old)==1;s=s.replace(old,'java.util.Base64.getEncoder().encodeToString('+expression+')')
for expression in ['secret.ciphertext','secret.iv']:
 old='Base64.decode('+expression+', Base64.NO_WRAP)';assert s.count(old)==2;s=s.replace(old,'java.util.Base64.getDecoder().decode('+expression+')')
state=r"""
    // EXPLICIT HOST FIXTURE ONLY: mutable synthetic alias; no hardware authority.
    private static javax.crypto.SecretKey syntheticOriginalKey, syntheticReplacementKey;
    private static EncryptedSecret syntheticOpaqueOriginal, syntheticGcmOriginal;
    private static int syntheticSelection, checksRemaining;
    private static Runnable afterChecks;
    static String syntheticHostModel() { return "EXPLICIT_SYNTHETIC_JCE_NO_HARDWARE_AUTHORITY"; }
    private static void requireHostProfile() {
        if (!syntheticHostModel().equals(System.getProperty("custodial.fixture.synthetic.jce.adapter")))
            throw new IllegalStateException("Explicit isolated synthetic-key profile required");
    }
    static synchronized void installSynthetic(EncryptedSecret original, char[] credential) throws Exception {
        requireHostProfile();
        if (original==null || credential==null || credential.length==0) throw new IllegalArgumentException("Original synthetic fixture required");
        clearSynthetic();
        KeyGenerator generator=KeyGenerator.getInstance("AES");generator.init(256);
        syntheticOriginalKey=generator.generateKey();syntheticReplacementKey=generator.generateKey();
        byte[] clear=encode(credential), encrypted=null;
        try {
            Cipher c=Cipher.getInstance(TRANSFORMATION);c.init(Cipher.ENCRYPT_MODE,syntheticOriginalKey);c.updateAAD(VAULT_SNAPSHOT_AAD);
            encrypted=c.doFinal(clear);
            syntheticGcmOriginal=new EncryptedSecret(java.util.Base64.getEncoder().encodeToString(encrypted),java.util.Base64.getEncoder().encodeToString(c.getIV()));
            syntheticOpaqueOriginal=original;syntheticSelection=1;
        } finally { Arrays.fill(clear,(byte)0);if(encrypted!=null)Arrays.fill(encrypted,(byte)0); }
    }
    static synchronized void clearSynthetic() {
        requireHostProfile();syntheticOriginalKey=null;syntheticReplacementKey=null;syntheticOpaqueOriginal=null;syntheticGcmOriginal=null;syntheticSelection=0;checksRemaining=0;afterChecks=null;
    }
    static synchronized void selectSyntheticKey(int selection) {
        requireHostProfile();if(selection<0||selection>2)throw new IllegalArgumentException("Only absent/original/replaced synthetic aliases");syntheticSelection=selection;
    }
    static synchronized void afterSyntheticChecks(int count,Runnable effect) {
        requireHostProfile();if(count<0||(count==0)!=(effect==null))throw new IllegalArgumentException("Explicit bounded synthetic fault");checksRemaining=count;afterChecks=effect;
    }
    private static synchronized EncryptedSecret fixtureEnvelope(EncryptedSecret secret) {
        requireHostProfile();
        if(secret!=null&&syntheticOpaqueOriginal!=null&&secret.ciphertext.equals(syntheticOpaqueOriginal.ciphertext)&&secret.iv.equals(syntheticOpaqueOriginal.iv))return syntheticGcmOriginal;
        return secret;
    }
    private static void syntheticCheckCompleted() {
        Runnable effect=null;
        synchronized(AndroidKeystoreCipher.class){requireHostProfile();if(checksRemaining>0&&--checksRemaining==0){effect=afterChecks;afterChecks=null;}}
        if(effect!=null)effect.run();
    }
"""
assert s.count('    private KeyStore keyStore;')==1;s=s.replace('    private KeyStore keyStore;',state)
old='            KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) store().getEntry(KEY_ALIAS, null);\n            if (entry == null) throw new VaultFailure("custodial_native_vault_key_missing");'
assert s.count(old)==1;s=s.replace(old,'            SecretKey existing = requireExistingKey();')
old='cipher.init(Cipher.DECRYPT_MODE, entry.getSecretKey(), new GCMParameterSpec(128, iv));'
assert s.count(old)==1;s=s.replace(old,'cipher.init(Cipher.DECRYPT_MODE, existing, new GCMParameterSpec(128, iv));')
start=s.index('    private SecretKey requireExistingKey()');end=s.index('    private static byte[] encode(',start)
s=s[:start]+r"""    private SecretKey requireExistingKey() throws Exception {
        synchronized(AndroidKeystoreCipher.class) {
            requireHostProfile();
            if(syntheticSelection==1&&syntheticOriginalKey!=null)return syntheticOriginalKey;
            if(syntheticSelection==2&&syntheticReplacementKey!=null)return syntheticReplacementKey;
            throw new VaultFailure("custodial_native_vault_key_missing");
        }
    }
    private SecretKey getOrCreateKey() throws Exception {
        // No implicit creation fallback, even in the explicitly synthetic model.
        return requireExistingKey();
    }

"""+s[end:]
old='            encrypted = java.util.Base64.getDecoder().decode(secret.ciphertext); iv = java.util.Base64.getDecoder().decode(secret.iv);'
assert s.count(old)==1;s=s.replace(old,'            EncryptedSecret bound=fixtureEnvelope(secret);\n            encrypted = java.util.Base64.getDecoder().decode(bound.ciphertext); iv = java.util.Base64.getDecoder().decode(bound.iv);')
old='            NativeRetainedNamespacePrivateCapsule.requireOriginalVaultAndWorkKey(key, encrypted, iv, frozenWork, principal);'
assert s.count(old)==1;s=s.replace(old,old+'\n            syntheticCheckCompleted();')
assert 'android.' not in '\n'.join(line for line in s.splitlines() if line.startswith('import '))
W.mkdir(mode=0o700);G=W/'generated/org/memphiszoo/custodial/vault';G.mkdir(parents=True);(W/'original-custody-root').mkdir(mode=0o700)
(G/'AndroidKeystoreCipher.java').write_text(s)
control=MOBILE/'scripts/fixtures/native-custody-host/CustodialSyntheticHostGuardTest.java';(G/control.name).write_bytes(control.read_bytes())
q=lambda p:json.dumps(str(p))
init="""// Explicit host TEST profile; never shipping/instrumentation source selection.
gradle.settingsEvaluated { settings ->
 def declared = [':capacitor-android': 'node_modules/@capacitor/android/capacitor', ':capacitor-firebase-messaging': 'node_modules/@capacitor-firebase/messaging/android']
 declared.each { name, rel ->
  def p=settings.project(name)
  def expected=new File(settings.settingsDir, '../../../../'+rel).canonicalFile
  if(p.projectDir.canonicalFile!=expected)throw new GradleException('Unexpected original dependency graph: '+name)
  p.projectDir=new File(NPM_ROOT,rel)
 }
}
gradle.beforeProject { p -> p.layout.buildDirectory.set(new File(WORKSPACE+'/build',p.name)) }
gradle.projectsEvaluated {
 def p=gradle.rootProject
 def main=p.tasks.named('compileDebugJavaWithJavac',org.gradle.api.tasks.compile.JavaCompile)
 def tests=p.tasks.named('compileDebugUnitTestJavaWithJavac',org.gradle.api.tasks.compile.JavaCompile)
 def host=p.tasks.register('compileCustodialSyntheticKeyAdapter',org.gradle.api.tasks.compile.JavaCompile) {
  dependsOn tests
  source=p.fileTree(WORKSPACE+'/generated') { include '**/*.java' }
  classpath=p.files(tests.get().classpath,main.get().destinationDirectory,tests.get().destinationDirectory)
  destinationDirectory.set(p.file(WORKSPACE+'/host-adapter-classes'))
  javaCompiler.set(main.get().javaCompiler)
  options.release.set(21)
  options.encoding='UTF-8'
 }
 def target=p.tasks.named('testDebugUnitTest',org.gradle.api.tasks.testing.Test).get()
 def original=target.classpath
 target.dependsOn(host)
 target.classpath=p.files(host.flatMap { it.destinationDirectory },original)
 target.testClassesDirs=p.files(target.testClassesDirs,host.flatMap { it.destinationDirectory })
 target.maxHeapSize='512m';target.maxParallelForks=1
 target.systemProperty('custodial.custody.fixture.root',WORKSPACE+'/original-custody-root')
 target.systemProperty('custodial.fixture.original-batch-before-capture','true')
 target.systemProperty('custodial.fixture.semantic-join-persistence','original-bound-prefs-host-model')
 target.systemProperty('custodial.fixture.synthetic.jce.adapter','EXPLICIT_SYNTHETIC_JCE_NO_HARDWARE_AUTHORITY')
 target.systemProperty('custodial.fixture.synthetic.adapter.classes',WORKSPACE+'/host-adapter-classes')
 target.systemProperty('custodial.fixture.shipping.cipher.source',SHIPPING_SOURCE)
}
"""
init=init.replace('NPM_ROOT',q(N)).replace('WORKSPACE',q(W)).replace('SHIPPING_SOURCE',q(SOURCE));(W/'host.init.gradle').write_text(init)
receipt={'schema':'custodial.explicit-native-custody-synthetic-host-fixture.v1','scope':BADGE,'shipping_cipher_sha256':EXPECTED,'shipping_cipher_modified':False,'shipping_source':str(SOURCE),'generated_adapter_sha256':hashlib.sha256((G/'AndroidKeystoreCipher.java').read_bytes()).hexdigest(),'control_source_sha256':hashlib.sha256(control.read_bytes()).hexdigest(),'packages':packages,'changes_to_test_adapter':['JVM Base64 only inside adapter','Explicit synthetic absent/original/replacement existing-key selector; no creation fallback','Exact opaque synthetic original-envelope mapping to a real AES-GCM envelope under the declared synthetic original key','Original frozen WORK/credential checks execute through unchanged shipping capsule methods','Bounded post-successful-key-check fault port for existing owner mutation tests'],'Android_hardware_or_keystore_acceptance':False,'shipping_removal_or_key_retirement_change':False,'new_work_or_finalization_authority':False,'workspace':str(W),'init_script':str(W/'host.init.gradle')}
(W/'FIXTURE.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))

// Actual current source fixture; fresh JVM for each owning observation selector.
// No APK, device, real keystore, NFC, audio or release admission.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readCoreNativeFixtureClasspath} from '../../scripts/core-native-fixture.mjs';
assert.equal(process.argv.length,2);
const cp=readCoreNativeFixtureClasspath(),base=mkdtempSync(join(tmpdir(),'custodial-observation-regressions-'));chmodSync(base,0o700);
try{
 const cases=[['org.junit.runner.JUnitCore','org.memphiszoo.custodial.vault.AndroidProtectedWorkReadOnlyAbaTest'],
 ...['FIXED_OWNER_STAMP_actualJournalAndSourceBoundaries','FIXED_OWNER_STAMP_sameBytesMetadataReplacementStillRefuses','FIXED_OWNER_STAMP_genericAndMixedFamiliesKeepAgreement'].map(name=>['org.memphiszoo.custodial.vault.NativeProtectedNamespaceObservationTest','--fixed-owner-stamp-only',name])];
 for(const args of cases){
  const owned=mkdtempSync(join(base,'case-'));chmodSync(owned,0o700);
  const r=spawnSync('java',['-Xmx256m','-Dcustodial.custody.fixture.root='+owned,'-Djava.io.tmpdir='+owned,'-cp',cp,...args],{stdio:'inherit',timeout:120000});
  if(r.error)throw r.error;assert.equal(r.signal,null);assert.equal(r.status,0,'Owning selector must actually pass: '+args.at(-1));
 }
 readCoreNativeFixtureClasspath();
 console.log(JSON.stringify({status:'PASS',owning_selectors:cases.length,aba_cases:8,fixed_owner_selectors:3,source_fixture_verified:true,physical_acceptance:false,release_admission:false}));
}finally{rmSync(base,{recursive:true,force:false});}

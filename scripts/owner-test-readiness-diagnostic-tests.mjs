import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readCoreNativeFixtureClasspath} from './core-native-fixture.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const base='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const plugin=read(base+'CustodialNativeVaultPlugin.java');
const start=plugin.indexOf('    @PluginMethod\n    public void getCustodialReadinessObservation('),end=plugin.indexOf('    @PluginMethod\n    public void beginRollbackFence(',start);
assert.ok(start>0&&end>start);
let addition=plugin.slice(start,end);
const from=addition.indexOf('            Map<String,Object> observed=observer.observe('),to=addition.indexOf('            resolve(call, observed);',from)+'            resolve(call, observed);'.length;
assert.ok(from>0&&to>from);
addition=addition.slice(0,from)+'            resolve(call, observer.observe(call.getString("device_id"),call.getString("expected_principal_identity")));'+addition.slice(to);
const field='    private final OwnerTestReadinessDiagnostic ownerTestReadinessDiagnostic=new OwnerTestReadinessDiagnostic();\n\n';
assert.equal(addition.split(field).length,2);addition=addition.replace(field,'');
assert.equal(createHash('sha256').update(addition).digest('hex'),'bf6c2a09a5188c05576baa94dd21a81486c9ea0edf81efcfa0bbcdd9c06afa46','exact original native observer remains after removing only diagnostic augmentation');
assert.match(plugin.slice(start,end),/ApplicationInfo\.FLAG_TEST_ONLY/);
assert.match(plugin.slice(start,end),/if\(diagnostic!=null\)Log\.i\("CustodialReadiness",diagnostic\)/);
assert.match(plugin.slice(start,end),/catch\(RuntimeException unavailable\)/);
assert.match(read('mobile/capacitor.config.ts'),/webContentsDebuggingEnabled: false/);
assert.match(read('mobile/capacitor.config.ts'),/loggingBehavior: 'debug'/);
const output=execFileSync('/usr/bin/java',['-Xmx256m','-cp',readCoreNativeFixtureClasspath(),'org.junit.runner.JUnitCore',
 'org.memphiszoo.custodial.vault.OwnerTestReadinessDiagnosticTest','org.memphiszoo.custodial.vault.NativeReadinessObservationTest'],
 {encoding:'utf8',timeout:20000,maxBuffer:1048576});
assert.match(output,/OK \(\d+ tests\)/);console.log(JSON.stringify({status:'PASS',scope:'exact original observer plus compiled native testOnly/finite/deduplicated diagnostic and read-only observer controls; no phone or physical acceptance',junit:output.trim()}));

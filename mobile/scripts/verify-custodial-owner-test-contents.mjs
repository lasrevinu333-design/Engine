import assert from 'node:assert/strict';
import {join} from 'node:path';
import {assertCustodialNativeSecurityBoundary,assertEmbeddedRuntimeAssets,assertQualifiedProviderClassClosure,CUSTODIAL_OLD_SECURE_STORAGE_CLASS,
  parseEmbeddedBuildIdentity,assertEmbeddedCustodialProvenance} from './verify-custodial-android-release.mjs';
import {inspectCompiledProviderOwner,readReviewedProviderRelease} from './custodial-provider-release-policy.mjs';
import {inspectCustodialNativeVaultDexSemantics,inspectCustodialNewProducerScopeDexSemantics} from './verify-custodial-dex-semantics.mjs';
import {readCustodialBuildScope} from './custodial-new-producer-scope-policy.mjs';
import {custodialNativeVaultSourceDigest} from './custodial-native-vault-source.mjs';

export function verifyCustodialOwnerTestContents({mobile,zipEntries,readEntry,manifestDump,versionCode,versionName,sourceCommit,sourceTree}) {
  assert.equal(new Set(zipEntries).size,zipEntries.length,'No duplicate APK entry identities');
  const plugin=join(mobile,'plugins','custodial-native-vault');
  const ticket=readReviewedProviderRelease(plugin,{versionCode,versionName,required:true});
  const scope=readCustodialBuildScope(mobile);
  assert.equal(scope.profile,'full-system');
  assert.match(manifestDump,/android:testOnly[^\n]*(?:true|0xffffffff)/);
  assert.match(manifestDump,/org\.memphiszoo\.custodial\.TEST_ARTIFACT/);
  const provider=inspectCompiledProviderOwner(manifestDump,ticket);
  const dexEntries=zipEntries.filter(name=>/^classes(?:\d+)?\.dex$/.test(name)).sort()
    .map(name=>({name,bytes:readEntry(name)}));
  assertQualifiedProviderClassClosure(dexEntries);
  inspectCustodialNewProducerScopeDexSemantics(dexEntries,{profile:scope.profile,policySha256:scope.policy_sha256,ownerTestFullSystem:true});
  const semantics=inspectCustodialNativeVaultDexSemantics(dexEntries,{
    oldSecureStorageDescriptor:`L${CUSTODIAL_OLD_SECURE_STORAGE_CLASS.replaceAll('.','/')};`
  });
  const native=assertCustodialNativeSecurityBoundary({
    pluginManifestBytes:readEntry('assets/capacitor.plugins.json'),
    capacitorConfigBytes:readEntry('assets/capacitor.config.json'),
    dexEntries,runtimeBridgeBytes:readEntry('assets/public/memphis-custodial-bridge.js'),
    runtimeExecutableEntries:zipEntries.filter(name=>/^assets\/public\/.+\.(?:html|js|mjs)$/.test(name)).sort()
      .map(name=>({name,bytes:readEntry(name)})),
  });
  assert.deepEqual(native.dex_sha256,semantics.dex_sha256);
  const buildJson=JSON.parse(readEntry('assets/public/build.json'));
  assert.equal(buildJson.native_build_number,versionCode);
  assert.ok(!buildJson.cleaning_first_scope);
  const runtimeAssetManifest=JSON.parse(readEntry('assets/public/runtime-asset-manifest.json'));
  const buildIdentity=parseEmbeddedBuildIdentity(readEntry('assets/public/memphis-build-identity.js'));
  const verifiedRuntime=assertEmbeddedRuntimeAssets({runtimeAssetManifest,zipEntries,readEntry});
  const nativeVaultSourceSha256=custodialNativeVaultSourceDigest(plugin);
  assertEmbeddedCustodialProvenance({buildJson,runtimeAssetManifest,buildIdentity,expectedBuildNumber:versionCode,
    expectedSourceCommit:sourceCommit,expectedSourceTree:sourceTree,expectedNativeVaultSourceSha256:nativeVaultSourceSha256});
  return {scope:scope.profile,runtime_assets_verified:verifiedRuntime.runtime_asset_count,
    native_vault_source_sha256:nativeVaultSourceSha256,provider_owner:provider.owner,dex_sha256:native.dex_sha256};
}

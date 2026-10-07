import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { withoutProviderRegistration, withoutProviderStatusJournal } from './provider-clock-source-boundary.mjs';
import { withoutLocalProviderLifecycle } from './provider-local-owner-source-boundary.mjs';
import {assertNativeBaseline} from './native-source-baselines.mjs';
import {withoutProviderInterval} from './provider-interval-source-boundary.mjs';

const base = '47f8948f520dd8687805c81a1a59b776d477a14d';
const directory = 'mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const read = name => readFileSync(directory + name, 'utf8');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const runtime = read('CustodialNativeRuntime.java');
for (const [factory, type] of [['providerComponents', 'NativeProviderComponentRuntime'], ['providerIngress', 'NativeProviderIngressRuntime']]) {
  check(new RegExp(`static ${type} ${factory}\\(Context context\\)\\s*\\{\\s*return ${type}\\.SUSPENDED;\\s*\\}`).test(runtime), factory + ' hard suspended');
}
const sources = readdirSync(directory).filter(name => name.endsWith('.java')).map(name => [name, read(name)]);
assert.deepEqual(sources.filter(([,source])=>/new NativeProviderRegistrationCoordinator\s*\(/.test(source)).map(([name])=>name),['NativeProviderRuntimeOwner.java']);checks++;
check(/new NativeProviderRuntimeOwner.Delivery\(NativeProviderTime.Profiles.NONE,/.test(runtime),'only conditional same-owner construction with no production profile');
const cursor = `    /** Read-only cursor for an in-process SDK getToken callback. Never an authority token. */
    static final class TokenCursor {
        final long epoch, captureSequence;
        TokenCursor(long epoch, long captureSequence) { this.epoch = epoch; this.captureSequence = captureSequence; }
        boolean same(TokenCursor other) { return other != null && epoch == other.epoch && captureSequence == other.captureSequence; }
    }
    TokenCursor tokenCursor() throws VaultFailure {
        return transition(() -> {
            JSONObject meta = metadata(store.load());
            return new TokenCursor(number(meta, "invalidation_epoch"), number(meta, "capture_sequence"));
        });
    }

`;
check(read('NativeProviderJournal.java').includes(cursor), 'exact read-only token cursor retained');
// Already integrated receipt791168e changed ONLY pendingEvents to received-first
// stable ordering. Freeze that actual current journal; don't omit future changes.
const receiptBase = '02fbd55569565b98763283d10426136f7863d4e4';
const receiptJournal = withoutProviderInterval('NativeProviderJournal.java',read('NativeProviderJournal.java'));
assertNativeBaseline(receiptBase,directory+'NativeProviderJournal.java',receiptJournal); checks++;
const omitPending = source => source.replace(/    EventBatch pendingEvents\([^]*?(?=    void requireEventBatchCurrent\()/, '    /* ACCEPTED_RECEIVED_FIRST_BATCH */\n');
assertNativeBaseline(base,directory+'NativeProviderJournal.java',omitPending(withoutProviderStatusJournal(receiptJournal.replace(cursor,''))),'provider-status-received-first'); checks++;
const service = read('CustodialProviderMessagingService.java');
check(/extends FirebaseMessagingService/.test(service), 'native Firebase SDK service');
check(/message\.getFrom\(\), project, message\.getNotification\(\) != null, message\.getData\(\)/.test(service), 'SDK sender and notification object are actual ingress inputs');
check(/FirebaseApp\.getInstance\(\)\.getOptions\(\)\.getGcmSenderId\(\)/.test(service), 'project comes from installed Firebase options');
check(/FirebaseMessagingPlugin\.onNewToken\(token\)/.test(service) && /FirebaseMessagingPlugin\.onMessageReceived\(message\)/.test(service), 'existing plugin compatibility is explicit');
check(!/Log\.[a-z]\([^\n]*(token|message\.getData|exception|rejected\.get)/.test(service.replace(/"native_token_not_committed"/, '"fixed_diagnostic"')), 'no token or payload diagnostic logging');
const token = read('AndroidProviderTokenSource.java');
check(/Looper\.myLooper\(\) == Looper\.getMainLooper\(\)/.test(token), 'native token read is not main-thread');
check(/Tasks\.await\(FirebaseMessaging\.getInstance\(\)\.getToken\(\), attempt\.timeout\(10000\), TimeUnit\.MILLISECONDS\)/.test(token), 'existing attempt bounds native SDK read');
check(/attempt\.check\(\); owner\.completeTokenRead\(read, token\)/.test(token), 'cancellation checked before capture');
check(/finally \{ owner\.abandonTokenRead\(read\); \}/.test(token), 'exact read lease abandoned');
check(!/requestPermissions|startActivity|Executor|addOnCompleteListener|evaluateJavascript/.test(token), 'no permission UI, detached callback or executor');
const android = 'mobile/plugins/custodial-native-vault/android/';
const manifest = readFileSync(android + 'src/main/AndroidManifest.xml', 'utf8');
assertNativeBaseline(base,android+'src/main/AndroidManifest.xml',manifest); checks++;
check(!/CustodialProviderMessagingService|MESSAGING_EVENT/.test(manifest), 'new handler deliberately unregistered');
const gradle = readFileSync(android + 'build.gradle', 'utf8');
check(/implementation project\(':capacitor-firebase-messaging'\)/.test(gradle), 'installed compatibility plugin visible to native library');
check(/implementation 'com.google.firebase:firebase-messaging:25.0.1'/.test(gradle), 'existing exact Firebase SDK dependency, no upgrade');
const coordinator = read('NativeProviderRegistrationCoordinator.java');
check(/received\.bounds != null/.test(coordinator), 'this stage rejects qualified-clock claims');
check(!/\.providerObservation\(|NotificationManager|NotificationCompat|markPresented|evaluateJavascript|sendNativeProviderEvents|recoverNativeProviderInventory/.test(coordinator), 'registration owner grants no clock/display/event/inventory authority');
assertNativeBaseline(base,directory+'VaultEngine.java',withoutProviderRegistration(read('VaultEngine.java')),'provider-registration-removal'); checks++;
assertNativeBaseline(base,directory+'CustodialNativeVaultPlugin.java',withoutLocalProviderLifecycle(read('CustodialNativeVaultPlugin.java'))); checks++;
console.log(JSON.stringify({ status: 'PROVIDER_REGISTRATION_SOURCE_CONTRACT_PASS', checks, base,
  limits: 'Source/SDK compile only. Factories remain hard suspended; no native provider runtime or closed-app delivery claim.' }));

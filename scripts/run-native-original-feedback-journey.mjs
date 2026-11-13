import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Import-only. Outer sole owner provisions the disposable DB and directly owns
// Java Popen/PID/start-ticks/argv and all cleanup. No implicit retry.
export async function runPreparedNativeFeedbackJourney({admin,target,backendRoot,frontendRoot,ipcDirectory,launchNative,recordDiagnostic}) {
 const load=(root,name)=>import(pathToFileURL(resolve(root,name)));
 const {prepareNativeOriginalFeedbackJourney}=await load(backendRoot,'scripts/native-original-feedback-journey-fixture.mjs');
 const {createNativeFeedbackIpc}=await load(frontendRoot,'scripts/native-original-feedback-ipc.mjs');
 const {createNativeFeedbackRuntime}=await load(frontendRoot,'scripts/native-original-feedback-runtime.mjs');
 const {consumeNativeOriginalFeedbackJourney}=await load(frontendRoot,'scripts/native-original-feedback-journey-consumer.mjs');
 let fixture,child,settled=false;
 try {
  fixture=await prepareNativeOriginalFeedbackJourney({admin,target,backendRoot,recordDiagnostic});
  const ipc=await createNativeFeedbackIpc({directory:ipcDirectory,fixture});
  child=await launchNative({className:'org.memphiszoo.custodial.vault.CurrentNativeFeedbackSqlProducer',directory:ipc.directory});
  assert.equal(typeof child?.terminateOwned,'function');assert.ok(child.completion&&typeof child.completion.then==='function');
  await ipc.ready();const runtime=await createNativeFeedbackRuntime({ipc});
  const consumer=await consumeNativeOriginalFeedbackJourney({frontendRoot,prepared:fixture.prepared,...runtime,nativeTransport:input=>ipc.authorizedRequest(input),originalRow:operation=>fixture.originalRow(operation)});
  const relay=await fixture.relayAndReadOriginal({operationId:consumer.operation_id,feedbackId:consumer.feedback_id});assert.equal(relay.feedback_writer_calls,1);assert.equal(relay.provider_send,false);assert.equal(relay.original_state,'outcome_unknown');
  const native=await ipc.finish();const terminal=await child.completion;settled=true;assert.equal(terminal.exitCode,0);assert.equal(terminal.signal,null);
  return {schema:'custodial.native-feedback-local-composition.v1',scope:'SOURCE_NATIVE_SIGNER_PROTECTED_OUTBOX_NORMAL_HTTP_SQL_RELAY_AND_PRIVATE_READER',consumer,relay,native,Android:false,genuine_TLS:false,real_enrollment:false,real_manager:false,provider_send:false,recipient_Inbox:false,full_program_ready:false};
 } finally {
  // Allow an outstanding normal 40s response wait to settle before requesting
  // exact owned termination. No file is changed to turn UNKNOWN into success.
  try{if(child&&!settled){let timer;try{const result=await Promise.race([child.completion,new Promise(ok=>{timer=setTimeout(()=>ok(null),45000);})]);if(result===null)await child.terminateOwned();}finally{clearTimeout(timer);}}}
  finally{if(fixture)await fixture.close();}
 }
}

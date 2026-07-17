import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(scriptDir, '../thread.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function extractFunctionSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} function must exist`);
  const braceStart = source.indexOf('{', start);
  assert.notEqual(braceStart, -1, `${name} must have a function body`);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} function body did not close`);
}

const sendMessage = extractFunctionSource(html, 'sendMessage');
const refreshMessages = extractFunctionSource(html, 'refreshMessages');
const bindEvents = extractFunctionSource(html, 'bindEvents');
const playChatSwoosh = extractFunctionSource(html, 'playChatSwoosh');
const hasIncomingMessages = extractFunctionSource(html, 'hasIncomingMessages');
const apiPost = extractFunctionSource(html, 'apiPost');
const optionalManagerAuthHeaders = extractFunctionSource(html, 'optionalManagerAuthHeaders');
const loadUsers = extractFunctionSource(html, 'loadUsers');
const createConversationFromPicker = extractFunctionSource(html, 'createConversationFromPicker');
const renderComposerState = extractFunctionSource(html, 'renderComposerState');
const postOutboxEntry = extractFunctionSource(html, 'postOutboxEntry');
const firstAwaitNetwork = sendMessage.indexOf('await flushOutbox');
const firstClear = sendMessage.indexOf("els.composeInput.value=''");
assert(firstAwaitNetwork > -1, 'sendMessage must await durable outbox flushing');
assert(
  firstClear > -1 && firstClear < firstAwaitNetwork,
  'sendMessage must clear the compose textbox immediately before waiting on the durable network/outbox response'
);

assert(
  /const\s+draft\s*=\s*body/.test(sendMessage),
  'sendMessage must keep a draft copy before optimistic clear so failed sends do not lose text'
);
assert(
  /catch\s*\([^)]*error[^)]*\)/.test(sendMessage) && /els\.composeInput\.value\s*=\s*draft/.test(sendMessage),
  'sendMessage must restore the draft on send failure'
);
assert(
  /els\.sendBtn\.textContent\s*=\s*['"]Sending/.test(sendMessage),
  'sendMessage must show an explicit Sending state instead of looking frozen'
);
assert(
  !/opsManagerAuthHeaders\s*\(/.test(apiPost),
  'Messenger sends must not force Ops Manager approval; employee messenger posts need to stay usable'
);
assert(
  /readSession\?\.\s*\(\)/.test(optionalManagerAuthHeaders) && /isOpsManager\?\.\s*\(session\)/.test(optionalManagerAuthHeaders),
  'Messenger may attach an existing manager session, but only opportunistically without prompting'
);
assert(
  /String\(u\.id\|\|'\'\)\.trim\(\)!==state\.currentUserId/.test(loadUsers),
  'Thread picker must exclude the current user so devices cannot start self-conversations'
);
assert(
  /els\.pickerCreate\.textContent\s*=\s*allowGroups\?['"]Create['"]:['"]Message['"]/.test(loadUsers),
  'Thread picker CTA must switch to a one-person Message flow for employee devices'
);
assert(
  /!state\.isManagerOverview&&checked\.length!==1/.test(createConversationFromPicker),
  'Employee devices must be blocked from creating multi-person group threads'
);
assert(
  /viewer_can_send===false/.test(renderComposerState) || /state\.thread\?\.viewer_can_send!==false/.test(renderComposerState),
  'Read-only manager thread views must disable the composer when the viewer is not a participant'
);

assert(
  /state\.thread\?\.viewer_can_send!==false/.test(refreshMessages) && /playChatSwoosh\('receive'\)/.test(refreshMessages),
  'Open thread views must play a lightweight receive swoosh for new incoming messages after rendering them'
);
assert(
  /playChatSwoosh\('send'\)/.test(sendMessage),
  'sendMessage must play a lightweight send swoosh after a successful post'
);
assert(
  /isMemphisConversation\(state\.thread\)/.test(postOutboxEntry),
  'Memphis routing must recognize the bot by canonical thread metadata instead of relying on one brittle field'
);
assert(
  /client_message_id:clientMessageId/.test(sendMessage) && /pendingClientMessageId/.test(sendMessage),
  'Every send must carry a stable client message ID so retries cannot duplicate user or Memphis messages'
);
assert(
  /window\.addEventListener\('pointerdown',prime,\{once:true,passive:true\}\)/.test(bindEvents)
    && /window\.addEventListener\('touchstart',prime,\{once:true,passive:true\}\)/.test(bindEvents)
    && /window\.addEventListener\('keydown',prime,\{once:true\}\)/.test(bindEvents),
  'Thread view must prime chat audio on the first user interaction so send/receive swooshes can play on kiosk phones'
);
assert(
  /document\.visibilityState==='hidden'/.test(playChatSwoosh),
  'Chat swooshes must stay suppressed while the thread page is hidden'
);
assert(
  /sender_user_id/.test(hasIncomingMessages) && /state\.currentUserId/.test(hasIncomingMessages),
  'Incoming-message detection must only trigger receive swooshes for messages from the other participant'
);

console.log(JSON.stringify({ ok: true, checked: ['optimistic_clear', 'draft_restore', 'visible_sending_state', 'no_forced_manager_pin_on_messenger_send', 'exclude_self_from_picker', 'employee_direct_only', 'read_only_manager_threads', 'chat_send_swoosh', 'chat_receive_swoosh', 'audio_prime_hooks', 'hidden_page_swoosh_guard', 'memphis_thread_fallback', 'message_idempotency'] }, null, 2));

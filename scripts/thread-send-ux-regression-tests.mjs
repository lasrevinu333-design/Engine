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
const apiPost = extractFunctionSource(html, 'apiPost');
const optionalManagerAuthHeaders = extractFunctionSource(html, 'optionalManagerAuthHeaders');
const loadUsers = extractFunctionSource(html, 'loadUsers');
const createConversationFromPicker = extractFunctionSource(html, 'createConversationFromPicker');
const renderComposerState = extractFunctionSource(html, 'renderComposerState');
const firstAwaitApiPost = sendMessage.indexOf('await apiPost');
const firstClear = sendMessage.indexOf("els.composeInput.value=''");
assert(firstAwaitApiPost > -1, 'sendMessage must await an API post');
assert(
  firstClear > -1 && firstClear < firstAwaitApiPost,
  'sendMessage must clear the compose textbox immediately before waiting on the network/AI response'
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
  'Messenger sends must not force the Ops Manager PIN prompt; employee messenger posts need to stay usable'
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

console.log(JSON.stringify({ ok: true, checked: ['optimistic_clear', 'draft_restore', 'visible_sending_state', 'no_forced_manager_pin_on_messenger_send', 'exclude_self_from_picker', 'employee_direct_only', 'read_only_manager_threads'] }, null, 2));

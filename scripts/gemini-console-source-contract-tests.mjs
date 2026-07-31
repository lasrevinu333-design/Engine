import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('gemini-admin.html','utf8');
const js=fs.readFileSync('gemini-console.js','utf8');
const auth=fs.readFileSync('memphis-auth.js','utf8');

assert.match(html,/Content-Security-Policy/);
assert.match(html,/default-src 'self'/);
assert.match(html,/object-src 'none'/);
assert.match(html,/conversation transcript/i);
assert.match(html,/Attach files, drag them here, or paste an image/);
assert.match(html,/class="gemini-global-back mz-back-link"[^>]*data-mz-back[^>]*href="\.\/start_page1\.html"/);
assert.match(fs.readFileSync('gemini-console.css','utf8'),/\[hidden\]\{display:none!important\}/);
assert.doesNotMatch(html,/premade|prompt card|model selector|temperature|API key|Gemini password/i);
assert.doesNotMatch(html,/onclick=|onerror=|<script(?![^>]*src=)/i);

assert.match(js,/requireOpsManagerSession\(\{accessLevel:'full_access',interactive:false/);
assert.match(js,/credentials:'include'/);
assert.match(js,/indexedDB\.open\(DB_NAME,1\)/);
assert.match(js,/client_message_id:uuid\(\)/);
assert.match(js,/if\(state\.busy\|\|state\.submitting/);
assert.match(js,/document\.addEventListener\('paste'/);
assert.match(js,/window\.visualViewport\?\.height/);
assert.match(js,/--gemini-viewport-height/);
assert.match(js,/function openApp\(\)\{syncViewportHeight\(\)/);
assert.match(js,/dataTransfer\.files/);
assert.match(js,/text\.textContent=message\.body/);
assert.match(js,/timeZone:'America\/Chicago'/);
assert.doesNotMatch(js,/localStorage|sessionStorage/);
assert.doesNotMatch(js,/innerHTML|insertAdjacentHTML|eval\(|new Function/);
assert.doesNotMatch(js,/requireGeminiAdmin|gemini\/login|gemini\/session|Gemini password/i);
assert.match(auth,/memphisGeminiAdminSession\.v1/);
assert.doesNotMatch(auth,/requireGeminiAdminSession|geminiAdminLogin/);

console.log('GEMINI_CONSOLE_SOURCE_CONTRACT_PASS');

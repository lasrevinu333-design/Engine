import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../mobile/src/chatscope/app.jsx', import.meta.url), 'utf8');
const theme = fs.readFileSync(new URL('../mobile/src/chatscope/theme.css', import.meta.url), 'utf8');

assert.match(app, /async function openDirectRecipient\(user\)/, 'employee New flow must open a selected person directly');
assert.match(app, /EMPLOYEE_CONTEXT[\s\S]*Tap a person to open their messages\./, 'employee recipient picker must use one-step novice language');
assert.match(app, /onClick=\{\(\) => openDirectRecipient\(user\)\}/, 'recipient tap must open the direct thread');
assert.match(app, /\{!EMPLOYEE_CONTEXT && <Search/, 'conversation search must remain manager-only');
assert.match(app, /\{!EMPLOYEE_CONTEXT && <button[\s\S]*onClick=\{openMemphis\}/, 'extra Memphis toolbar action must remain hidden from employee mode');
assert.match(app, /EMPLOYEE_CONTEXT \? 'Loading messages…' : 'Resolving named manager identity…'/, 'employee startup language must be plain');
assert.match(app, /function employeeSafeError\(/, 'employee errors must be mapped to a small safe vocabulary');
assert.match(app, /messageLoadController = useRef\(null\)/, 'thread switching must abort stale requests');
assert.match(app, /messageLoadController\.current\?\.abort\(\)/, 'prior thread request must be cancelled');
assert.match(app, /setMessages\(\[\]\);[\s\S]*setLoadingMessages\(true\);[\s\S]*setSelectedId\(id\)/, 'old messages must disappear before the new recipient header renders');

assert.match(app, /function EmployeeConversationRow\(/, 'employee rows must own swipe behavior');
assert.match(app, /onTouchStart=/, 'employee row must detect swipe start');
assert.match(app, /onTouchEnd=/, 'employee row must detect swipe end');
assert.match(app, /aria-label=\{`Delete conversation with \$\{thread\.title\}`\}/, 'row delete must remain accessible without swiping');
assert.match(theme, /\.mz-chat-swipe-row\.revealed \.mz-chat-swipe-content/, 'swipe-left reveal styling must exist');
assert.match(theme, /\.mz-chat-row-delete/, 'row-level delete button styling must exist');

const deleteBlock = app.slice(app.indexOf('const deleteThread = useCallback'), app.indexOf('useEffect(() => {', app.indexOf('const deleteThread = useCallback')));
assert.ok(deleteBlock, 'deleteThread block should be extractable');
assert.doesNotMatch(deleteBlock, /confirm\(/, 'employee deletion must not ask for a second confirmation');
assert.match(deleteBlock, /threadsRef\.current = optimisticThreads/, 'conversation must hide locally before the server responds');
assert.ok(deleteBlock.indexOf('threadsRef.current = optimisticThreads') < deleteBlock.indexOf("await api(`/thread/${encodeURIComponent(thread.id)}/delete`"), 'optimistic removal must precede the network request');
assert.match(deleteBlock, /threadsRef\.current = previousThreads/, 'failed deletion must restore the row');

assert.doesNotMatch(app, /Message queued for retry: \$\{safe\(error\)\}/, 'employee send failures must not expose raw technical errors');
assert.match(app, /No connection\. Your message is saved\./, 'offline send copy must be employee-safe');

console.log('custodial employee Messenger v23 contracts: PASS');

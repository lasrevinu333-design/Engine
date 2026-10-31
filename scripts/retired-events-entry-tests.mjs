import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
for(const page of ['events-admin.html','employee-events.html']){
  const html=readFileSync(new URL('../'+page,import.meta.url),'utf8');
  assert.doesNotMatch(html,/<(?:form|input|textarea|select|button)\b|xlsx|fetch\(|localStorage|admin-api|employee-events-api/i);
  assert.match(html,/<a href="\.\/events\.html">Open Events<\/a>/);
  assert.match(html,/form-action 'none'/);
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for(const query of ['','?token=SECRET&return=https://untrusted.invalid&device=OTHER#secret','?event_id=invalid&hub=employee']){
    const targets=[];
    vm.runInNewContext(script,{URL,window:{location:{href:`https://fixture.invalid/app/${page}${query}`,replace:url=>targets.push(url)}}});
    assert.deepEqual(targets,['https://fixture.invalid/app/events.html']);
  }
}
console.log(JSON.stringify({status:'PASS_RETIRED_EVENTS_COMPATIBILITY',pages:2,sameOrigin:true,queryCarryover:false,writes:false,browser:false}));

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const locationCueWordingPins=Object.freeze({
  name:'memphis-device-reminders.js',
  prior_sha256:'31429725ea97d9e4628c3dc0f28f9c2ff06fbae7c3b1531a548af2cdab367918',
  current_sha256:'c6afb4ca9e14d8fe223b271319041b4af0e064adf3632098ba9cf69d74972d08',
  before:'`${lead}${locationName} needs attention now.`',
  after:'`${lead}${locationName} is overdue and needs attention now.`'
});
// TEST COMPARISON ONLY: reverse only the complete, exact approved wording
// successor. Unknown edits/paths remain unchanged and older strict guards
// continue to reject them. Runtime never imports this module.
export function normalizeCurrentLocationCueWording(name,source){
  const p=locationCueWordingPins;
  if(!(name===p.name||name.endsWith('/'+p.name))||sha(source)!==p.current_sha256)return source;
  assert.equal(source.split(p.after).length,2);
  const prior=source.replace(p.after,p.before);assert.equal(sha(prior),p.prior_sha256);
  return prior;
}

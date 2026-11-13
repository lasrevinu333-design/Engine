// Explicit civil time at the Zoo. Never interpret datetime-local in the browser zone.
const zone = 'America/Chicago';
const formatter = new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function zooLocalInput(instant) {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('A valid recorded time is required.');
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
export function zooLocalInstant(value, occurrence = '') {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value));
  if (!match) throw new Error('Enter a complete date and time in Zoo local time (America/Chicago).');
  const [year,month,day,hour,minute,second] = match.slice(1).map((x,i)=>Number(x || (i===5 ? 0 : NaN)));
  const naive = Date.UTC(year,month-1,day,hour,minute,second);
  const d = new Date(naive);
  if (year<2000 || year>9999 || d.getUTCFullYear()!==year || d.getUTCMonth()!==month-1 || d.getUTCDate()!==day || hour>23 || minute>59 || second>59)
    throw new Error('Enter a valid Zoo local date and time.');
  const expected = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${String(second).padStart(2,'0')}`;
  const candidates=[];
  // Chicago offsets are whole hours. Verify candidates by a full civil-time round trip.
  for(let offset=-14;offset<=14;offset++) {
    const instant=naive+offset*3600000;
    if(zooLocalInput(instant)===expected)candidates.push(new Date(instant).toISOString());
  }
  if(!candidates.length)throw new Error('This Zoo local time does not exist because clocks move forward. Choose another time.');
  if(candidates.length>1 && !['earlier','later'].includes(occurrence))
    throw new Error('This Zoo local time occurs twice when clocks move back. Choose the first or second occurrence.');
  return occurrence==='later' ? candidates.at(-1) : candidates[0];
}

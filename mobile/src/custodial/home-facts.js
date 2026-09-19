const ZONE = 'America/Chicago';
const minute = 60_000;
const numeric = value => value !== null && value !== undefined && value !== '' && !(typeof value === 'string' && !value.trim())
  && (typeof value === 'number' || typeof value === 'string') && Number.isFinite(Number(value)) ? Number(value) : null;
const stamp = value => typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
export function zooServiceDate(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
  const take = key => parts.find(part=>part.type===key).value;
  return `${take('year')}-${take('month')}-${take('day')}`;
}
export function timeMinutes(value) {
  const raw=String(value??'').trim();
  const military=raw.match(/^(\d{2}):(\d{2})(?::00)?$/);
  if(military&&Number(military[1])<24&&Number(military[2])<60)return Number(military[1])*60+Number(military[2]);
  const civil=raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if(!civil||Number(civil[1])<1||Number(civil[1])>12||Number(civil[2])>59)return null;
  return (Number(civil[1])%12+(civil[3].toUpperCase()==='PM'?12:0))*60+Number(civil[2]);
}
const clock = value => `${Math.floor(value/60)%12||12}:${String(value%60).padStart(2,'0')} ${value<720?'AM':'PM'}`;
export function sourceLabel(value, now=Date.now(), limit=60*minute, forcedStale=false) {
  const when=stamp(value),age=now-when;
  if(!Number.isFinite(when)||age< -minute)return {stale:true,label:'Update time unavailable'};
  const label=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(when));
  return {stale:forcedStale||age>limit,label:`${forcedStale||age>limit?'Last update':'Updated'} ${label}`};
}
export function scheduleFacts(data, identity, receivedAt, now=Date.now()) {
  const unavailable={shift:'Schedule unavailable',lunch:'Lunch unavailable',stale:true,detail:'Open Schedule for the latest assignments.'};
  if(!data||data.service_date!==zooServiceDate(now))return unavailable;
  const ids=[data.canonical_device_id,data.device_id].filter(Boolean).map(value=>String(value).toUpperCase());
  if(!ids.length||ids.some(value=>value!==identity.deviceId))return unavailable;
  const employeeId=String(data.employee_id||data.employee?.id||'');
  const employeeName=String(data.employee_name||data.employee?.display_name||'').trim();
  if(identity.employeeId ? employeeId!==identity.employeeId : !employeeName||employeeName!==identity.employeeName)return unavailable;
  if(data.projection_status&&data.projection_status!=='current')return {...unavailable,detail:'Schedule update required.'};
  const freshness=sourceLabel(receivedAt,now,5*minute,data.stale===true);
  if(data.schedule_status==='off'||data.phase==='off_day'||data.shift?.active===false)
    return {shift:'Not scheduled today',lunch:'Not scheduled',...freshness,detail:freshness.label};
  const start=timeMinutes(data.shift?.shift_start??data.shift?.start),end=timeMinutes(data.shift?.shift_end??data.shift?.end);
  if(start===null||end===null||end<=start)return unavailable;
  const lunchStart=timeMinutes(data.lunch?.start??data.shift?.lunch_start),lunchEnd=timeMinutes(data.lunch?.end??data.shift?.lunch_end);
  const lunch=lunchStart!==null&&lunchEnd!==null&&lunchStart>=start&&lunchEnd<=end&&lunchEnd>lunchStart
    ? `${clock(lunchStart)}–${clock(lunchEnd)}`:'Lunch not published';
  return {shift:`${clock(start)}–${clock(end)}`,lunch,...freshness,detail:freshness.label};
}
export function attendanceFacts(data,now=Date.now()) {
  const count=numeric(data?.attendance);
  if(count===null||!Number.isSafeInteger(count)||count<0||data?.available===false)
    return {value:'Unavailable',stale:true,detail:'Guest count has not been verified.'};
  const fresh=sourceLabel(data.source_timestamp??data.fetched_at??data.updated_at,now,60*minute,data.stale===true);
  return {value:count.toLocaleString('en-US'),...fresh,detail:fresh.label};
}
export function weatherFacts(data,receivedAt,now=Date.now()) {
  const fresh=sourceLabel(receivedAt,now,60*minute,data?.stale===true),hourly=data?.hourly;
  if(!hourly||!Array.isArray(hourly.time)||!Array.isArray(hourly.temperature_2m))
    return {hours:[],stale:true,detail:'Hourly weather unavailable.'};
  const unit=data.hourly_units?.temperature_2m;
  if(!['°F','°C'].includes(unit))return {hours:[],stale:true,detail:'Weather units unavailable.'};
  const hours=[];
  for(let i=0;i<hourly.time.length&&hours.length<4;i++){
    const epoch=numeric(hourly.time[i]),temperature=numeric(hourly.temperature_2m[i]);
    if(epoch===null||temperature===null||epoch*1000<now-60*minute||epoch*1000>now+6*60*minute)continue;
    if(hours.some(hour=>hour.time===epoch))continue;
    const probability=numeric(hourly.precipitation_probability?.[i]);
    hours.push({time:epoch,label:new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hour:'numeric'}).format(new Date(epoch*1000)),
      temperature:`${Math.round(unit==='°C'?temperature*9/5+32:temperature)}°F`,
      rain:probability!==null&&probability>=0&&probability<=100?`${Math.round(probability)}% rain`:''});
  }
  return {hours,...fresh,stale:!hours.length||fresh.stale,detail:hours.length?`Open-Meteo · ${fresh.label}`:'Hourly weather unavailable.'};
}
export function homeIdentity(profile,deviceId) {
  const id=String(deviceId||'').trim().toUpperCase();
  if(!/^KIOSK_(0[2-9]|10)$/.test(id)||profile?.authenticated!==true
    ||String(profile.canonical_device_id||profile.device_id||'').toUpperCase()!==id)return null;
  const employeeName=String(profile.employee_name||profile.employee?.display_name||'').trim();
  if(!employeeName)return null;
  return {deviceId:id,employeeId:String(profile.employee_id||profile.employee?.id||''),employeeName,
    credentialId:String(profile.credential_id||'')};
}
export function homeBinding(identity) {
  return identity?JSON.stringify([identity.deviceId,identity.employeeId,identity.employeeName,identity.credentialId]):'';
}

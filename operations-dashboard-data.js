(function(root){
  'use strict';
  const ZONE='America/Chicago';
  const text=(v,fallback='Not provided')=>typeof v==='string'&&v.trim()?v.trim().slice(0,2000):fallback;
  const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
  const number=v=>count(v)===null?'Not provided':v.toLocaleString('en-US');
  const instant=v=>typeof v==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
  function localDate(now){return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
  function clock(value){const at=instant(value);return at===null?'Not provided':new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(at));}
  function stamp(value){const at=instant(value);return at===null?'Source time unknown':new Intl.DateTimeFormat('en-US',{timeZone:ZONE,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(at));}
  function localTime(v){const m=typeof v==='string'&&/^(\d{2}):(\d{2})(?::\d{2})?$/.exec(v);if(!m||+m[1]>23||+m[2]>59)return'Not provided';return `${+m[1]%12||12}:${m[2]} ${+m[1]>=12?'p.m.':'a.m.'} Central`;}
  const hasFeed=value=>value?.state==='current'||value?.state==='snapshot';
  const stableId=(a,b)=>String(a.id??a.ticket_id??'').localeCompare(String(b.id??b.ticket_id??''),'en',{numeric:true});
  const orderedTime=(a,b,direction=1)=>a===null?(b===null?0:1):b===null?-1:direction*(a-b);
  const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
    &&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  function calendarDate(value,today=null){
    if(!validDate(value))return text(value,'Date not provided');
    return `${value===today?'Today, ':''}${new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric'}).format(new Date(value+'T12:00:00Z'))}`;
  }
  function reportedDate(value){
    const datePrefix=typeof value==='string'&&/^(\d{4}-\d{2}-\d{2})/.exec(value);
    if(datePrefix&&!validDate(datePrefix[1]))return text(value);
    const at=instant(value);
    if(at!==null)return `${calendarDate(localDate(at))} · ${clock(value)}`;
    const raw=text(value),m=/^(\d{2})\/(\d{2})\/(\d{4})(.*)$/.exec(raw);
    if(m){const day=`${m[3]}-${m[1]}-${m[2]}`;return validDate(day)?calendarDate(day)+m[4]:raw;}
    const iso=/^(\d{4}-\d{2}-\d{2})(.*)$/.exec(raw);
    return iso&&validDate(iso[1])?calendarDate(iso[1])+iso[2]:raw;
  }
  function cityLocation(value,fallback){
    return text(text(value,fallback).replace(/(^|\s+|[^\p{L}\p{N}\s_])(?:at North Parkway and McLean Boulevard|@ N Parkway & N Mclean Blvd)\b/giu,(_,boundary)=>/^\s+$/.test(boundary)?'':boundary).trim(),fallback);
  }
  function visitOrder(a,b,timeField){
    const ad=validDate(a.date)?a.date:null,bd=validDate(b.date)?b.date:null;
    if(ad!==bd)return ad===null?1:bd===null?-1:ad.localeCompare(bd);
    const ai=instant(a[timeField]),bi=instant(b[timeField]);
    if(ai!==null&&bi!==null)return orderedTime(ai,bi)||stableId(a,b);
    const minutes=row=>{const at=instant(row[timeField]);if(at!==null)return at;
      if(timeField!=='start_at'||!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(row.start_time||''))return null;
      // Local wall time only; never fabricate a UTC instant for an unknown zone.
      return Number(row.start_time.slice(0,2))*60+Number(row.start_time.slice(3,5));};
    // Events use their declared Central wall time when instants are mixed with
    // local-only records, so the two representations remain comparable.
    const localMinutes=row=>{const at=instant(row[timeField]);if(at===null)return minutes(row);
      const parts=new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at));
      return Number(parts.find(p=>p.type==='hour').value)*60+Number(parts.find(p=>p.type==='minute').value);};
    return orderedTime(localMinutes(a),localMinutes(b))||stableId(a,b);
  }
  function orderedSchools(value){return hasFeed(value)&&Array.isArray(value.rows)
    ?value.rows.filter(row=>validDate(row?.date)).slice().sort((a,b)=>visitOrder(a,b,'arrival_at')):[];}
  // Display only facts actually supplied by the normal dashboard.v1 reader.
  // A closed-session projection is NOT an original completion receipt.
  function cleaning(summary,approved,now=Date.now()){
    // SQL uuid output is canonical hexadecimal, without an RFC version/variant restriction.
    const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
    // The HTTP completion operation ID has its own retained UUID admission.
    const completionId=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
    // Canonical Start preserves bounded text, not a UUID. Count SQL characters,
    // preserve the value verbatim, and reject a noncanonical ASCII-space trim.
    const sessionIdentity=v=>typeof v==='string'&&v.length>0&&v.length<=400
      &&v[0]!==' '&&v[v.length-1]!==' '&&!v.includes('\0')&&Array.from(v).length<=200;
    const servicePresentation=values=>{
      const shown=values.slice(0,200),notes=[];
      if(values.length>shown.length)notes.push(`Showing the first 200 of ${values.length} original service entries.`);
      if(shown.some(v=>v.trim().length>2000))notes.push('Displayed service text is limited to 2000 characters per entry; original answers are preserved.');
      return shown.map(v=>text(v)).join('; ')+(notes.length?' ['+notes.join(' ')+']':'');
    };
    const exactTime=v=>typeof v==='string'
      && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v)
      &&v.slice(0,4)!=='0000'&&instant(v)!==null
      &&new Date(v.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)===v.slice(0,10);
    const at=exactTime(summary?.meta?.generated_at)?instant(summary.meta.generated_at):null;
    const originalFields=['schema','state','reconciliation_id','context_id','occurrence_id','occurrence_fingerprint',
      'payload_fingerprint','employee_id','employee_name','device_id','credential_id','assignment_epoch','location_id',
      'session_uuid','client_session_id','client_completion_id','snapshot_id','started_at','completed_at','accepted_at',
      'work_result','services_performed','schedule_authority_revision','schedule_authority_revision_available'];
    const originalRecord=row=>{
      const value=row.latest_original_completion;
      if(!value||typeof value!=='object'||Array.isArray(value)
        ||Object.keys(value).sort().join(',')!==[...originalFields].sort().join(',')
        ||value.schema!=='custodial.dashboard-original-completion.v1'||value.state!=='SERVER_ACCEPTED_ORIGINAL_RECORD'
        ||!['reconciliation_id','context_id','occurrence_id','employee_id','device_id','credential_id','location_id'].every(k=>uuid(value[k]))
        ||!['session_uuid','client_session_id'].every(k=>sessionIdentity(value[k]))||!completionId(value.client_completion_id)
        ||value.location_id.toLowerCase()!==row.location_id.toLowerCase()
        ||!['occurrence_fingerprint','payload_fingerprint','snapshot_id'].every(k=>typeof value[k]==='string'&&/^[a-f0-9]{64}$/.test(value[k]))
        ||typeof value.employee_name!=='string'
        ||typeof value.assignment_epoch!=='string'||!/^[1-9]\d{0,18}$/.test(value.assignment_epoch)
        ||BigInt(value.assignment_epoch)>9223372036854775807n
        ||value.schedule_authority_revision!==null||value.schedule_authority_revision_available!==false
        ||!['full','details','selective','checked_no_cleaning_needed'].includes(value.work_result)
        ||!Array.isArray(value.services_performed)
        ||!value.services_performed.every(v=>typeof v==='string'&&v.trim())
        ||(value.work_result==='full'&&(value.services_performed.length!==1
          ||value.services_performed[0].trim().toLowerCase()!=='full cleaning services'))
        ||(['details','selective'].includes(value.work_result)&&(value.services_performed.length===0
          ||value.services_performed.some(v=>v.trim().toLowerCase()==='full cleaning services')))
        ||(value.work_result==='checked_no_cleaning_needed'&&value.services_performed.length!==0)
        ||!['started_at','completed_at','accepted_at'].every(k=>exactTime(value[k]))
        ||(row.open_session_status!==null&&row.open_session_status!==undefined&&row.open_session_uuid===value.session_uuid))return null;
      // Native start/finish order retains microseconds. Server acceptance uses
      // a separate transaction-start clock and need not follow native finish.
      const micros=v=>BigInt(instant(v))*1000n+BigInt((/\.(\d{1,6})/.exec(v)?.[1]||'').padEnd(6,'0').slice(3));
      if(micros(value.started_at)>=micros(value.completed_at))return null;
      return value;
    };
    const bound=summary?.meta?.contracts?.dashboard==='dashboard.v1'&&at!==null&&at<=now+60000
      &&Array.isArray(summary.restrooms)&&Array.isArray(summary.exhibits)
      &&summary.restrooms.length+summary.exhibits.length<=500;
    const rows=new Map(),duplicate=new Set();
    for(const row of bound?[...summary.restrooms,...summary.exhibits]:[]){
      if(!uuid(row?.location_id))continue;const id=row.location_id.toLowerCase();
      if(rows.has(id))duplicate.add(id);rows.set(id,row);
    }
    const cards=approved.map(place=>{
      const id=String(place.id),row=duplicate.has(id.toLowerCase())?null:rows.get(id.toLowerCase());
      const card={id,source:'Cleaning location',title:row?text(row.location_name||row.location_code):text(place.name,'Location name unavailable'),
        state:'unknown',lines:[],location:true};
      if(!row){card.lines.push('Current cleaning record unavailable. Map colour is not a completion receipt.');return card;}
      const pending=row.open_session_status==='pending_submit',working=row.open_session_status==='active';
      if(working&&sessionIdentity(row.open_session_uuid)){
        card.state='in_progress';
        card.lines.push(`Cleaning now, ${text(row.open_session_employee_name,'Name unavailable')}`);
        return card;
      }
      const original=originalRecord(row);
      const status=row.status_code==='cleaning_in_progress'?'in_progress':row.status_code;
      if(['okay','due_soon','overdue','in_progress','not_cleaned'].includes(status))card.state=status;
      const sessionId=row.latest_completed_session_id;
      const recorded=uuid(sessionId)&&sessionIdentity(row.latest_completed_session_uuid)&&exactTime(row.latest_completed_at)
        &&instant(row.latest_completed_at)<=at&&typeof row.latest_employee_name==='string'&&!!row.latest_employee_name.trim();
      const closed=recorded&&row.open_session_status===null&&row.open_session_uuid===null;
      // Retain a prior closed visit separately, never mix its exact identity with
      // current pending work or accept a contradictory same-session projection.
      const prior=(pending||working)&&recorded
        &&sessionIdentity(row.open_session_uuid)&&row.latest_completed_session_uuid!==row.open_session_uuid;
      if(pending||working){
        card.lines.push(pending?'Saved pending — not accepted as completed.':'Work in progress — not completed.');
        card.lines.push(`Current worker: ${text(row.open_session_employee_name,'Unavailable')}`);
        if(sessionIdentity(row.open_session_uuid))card.lines.push(`Current session: ${row.open_session_uuid}`);
        if(card.state==='okay'||card.state==='in_progress')card.state=pending?'pending_submit':'in_progress';
      }
      if((closed||prior)&&(!original||original.session_uuid!==row.latest_completed_session_uuid)){
        card.lines.push(`${prior?'Prior closed cleaning record':'Closed cleaning record'} · ${stamp(row.latest_completed_at)}`,
          `Recorded worker: ${text(row.latest_employee_name)}`,
          `Location: ${row.location_id} · ${text(row.location_code)}`,
          `Closed session: ${row.latest_completed_session_uuid} · Record ${sessionId}`);
        const services=Array.isArray(row.services_performed)&&row.services_performed.every(v=>typeof v==='string')
          ?servicePresentation(row.services_performed):'';
        card.lines.push(`Reported services: ${services||'Not provided'}`);
      }else if(!original)card.lines.push('Closed cleaning record unavailable.');
      if(original){
        const label=pending||working?'Preceding server-accepted original record':'Server-accepted original record';
        const kind=original.work_result==='full'?'Full cleaning':['details','selective'].includes(original.work_result)?'Selective cleaning':'Check only — no cleaning reported needed';
        card.lines.push(label,`Recorded work: ${kind}`,`Original employee: ${text(original.employee_name)} · ${original.employee_id}`,
          `Original location: ${original.location_id} · ${text(row.location_code)}`,
          `Original session: ${original.session_uuid} · Client session: ${original.client_session_id}`,
          `Original completion: ${original.client_completion_id}`,
          `Occurrence: ${original.occurrence_id} · Fingerprint: ${original.occurrence_fingerprint}`,
          `Reconciliation: ${original.reconciliation_id} · Context: ${original.context_id}`,
          `Payload fingerprint: ${original.payload_fingerprint} · Snapshot: ${original.snapshot_id}`,
          `Original device: ${original.device_id} · Credential ID: ${original.credential_id}`,
          `Original assignment epoch: ${original.assignment_epoch}`,
          `Started: ${original.started_at} · ${clock(original.started_at)}`,
          `Completed: ${original.completed_at} · ${clock(original.completed_at)}`,
          `Accepted: ${original.accepted_at} · ${clock(original.accepted_at)}`,
          `Reported services: ${servicePresentation(original.services_performed)||(original.work_result==='checked_no_cleaning_needed'?'none (check only)':'Not provided')}`,
          'Original schedule authority revision: unavailable (not retained by source).',
          'Native clock alignment: unavailable; server acceptance time does not order the native clock.',
          'Recorded original acceptance only — not physical or overall current-source proof.');
      }else card.lines.push('Original completion receipt, employee ID, occurrence and revision unavailable or unconfirmed; no original-request acceptance inferred.');
      if(card.state==='okay'&&!closed&&!prior&&!original)card.state='unknown';
      return card;
    });
    return{title:`All ${approved.length} locations`,cards,
      note:bound?`Authenticated dashboard summary · ${stamp(summary.meta.generated_at)}. Pending work and closed cleaning history are separate; no local queued item is accepted by this board.`
        :'Current authenticated cleaning summary unavailable. Approved locations remain visible without a claimed completion.'};
  }
  function feed(value){return hasFeed(value)&&Array.isArray(value.rows)&&value.rows.length<=10000
    &&instant(value.generated_at)!==null&&(value.state!=='snapshot'||(value.coverage==='imported_only'&&value.mailbox_completeness_verified===false))
    ?{state:value.state,rows:value.rows,generated_at:value.generated_at,coverage:value.coverage}
    :{state:'unavailable',rows:[]};}
  function operations(payload){const d=payload?.data;
    if(payload?.ok!==true||d?.schema!=='custodial.operations-board.v1'||d.timezone!==ZONE
      ||instant(d.generated_at)===null||!Array.isArray(d.events)||d.events.length>500)throw new Error('operations_contract_unavailable');
    return {generated_at:d.generated_at,events:d.events,manager_on_duty:d.manager_on_duty,schools:feed(d.schools),spiceworks:feed(d.spiceworks),spiceworks_activity:feed(d.spiceworks_activity),city:feed(d.city)};
  }
  function managerOnDuty(value,now=Date.now()){
    return value?.schema==='custodial.manager-on-duty.v1'&&value.state==='confirmed'
      &&value.service_date===localDate(now)&&typeof value.manager_id==='string'
      &&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.manager_id)
      &&typeof value.name==='string'&&value.name.trim()&&value.name.length<=100
      ?value.name.trim():'Unavailable';
  }
  function spiceworksActivity(value,now=Date.now()){
    const unavailable={title:'Spiceworks · new-ticket notices · 72h',cards:[],note:'New-ticket notices unavailable.'};
    if(!hasFeed(value)||!Array.isArray(value.rows))return unavailable;
    const cards=[],seen=new Set();
    for(const row of value.rows){
      const at=instant(row?.at);
      if(!/^[1-9]\d{0,9}$/.test(row?.ticket_id||'')||!['opened','closed','reopened'].includes(row.kind)||at===null)return unavailable;
      if(row.kind!=='opened'||at<now-72*60*60*1000||at>now)continue;
      const key=`${row.ticket_id}:${row.kind}:${row.at}`;if(seen.has(key))continue;seen.add(key);
      cards.push({id:key,source:'Spiceworks',title:`#${row.ticket_id} · ${text(row.title,'Ticket title unavailable')}`,
        state:row.kind==='closed'?'CLOSED':'OPEN',activity:row.kind,at,
        lines:[`${row.kind[0].toUpperCase()+row.kind.slice(1)}`]});
    }
    cards.sort((a,b)=>b.at-a.at||stableId(a,b));
    return{title:'Spiceworks · new-ticket notices · 72h',cards,note:`Imported notifications · updated ${stamp(value.generated_at)}. ${cards.length?'':'No imported new-ticket notices received in this period. '}Only new-ticket notices received in the last 72 hours, newest received first. This is notification receipt time, not verified ticket creation time. Other new-ticket notices may not yet be received; current ticket status is not confirmed.`};
  }
  function cityWorkOrders(value){
    const unavailable={title:'Open City work orders',cards:[],note:'Current City work orders unavailable.'};
    if(value?.state!=='current'||value.coverage!=='city_active_zoo'||!Array.isArray(value.rows))return unavailable;
    const states=['Approved','Awaiting Materials','In Progress','Ready For Review','Requested'];
    if(value.rows.some(row=>!row?.id||!states.includes(row.status)||!row.facility?.startsWith('15Z')))return unavailable;
    const rows=value.rows.slice().sort((a,b)=>orderedTime(instant(a.requested_at),instant(b.requested_at),-1)||stableId(a,b));
    return{title:'Open City work orders',cards:rows.map(row=>({id:row.id,source:'City of Memphis',
      title:`${row.work_order_id?'#'+row.work_order_id:'Request '+row.id} · ${cityLocation(row.facility)}`,state:'OPEN',
      status:row.status,lines:[row.status,cityLocation(row.description,'Description unavailable.'),`Requested: ${instant(row.requested_at)===null?'Date unknown':stamp(row.requested_at)}`,
        ...(row.facility_label_conflict===true?['City facility labels differ; verify the location.']:[])]})),
      note:`City active list · ${value.rows.length} Zoo work orders · newest requested date first; unknown dates last · updated ${stamp(value.generated_at)}.`};
  }
  function attendance(payload){const d=payload?.data;
    if(payload?.ok!==true||count(d?.attendance)===null)return{value:'Unavailable',note:'Gate count source unavailable.',stale:true};
    const time=d.source_timestamp||d.fetched_at||d.updated_at,unknown=instant(time)===null||typeof d.stale!=='boolean';
    return{value:d.attendance.toLocaleString('en-US'),note:`${stamp(time)}${unknown?' · Freshness unknown':d.stale?' · Stale source':''}`,
      stale:unknown||d.stale};
  }
  function weather(payload,now=Date.now()){
    const c=payload?.current,at=typeof c?.time==='number'?c.time*1000:NaN;
    if(!Number.isFinite(at)||!Number.isFinite(c.temperature_2m)||payload.current_units?.temperature_2m!=='°F')
      return{value:'Unavailable',note:'Weather source unavailable.',hour:'Next-hour forecast unavailable.',stale:true};
    const stale=now-at>45*60000||at>now+60000;
    const h=payload.hourly,idx=Array.isArray(h?.time)?h.time.findIndex(t=>Number.isFinite(t)&&t*1000>now&&t*1000<=now+3600000):-1;
    const valid=idx>=0&&Number.isFinite(h.temperature_2m?.[idx])&&Number.isFinite(h.precipitation_probability?.[idx])
      &&h.precipitation_probability[idx]>=0&&h.precipitation_probability[idx]<=100&&payload.hourly_units?.temperature_2m==='°F';
    const day=localDate(now),daily=payload.daily;
    const di=payload.timezone===ZONE&&Array.isArray(daily?.time)?daily.time.findIndex(t=>Number.isFinite(t)&&Math.abs(t*1000)<=8640000000000000&&localDate(t*1000)===day):-1;
    const high=di>=0?daily.temperature_2m_max?.[di]:null,low=di>=0?daily.temperature_2m_min?.[di]:null;
    const validDaily=Number.isFinite(high)&&Number.isFinite(low)&&high>=low&&payload.daily_units?.temperature_2m_max==='°F'&&payload.daily_units?.temperature_2m_min==='°F';
    const highLow=validDaily?`High ${Math.round(high)}°F · Low ${Math.round(low)}°F`:'High/low unavailable.';
    const forecastTime=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hour:'numeric',minute:'2-digit'}).format(new Date(at)).replace(':00','').replace('AM','a.m.').replace('PM','p.m.');
    return{day,highLow,value:`${Math.round(c.temperature_2m)}°F`,note:`${forecastTime}${stale?' · Stale forecast':''}`,
      hour:valid?`${clock(new Date(h.time[idx]*1000).toISOString())}: ${Math.round(h.temperature_2m[idx])}°F · ${h.precipitation_probability[idx]}% rain`:'Next-hour forecast unavailable.',stale};
  }
  function tickets(summary,mail){
    const scan=Array.isArray(summary?.open_tickets)?summary.open_tickets:[];
    const seen=new Set(),cards=[];
    for(const row of scan){if(!row?.ticket_id||seen.has(row.ticket_id))continue;seen.add(row.ticket_id);
      cards.push({id:`scan:${row.ticket_id}`,source:'Scan session',title:text(row.location_name||row.location_code,'Location not provided'),
        state:'OPEN',lines:[text(row.maintenance_issue),`Reported: ${reportedDate(row.date_submitted_display||row.created_at_display)}`,
          ...(row.fixture_identifier?[`Fixture: ${text(row.fixture_identifier)}`]:[])]});}
    for(const row of hasFeed(mail)?mail.rows:[]){
      if(!row?.ticket_id||row.custodial!==true||row.active!==true||row.status==='Closed'||seen.has(`spice:${row.ticket_id}`))continue;
      seen.add(`spice:${row.ticket_id}`);cards.push({id:`spice:${row.ticket_id}`,source:'Spiceworks',title:`#${row.ticket_id} · ${text(row.title,'Ticket title not provided')}`,
        state:text(row.status,'Unknown'),lines:[`Status: ${text(row.status,'Unknown')}`,`Category: ${text(row.category)} · Assignee: ${text(row.assignee)}`]});
    }
    const mailNote=mail?.state==='snapshot'?`Spiceworks imported snapshot · ${stamp(mail.generated_at)}. Mailbox completeness and current freshness are NOT verified; newer closure/reassignment messages may be missing.`
      :mail?.state==='current'?'Spiceworks: verified imported status; this board never edits external tickets.':'Spiceworks unavailable: no complete validated imported snapshot is available.';
    return{title:'Custodial tickets',cards,note:`Open the Dashboard to close eligible scan-session tickets. Other managers cannot close tickets from unrelated sources. No separate delete control.\n${mailNote}`};
  }
  function events(rows,now,{labelToday=false}={}){const cards=[],history=[];
    const today=labelToday?localDate(now):null;
    const eventDate=value=>calendarDate(value,today);
    for(const row of Array.isArray(rows)?rows.filter(row=>row?.id).slice().sort((a,b)=>visitOrder(a,b,'start_at')):[]){
      const end=instant(row.end_at),lastDate=row.end_date||row.date;
      const pastDate=end===null&&/^\d{4}-\d{2}-\d{2}$/.test(lastDate||'')&&lastDate<localDate(now);
      const ended=end!==null?end<=now:pastDate;
      const status=row.needs_review?'REVIEW_REQUIRED':text(row.status,'UNKNOWN');
      const when=`${eventDate(row.date)}${row.end_date&&row.end_date!==row.date?` → ${eventDate(row.end_date)}`:''}`;
      const start=instant(row.start_at)!==null?clock(row.start_at):localTime(row.start_time);
      const finish=end!==null?clock(row.end_at):localTime(row.end_time);
      const card={id:row.id,revision:row.revision,source:'Events',state:status,title:text(row.name,'Unnamed event'),
        lines:[text(row.location,'Location not provided'),`${when} · ${start} → ${finish}`,
          `Attendees: ${number(row.attendees)}`,
          `Custodial: ${[...(Array.isArray(row.requirements)?row.requirements.filter(x=>typeof x==='string'):[]),row.custodial_notes].filter(Boolean).map(x=>text(x)).join('; ')||'Not provided'}`,
          status==='CANCELLED'?'Cancelled':status==='SUPERSEDED'?'Superseded by a newer event':status==='REVIEW_REQUIRED'?'Needs source review — not an approved operational event':ended?'Scheduled to have ended — departure not independently confirmed':end===null?'End time/instant not provided — not automatically expired':'Scheduled event'],
        active:status==='SCHEDULED'&&!ended};
      (ended||status==='CANCELLED'||status==='SUPERSEDED'?history:cards).push(card);
    }
    return{title:'Events',cards,history,note:'Structured Events data only. Cancelled, superseded and scheduled-ended records move to history; source mail is not displayed. Scheduled end is not a physical departure observation.'};
  }
  // Planned attendance is not live occupancy or distinct visitors across events.
  function dailyExpected(ops,now=Date.now()){
    const today=localDate(now);
    function total(rows,available,school,snapshot=false){
      if(!available)return {value:'Unknown',note:'Source unavailable.'};
      let sum=0,unknown=false;const seen=new Map(),conflicts=new Set();
      for(const row of rows){if(!row?.id)continue;const signature=JSON.stringify(row);
        if(seen.has(row.id)&&seen.get(row.id)!==signature)conflicts.add(row.id);else seen.set(row.id,signature);}
      seen.clear();
      for(const row of rows){
        if(!row||['CANCELLED','SUPERSEDED'].includes(row.status))continue;
        if(!validDate(row.date)){unknown=true;continue;}
        if(!school&&row.end_date&&(!validDate(row.end_date)||row.end_date<row.date)){unknown=true;continue;}
        if(school?row.date!==today:row.date>today||(row.end_date||row.date)<today)continue;
        if(!row.id||conflicts.has(row.id)){unknown=true;continue;}
        const signature=JSON.stringify(row);
        if(seen.has(row.id)){if(seen.get(row.id)!==signature)unknown=true;continue;}
        seen.set(row.id,signature);
        if(row.needs_review||row.status!=='SCHEDULED'){unknown=true;continue;}
        // A whole-run attendance estimate cannot be allocated to individual days.
        if(!school&&row.end_date&&row.end_date!==row.date){unknown=true;continue;}
        const n=school?(count(row.students)!==null&&count(row.adults)!==null?count(row.students+row.adults):null):count(row.attendees);
        if(n===null){unknown=true;continue;}
        sum+=n;
        if(school&&(count(row.unclassified)===null||row.unclassified>0))unknown=true;
      }
      if(!Number.isSafeInteger(sum))return {value:'Unknown',note:'Counts need review.'};
      return {value:unknown?(sum?`${number(sum)} known · incomplete`:'Unknown · incomplete'):number(sum),
        note:`Planned people in loaded records; not live occupancy.${snapshot?' Imported snapshot; freshness unverified.':''}${school?'':' Not unique visitors.'}`};
    }
    return {schools:total(ops?.schools?.rows||[],hasFeed(ops?.schools)&&Array.isArray(ops?.schools?.rows),true,ops?.schools?.state==='snapshot'),
      events:total(ops?.events||[],Array.isArray(ops?.events),false)};
  }
  function schools(value,now){
    const today=localDate(now),rows=orderedSchools(value);
    const totals={students:0,adults:0,total:0,unclassified:0};let unknown=false;
    for(const row of rows){if(row.date!==today)continue;if(row.status==='CANCELLED'||row.status==='SUPERSEDED')continue;
      for(const key of Object.keys(totals)){if(count(row[key])===null)unknown=true;else totals[key]+=row[key];}}
    const cards=[],history=[];
    for(const row of rows){
      const start=instant(row.arrival_at);
      // The supported attachment has no departure field. Do not revive the
      // historical policy as a fact or silently adopt an unsupported end.
      const unsupportedDeparture=row.departure_at!=null||row.departure_source!=null;
      const contradiction=unsupportedDeparture||start===null||localDate(start)!==row.date||row.status==='REVIEW_REQUIRED';
      const inactive=row.status==='CANCELLED'||row.status==='SUPERSEDED';
      const identified=count(row.students)!==null&&count(row.adults)!==null?count(row.students+row.adults):null;
      const card={id:row.id,source:'School visit',title:text(row.name),state:inactive?row.status:contradiction?'REVIEW_REQUIRED':'SCHEDULED',
        lines:[`${calendarDate(row.date)} · Arrival ${clock(row.arrival_at)} · Departure not provided`,
          `Students: ${number(row.students)} · Chaperones: ${number(row.chaperones)} · Teachers: ${number(row.teachers)}`,
          `Adults: ${number(row.adults)} · Identified people: ${number(identified)} · Unclassified ticket units: ${number(row.unclassified)} · Reported quantity: ${number(row.total)} · Buses: ${number(row.buses)}`,
          text(row.notes,'Operational notes not provided'),inactive?row.status:contradiction?'GAP: source arrival/departure needs review; no departure or overnight visit inferred.':row.date<today?'Past scheduled date — arrival, presence and departure not independently confirmed.':row.date>today?'Upcoming scheduled visit — arrival and departure not independently confirmed.':start>now?'Expected later today — arrival not independently confirmed; departure time not provided.':'Expected arrival time has passed — arrival, presence and departure not independently confirmed.']};
      // Planned load is not observed occupancy. Past dates and explicit source
      // cancellation/supersession belong in history without implying departure.
      (inactive||row.date<today?history:cards).push(card);
    }
    return{title:'Upcoming school groups',cards,history,note:!hasFeed(value)?'School feed unavailable: no verified Outlook attachment projection is bound. Daily counts unknown.'
      :`${value.state==='snapshot'?`Imported snapshot · ${stamp(value.generated_at)}. Mailbox completeness/current freshness NOT verified. `:''}Today's planned source counts: ${unknown?'incomplete':`${totals.students} students · ${totals.adults} adults · ${number(totals.students+totals.adults)} identified people · ${totals.unclassified} unclassified ticket units · ${totals.total} reported quantity`}. Departure times are not provided by this attachment; no general cutoff is established. Today and upcoming visit dates are shown, with past dates in history; date rollover does not confirm departure.`};
  }

  function publicCleaning(summary,approved,now=Date.now()){
    const view=cleaning(summary,approved,now);
    const prefixes=['Cleaning now,','Saved pending','Work in progress','Current worker:','Prior closed cleaning record ·',
      'Closed cleaning record ·','Recorded worker:','Reported services:','Current cleaning record unavailable.','Closed cleaning record unavailable.'];
    return {...view,cards:view.cards.map(card=>({...card,lines:card.lines.filter(line=>prefixes.some(prefix=>line.startsWith(prefix)))})),
      note:summary?.meta?.audience==='public_readonly'?`Read-only cleaning status · ${stamp(summary.meta.generated_at)}. Pending work is shown separately from closed cleaning history.`:'Current cleaning status unavailable.'};
  }
  function operationalView(kind,view){
    const notes={locations:'Cleaning status and recorded work. Saved pending work is not complete.',
      events:'Upcoming events and event history.',schools:'Planned school visits. Arrival and departure are not confirmed.',
      tickets:'Ticket details. Recent changes may not yet be received.',activity:'Ticket details. Recent changes may not yet be received.'};
    const line=(value)=>value.replace(/^Original employee: (.*?) · [a-f0-9-]+$/i,'Recorded worker: $1')
      .replace(/^Started: .*? · /,'Started: ').replace(/^Completed: .*? · /,'Completed: ').replace(/^Accepted: .*? · /,'Saved: ')
      .replace('Current cleaning record unavailable. Map colour is not a completion receipt.','Current cleaning record unavailable.')
      .replace('GAP: source arrival/departure needs review; no departure or overnight visit inferred.','Visit time needs review.')
      .replace('Expected later today — arrival not independently confirmed; departure time not provided.','Expected later today; arrival and departure unconfirmed.')
      .replace('Expected arrival time has passed — arrival, presence and departure not independently confirmed.','Expected arrival time has passed; arrival and departure unconfirmed.')
      .replace('Needs source review — not an approved operational event','Needs review')
      .replace('Scheduled to have ended — departure not independently confirmed','Scheduled end has passed')
      .replace('End time/instant not provided — not automatically expired','End time unavailable');
    const allowed=/^(Cleaning now,|Saved pending|Work in progress|Current worker:|Prior closed cleaning record|Closed cleaning record|Recorded worker:|Reported services:|Recorded work:|Original employee:|Started:|Completed:|Accepted:|Current cleaning record unavailable)/;
    const present=card=>({...card,lines:card.lines.filter(value=>kind!=='locations'||allowed.test(value)).map(line)});
    const note=kind==='schools'?`${/Today's planned source counts: ([^.]+)\./.exec(view.note)?.[0].replace('source ','')||'School counts unavailable.'} Planned visits; arrival and departure unconfirmed.`
      :['activity','tickets'].includes(kind)&&!view.cards.length&&/unavailable/i.test(view.note)?'Ticket details unavailable.':notes[kind]||view.note;
    return{...view,note,cards:view.cards.map(present),...(view.history?{history:view.history.map(present)}:{})};
  }
  const api=Object.freeze({ZONE,text,count,instant,localDate,clock,calendarDate,reportedDate,operations,managerOnDuty,attendance,weather,tickets,spiceworksActivity,cityWorkOrders,events,schools,dailyExpected,orderedSchools,cleaning,publicCleaning,operationalView});
  root.MemphisOperationsData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

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
  function feed(value){return hasFeed(value)&&Array.isArray(value.rows)&&value.rows.length<=10000
    &&instant(value.generated_at)!==null&&(value.state!=='snapshot'||(value.coverage==='imported_only'&&value.mailbox_completeness_verified===false))
    ?{state:value.state,rows:value.rows,generated_at:value.generated_at}
    :{state:'unavailable',rows:[]};}
  function operations(payload){const d=payload?.data;
    if(payload?.ok!==true||d?.schema!=='custodial.operations-board.v1'||d.timezone!==ZONE
      ||instant(d.generated_at)===null||!Array.isArray(d.events)||d.events.length>500)throw new Error('operations_contract_unavailable');
    return {generated_at:d.generated_at,events:d.events,schools:feed(d.schools),spiceworks:feed(d.spiceworks)};
  }
  function attendance(payload){const d=payload?.data;
    if(payload?.ok!==true||count(d?.attendance)===null)return{value:'Unavailable',note:'Gate count source unavailable.',stale:true};
    const time=d.source_timestamp||d.fetched_at||d.updated_at,unknown=instant(time)===null||typeof d.stale!=='boolean';
    return{value:d.attendance.toLocaleString('en-US'),note:`${unknown?'Gate count; freshness unknown':d.stale?'Stale gate count':'Current gate count'} · ${stamp(time)}`,
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
    return{value:`${Math.round(c.temperature_2m)}°F`,note:`${stale?'Stale forecast':'Open-Meteo forecast'} · ${clock(new Date(at).toISOString())}`,
      hour:valid?`${clock(new Date(h.time[idx]*1000).toISOString())}: ${Math.round(h.temperature_2m[idx])}°F · ${h.precipitation_probability[idx]}% rain`:'Next-hour forecast unavailable.',stale};
  }
  function tickets(summary,mail){
    const scan=Array.isArray(summary?.open_tickets)?summary.open_tickets:[];
    const seen=new Set(),cards=[];
    for(const row of scan){if(!row?.ticket_id||seen.has(row.ticket_id))continue;seen.add(row.ticket_id);
      cards.push({id:`scan:${row.ticket_id}`,source:'Custodial ticket',title:text(row.location_name||row.location_code,'Location not provided'),
        state:'OPEN',lines:[text(row.maintenance_issue),`Reported: ${text(row.date_submitted_display||row.created_at_display)}`,
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
  function events(rows,now){const cards=[],history=[];
    for(const row of Array.isArray(rows)?rows:[]){if(!row?.id)continue;
      const end=instant(row.end_at),ended=end!==null&&end<=now;
      const status=row.needs_review?'REVIEW_REQUIRED':text(row.status,'UNKNOWN');
      const when=`${text(row.date,'Date not provided')}${row.end_date&&row.end_date!==row.date?` → ${row.end_date}`:''}`;
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
  function schools(value,now){
    const today=localDate(now),rows=hasFeed(value)?value.rows.filter(r=>r?.date===today):[];
    const localHour=at=>Number(new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hour:'2-digit',hourCycle:'h23'}).format(new Date(at)));
    const afterDeparture=localHour(now)>=13;
    const totals={students:0,adults:0,total:0};let unknown=false;
    for(const row of rows){if(row.status==='CANCELLED'||row.status==='SUPERSEDED')continue;
      for(const key of Object.keys(totals)){if(count(row[key])===null)unknown=true;else totals[key]+=row[key];}}
    const cards=[],history=[];
    for(const row of rows){
      const end=instant(row.departure_at),start=instant(row.arrival_at);
      // The producer must bind the owner policy on this date. No invented
      // overnight conversion or untrusted later departure extends the board.
      const policy=end!==null&&localDate(end)===today&&localHour(end)===13&&new Date(end).getUTCMinutes()===0
        &&new Date(end).getUTCSeconds()===0&&new Date(end).getUTCMilliseconds()===0
        &&row.departure_source==='owner_policy_13:00_America/Chicago';
      const contradiction=!policy||start===null||start>=end||row.status==='REVIEW_REQUIRED';
      const inactive=row.status==='CANCELLED'||row.status==='SUPERSEDED';
      const card={id:row.id,source:'School visit',title:text(row.name),state:inactive?row.status:contradiction?'REVIEW_REQUIRED':afterDeparture?'SCHEDULED_ENDED':'SCHEDULED',
        lines:[`${today} · Arrival ${clock(row.arrival_at)} · Scheduled departure 1:00 p.m. Central (owner policy)`,
          `Students: ${number(row.students)} · Chaperones: ${number(row.chaperones)} · Teachers: ${number(row.teachers)}`,
          `Adults: ${number(row.adults)} · Unclassified: ${number(row.unclassified)} · Total: ${number(row.total)} · Buses: ${number(row.buses)}`,
          text(row.notes,'Operational notes not provided'),inactive?row.status:contradiction?'GAP: source arrival/departure needs review; no overnight visit inferred.':afterDeparture?'Scheduled departure elapsed — not a physical departure observation':start>now?'Expected later today — arrival not independently confirmed':'Within scheduled visit window — on-site presence not independently confirmed']};
      // Bad input cannot extend an on-site card past the owner cutoff.
      (inactive||afterDeparture?history:cards).push(card);
    }
    return{title:"Today's schools",cards,history,note:!hasFeed(value)?'School feed unavailable: no verified Outlook attachment projection is bound. Daily counts unknown.'
      :`${value.state==='snapshot'?`Imported snapshot · ${stamp(value.generated_at)}. Mailbox completeness/current freshness NOT verified. `:''}Daily expected totals (retained after 1 p.m.): ${unknown?'incomplete':`${totals.students} students · ${totals.adults} adults · ${totals.total} people`}. Visits leave this active board at 1 p.m. Central, per owner policy; that is not a physical departure observation.`};
  }
  const api=Object.freeze({ZONE,text,count,instant,localDate,clock,operations,attendance,weather,tickets,events,schools});
  root.MemphisOperationsData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

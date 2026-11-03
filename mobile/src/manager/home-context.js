import '../../../operations-dashboard-data.js';
const DATA=globalThis.MemphisOperationsData;
const problemRoutes={maintenance:'./dashboard.html#tickets-section',guest:'./guest-issues.html',saved_work:'./admin.html#sessions-panel'};
const instant=value=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
export function createManagerHomeContext({document,request,isCurrent,now=()=>Date.now()}) {
  const el=id=>document.getElementById(id), node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
  let generation=0;
  function clear() {generation++;el('today-events').replaceChildren();el('open-problems-list').replaceChildren();
    el('today-events-source').textContent='Event source unavailable.';el('open-problems-source').textContent='Problem sources unavailable.';
    el('today-open-problems').textContent='Unavailable';el('today-open-problems').dataset.state='unavailable';}
  async function refresh() {
    clear();const captured=generation,current=()=>captured===generation&&isCurrent();
    el('today-events-source').textContent='Loading today’s event context…';el('open-problems-source').textContent='Loading problem sources…';
    const events=request('/dashboard-api/operations').then(data=>{
      if(!current())return;
      const value=DATA.operations({ok:true,data}),today=DATA.localDate(now());
      if(Date.parse(value.generated_at)>now()+60000)throw new Error('Invalid source time');
      const todayRows=value.events.filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date||'')&&row.date<=today&&(row.end_date||row.date)>=today);
      const projection=DATA.events(todayRows,now()),cards=[...projection.cards,...projection.history];
      el('today-events').replaceChildren(...cards.map(card=>{const article=node('article','');article.append(node('h3',card.title),node('p',card.lines.join(' · ')));return article;}));
      el('today-events-source').textContent=`${cards.length ? `${cards.length} source event records for today.` : 'No events dated today in this source.'} Retrieved ${DATA.clock(value.generated_at)} Central. Scheduled times do not confirm attendance or staffing.`;
    }).catch(()=>{if(current()){el('today-events').replaceChildren();el('today-events-source').textContent='Today’s event source unavailable. Open Events to check current records.';}});
    const problems=request('/admin-api/custodial/open-problems').then(data=>{
      if(!current())return;
      if(data?.schema!=='custodial.open-problems.v1'||!instant(data.generated_at)||Date.parse(data.generated_at)>now()+60000||!Number.isSafeInteger(data.total)||data.total<0||!Array.isArray(data.items)||data.items.length>200||data.total<data.items.length)throw new Error('Problem sources unavailable');
      for(const item of data.items)if(!item||!Object.hasOwn(problemRoutes,item.source)||typeof item.source_id!=='string'||!item.source_id||typeof item.source_label!=='string'||!item.source_label||typeof item.status!=='string'||!item.status)throw new Error('Invalid problem item');
      el('open-problems-list').replaceChildren(...data.items.map(item=>{const article=node('article','');
        article.append(node('h3',item.source_label),node('p',typeof item.location==='string'?item.location:'Location unavailable'),node('p',typeof item.summary==='string'?item.summary:'Summary unavailable'),node('p',`Status: ${item.status} · Recorded: ${instant(item.observed_at)?DATA.clock(item.observed_at)+' Central':'time unavailable'}`));
        const link=node('a','Review '+item.source_label.toLowerCase());link.href=problemRoutes[item.source];article.append(link);return article;}));
      el('today-open-problems').textContent=String(data.total);el('today-open-problems').dataset.state='current';
      el('open-problems-source').textContent=`${data.total===0?'No open problems in the included sources.':`Showing ${data.items.length} of ${data.total} open problems.`} Cleaning and maintenance reminders, approved enabled guest issues, and quarantined saved work requiring review. Retrieved ${DATA.clock(data.generated_at)} Central.`;
    }).catch(()=>{if(current()){el('today-open-problems').textContent='Unavailable';el('today-open-problems').dataset.state='unavailable';el('open-problems-list').replaceChildren();el('open-problems-source').textContent='Combined problem sources unavailable. No zero count is inferred.';}});
    await Promise.allSettled([events,problems]);
  }
  return {refresh,clear};
}

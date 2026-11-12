const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../operations-dashboard-data.js');
test('calendar dates retain their day without timezone rollover',()=>{
 assert.equal(D.calendarDate('2026-11-13'),'Friday, November 13');
 assert.equal(D.calendarDate('2026-02-30'),'2026-02-30');
 assert.equal(D.reportedDate('2026-02-30T12:00:00Z'),'2026-02-30T12:00:00Z');
 assert.equal(D.calendarDate(null),'Date not provided');
 assert.equal(D.reportedDate('11/13/2026 08:00 AM Central'),'Friday, November 13 08:00 AM Central');
 assert.equal(D.reportedDate('2026-11-13T02:00:00Z'),'Thursday, November 12 · 8:00 PM CST');
});
test('event and school cards retain location time and counts',()=>{
 const now=Date.parse('2026-11-12T17:00:00Z');
 const card=D.events([{id:'1',name:'Event',date:'2026-11-13',end_date:'2026-11-14',location:'Birdhouse',start_time:'08:00',end_time:'17:00',attendees:60,status:'SCHEDULED'}],now).cards[0];
 assert.equal(card.lines[0],'Birdhouse');assert.match(card.lines[1],/Friday, November 13 → Saturday, November 14/);assert.match(card.lines[1],/8:00 a.m./);assert.equal(card.lines[2],'Attendees: 60');
 const school=D.schools({state:'snapshot',rows:[{id:'s',date:'2026-11-13',name:'School',arrival_at:'2026-11-13T14:00:00Z',students:40,adults:20}]},now).cards[0];
 assert.match(school.lines[0],/^Friday, November 13 · Arrival 8:00 AM CST/);
 const ticket=D.tickets({open_tickets:[{ticket_id:'t',date_submitted_display:'11/13/2026 08:00 AM Central'}]}).cards[0];
 assert.equal(ticket.lines[1],'Reported: Friday, November 13 08:00 AM Central');
});
test('city removes only generic intersection and preserves source and operational details',()=>{
 const row={id:'1',work_order_id:'123',facility:'15Z05 Birdhouse at North Parkway and McLean Boulevard',status:'Approved',description:'Repair light at North Parkway and McLean Boulevard. Zoo location: Birdhouse kitchen',requested_at:'2026-11-13T14:00:00Z'};
 const original=JSON.stringify(row),card=D.cityWorkOrders({state:'current',coverage:'city_active_zoo',rows:[row]}).cards[0];
 assert.equal(card.title,'#123 · 15Z05 Birdhouse');assert.equal(card.lines[0],'Approved');assert.equal(card.lines[1],'Repair light. Zoo location: Birdhouse kitchen');assert.match(card.lines[2],/^Requested:/);assert.equal(JSON.stringify(row),original);
});

test('City details without generic address preserve leading decimal and punctuation',()=>{
 for(const description of ['.5-inch supply pipe leaking; replace fitting.',', verify repair details.']){
  const card=D.cityWorkOrders({state:'current',coverage:'city_active_zoo',rows:[{id:'1',facility:'15Z05 Birdhouse',status:'Approved',description}]}).cards[0];
  assert.equal(card.lines[1],description);
 }
});

test('event ticker Today label uses Memphis calendar day, never host or UTC day',()=>{
 const event={id:'e',name:'Event',date:'2026-11-13',location:'Birdhouse',start_time:'08:00',end_time:'17:00',attendees:60,status:'SCHEDULED'};
 for(const [now,expected] of [['2026-11-13T05:59:59Z','Friday, November 13'],['2026-11-13T06:00:00Z','Today, Friday, November 13']]){
  const card=D.events([event],Date.parse(now),{labelToday:true}).cards[0];
  assert.ok(card.lines[1].startsWith(expected+' ·'));assert.equal(card.lines[0],'Birdhouse');assert.equal(card.lines[2],'Attendees: 60');
 }
 const dayAfter=D.events([event],Date.parse('2026-11-14T06:00:00Z'),{labelToday:true});
 assert.equal(dayAfter.cards.length,0);assert.ok(dayAfter.history[0].lines[1].startsWith('Friday, November 13 ·'));
 const summer={...event,date:'2026-07-01'};
 assert.ok(D.events([summer],Date.parse('2026-07-01T05:00:00Z'),{labelToday:true}).cards[0].lines[1].startsWith('Today, Wednesday, July 1 ·'));
 assert.ok(D.events([event],Date.parse('2026-11-13T06:00:00Z')).cards[0].lines[1].startsWith('Friday, November 13 ·'));
});

// R4: remove only the exact standalone address, retaining its punctuation.
test('City address recognizes punctuation boundaries without erasing operational text',()=>{
 const cases=[
  ['Repair (at North Parkway and McLean Boulevard). Zoo location: Birdhouse kitchen','Repair (). Zoo location: Birdhouse kitchen'],
  ['.5-inch pipe,at North Parkway and McLean Boulevard; retain fitting.','.5-inch pipe,; retain fitting.'],
  ['Repair [at North Parkway and McLean Boulevard] now','Repair [] now'],
  ['greatat North Parkway and McLean Boulevard','greatat North Parkway and McLean Boulevard'],
  ['at North Parkway and McLean Boulevardish','at North Parkway and McLean Boulevardish'],
 ];
 for(const [description,expected] of cases){
  const row={id:'1',facility:'15Z05 Birdhouse',status:'Approved',description};
  const before=JSON.stringify(row);assert.equal(D.cityWorkOrders({state:'current',coverage:'city_active_zoo',rows:[row]}).cards[0].lines[1],expected);assert.equal(JSON.stringify(row),before);
 }
});

// R5: observed literal City export suffix; no generic address inference.
test('City observed abbreviated address is removed while real details survive',()=>{
 const row={id:'1',work_order_id:'123',facility:'15Z05 Birdhouse @ N Parkway & N Mclean Blvd',status:'Approved',description:'.5-inch fitting; Zoo location: Birdhouse kitchen'};
 const before=JSON.stringify(row),card=D.cityWorkOrders({state:'current',coverage:'city_active_zoo',rows:[row]}).cards[0];
 assert.equal(card.title,'#123 · 15Z05 Birdhouse');assert.equal(card.lines[1],row.description);assert.equal(JSON.stringify(row),before);
 for(const value of ['15Z05 Birdhouse @ N Parkway & N Mclean Blvdish','15Z05 Birdhouse @ N Parkway & Other Blvd','15Z05 Birdhouse @ N Parkway','15Z05 Birdhouse email@ N Parkway & N Mclean Blvd']){
  assert.equal(D.cityWorkOrders({state:'current',coverage:'city_active_zoo',rows:[{...row,facility:value}]}).cards[0].title,'#123 · '+value);
 }
});

test('Spiceworks72h boundaries, rollover, duplicate and status-only display',()=>{
 const now=Date.parse('2026-11-12T18:00:00Z'),h=3600000;
 const rows=[0,24,48,72,72+1/h,-1/h].map((age,i)=>({ticket_id:String(i+1),title:'Synthetic',kind:i%2?'closed':'opened',at:new Date(now-age*h).toISOString()}));
 rows.push({...rows[2]});
 const feed={state:'snapshot',generated_at:new Date(now).toISOString(),rows};
 const before=JSON.stringify(feed),out=D.spiceworksActivity(feed,now);
 assert.equal(out.title,'Spiceworks · last 72 hours');assert.equal(out.cards.length,4);
 assert.deepEqual(out.cards.map(c=>c.lines),[['Opened'],['Closed'],['Opened'],['Closed']]);
 assert.doesNotMatch(JSON.stringify(out),/email activity/i);assert.equal(JSON.stringify(feed),before);
 assert.equal(D.spiceworksActivity(feed,now+1).cards.some(c=>c.id.startsWith('4:')),false);
 assert.equal(D.spiceworksActivity(null,now).title,'Spiceworks · last 72 hours');
});

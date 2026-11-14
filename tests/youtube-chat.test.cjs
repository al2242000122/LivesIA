'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {JsonArrayFramer, createYouTubeChat} = require('../lib/youtube-chat');
test('array framing preserves UTF8 and escaped string chunk boundaries', () => {
 const out=[]; const p=new JsonArrayFramer(x=>out.push(x));
 const bytes=Buffer.from('[{"items":[{"text":"á \\\" \\\\"}]},{"nextPageToken":"x"}]');
 for(const b of bytes)p.push(Uint8Array.of(b)); p.end();
 assert.equal(out.length,2); assert.equal(out[1].nextPageToken,'x');
});
test('framer rejects depth, oversized frames and provider errors',()=>{
 assert.throws(()=>new JsonArrayFramer(()=>{}).push(Buffer.from('['+'['.repeat(20))),/youtube_framing/);
 assert.throws(()=>new JsonArrayFramer(()=>{}).push(Buffer.from('[{"x":"'+'a'.repeat(262145))),/youtube_framing/);
 assert.throws(()=>new JsonArrayFramer(()=>{}).push(Buffer.from('{"error":{"code":403}}')),/youtube_auth_required/);
});
test('invalid selection never calls network',async()=>{
 const c=createYouTubeChat({fetchImpl:()=>{throw Error('network')},getAccessToken:async()=>'',expectedChannelId:'UC'+'a'.repeat(22)});
 assert.equal(await c.select('../bad'),false); assert.equal(c.status().error,'youtube_video_invalid'); c.stop();
});
const channel='UC'+'a'.repeat(22), other='UC'+'b'.repeat(22), video='abcdefghijk';
function harness({wrong=false,waiting=false}={}){
 let current=100000, calls=[],events=[],scheduled=[],items=[],delay=0;
 const timers={setTimeout(fn,ms){const t={fn,ms};scheduled.push(t);return t;},clearTimeout(t){scheduled=scheduled.filter(x=>x!==t);}};
 const response=v=>({ok:true,body:new ReadableStream({start(c){c.enqueue(Buffer.from(JSON.stringify(v)));c.close();}})});
 const fetchImpl=async url=>{calls.push(url);const u=new URL(url);if(u.pathname.endsWith('/channels'))return response({items:[{id:wrong?other:channel}]});if(u.pathname.endsWith('/videos'))return response({items:[{id:video,snippet:{channelId:channel},liveStreamingDetails:waiting?{}:{actualStartTime:'2026-01-01T00:00:00Z',activeLiveChatId:'chat'}}]});if(u.pathname.endsWith('/stream'))return {ok:false,status:400,body:{cancel(){return Promise.resolve();}}};if(u.pathname.endsWith('/messages'))return response({items:items.shift()||[],nextPageToken:'cursor',pollingIntervalMillis:19000});if(u.pathname.endsWith('/liveBroadcasts'))return response({items:[{id:video,snippet:{title:'A'},status:{privacyStatus:'public',lifeCycleStatus:'live'}}]});throw Error('unexpected');};
 const c=createYouTubeChat({fetchImpl,getAccessToken:async()=> 'fixture',expectedChannelId:channel,onEvent:x=>events.push(x),now:()=>current,timers});
 return {c,calls,events,items,get scheduled(){return scheduled;},advance(ms){current+=ms;const list=scheduled.filter(t=>t.ms===ms);for(const t of list){timers.clearTimeout(t);t.fn();}},async flush(){for(let i=0;i<40;i++)await new Promise(setImmediate);}};
}
const message=(id,at=100000)=>({id,authorDetails:{channelId:channel,displayName:'Tester'},snippet:{type:'textMessageEvent',publishedAt:new Date(at).toISOString(),textMessageDetails:{messageText:'RAIN'}}});
test('ownership mismatch never discovers or emits',async()=>{const h=harness({wrong:true});await h.c.select(video);await h.flush();assert.equal(h.c.status().error,'youtube_channel_mismatch');assert.equal(h.calls.length,1);assert.equal(h.events.length,0);h.c.stop();});
test('absent active chat waits and schedules slow discovery',async()=>{const h=harness({waiting:true});await h.c.select(video);await h.flush();assert.equal(h.c.status().state,'waiting_live');assert.ok(h.scheduled.some(t=>t.ms===60000));assert.equal(h.calls.length,2);h.c.stop();});
test('history discarded, fresh comment opaque, duplicates and stale rejected',async()=>{
 const h=harness();h.items.push([message('history')],[message('fresh',119000),message('fresh',119000),message('old',100000),{...message('paid',119000),snippet:{type:'superChatEvent'}}]);
 await h.c.select(video);await h.flush();assert.equal(h.events.length,0);assert.equal(h.c.status().transport,'poll');h.advance(19000);await h.flush();assert.equal(h.events.length,1);const e=h.events[0];assert.equal(e.data.text,'RAIN');assert.match(e.id,/^yt:[a-f0-9]{32}$/);assert.equal(e.actor.stableHash.includes(channel),false);assert.equal(h.c.status().duplicates,1);h.c.stop();
});
test('broadcast manual discovery is coalesced and cached with official owner fields',async()=>{const h=harness();const [a,b]=await Promise.all([h.c.broadcasts(),h.c.broadcasts()]);assert.deepEqual(a,b);assert.deepEqual(a,[{id:video,title:'A',privacy:'public',status:'live'}]);await h.c.broadcasts();const u=new URL(h.calls.find(x=>x.includes('liveBroadcasts')));assert.equal(u.searchParams.get('mine'),'true');assert.equal(u.searchParams.get('broadcastType'),'all');assert.equal(u.searchParams.has('broadcastStatus'),false);assert.equal(h.calls.length,2);h.c.stop();});
test('six virtual hours of polling retain bounded processing and stop callbacks',async()=>{const h=harness();await h.c.select(video);await h.flush();for(let i=0;i<1137;i++){h.advance(19000);await h.flush();}assert.equal(h.c.status().state,'connected');assert.ok(h.c.status().quotaUsed<8000);h.c.stop();h.advance(19000);await h.flush();assert.equal(h.c.status().state,'stopped');assert.equal(h.events.length,0);});
test('superseded pending response cannot emit or mutate new selection',async()=>{
 let resolveOld;const states=[],events=[];const pending=new Promise(r=>resolveOld=r);let calls=0;
 const c=createYouTubeChat({expectedChannelId:channel,getAccessToken:async()=> 'x',fetchImpl:async()=>{calls++;return pending;},onEvent:e=>events.push(e),onState:s=>states.push(s)});
 await c.select(video);await new Promise(setImmediate);await c.select('invalid');resolveOld({ok:true,body:new ReadableStream({start(x){x.enqueue(Buffer.from(JSON.stringify({items:[{id:channel}]})));x.close();}})});await new Promise(setImmediate);assert.equal(c.status().error,'youtube_video_invalid');assert.equal(events.length,0);c.stop();
});
test('official streaming array emits fresh comment after initial history and retains cursor',async()=>{
 const events=[],urls=[];let streamCount=0;const json=v=>({ok:true,body:new ReadableStream({start(c){c.enqueue(Buffer.from(JSON.stringify(v)));c.close();}})});
 const c=createYouTubeChat({expectedChannelId:channel,now:()=>100000,getAccessToken:async()=> 'fixture',onEvent:e=>events.push(e),fetchImpl:async url=>{urls.push(url);if(url.includes('/channels'))return json({items:[{id:channel}]});if(url.includes('/videos'))return json({items:[{id:video,snippet:{channelId:channel},liveStreamingDetails:{activeLiveChatId:'chat',actualStartTime:'2026-01-01'}}]});streamCount++;return json([{items:Array.from({length:200},(_,i)=>message('history'+i)),nextPageToken:'cursor1'},{items:[message('history0'),message('new')],nextPageToken:'cursor2'}]);}});
 await c.select(video);for(let i=0;i<30;i++)await new Promise(setImmediate);assert.equal(events.length,1);assert.equal(events[0].data.text,'RAIN');assert.equal(c.status().duplicates,1);assert.ok(urls.some(x=>x.startsWith('https://youtube.googleapis.com/youtube/v3/liveChat/messages/stream?')));assert.equal(streamCount,1);c.stop();
});
test('provider framing maps quota, ended and disabled to terminal fixed codes',()=>{
 for(const [reason,code]of [['quotaExceeded','youtube_quota'],['liveChatEnded','youtube_ended'],['liveChatDisabled','youtube_disabled']]){
  const p=new JsonArrayFramer(()=>{});assert.throws(()=>p.push(Buffer.from(JSON.stringify({error:{code:403,errors:[{reason}]}}))),e=>e.code===code);
 }
});
test('stalled fetch expires and cancels its late body without affecting current selection',async()=>{
 let resolveFetch,cancelled=0;const scheduled=[];const timers={setTimeout(fn,ms){const t={fn,ms};scheduled.push(t);return t;},clearTimeout(t){const n=scheduled.indexOf(t);if(n>=0)scheduled.splice(n,1);}};
 const c=createYouTubeChat({expectedChannelId:channel,getAccessToken:async()=> 'x',fetchImpl:()=>new Promise(r=>resolveFetch=r),timers});await c.select(video);await new Promise(setImmediate);
 const timer=scheduled.find(t=>t.ms===20000);assert.ok(timer);timer.fn();await new Promise(setImmediate);assert.equal(c.status().state,'error');resolveFetch({ok:true,body:{cancel(){cancelled++;return new Promise(()=>{});}}});await new Promise(setImmediate);assert.equal(cancelled,1);c.stop();
});
test('stalled body expires and cancels without awaiting cancellation',async()=>{
 let cancelled=0;const scheduled=[];const timers={setTimeout(fn,ms){const t={fn,ms};scheduled.push(t);return t;},clearTimeout(t){const n=scheduled.indexOf(t);if(n>=0)scheduled.splice(n,1);}};
 const c=createYouTubeChat({expectedChannelId:channel,getAccessToken:async()=> 'x',fetchImpl:async()=>({ok:true,body:{getReader(){return {read:()=>new Promise(()=>{}),cancel(){cancelled++;return new Promise(()=>{});}};}}}),timers});await c.select(video);await new Promise(setImmediate);scheduled.find(t=>t.ms===20000).fn();await new Promise(setImmediate);assert.equal(c.status().state,'error');assert.equal(cancelled,1);c.stop();
});
test('obsolete owner response never grants ownership to a later selection',async()=>{
 let oldResolve;let owners=0,videos=0;const json=v=>({ok:true,body:new ReadableStream({start(c){c.enqueue(Buffer.from(JSON.stringify(v)));c.close();}})});
 const c=createYouTubeChat({expectedChannelId:channel,getAccessToken:async()=> 'x',fetchImpl:async url=>{if(url.includes('/channels')){owners++;if(owners===1)return new Promise(r=>oldResolve=r);return json({items:[{id:other}]});}videos++;return json({items:[]});}});
 await c.select(video);await new Promise(setImmediate);await c.select('zyxwvutsrqp');oldResolve(json({items:[{id:channel}]}));for(let i=0;i<20;i++)await new Promise(setImmediate);assert.equal(owners,2);assert.equal(videos,0);assert.equal(c.status().error,'youtube_channel_mismatch');c.stop();
});

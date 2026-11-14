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
function streamHarness(streamFactory,{jitter=0.5}={}){
 let current=100000,nextId=0;const scheduled=new Map(),events=[],requests=[];
 const timers={setTimeout(fn,ms){const id=++nextId;scheduled.set(id,{fn,at:current+ms,ms});return id;},clearTimeout(id){scheduled.delete(id);}};
 const json=value=>({ok:true,body:new ReadableStream({start(c){c.enqueue(Buffer.from(JSON.stringify(value)));c.close();}})});
 const fetchImpl=async url=>{const u=new URL(url);if(u.pathname.endsWith('/channels'))return json({items:[{id:channel}]});if(u.pathname.endsWith('/videos'))return json({items:[{id:video,snippet:{channelId:channel},liveStreamingDetails:{activeLiveChatId:'chat',actualStartTime:'2026-01-01'}}]});requests.push(u);return streamFactory({index:requests.length,now:()=>current,timers});};
 const c=createYouTubeChat({expectedChannelId:channel,now:()=>current,timers,random:()=>jitter,getAccessToken:async()=> 'fixture',fetchImpl,onEvent:e=>events.push(e)});
 const flush=async()=>{for(let i=0;i<20;i++)await new Promise(setImmediate);};
 return {c,events,requests,timers,scheduled,flush,get time(){return current;},async advance(ms){current+=ms;for(const [id,t]of [...scheduled])if(t.at<=current){scheduled.delete(id);t.fn();}await flush();}};
}
test('200 stream callback budget rotates preserving cursor and dedupe for next event',async()=>{
 let cancelled=0;const h=streamHarness(({index})=>({ok:true,body:{getReader(){let sent=false;return {read(){if(sent)return new Promise(()=>{});sent=true;const frames=index===1?[{items:[],nextPageToken:'history'},...Array.from({length:201},(_,i)=>({items:[message('n'+i)],nextPageToken:'p'+i}))]:[{items:[message('n199',115000),message('n200',115000)],nextPageToken:'p200'}];return Promise.resolve({value:Buffer.from(JSON.stringify(frames)),done:false});},cancel(){cancelled++;return Promise.resolve();}};}}}));
 await h.c.select(video);await h.flush();assert.equal(h.events.length,200);assert.equal(cancelled,1);await h.advance(15000);assert.equal(h.requests.length,2);assert.equal(h.requests[1].searchParams.get('pageToken'),'p199');assert.equal(h.events.length,201);assert.equal(new Set(h.events.map(e=>e.id)).size,201);h.c.stop();
});
test('HTTP500 stream retries always wait15..60 seconds including jitter extremes',async()=>{
 for(const jitter of [0,1]){const h=streamHarness(()=>({ok:false,status:500,body:{cancel:async()=>{}}}),{jitter});await h.c.select(video);await h.flush();for(let i=0;i<9;i++){const wait=[...h.scheduled.values()].find(x=>x.ms>=15000&&x.ms<=60000);assert.ok(wait,'bounded retry wait');const before=h.requests.length;await h.advance(wait.ms-1);assert.equal(h.requests.length,before);await h.advance(1);assert.equal(h.requests.length,before+1);}h.c.stop();}
});
test('absolute stream lifetime rotates a whitespace trickle before six minute mark',async()=>{
 let cancelled=0;const h=streamHarness(({timers})=>({ok:true,body:{getReader(){let first=true;return {read(){if(first){first=false;return Promise.resolve({done:false,value:Buffer.from('[')});}return new Promise(resolve=>timers.setTimeout(()=>resolve({done:false,value:Buffer.from(' ')}),60000));},cancel(){cancelled++;return Promise.resolve();}};}}}));await h.c.select(video);await h.flush();for(let i=0;i<5;i++)await h.advance(60000);assert.equal(cancelled,1);await h.advance(15000);assert.equal(h.requests.length,2);h.c.stop();
});
test('cumulative stream byte bound rotates even when no JSON frames complete',async()=>{
 let cancelled=0;const h=streamHarness(()=>({ok:true,body:{getReader(){let n=0;return {read(){return Promise.resolve({done:false,value:Buffer.from((n++===0?'[':'')+' '.repeat(262144))});},cancel(){cancelled++;return Promise.resolve();}};}}}));await h.c.select(video);await h.flush();assert.equal(cancelled,1);assert.ok(h.scheduled.size<=1);await h.advance(15000);assert.equal(h.requests.length,2);h.c.stop();
});
test('six virtual hours of live STREAM trickles rotate with cursor and unique events',async()=>{
 let cancelled=0,serial=0,lastId=null;
 const h=streamHarness(({index,now,timers})=>({ok:true,body:{getReader(){let first=true,pendingTimer;return {read(){if(first){first=false;const items=index===1?[]:lastId?[message(lastId,now()-15000)]:[];return Promise.resolve({done:false,value:Buffer.from('['+JSON.stringify({items,nextPageToken:'cursor-'+serial}))});}return new Promise(resolve=>{pendingTimer=timers.setTimeout(()=>{lastId='soak-'+(++serial);resolve({done:false,value:Buffer.from(','+JSON.stringify({items:[message(lastId,now())],nextPageToken:'cursor-'+serial}))});},60000);});},cancel(){cancelled++;timers.clearTimeout(pendingTimer);return Promise.resolve();}};}}}));
 await h.c.select(video);await h.flush();for(let i=0;i<1440;i++)await h.advance(15000);
 assert.ok(h.time>=21700000);assert.ok(h.requests.length>=60);assert.ok(cancelled>=60);assert.equal(h.c.status().transport,'stream');assert.ok(['connected','reconnecting'].includes(h.c.status().state));assert.ok(h.events.length>200);assert.equal(new Set(h.events.map(e=>e.id)).size,h.events.length);assert.ok(h.requests.slice(1).every(u=>u.searchParams.has('pageToken')));assert.ok(h.c.status().quotaUsed<8000);assert.ok(h.scheduled.size<=2);h.c.stop();await h.advance(300000);assert.equal(h.c.status().state,'stopped');
});
test('idle stream timeout also waits15 seconds before reconnecting',async()=>{
 let cancelled=0;const h=streamHarness(()=>({ok:true,body:{getReader(){return {read:()=>new Promise(()=>{}),cancel(){cancelled++;return Promise.resolve();}};}}}),{jitter:0});await h.c.select(video);await h.flush();await h.advance(90000);assert.equal(cancelled,1);assert.equal(h.c.status().state,'reconnecting');await h.advance(14999);assert.equal(h.requests.length,1);await h.advance(1);assert.equal(h.requests.length,2);h.c.stop();
});

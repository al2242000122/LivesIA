'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {connect}=require('../integrations/transport.js');
function environment(){
  const sockets=[],streams=[],timers=new Map();
  class WS {constructor(){sockets.push(this);}close(){this.onclose?.();}}
  class SSE {static CLOSED=2;constructor(){this.readyState=0;this.listeners={};streams.push(this);}addEventListener(type,listener){this.listeners[type]=listener;}close(){this.readyState=2;}}
  const env={WebSocket:WS,EventSource:SSE,setTimeout:(fn,delay)=>{const id={};timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)};
  const tick=()=>{const [id,timer]=[...timers][0];timers.delete(id);timer.fn();return timer.delay;};
  return {env,sockets,streams,timers,tick};
}
test('transport isolates game targets and accepts only normalized relay data',()=>{
  const f=environment(),events=[],controls=[],states=[];
  const connection=connect({target:'block-wars',env:f.env,onEvent:e=>events.push(e),onControl:e=>controls.push(e),onStatus:s=>states.push(s)});
  f.streams[0].onmessage({data:JSON.stringify({type:'reset'})});
  assert.equal(controls.length,0);
  f.streams[0].onmessage({data:JSON.stringify({type:'bw_pause',target:'block-wars'})});
  assert.equal(controls.length,1);
  f.streams[0].onmessage({data:JSON.stringify({type:'like',target:'block-wars',count:25})});
  assert.equal(events[0].source,'simulator');assert.equal(events[0].data.delta,25);
  f.sockets[0].onmessage({data:'null'}); assert.equal(events.length,1);
  f.sockets[0].onopen();assert.equal(states.at(-1).relay,'connected');assert.equal(states.at(-1).verified,false);
  connection.stop();
});
test('SSE audio settings reach the control handler without being discarded as viewer events',()=>{
  const f=environment(),controls=[],events=[];
  const connection=connect({target:'block-wars',env:f.env,onControl:value=>controls.push(value),onEvent:value=>events.push(value)});
  const command={type:'bw_audio',target:'block-wars',settings:{muted:true,volume:.25,narration:false}};
  f.streams[0].onmessage({data:JSON.stringify(command)});
  assert.deepEqual(controls,[command]);assert.equal(events.length,0);connection.stop();
});
test('YouTube rehearsal disables TikFinity and its reconnects but retains local controls',()=>{
  const f=environment(),controls=[];
  const connection=connect({target:'block-wars',relayEnabled:false,env:f.env,onControl:command=>controls.push(command)});
  assert.equal(connection.state.relay,'disabled');assert.equal(f.sockets.length,0);assert.equal(f.timers.size,0);
  f.streams[0].onmessage({data:JSON.stringify({type:'bw_pause',target:'block-wars',paused:true})});
  assert.equal(controls.length,1);connection.stop();assert.equal(f.timers.size,0);
});
test('WebSocket reconnect backoff is bounded and stop releases all resources',()=>{
  const f=environment(),connection=connect({env:f.env}); const delays=[];
  for(let i=0;i<9;i++){f.sockets.at(-1).onclose();delays.push(f.tick());}
  assert.ok(delays[1]>delays[0]);assert.ok(delays.every(n=>n<=30000));
  f.sockets.at(-1).onclose();assert.equal(f.timers.size,1);connection.stop();assert.equal(f.timers.size,0);
  const count=f.sockets.length;f.sockets.at(-1).onclose();assert.equal(f.sockets.length,count);assert.equal(f.timers.size,0);
});
test('terminal SSE retries once while native CONNECTING retry stays native',()=>{
  const f=environment(),connection=connect({env:f.env});
  f.streams[0].onerror();assert.equal(f.timers.size,0);
  f.streams[0].readyState=2;f.streams[0].onerror();f.streams[0].onerror();assert.equal(f.timers.size,1);
  f.tick();assert.equal(f.streams.length,2);connection.stop();
});

test('dedicated YouTube channels isolate Snake, reject simulator spoofing and clear stale connection',()=>{
 const f=environment(),events=[],states=[];const c=connect({target:'block-wars',youtubeEnabled:true,env:f.env,onEvent:e=>events.push(e),onYouTubeState:s=>states.push(s)});
 const stream=f.streams[0],event={type:'comment',source:'youtube',id:'yt:'+'a'.repeat(32),receivedAt:1,actor:{displayName:'Ana',stableHash:'b'.repeat(32)},data:{text:'TNT'}};
 assert.equal(f.sockets.length,0);stream.onmessage({data:JSON.stringify({...event,target:'block-wars'})});assert.equal(events.length,0);
 stream.listeners.youtube_comment({data:JSON.stringify(event)});assert.equal(events[0].actor.stableHash,event.actor.stableHash);assert.equal(events[0].source,'youtube');
 stream.listeners.youtube_state({data:JSON.stringify({state:'connected',token:'must-not-leak',received:3})});assert.deepEqual(states.at(-1),{state:'connected',received:3});
 stream.onerror();assert.equal(states.at(-1).state,'reconnecting');c.stop();
 const snake=environment();connect({target:'snake',youtubeEnabled:true,env:snake.env});assert.deepEqual(Object.keys(snake.streams[0].listeners),[]);
});

'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {connect}=require('../integrations/transport.js');
function environment(){
  const sockets=[],streams=[],timers=new Map();
  class WS {constructor(){sockets.push(this);}close(){this.onclose?.();}}
  class SSE {static CLOSED=2;constructor(){this.readyState=0;streams.push(this);}close(){this.readyState=2;}}
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

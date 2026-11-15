'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEngine,LIMITS}=require('../games/block-wars/engine.js');
const make=()=>createEngine({seed:42,layout:'endless',eventInterval:180});
function origin(i,source='simulator'){return {actor:'Miner '+i,source,actionId:'pending-'+i};}
function fill(e){for(let i=0;i<LIMITS.maxQueue/3;i++)assert.equal(e.action({type:'tnt',team:'dark'},origin('fill-'+i)),true);}

test('one thousand valid burst commands are accepted compactly and drain FIFO once without growing active work',()=>{
  const e=make(),started=[];fill(e);
  const stop=e.subscribeDeferredActions(event=>started.push(event));
  for(let i=0;i<1000;i++){
    assert.equal(e.action({type:'tnt',team:i%2?'light':'dark'},origin(i)),true);
    assert.equal(e.state.lastAdmission.queued,true);assert.equal(e.state.lastAdmission.actionId,'pending-'+i);
  }
  assert.equal(e.state.pendingActionCount,1000);assert.equal(e.state.entities.length,LIMITS.maxQueue);
  let seenQueuedBodies=false;
  for(let tick=0;tick<15000&&started.length<1000;tick++){
    e.update(.05);
    assert.ok(e.state.entities.length+e.state.queue.length<=LIMITS.maxQueue);
    assert.ok(e.state.weatherEvents.length<=LIMITS.maxWeather);
    assert.ok(e.state.particles.length<=LIMITS.maxParticles&&e.state.effects.length<=LIMITS.maxEffects);
    seenQueuedBodies ||= e.state.entities.some(v=>v.actionId==='pending-0');
  }
  assert.ok(seenQueuedBodies);assert.equal(e.state.pendingActionCount,0);assert.equal(started.length,1000);
  assert.deepEqual(started.map(v=>v.actionId),Array.from({length:1000},(_,i)=>'pending-'+i));
  assert.ok(started.every((v,i)=>v.actor==='Miner '+i&&v.source==='simulator'&&v.team===(i%2?'light':'dark')));
  stop();
});

test('weather backlog admits every command and drains multiple newly available slots without bypassing FIFO',()=>{
  const e=make(),started=[];e.subscribeDeferredActions(v=>started.push(v));
  for(let i=0;i<LIMITS.maxWeather;i++)assert.equal(e.action({type:'thunder'},origin('weather-'+i)),true);
  const active=e.state.activeEvent,resultCount=e.state.actionResults.length;
  for(let i=0;i<20;i++)assert.equal(e.action({type:i%2?'spin':'storm',team:'dark'},origin(i)),true);
  assert.equal(e.state.activeEvent,active);assert.equal(e.state.actionResults.length,resultCount,'waiting is not a partial activation');
  assert.equal(e.state.pendingActionCount,20);
  e.state.weatherEvents.splice(0,3);e.update(.001);
  assert.deepEqual(started.map(v=>v.actionId),Array.from({length:6},(_,i)=>'pending-'+i));
  assert.equal(e.state.pendingActionCount,14);assert.equal(e.state.weatherEvents.length,LIMITS.maxWeather);
});

test('queued counts and sanitized source metadata survive draining and source cancellation leaves active effects alone',()=>{
  const e=make(),started=[];fill(e);e.subscribeDeferredActions(v=>started.push(v));
  const input={type:'nuke',count:10,team:'light'},metadata={actor:'A\u0000<'.repeat(50),source:'youtube',actionId:'ten-giants'};
  assert.equal(e.action(input,metadata),true);input.count=1;metadata.actionId='tampered';
  assert.equal(e.action({type:'tnt'},origin('cancel','youtube')),true);
  assert.equal(e.action({type:'rain'},origin('keep','simulator')),true);
  assert.equal(e.cancelPendingActions('youtube'),2);assert.equal(e.state.pendingActionCount,1);
  assert.equal(e.state.entities.length,LIMITS.maxQueue,'source stop preserves existing work');
  e.clearEffects();fill(e);
  input.count=10;metadata.actionId='ten-giants';metadata.actor='A\u0000'.repeat(50);
  assert.equal(e.action(input,metadata),true);input.count=1;metadata.actionId='tampered';
  e.state.entities.length=0;e.update(.001);
  const giants=e.state.entities.filter(v=>v.actionId==='ten-giants');
  assert.equal(giants.length,10);assert.ok(giants.every(v=>v.actor.length<=44&&!v.actor.includes('\u0000')&&v.source==='youtube'));
  assert.equal(started.at(-1).actionId,'ten-giants');
});

test('a long FIFO of inexpensive actions drains in bounded batches without losing remaining commands',()=>{
  const e=make(),started=[];e.subscribeDeferredActions(v=>started.push(v));
  for(let i=0;i<LIMITS.maxWeather;i++)e.action({type:'thunder'},origin('full-'+i));
  e.action({type:'storm'},origin('head'));
  for(let i=0;i<1000;i++)assert.equal(e.action({type:'spin'},origin(i)),true);
  e.state.weatherEvents.pop();e.update(.001);
  assert.equal(started.length,64);assert.equal(e.state.pendingActionCount,937);
  for(let i=0;i<16;i++)e.update(.001);
  assert.equal(started.length,1001);assert.equal(e.state.pendingActionCount,0);
  assert.deepEqual(started.slice(1).map(v=>v.actionId),Array.from({length:1000},(_,i)=>'pending-'+i));
});

test('pausing freezes pending actions and emergency or reset clears them without later callbacks',()=>{
  for(const reset of [false,true]){
    const e=make();fill(e);let calls=0;e.subscribeDeferredActions(()=>calls++);
    e.action({type:'nuke',count:10},origin(1));e.pause(true);
    const snapshot=JSON.stringify(e.state);e.update(.25);assert.equal(JSON.stringify(e.state),snapshot);
    assert.equal(e.action({type:'tnt'},origin(2)),false);
    if(reset)e.reset();else e.clearEffects();
    assert.equal(e.state.pendingActionCount,0);e.pause(false);e.update(.01);assert.equal(calls,0);
  }
});

test('deferred callbacks are isolated and unsubscribe stops notifications while valid queued work still starts',()=>{
  const e=make();fill(e);let calls=0;
  const unsubscribe=e.subscribeDeferredActions(()=>{calls++;throw new Error('broken overlay');});
  e.action({type:'tnt'},origin(1));e.action({type:'tnt'},origin(2));
  e.state.entities.length=0;assert.doesNotThrow(()=>e.update(.001));assert.equal(calls,2);
  fill(e);e.action({type:'tnt'},origin(3));unsubscribe();e.state.entities.length=0;e.update(.001);assert.equal(calls,2);
});

test('periodic automatic events count actual starts rather than queued receipts or the prior viewer action',()=>{
  const e=createEngine({seed:2,layout:'endless',eventInterval:180}),started=[];fill(e);e.subscribeDeferredActions(v=>started.push(v));
  e.action({type:'tnt',team:'dark'},origin('before-automatic'));
  const prior=e.state.lastEvent;e.state.nextEventIn=0;e.update(1/60);
  assert.equal(e.state.pendingActionCount,2);assert.equal(e.state.lastEvent,prior);
  assert.equal(e.state.eventCount,0,'admitting a pending timer event is not an activation');
  e.state.entities.length=0;e.update(1/60);
  assert.equal(e.state.pendingActionCount,0);assert.equal(e.state.eventCount,1);
  assert.equal(started.length,2);assert.equal(started[1].source,'automatic');
  assert.equal(e.state.lastEvent.actionId,started[1].actionId);
  e.update(1/60);assert.equal(e.state.eventCount,1);
  e.action({type:'spin'});assert.equal(e.state.eventCount,1,'manual local calls are not scheduled events');
});

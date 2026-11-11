'use strict';
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {createEngine,LIMITS}=require('../games/block-wars/engine.js');
const {createRules}=require('../games/block-wars/rules.js');
const hours=Number(process.env.SOAK_HOURS||2);
if(!Number.isFinite(hours)||hours<=0||hours>24)throw new RangeError('SOAK_HOURS must be > 0 and <= 24');
// Accelerated seeded simulation: this does not measure browser FPS, OBS, or TikTok LIVE.
const engine=createEngine({seed:20261110,duration:60,eventInterval:15});
const rules=createRules(engine,{maxActors:128,maxDedupe:256,actorTtlMs:60000,dedupeTtlMs:1000});
const start=performance.now();let sequence=0,maxQueue=0,maxParticles=0,maxEffects=0,maxActors=0,maxDedupe=0,maxVotes=0;
let heapMin=Infinity,heapMax=0,pauses=0;
function send(type,data,actor,at,source='simulator',id){
  return rules.handle({type,data,source,id:id||`soak-${++sequence}`,receivedAt:at,actor:{stableHash:actor}});
}
for(let ms=0;ms<hours*3600000;ms+=250){
  if(ms%60000===0){engine.pause(true);pauses++;}
  if(ms%60000===3000)engine.pause(false);
  if(ms%1000===0){
    const source=ms%2000===0?'simulator':'tikfinity',actor=`fixture-${ms%97000}`;
    send('like',{delta:37},actor,ms,source);
    send('comment',{text:ms%2000===0?'!dark':'!light'},actor,ms,source);
    send('comment',{text:'!mine'},actor,ms,source);
    send('comment',{text:'!rain'},actor,ms,source);
    send('comment',{text:'!oro'},actor,ms,source);
    send('follow',{},actor,ms,source);
  }
  if(ms%15000===0){
    for(let i=0;i<100;i++)send('comment',{text:'!boom'},`burst-${ms}-${i}`,ms);
    const id=`duplicate-${ms}`;send('like',{delta:25},'fixture',ms,'simulator',id);send('like',{delta:25},'fixture',ms,'simulator',id);
    send('gift',{count:1000},'fixture',ms);send('subscribe_paid',{count:1000},'fixture',ms);
    engine.action({type:'turbo',team:'dark'});engine.action({type:'turbo',team:'light'});
  }
  if(ms%45000===0){engine.action({type:'nuke',team:'neutral'});engine.action({type:'nuke',team:'neutral'});}
  if(ms%90000===0){engine.action({type:'descomunal',team:'dark'});engine.action({type:'enchant',team:'dark',efficiency:5,unbreaking:3,fortune:3});}
  const before=engine.state.remaining,paused=engine.state.paused;
  rules.flush();engine.update(0.25);
  if(paused)assert.equal(engine.state.remaining,before);
  assert.ok(engine.state.queue.length<=LIMITS.maxQueue);assert.ok(engine.state.particles.length<=LIMITS.maxParticles);assert.ok(engine.state.effects.length<=LIMITS.maxEffects);
  assert.ok(rules.state.trackedActors<=128);assert.ok(rules.state.trackedDedupe<=256);assert.ok(rules.state.trackedVotes<=128);assert.ok(rules.state.notifications.length<=6);
  assert.ok(engine.state.remaining>=0&&engine.state.remaining<=60);assert.ok(Number.isSafeInteger(rules.state.pendingTnt));
  for(const team of Object.values(engine.state.teams)){assert.ok(Number.isFinite(team.score));assert.ok(team.durability>=0);assert.ok(team.effectiveSpeed>=0);}
  maxQueue=Math.max(maxQueue,engine.state.queue.length);maxParticles=Math.max(maxParticles,engine.state.particles.length);maxEffects=Math.max(maxEffects,engine.state.effects.length);
  maxActors=Math.max(maxActors,rules.state.trackedActors);maxDedupe=Math.max(maxDedupe,rules.state.trackedDedupe);maxVotes=Math.max(maxVotes,rules.state.trackedVotes);
  if(ms>=3600000&&ms%60000===0){if(global.gc)global.gc();const heap=process.memoryUsage().heapUsed;heapMin=Math.min(heapMin,heap);heapMax=Math.max(heapMax,heap);}
}
assert.ok(engine.state.round>hours*10,'round turnover continues under spam and destructive events');
assert.ok(rules.metrics.bySource.simulator.likes>0&&rules.metrics.bySource.tikfinity.likes>0);assert.ok(pauses>0);assert.equal('viewers' in rules.metrics,false);
console.log(JSON.stringify({seed:20261110,virtualHours:hours,frameStepMs:250,rounds:engine.state.round,pauses,maxQueue,maxParticles,maxEffects,maxActors,maxDedupe,maxVotes,pendingTnt:rules.state.pendingTnt,
  wallSeconds:Number(((performance.now()-start)/1000).toFixed(2)),heapSampledAfterWarmup:Number.isFinite(heapMin),forcedGc:Boolean(global.gc),
  heapRangeMiB:Number.isFinite(heapMin)?[heapMin,heapMax].map(n=>Number((n/1048576).toFixed(2))):null},null,2));

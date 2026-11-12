'use strict';
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {createEngine,EVENTS,PICKAXES,LIMITS}=require('../games/block-wars/engine.js');
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
console.log(JSON.stringify({layout:'arena',seed:20261110,virtualHours:hours,frameStepMs:250,rounds:engine.state.round,pauses,maxQueue,maxParticles,maxEffects,maxActors,maxDedupe,maxVotes,pendingTnt:rules.state.pendingTnt,
  wallSeconds:Number(((performance.now()-start)/1000).toFixed(2)),heapSampledAfterWarmup:Number.isFinite(heapMin),forcedGc:Boolean(global.gc),
  heapRangeMiB:Number.isFinite(heapMin)?[heapMin,heapMax].map(n=>Number((n/1048576).toFixed(2))):null},null,2));

// Second circuit: app-sized shaft with real engine/rules and fixed 50ms steps.
// "tikfinity" below labels synthetic fixtures, never a real transport or account.
function runShaft(){
  const game=createEngine({seed:20261111,layout:'shaft',width:7,height:40,duration:60,eventInterval:15});
  const participation=createRules(game,{maxActors:128,maxDedupe:256,actorTtlMs:60000,dedupeTtlMs:1000});
  const eventKeys=Object.keys(EVENTS),pickKeys=Object.keys(PICKAXES);
  const acceptedEvents=Object.fromEntries(eventKeys.map(key=>[key,0]));
  const acceptedPicks=Object.fromEntries(pickKeys.map(key=>[key,0]));
  const peak={queue:0,entities:0,combinedWork:0,particles:0,effects:0,removedPerStep:0,actors:0,dedupe:0,votes:0};
  let seq=0,pauses=0,emergencies=0,eventIndex=0,chatIndex=0,pickIndex=0,duplicateChecks=0,paidChecks=0;
  let heapMin=Infinity,heapMax=0;
  const started=performance.now();
  function event(type,data,at,source='simulator',actor='fixture',id){
    return participation.handle({type,data,source,id:id||`shaft-${++seq}`,receivedAt:at,actor:{stableHash:actor}});
  }
  for(let ms=0;ms<hours*3600000;ms+=50){
    const state=game.state;
    if(ms%60000===0){game.pause(true);pauses++;}
    if(ms%60000===3000)game.pause(false);
    if(ms%1000===0){
      const source=ms%2000===0?'simulator':'tikfinity',actor=`fixture-${ms%97000}`;
      event('like',{delta:37},ms,source,actor);
      for(const text of [ms%2000===0?'!dark':'!light','!mine','!rain','!oro'])event('comment',{text},ms,source,actor);
      event('follow',{},ms,source,actor);
    }
    if(ms%15000===0){
      for(let i=0;i<100;i++)event('comment',{text:'!boom'},ms,'simulator',`burst-${ms}-${i}`);
      const id=`duplicate-${ms}`,duplicates=participation.metrics.bySource.simulator.duplicates;
      event('like',{delta:25},ms,'simulator','duplicate',id);
      const likes=participation.metrics.bySource.simulator.likes;
      assert.equal(event('like',{delta:25},ms,'simulator','duplicate',id),false);
      assert.equal(participation.metrics.bySource.simulator.likes,likes);
      assert.equal(participation.metrics.bySource.simulator.duplicates,duplicates+1);duplicateChecks++;
      const lastEvent=state.lastEvent;
      event('gift',{count:1000},ms);event('subscribe_paid',{count:1000},ms);
      assert.equal(state.lastEvent,lastEvent);paidChecks+=2;
      game.action({type:'turbo',team:'dark'});game.action({type:'descomunal',team:'light'});
    }
    if(ms%12000===6000){
      const kind=eventKeys[eventIndex++%eventKeys.length];
      if(game.action({type:kind,team:eventIndex%2?'dark':'light'}))acceptedEvents[kind]++;
    }
    if(ms%12000===10000){
      const kind=eventKeys[chatIndex++%eventKeys.length],source=chatIndex%2?'simulator':'tikfinity';
      event('comment',{text:kind.replace(/_/g,' ').toUpperCase()},ms,source,'catalog');
    }
    if(ms%45000===5000){
      const pickaxe=pickKeys[pickIndex++%pickKeys.length];
      if(game.action({type:'pickaxe',team:'dark',pickaxe}))acceptedPicks[pickaxe]++;
      game.action({type:'enchant',team:'dark',efficiency:pickIndex%6,unbreaking:pickIndex%4,fortune:pickIndex%4});
    }
    if(ms%300000===120000){
      game.clearEffects();participation.clearPending();game.pause(true);emergencies++;
      assert.equal(state.entities.length+state.queue.length+state.effects.length+state.particles.length,0);
      assert.equal(state.activeEvent,null);assert.equal(participation.state.pendingTnt,0);
    }
    if(ms%300000===121000)game.pause(false);
    const before={round:state.round,blocks:state.blocks.filter(Boolean).length,paused:state.paused,
      remaining:state.remaining,elapsed:state.elapsed,entityAges:state.entities.map(entity=>entity.age)};
    participation.flush();game.update(0.05);
    // Likes continuously compete for TNT cooldown slots; count their real accepted
    // engine actions as coverage instead of requiring an operator to preempt them.
    acceptedEvents.tnt=participation.metrics.bySource.simulator.tnt+participation.metrics.bySource.tikfinity.tnt;
    if(before.paused){
      assert.equal(state.remaining,before.remaining);assert.equal(state.elapsed,before.elapsed);
      assert.deepEqual(state.entities.map(entity=>entity.age),before.entityAges);
    }
    const removed=before.round===state.round?before.blocks-state.blocks.filter(Boolean).length:0;
    assert.ok(removed<=LIMITS.maxBlockOps,'shared per-step removal budget');
    assert.ok(state.entities.length<=LIMITS.maxEntities && state.queue.length<=LIMITS.maxQueue);
    assert.ok(state.entities.length+state.queue.length<=LIMITS.maxQueue);
    assert.ok(state.particles.length<=LIMITS.maxParticles && state.effects.length<=LIMITS.maxEffects);
    assert.ok(state.remaining>=0 && state.remaining<=60 && state.elapsed>=0 && state.elapsed<=state.roundDuration);
    assert.ok(Number.isFinite(state.focus.x) && state.focus.x>=0 && state.focus.x<state.width);
    assert.ok(Number.isFinite(state.focus.y) && state.focus.y>=0 && state.focus.y<state.height);
    if(state.phase==='playing')assert.ok(state.focus.y<state.height-1,'floor must finish the round');
    if(state.activeEvent)assert.ok(state.activeEvent.remaining>=0 && state.activeEvent.remaining<=state.activeEvent.duration);
    for(const team of Object.values(state.teams)){
      assert.ok(Number.isFinite(team.score) && team.score>=0 && team.score<=LIMITS.maxScore);
      assert.ok(team.durability>=0 && team.durability<=PICKAXES[team.pickaxe].durability);
      assert.ok(team.effectiveSpeed>=0 && team.effectiveSpeed<=LIMITS.maxSpeed);
      assert.ok(team.progress>=0 && team.progress<=LIMITS.maxProgress && team.unlocked.length<=pickKeys.length);
    }
    for(const entity of state.entities)for(const key of ['x','y','targetX','targetY','age','duration','size','rotation'])assert.ok(Number.isFinite(entity[key]));
    const tracked=participation.state;
    assert.ok(tracked.trackedActors<=128 && tracked.trackedDedupe<=256 && tracked.trackedVotes<=128);
    assert.ok(tracked.notifications.length<=6 && Number.isSafeInteger(tracked.pendingTnt));
    peak.queue=Math.max(peak.queue,state.queue.length);peak.entities=Math.max(peak.entities,state.entities.length);
    peak.combinedWork=Math.max(peak.combinedWork,state.entities.length+state.queue.length);
    peak.particles=Math.max(peak.particles,state.particles.length);peak.effects=Math.max(peak.effects,state.effects.length);
    peak.removedPerStep=Math.max(peak.removedPerStep,removed);peak.actors=Math.max(peak.actors,tracked.trackedActors);
    peak.dedupe=Math.max(peak.dedupe,tracked.trackedDedupe);peak.votes=Math.max(peak.votes,tracked.trackedVotes);
    if(ms>=3600000 && ms%60000===0){
      if(global.gc)global.gc();const heap=process.memoryUsage().heapUsed;
      heapMin=Math.min(heapMin,heap);heapMax=Math.max(heapMax,heap);
    }
  }
  assert.ok(game.state.round>hours*10);
  assert.ok(participation.metrics.bySource.simulator.likes>0 && participation.metrics.bySource.tikfinity.likes>0);
  assert.ok(duplicateChecks>0 && paidChecks>0);assert.equal('viewers' in participation.metrics,false);
  if(hours>=0.25){
    for(const kind of eventKeys)assert.ok(acceptedEvents[kind]>0,'catalog event executes: '+kind);
    for(const pickaxe of pickKeys)assert.ok(acceptedPicks[pickaxe]>0,'operator pick executes: '+pickaxe);
    assert.ok(emergencies>0);
  }
  return {layout:'shaft',seed:20261111,virtualHours:hours,frameStepMs:50,ticks:Math.ceil(hours*3600000/50),
    rounds:game.state.round,pauses,emergencies,duplicateChecks,ignoredPaidFixtures:paidChecks,
    peak,pendingTnt:participation.state.pendingTnt,acceptedEvents,acceptedPicks,
    wallSeconds:Number(((performance.now()-started)/1000).toFixed(2)),forcedGc:Boolean(global.gc),
    heapSampledAfterWarmup:Number.isFinite(heapMin),heapRangeMiB:Number.isFinite(heapMin)?[heapMin,heapMax].map(n=>Number((n/1048576).toFixed(2))):null};
}
console.log(JSON.stringify(runShaft(),null,2));

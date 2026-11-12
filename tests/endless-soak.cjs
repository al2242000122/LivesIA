'use strict';
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {createEngine,EVENTS,LIMITS}=require('../games/block-wars/engine.js');
const {createRules}=require('../games/block-wars/rules.js');
const hours=Number(process.env.SOAK_HOURS||6);
if(!Number.isFinite(hours)||hours<=0||hours>24)throw new RangeError('SOAK_HOURS must be > 0 and <= 24');
const options={seed:20261111,layout:'endless',eventInterval:5};
const games=[createEngine(options),createEngine({...options,reducedMotion:true})];
const rules=games.map(game=>createRules(game,{maxActors:128,maxDedupe:256,actorTtlMs:60000,dedupeTtlMs:1000}));
const engine=games[0],keys=Object.keys(EVENTS);
const peak={entities:0,queue:0,combined:0,particles:0,effects:0,removedPerStep:0};
const columns=new Set();
let pauses=0,emergencies=0,duplicateChecks=0,shiftCount=0,votingCycles=0;
const start=performance.now();
function action(input){for(const game of games)game.action(input);}
function receive(input){for(const controller of rules)controller.handle(input);}
// Each fixture is local, including those tagged tikfinity. No transport is opened.
for(let i=0;i<Math.ceil(hours*3600000/50);i++){
  const ms=i*50;
  if(i%1200===0){for(const game of games)game.pause(true);pauses++;}
  if(i%1200===20)for(const game of games)game.pause(false);
  if(i%37===0)action({type:keys[Math.floor(i/37)%keys.length],team:i%2?'dark':'light'});
  if(i%1000===0){
    action({type:'pickaxe',team:'dark',pickaxe:'diamond'});
    action({type:'enchant',team:'dark',efficiency:5,unbreaking:3,fortune:3});
  }
  if(i%100===0){
    const source=i%200?'simulator':'tikfinity';
    const input={type:'like',source,id:'like-'+i,receivedAt:ms,actor:{stableHash:'fixture'},data:{delta:25}};
    for(const controller of rules){
      controller.handle(input);const likes=controller.metrics.bySource[source].likes;
      assert.equal(controller.handle(input),false);assert.equal(controller.metrics.bySource[source].likes,likes);
    }
    duplicateChecks++;
  }
  if(i%6000===2400){for(let j=0;j<2;j++){games[j].clearEffects();rules[j].clearPending();}emergencies++;}
  const old=engine.state.blocks.slice(),offset=engine.state.rowOffset,elapsed=engine.state.elapsed;
  const paused=engine.state.paused,cycle=engine.state.round;
  for(let j=0;j<2;j++){rules[j].flush();games[j].update(0.05);}
  const state=engine.state,body=state.body;
  assert.equal(state.phase,'playing');assert.equal(state.remaining,0);assert.equal(state.blocks.length,280);
  assert.equal(state.round,1+Math.floor(state.elapsed/180));
  if(paused)assert.equal(state.elapsed,elapsed);
  assert.ok(body.x>=body.radius-1e-6 && body.x<=7-body.radius+1e-6 && body.y>=body.radius-1e-6 && body.y<40);
  for(const key of ['x','y','vx','vy','radius','rotation','collisions'])assert.ok(Number.isFinite(body[key]));
  assert.ok(state.entities.length+state.queue.length<=LIMITS.maxQueue);
  assert.ok(state.particles.length<=LIMITS.maxParticles && state.effects.length<=LIMITS.maxEffects);
  assert.equal(games[1].state.particles.length,0);
  assert.ok(rules[0].state.trackedActors<=128 && rules[0].state.trackedDedupe<=256);
  let removed=0;
  if(offset===state.rowOffset){
    for(let j=0;j<280;j++)if(old[j] && !state.blocks[j]){columns.add(j%7);removed++;}
    assert.ok(removed<=LIMITS.maxBlockOps);
  }else shiftCount++;
  for(const [key,value]of Object.entries({entities:state.entities.length,queue:state.queue.length,
    combined:state.entities.length+state.queue.length,particles:state.particles.length,effects:state.effects.length,removedPerStep:removed}))peak[key]=Math.max(peak[key],value);
  if(state.round!==cycle){
    receive({type:'comment',source:'simulator',id:'cycle-'+state.round,receivedAt:ms,
      actor:{stableHash:'cycle-voter'},data:{text:'!rain'}});
    assert.equal(rules[0].state.rainVotes,1,'same identity can vote again in a new logical cycle');votingCycles++;
  }
  if(i%1000===0){
    assert.deepEqual(state.body,games[1].state.body);
    assert.deepEqual(state.blocks,games[1].state.blocks);
    assert.deepEqual(state.teams,games[1].state.teams);
    assert.equal(state.rowOffset,games[1].state.rowOffset);
  }
}
if(hours>=0.25){assert.ok(columns.size>=4 && engine.state.rowOffset>100);assert.ok(votingCycles>0);}
assert.deepEqual(engine.state.body,games[1].state.body);
console.log(JSON.stringify({layout:'endless',virtualHours:hours,ticks:Math.ceil(hours*3600000/50),
  seed:20261111,frameStepMs:50,elapsed:engine.state.elapsed,logicalVotingCycle:engine.state.round,
  depth:engine.state.rowOffset+engine.state.body.y,rowOffset:engine.state.rowOffset,shiftCount,
  minedColumns:[...columns].sort(),collisions:engine.state.body.collisions,pauses,emergencies,
  duplicateChecks,votingCycles,reducedMotionReplayMatches:true,peak,
  wallSeconds:Number(((performance.now()-start)/1000).toFixed(2))},null,2));

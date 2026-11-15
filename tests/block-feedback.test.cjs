'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEngine,MINECRAFT_EFFECTS:MC,LIMITS}=require('../games/block-wars/engine.js');
const physics=require('../games/block-wars/physics.js');
const make=()=>createEngine({seed:42,layout:'endless',eventInterval:180});
const context={source:'simulator',actor:'Miner',actionId:'feedback'};
function run(e,seconds){for(let frame=0;frame<Math.round(seconds*60);frame++)e.update(1/60);}

test('TNT and CREEPER spread in two dimensions and velocity inside the real initial shaft',()=>{
  for(const kind of ['tnt','creeper']){
    const e=make();e.action({type:kind},context);const entities=e.state.entities;
    assert.equal(entities.length,3);
    assert.equal(new Set(entities.map(v=>v.x)).size,3,kind+' has distinct horizontal starts');
    assert.equal(new Set(entities.map(v=>v.y)).size,3,kind+' has distinct vertical starts');
    assert.equal(new Set(entities.map(v=>v.vx)).size,3,kind+' has distinct launch velocities');
    assert.equal(new Set(entities.map(v=>v.delay)).size,3);
    run(e,3);assert.ok(e.state.actionResults[0].blocks>0,kind+' destroys actual seeded terrain');
  }
});

test('MEGA and NUKE launch at the actual pick and damage seeded narrow and deep terrain within two seconds',()=>{
  for(const kind of ['mega','nuke'])for(const deep of [false,true]){
    const e=make();
    if(deep){run(e,90);assert.ok(e.state.rowOffset>0);}
    const bodyY=e.state.body.y,offset=e.state.rowOffset;
    e.action({type:kind,team:'dark'},context);
    for(const entity of e.state.entities){
      assert.ok(entity.y>=0&&Math.abs(entity.y-bodyY)<3,kind+' must launch visibly near the pick');
      assert.ok(entity.radius<=.45&&entity.size>=2.8,'physical core and oversized visual are distinct');
    }
    run(e,2);
    assert.ok(e.state.actionResults.find(v=>v.actionId===context.actionId).blocks>0,kind+' deep='+deep+' offset='+offset);
  }
});

test('giant cores fit an off-center pick in a single-column deep shaft without spawning in its walls',()=>{
  for(const kind of ['mega','nuke']){
    const e=make();e.state.rowOffset=1200;
    for(let row=0;row<24;row++)e.state.blocks[row*7+3]=null;
    Object.assign(e.state.body,{x:3.64,y:20.5,vx:5,vy:0});
    e.action({type:kind,team:'dark'},context);
    for(const entity of e.state.entities){
      assert.ok(Math.abs(entity.y-20.5)<3);
      for(let i=0;i<e.state.blocks.length;i++)if(e.state.blocks[i])assert.equal(physics.normal(entity,i%7,Math.floor(i/7)),null,kind+' core starts outside wall');
    }
    run(e,2);assert.ok(e.state.actionResults[0].blocks>0,kind+' destroys the nearby floor');
  }
});

test('RAIN stays moderate with twelve mixed picks and expires at ten seconds including stagger',()=>{
  const e=make();e.action({type:'rain'},context);
  assert.equal(e.state.entities.length,12);assert.equal(new Set(e.state.entities.map(v=>v.pickaxe)).size,5);
  const picks=e.state.entities.slice();
  for(let frame=0;frame<600;frame++){
    Object.assign(e.state.body,{x:3.5,y:1,vx:0,vy:0});e.update(1/60);
    if(frame===593)assert.equal(e.state.entities.filter(v=>v.kind==='rain').length,12);
  }
  assert.ok(picks.every(v=>Math.abs(v.age-10)<1e-8));
  assert.equal(e.state.entities.filter(v=>v.kind==='rain').length,0);
});

test('shared physical buffs persist through opposite-team commands and crossing the center',()=>{
  const e=make();
  for(const kind of ['big','fast','spin'])e.action({type:kind,team:'dark'},{...context,actionId:kind});
  e.action({type:'tnt',team:'light'},{...context,actionId:'later-tnt'});
  e.state.body.x=4;e.update(1/60);
  assert.ok(e.state.body.buffs,'effective body buff timers are exposed');
  assert.ok(e.state.body.buffs.big>26&&e.state.body.buffs.fast>14&&e.state.body.buffs.spin>23);
  assert.ok(e.state.body.visualScale>2);assert.ok(e.state.body.radius<=.45);
  assert.ok(e.state.body.speedScale>=2);
  assert.ok(e.state.body.angularSpeed>=60);
  e.clearEffects();e.update(1/60);
  assert.equal(e.state.body.buffs.big,0);assert.equal(e.state.body.visualScale,1);
});

test('a shared buff expires for both teams on the same physical tick',()=>{
  const e=make();e.state.teams.light.buffs.fast=.005;e.update(.01);
  assert.equal(e.state.body.buffs.fast,0);
  assert.equal(e.state.teams.dark.effectiveSpeed,e.state.teams.light.effectiveSpeed);
});

test('FAST maximum physical speed still respects a single-cell wall with spatial substeps',()=>{
  const e=make();e.state.blocks.fill(null);
  for(let row=0;row<40;row++)e.state.blocks[row*7+5]={hp:100000,maxHp:100000,material:'stone',value:2};
  const body=e.state.body;Object.assign(body,{x:2,y:12,vx:36,vy:0});
  assert.ok(MC.fast.physicsSpeedScale<=physics.MAX_SPEED_SCALE);
  let contacts=0;physics.step(body,.25,e.state,()=>contacts++,MC.fast.physicsSpeedScale);
  assert.ok(contacts>0);assert.ok(body.x<=5-body.radius+1e-6);
  assert.ok(Math.abs(body.vx)>24,'the higher speed must actually execute');
});

test('endless engine rejects FAST tuning that exceeds the supported physics speed cap',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),config=require('../games/block-wars/config.js');
  const altered={...config,MINECRAFT_EFFECTS:{...MC,fast:{...MC.fast,physicsSpeedScale:3}}};
  const sandbox={module:{exports:{}},require:path=>path==='./config.js'?altered:physics};
  vm.runInNewContext(fs.readFileSync(require.resolve('../games/block-wars/engine.js'),'utf8'),sandbox);
  assert.throws(()=>sandbox.module.exports.createEngine({layout:'endless'}),/FAST.*physics/i);
});

test('FAST and SPIN visibly rotate faster and excavate more real terrain while BIG keeps stable collision',()=>{
  const normal=make();run(normal,10);const baseline=normal.state.teams.dark.blocks+normal.state.teams.light.blocks;
  for(const kind of ['fast','spin','big']){
    const e=make();e.action({type:kind,team:'dark'},context);run(e,10);
    const destroyed=e.state.teams.dark.blocks+e.state.teams.light.blocks;
    assert.ok(destroyed>baseline*1.5,kind+' '+destroyed+' vs '+baseline);
    if(kind!=='big')assert.ok(e.state.body.angularSpeed>=45,kind+' fast physical rotation');
    assert.ok(e.state.entities.length+e.state.queue.length<=LIMITS.maxQueue);
    assert.ok(Number.isFinite(e.state.body.y));
  }
  const e=make();e.state.body.x=2.36;e.state.body.vx=-5;
  e.action({type:'big',team:'dark'},context);e.update(1/60);
  for(let i=0;i<e.state.blocks.length;i++)if(e.state.blocks[i])assert.equal(physics.normal(e.state.body,i%7,Math.floor(i/7)),null,'BIG core must remain outside solids');
  assert.ok(MC.fast.rotationRate>=45&&MC.spin.rotationRate>=60);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {EVENTS}=require('../games/block-wars/config.js');
const {validateCommand}=require('../lib/contracts.js');
const catalog=['tnt','rainbow','mega','arrow','butterfly','nuke','tnt_rain','thunder','fire','rain','tsunami','black_hole','jackpot','demon','meteor','spin','fast','big','storm','creeper'];
test('the original eighteen effects plus storm and creeper remain static and server-allowlisted',()=>{
  assert.deepEqual(Object.keys(EVENTS).sort(),catalog.slice().sort());
  assert.equal(Object.isFrozen(EVENTS),true);
  for(const key of catalog){
    const descriptor=EVENTS[key];assert.equal(descriptor.id,key);assert.equal(typeof descriptor.label,'string');assert.ok(['blast','buff'].includes(descriptor.mode));
    assert.ok(Number.isFinite(descriptor.cooldown)&&descriptor.cooldown>=0);assert.ok(Number.isFinite(descriptor.duration)&&descriptor.duration>0);
    const command=validateCommand({type:'bw_action',target:'block-wars',action:key,source:'tikfinity'});
    assert.equal(command.action,key);assert.equal(command.source,'simulation');
  }
});
test('browser UMD rules load the same original catalog and dispatch a safe allowlisted action',()=>{
  const context=vm.createContext({});
  for(const name of ['config.js','rules.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../games/block-wars',name),'utf8'),context,{filename:name});
  assert.deepEqual(Object.keys(context.BlockWarsConfig.EVENTS).sort(),catalog.slice().sort());
  const actions=[],engine={state:{round:1,paused:false,phase:'playing',teams:{}},action(action){actions.push(action);return true;}};
  const rules=context.BlockWarsRules.createRules(engine);
  assert.equal(rules.handle({type:'comment',source:'simulator',id:'browser-fixture',receivedAt:0,data:{text:'!BLACK HOLE'}}),true);
  assert.equal(actions[0].type,'black_hole');assert.equal(actions[0].team,'neutral');
});
test('browser rules explain a missing catalog dependency instead of silently dropping aliases',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../games/block-wars/rules.js'),'utf8');
  assert.throws(()=>vm.runInNewContext(source),/Load BlockWarsConfig before BlockWarsRules/);
});
test('all catalog aliases reach the real shaft engine with bounded effects',()=>{
  const {createEngine,LIMITS}=require('../games/block-wars/engine.js');const {createRules}=require('../games/block-wars/rules.js');
  for(const type of catalog){
    const engine=createEngine({seed:42,layout:'shaft',width:7,height:40}),rules=createRules(engine);
    const text=type==='rain'?'Rain':'!'+type.replace(/_/g,' ');
    assert.equal(rules.handle({type:'comment',source:'simulator',id:'shaft-fixture',receivedAt:0,actor:{stableHash:'fixture'},data:{text}}),true,type);
    assert.equal(engine.state.activeEvent.kind,type==='tnt_rain'?'rain':type);assert.equal(rules.metrics.bySource.simulator.effects,1);
    for(let i=0;i<40;i++)engine.update(0.25);
    assert.ok(engine.state.entities.length<=LIMITS.maxEntities);assert.ok(engine.state.queue.length<=LIMITS.maxQueue);
    assert.ok(engine.state.particles.length<=LIMITS.maxParticles);assert.ok(engine.state.effects.length<=LIMITS.maxEffects);
  }
});
test('a rejected real shaft NUKE does not spend chat cooldown or block another allowed effect',()=>{
  const {createEngine}=require('../games/block-wars/engine.js');const {createRules}=require('../games/block-wars/rules.js');
  const engine=createEngine({seed:42,layout:'shaft',width:7,height:40}),rules=createRules(engine);
  const event=(id,text,receivedAt,actor)=>({type:'comment',source:'simulator',id,receivedAt,actor:{stableHash:actor},data:{text}});
  assert.equal(rules.handle(event('n1','Nuke',0,'a')),true);assert.equal(engine.state.nukeCooldown,45);
  assert.equal(rules.handle(event('n2','Nuke',15000,'b')),false);
  assert.equal(rules.handle(event('t1','TNT',15000,'b')),true);
});

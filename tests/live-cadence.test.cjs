'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEngine,LIMITS}=require('../games/block-wars/engine.js');
const {createRules}=require('../games/block-wars/rules.js');
const {createExperience}=require('../games/block-wars/experience.js');

test('optional configured cooldowns retain500ms across viewers and1s per viewer',()=>{
  const engine=createEngine({layout:'endless',seed:21,eventInterval:180});
  const rules=createRules(engine,{effectCooldownMs:500,actorEffectCooldownMs:1000}),notices=[];
  const experience=createExperience(engine,rules,{notify:e=>notices.push(e),impact(){}},()=>{},{platform:'youtube'});
  const send=(actor,at,id)=>experience.handleEvent({type:'comment',source:'youtube',id,receivedAt:at,
    actor:{stableHash:actor,displayName:actor},data:{text:'TNT'}});
  assert.equal(send('Ana',0,'yt-1'),true);
  assert.equal(send('Beto',499,'yt-2'),false);
  for(let i=0;i<30;i++)experience.update(1/60);
  assert.equal(send('Beto',500,'yt-3'),true);
  assert.equal(send('Ana',999,'yt-4'),false);
  for(let i=0;i<30;i++)experience.update(1/60);
  assert.equal(send('Ana',1000,'yt-5'),true);
  assert.deepEqual(notices.map(e=>e.actorName),['Ana','Beto','Ana']);
  assert.ok(notices.every(e=>e.source==='youtube'&&e.narrate===false));
  assert.equal(send('Ana',2000,'yt-5'),false,'duplicate IDs remain blocked');
  assert.ok(engine.state.entities.length+engine.state.queue.length<=LIMITS.maxQueue);
});

test('rapid commands fail honestly when capacity is full and do not announce rejected actors',()=>{
  const engine=createEngine({layout:'endless',seed:24});
  const rules=createRules(engine),sounds=[];
  const experience=createExperience(engine,rules,{notify:e=>sounds.push(e),impact(){}},()=>{},{platform:'youtube'});
  for(let i=0;i<LIMITS.maxQueue;i++)engine.state.entities.push({kind:'tnt'});
  assert.equal(experience.handleEvent({type:'comment',source:'youtube',id:'yt-full',receivedAt:1000,
    actor:{stableHash:'test-miner',displayName:'Minera de prueba'},data:{text:'RAIN'}}),false);
  assert.equal(sounds.length,0);assert.equal(experience.state.lastActivation,null);
  assert.equal(rules.state.lastOutcome.reason,'engine_busy');
});

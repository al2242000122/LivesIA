'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRules}=require('../games/block-wars/rules.js');
const {createExperience}=require('../games/block-wars/experience.js');

function fixture(){
  const actions=[],heard=[],notices=[];
  const engine={state:{round:1,phase:'playing',paused:false,eventCount:0,teams:{dark:{pickaxe:'wood',unlocked:['wood']},light:{pickaxe:'wood',unlocked:['wood']}}},
    action(action,metadata){actions.push({action,metadata});return true;},update(){}};
  const rules=createRules(engine),experience=createExperience(engine,rules,{notify(event){heard.push(event);}},(text,detail)=>notices.push({text,detail}));
  let id=0;
  const send=(text,at=0,actor='Ana',source='simulator',eventId)=>experience.handleEvent({type:'comment',source,id:eventId||'event-'+(++id),receivedAt:at,actor:{stableHash:'user-'+Buffer.from(actor).toString('hex').slice(0,100),displayName:actor},data:{text}});
  return {engine,rules,experience,send,actions,heard,notices};
}

test('rain spelling and TNT RAIN aliases all trigger the same direct effect',()=>{
  for(const command of ['rain','RAIN','!rain','!RAIN','TNT RAIN','!tnt rain','TNTRAIN','!TNTRAIN']){
    const f=fixture();assert.equal(f.send(command),true,command);
    assert.equal(f.actions[0].action.type,'rain',command);
    assert.equal(f.rules.state.rainVotes,0);
    assert.equal(f.heard[0].actorName,'Ana');
  }
});

test('activation provenance uses the exact same local ID for engine, voice and feedback',()=>{
  const f=fixture();f.send('TNT');
  const metadata=f.actions[0].metadata;
  assert.equal(metadata.actor,'Ana');assert.equal(metadata.source,'simulator');
  assert.equal(metadata.actionId,f.heard[0].id);
  assert.equal(metadata.actionId,f.experience.state.lastActivation.id);
  assert.equal(f.experience.state.lastActivation.actorName,'Ana');
  assert.match(f.notices.at(-1).text,/PRUEBA.*Ana.*TNT/);
  assert.doesNotMatch(f.notices.at(-1).text,/próximo contacto/);
});

test('cooldown rejections explain exact remaining time and never announce an activation',()=>{
  const f=fixture();f.send('TNT',0);f.send('RAIN',4000,'Bea');
  assert.equal(f.rules.state.lastOutcome.reason,'global_cooldown');
  assert.equal(f.rules.state.lastOutcome.retryAfterMs,6000);
  assert.equal(f.heard.length,1);assert.match(f.notices.at(-1).text,/6 s/);
  f.send('RAIN',10000);
  assert.equal(f.rules.state.lastOutcome.reason,'actor_cooldown');
  assert.equal(f.rules.state.lastOutcome.retryAfterMs,5000);
  assert.equal(f.heard.length,1);
});

test('unknown conversation and duplicates do not replace the latest visible activation',()=>{
  const f=fixture();f.send('TNT',0,'Ana','simulator','same');
  const first=f.experience.state.lastFeedback,count=f.notices.length;
  assert.equal(f.send('TNT',100,'Ana','simulator','same'),false);
  assert.equal(f.rules.state.lastOutcome.reason,'duplicate');
  assert.equal(f.send('hola mundo',200,'Ana'),false);
  assert.equal(f.rules.state.lastOutcome.reason,'unknown');
  assert.equal(f.experience.state.lastFeedback,first);assert.equal(f.notices.length,count);
});

test('legacy rain voting is retained explicitly as !voterain without claiming an individual author',()=>{
  const f=fixture();f.rules.configure({rainThreshold:2});
  f.send('!voterain',0,'Ana');assert.equal(f.actions.length,0);assert.equal(f.heard.length,0);
  f.send('!voterain',1,'Bea');assert.equal(f.actions.length,1);assert.equal(f.actions[0].action.type,'rain');
  assert.equal(f.actions[0].metadata.actor,'');assert.equal(f.heard[0].actorName,'');
  assert.equal(f.heard[0].source,'simulator');
});

test('normalization cannot introduce markup and transient UI can be cleared on emergency',()=>{
  const f=fixture();f.send('TNT',0,'＜script＞');
  assert.equal(f.heard[0].actorName,'un minero');
  assert.equal(f.actions[0].metadata.actor,'un minero');
  assert.ok(f.experience.state.lastActivation);
  f.experience.clear();assert.equal(f.experience.state.lastActivation,null);assert.equal(f.experience.state.lastFeedback,null);
  f.send('RAIN',20000,'Ana');f.experience.update(8.1);
  assert.equal(f.experience.state.lastFeedback,null);
});

test('a physical TNT created by an accepted comment keeps the author and simulation source',()=>{
  const {createEngine}=require('../games/block-wars/engine.js');
  const engine=createEngine({seed:20261110,layout:'endless',eventInterval:180});
  const rules=createRules(engine),heard=[];
  const experience=createExperience(engine,rules,{notify(event){heard.push(event);}});
  experience.handleEvent({id:'physical-rain',type:'comment',source:'simulator',receivedAt:1,actor:{displayName:'Ana',stableHash:'ana'},data:{text:'!RAIN'}});
  assert.equal(heard.length,1);assert.ok(engine.state.entities.length>0);
  for(const entity of engine.state.entities){
    assert.equal(entity.actor,'Ana');assert.equal(entity.source,'simulator');assert.equal(entity.actionId,heard[0].id);
  }
  assert.equal(engine.state.activeEvent.actor,'Ana');
  assert.equal(engine.state.activeEvent.actionId,experience.state.lastActivation.id);
});

test('busy or paused rejections preserve the existing effect author and have no narration',()=>{
  const f=fixture();f.engine.state.layout='endless';
  f.engine.state.weather={kind:'thunder',actor:'Ana'};
  assert.equal(f.send('RAIN',0,'Bea'),false);
  assert.equal(f.rules.state.lastOutcome.reason,'engine_busy');assert.equal(f.heard.length,0);
  assert.equal(f.engine.state.weather.actor,'Ana');
  f.engine.state.paused=true;assert.equal(f.send('RAIN',20000,'Bea'),false);
  assert.equal(f.rules.state.lastOutcome.reason,'paused');assert.equal(f.heard.length,0);
  assert.match(f.notices.at(-1).text,/pausada/);
});

test('impact cues play once per actual impact and do not create additional narration',()=>{
  const f=fixture(),impacts=[];
  // A separate fixture exposes only the documented audio hooks.
  const effects=[{kind:'tnt',stage:'activation'},{kind:'tnt',stage:'impact'}];
  f.engine.state.effects=effects;
  const experience=createExperience(f.engine,createRules(f.engine),{notify(){throw Error('unexpected narration');},impact(kind){impacts.push(kind);}});
  experience.update(.05);experience.update(.05);
  assert.deepEqual(impacts,['tnt']);
  effects.push({kind:'tnt',stage:'impact'});experience.update(.05);
  assert.deepEqual(impacts,['tnt','tnt']);
});

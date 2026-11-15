'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createAdapter}=require('../integrations/events.js');
const {connect}=require('../integrations/transport.js');
const {createEngine}=require('../games/block-wars/engine.js');
const {createRules}=require('../games/block-wars/rules.js');
const {createExperience}=require('../games/block-wars/experience.js');
function reward(index=1,type='like',at=1000){return {type,source:'youtube',id:'ytr:'+index.toString(16).padStart(32,'0'),receivedAt:at,actor:{displayName:type==='subscriber'?'Ana 🌻 López':'',stableHash:'a'.repeat(32)},data:type==='like'?{delta:1}:{}};}
function fixture(){
  let time=1000;
  const adapter=createAdapter({now:()=>time,rateLimit:1000}),engine=createEngine({layout:'endless',seed:1,eventInterval:180}),sounds=[];
  const experience=createExperience(engine,createRules(engine),{notify:e=>sounds.push(e)},()=>{},{platform:'youtube',now:()=>time});
  return {adapter,engine,sounds,experience,send:(i,type='like')=>experience.handleEvent(adapter.normalizeYouTubeReward(reward(i,type,time))),advance(ms){time+=ms;experience.update(ms/1000);},setTime(value){time=value;}};
}
test('reward adapter uses an exact printable wire contract, opaque dedupe and a separate comments entry point',()=>{
  const adapter=createAdapter({now:()=>1000});
  assert.deepEqual(adapter.normalizeYouTubeReward(JSON.stringify(reward())),reward());
  assert.equal(adapter.normalizeYouTubeReward(reward()),null);
  assert.equal(adapter.normalizeYouTube(reward(2)),null);assert.equal(adapter.normalize(reward(2),'youtube'),null);
  for(const change of [{source:'simulator'},{type:'follow'},{id:'yt:'+'a'.repeat(32)},{receivedAt:-1},{data:{delta:2}},{data:{delta:1,name:'x'}},{target:'block-wars'},{actor:{displayName:'Liker',stableHash:'a'.repeat(32)}},{actor:{displayName:'',stableHash:'bad'}}]){
    assert.equal(adapter.normalizeYouTubeReward({...reward(3),...change}),null,JSON.stringify(change));
  }
  for(const name of ['', 'x'.repeat(45), 'Ana\n', 'Ana\u200b', '\ud800']){
    const event=reward(4,'subscriber');event.actor.displayName=name;assert.equal(adapter.normalizeYouTubeReward(event),null,JSON.stringify(name));
  }
  const event=reward(5,'subscriber');event.actor.displayName='😀'.repeat(44);assert.ok(adapter.normalizeYouTubeReward(event));
});
test('dedicated reward SSE rejects default-channel spoofing and strips reward status private fields',()=>{
  const streams=[],events=[],statuses=[];
  class SSE {constructor(){this.listeners={};streams.push(this);}addEventListener(kind,fn){this.listeners[kind]=fn;}close(){}}
  const env={EventSource:SSE,setTimeout(){},clearTimeout(){}};
  const c=connect({target:'block-wars',youtubeEnabled:true,env,onEvent:e=>events.push(e),onYouTubeState:s=>statuses.push(s)}),s=streams[0];
  const packet={data:JSON.stringify(reward())};
  s.onmessage({data:JSON.stringify({...reward(),target:'block-wars'})});assert.equal(events.length,0);
  s.listeners.youtube_comment(packet);assert.equal(events.length,0);
  s.listeners.youtube_reward(packet);assert.equal(events.length,1);assert.equal(events[0].source,'youtube');
  s.listeners.youtube_state({data:JSON.stringify({state:'connected',rewards:{state:'active',likesObserved:12,likesTriggered:2,subscribersTriggered:1,error:null,token:'private'},auth:'private'})});
  assert.deepEqual(statuses.at(-1),{state:'connected',received:0,rewards:{state:'active',likesObserved:12,likesTriggered:2,subscribersTriggered:1,error:null}});
  s.onerror();assert.notEqual(statuses.at(-1).rewards?.state,'active');c.stop();
  s.listeners.youtube_reward({data:JSON.stringify(reward(2))});assert.equal(events.length,1);
});
test('one official like makes one anonymous TNT and a public subscriber makes three attributed NUKE charges with original voice IDs',()=>{
  const f=fixture();assert.equal(f.send(1),true);assert.equal(f.engine.state.entities.filter(e=>e.kind==='tnt').length,1);
  assert.deepEqual(f.sounds[0],{id:reward().id,kind:'tnt',team:'neutral',actorName:'',source:'youtube',narrate:true,speechKind:'like_milestone'});
  assert.equal(f.send(2,'subscriber'),true);assert.equal(f.sounds.length,1);f.advance(250);
  const entities=f.engine.state.entities.filter(e=>e.kind==='nuke');assert.equal(entities.length,3);
  assert.ok(entities.every(e=>e.actor==='Ana 🌻 López'&&e.source==='youtube'&&e.actionId===reward(2).id));
  assert.equal(f.sounds[1].id,reward(2).id);assert.equal(f.sounds[1].speechKind,'youtube_subscriber');assert.equal(f.sounds[1].narrate,true);
  assert.equal(f.sounds[1].actorName,'Ana 🌻 López');assert.equal(f.experience.handleEvent(reward(2,'subscriber')),false);
});
test('reward queue is bounded, spaces actions, prioritizes public subscribers and expires by real time',()=>{
  const f=fixture();f.send(1);
  for(let i=2;i<=65;i++)assert.equal(f.send(i),true);
  assert.equal(f.experience.state.rewardQueue,64);assert.equal(f.send(66),false);assert.equal(f.send(67,'subscriber'),true);
  assert.equal(f.experience.state.rewardQueue,64);f.advance(249);assert.equal(f.sounds.length,1);f.advance(1);
  assert.equal(f.sounds[1].kind,'nuke');assert.equal(f.experience.state.rewardQueue,63);
  f.setTime(32000);f.experience.update(1/60);assert.equal(f.experience.state.rewardQueue,0);assert.equal(f.sounds.length,2);
});
test('pause, reset and emergency clear queued rewards and rejected engine actions never announce',()=>{
  for(const clear of ['pause','reset','clear']){
    const f=fixture();f.send(1);f.send(2);f.experience[clear](true);f.advance(300);assert.equal(f.sounds.length,1,clear);assert.equal(f.experience.state.rewardQueue,0);
  }
  const f=fixture();f.engine.pause(true);assert.equal(f.send(1),false);assert.equal(f.sounds.length,0);
  f.engine.pause(false);f.engine.state.phase='summary';f.send(2);assert.equal(f.sounds.length,0);
});
test('audio and notice failures cannot interrupt accepted reward gameplay',()=>{
  const engine=createEngine({layout:'endless',seed:1}),experience=createExperience(engine,createRules(engine),{notify(){throw Error('audio');}},()=>{throw Error('UI');},{platform:'youtube',now:()=>1000});
  assert.doesNotThrow(()=>experience.handleEvent(reward()));assert.equal(engine.state.entities.filter(e=>e.kind==='tnt').length,1);
});
test('official rewards stay disabled outside the YouTube scene and expire before initial dispatch',()=>{
  const engine=createEngine({layout:'endless',seed:1}),sounds=[];
  const experience=createExperience(engine,createRules(engine),{notify:e=>sounds.push(e)},()=>{},{now:()=>1000});
  assert.equal(experience.handleEvent(reward()),false);assert.equal(engine.state.entities.length,0);assert.equal(sounds.length,0);
  const f=fixture();f.setTime(31000);assert.equal(f.experience.handleReward(reward()),false);assert.equal(f.sounds.length,0);
});
test('a saturated engine retains a reward until capacity returns and activates it exactly once',()=>{
  const f=fixture();f.engine.state.queue=Array.from({length:500},()=>({delay:60}));
  f.send(1);assert.equal(f.sounds.length,0);assert.equal(f.experience.state.rewardsDropped,0);assert.equal(f.experience.state.rewardQueue,1);
  f.engine.state.queue=[];f.advance(250);assert.equal(f.sounds.length,1);assert.equal(f.sounds[0].id,reward().id);
  assert.equal(f.experience.state.rewardQueue,0);assert.equal(f.experience.state.rewardsActivated,1);
  f.advance(250);assert.equal(f.sounds.length,1);assert.equal(f.engine.state.entities.filter(e=>e.actionId===reward().id).length,1);
});
test('future reward timestamps cannot reserve queue or adapter dedupe capacity',()=>{
  const f=fixture(),future=reward(1,'like',2001);
  assert.equal(f.adapter.normalizeYouTubeReward(future),null);assert.equal(f.experience.handleReward(future),false);
  assert.equal(f.experience.state.rewardQueue,0);assert.ok(f.adapter.normalizeYouTubeReward(reward()));
});

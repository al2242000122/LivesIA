'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEngine}=require('../games/block-wars/engine.js');
const {createRules}=require('../games/block-wars/rules.js');
const {createExperience}=require('../games/block-wars/experience.js');
function harness(options){
  const engine=createEngine({seed:14,layout:'endless',width:7,height:40,eventInterval:5});
  const rules=createRules(engine),heard=[],notices=[];
  const experience=createExperience(engine,rules,{notify(event){heard.push(event);}},text=>notices.push(text),options);
  return {engine,rules,heard,notices,experience};
}
function comment(id,text,at=1){return {id,type:'comment',source:'simulator',receivedAt:at,actor:{displayName:'Minero demo',stableHash:'user1'},data:{text}};}
test('accepted command produces one announcement with its actor; rejected cooldown produces none',()=>{
  const app=harness();
  assert.equal(app.experience.handleEvent(comment('a','NUKE')),true);
  assert.equal(app.heard.length,1);assert.equal(app.heard[0].kind,'nuke');assert.equal(app.heard[0].actorName,'Minero demo');
  app.experience.handleEvent(comment('a','NUKE'));app.experience.handleEvent(comment('b','NUKE',2));
  assert.equal(app.heard.length,1);assert.match(app.notices.at(-1),/enfriamiento|rechazada/i);
});
test('rewarded mine and follow have their own announcement, team choice and ignored paid event have none',()=>{
  const app=harness();app.experience.handleEvent(comment('team','!dark'));
  assert.equal(app.heard.length,0);
  app.experience.handleEvent(comment('mine','!mine',2));
  assert.equal(app.heard.at(-1).kind,'mine');assert.equal(app.heard.at(-1).team,'dark');
  const follow={...comment('follow','',3),type:'follow'};app.experience.handleEvent(follow);
  assert.equal(app.heard.at(-1).kind,'follow');
  app.experience.handleEvent({...follow,id:'paid',type:'subscribe_paid'});assert.equal(app.heard.length,2);
});
test('likes announce a community effect without inventing an individual author',()=>{
  const app=harness();
  app.experience.handleEvent({id:'likes',type:'like',source:'simulator',receivedAt:1,actor:{displayName:'Not the author'},data:{delta:25}});
  assert.equal(app.heard.length,1);assert.equal(app.heard[0].kind,'tnt');assert.equal(app.heard[0].actorName,'');
});
test('deferred community TNT retains simulator source instead of masquerading as automatic',()=>{
  const app=harness();
  app.experience.handleEvent({id:'burst',type:'like',source:'simulator',receivedAt:1,data:{delta:1000}});
  for(let i=0;i<5;i++)app.experience.update(.05);
  assert.ok(app.heard.length>=2);
  assert.ok(app.heard.every(event=>event.source==='simulator'&&event.actorName===''));
});
test('only the third boom vote activates one anonymous community TNT',()=>{
  const app=harness();
  for(let index=0;index<3;index++){
    const base=comment('team'+index,'!dark',index*2+1);base.actor.stableHash='user'+index;
    app.experience.handleEvent(base);
    app.experience.handleEvent({...base,id:'vote'+index,receivedAt:index*2+2,data:{text:'!boom'}});
    assert.equal(app.heard.length,index===2?1:0);
  }
  assert.equal(app.heard[0].kind,'tnt');assert.equal(app.heard[0].actorName,'');
});
test('automatic event announces once and operator demo does not borrow the last spectator identity',()=>{
  const app=harness();app.experience.handleEvent(comment('event','SPIN'));
  app.experience.action({type:'tnt',team:'dark'});assert.equal(app.heard.at(-1).actorName,'');assert.equal(app.heard.at(-1).source,'simulator');
  for(let i=0;i<101;i++)app.experience.update(.05);
  assert.equal(app.heard.filter(event=>event.source==='automatic').length,1);
  assert.equal(new Set(app.heard.map(event=>event.id)).size,app.heard.length);
});

test('automatic narration IDs remain unique after a deterministic engine reset',()=>{
  const app=harness();
  for(let i=0;i<101;i++)app.experience.update(.05);
  const first=app.heard.find(event=>event.source==='automatic');assert.ok(first);
  app.engine.reset();app.rules.reset();app.experience.reset();
  for(let i=0;i<101;i++)app.experience.update(.05);
  const automatic=app.heard.filter(event=>event.source==='automatic');
  assert.equal(automatic.length,2);assert.notEqual(automatic[0].id,automatic[1].id);
});

test('YouTube commands and automatic actions keep FX but cannot request narration',()=>{
  const {SELECTED_EVENTS}=require('../games/block-wars/config.js');
  for(const kind of SELECTED_EVENTS){
    const app=harness({platform:'youtube'});
    assert.equal(app.experience.handleEvent(comment('command',kind)),true,kind);
    assert.equal(app.heard[0].kind,kind);assert.equal(app.heard[0].narrate,false,kind);
  }
  const app=harness({platform:'youtube'});
  for(let i=0;i<101;i++)app.experience.update(.05);
  assert.equal(app.heard[0].source,'automatic');assert.equal(app.heard[0].narrate,false);
});

test('YouTube narrates only accepted like rewards, including deferred credits, without a name',()=>{
  const app=harness({platform:'youtube'});
  app.experience.handleEvent({id:'burst',type:'like',source:'simulator',receivedAt:1,actor:{displayName:'Not the liker'},data:{delta:1000}});
  for(let i=0;i<5;i++)app.experience.update(.05);
  assert.ok(app.heard.length>=2);
  assert.ok(app.heard.every(event=>event.speechKind==='like_milestone'&&event.narrate===true&&event.actorName===''&&event.source==='simulator'));
});

test('YouTube community votes and operator TNT are not narrated as likes',()=>{
  const app=harness({platform:'youtube'});
  for(let index=0;index<5;index++){
    const base=comment('team'+index,'!dark',index*2+1);base.actor.stableHash='user'+index;
    app.experience.handleEvent(base);
    app.experience.handleEvent({...base,id:'vote'+index,receivedAt:index*2+2,data:{text:index<3?'!boom':'!voterain'}});
  }
  app.experience.action({type:'tnt',team:'neutral'});
  assert.ok(app.heard.length>=1);
  assert.ok(app.heard.every(event=>event.narrate===false&&event.speechKind===undefined));
  const rain=harness({platform:'youtube'});
  for(let index=0;index<5;index++){
    const vote=comment('rain'+index,'!voterain',index+1);vote.actor.stableHash='rain-user'+index;
    rain.experience.handleEvent(vote);
  }
  assert.equal(rain.heard.length,1);assert.equal(rain.heard[0].kind,'rain');assert.equal(rain.heard[0].narrate,false);
});

test('YouTube subscriber demo is explicit, while relay follows cannot masquerade as channel subscribers',()=>{
  const app=harness({platform:'youtube'});
  app.experience.handleEvent({...comment('demo','',1),type:'follow'});
  assert.equal(app.heard[0].speechKind,'youtube_subscriber');assert.equal(app.heard[0].narrate,true);
  assert.match(app.notices.at(-1),/PRUEBA.*suscriptor.*canal/i);
  app.experience.handleEvent({...comment('relay','',2),type:'follow',source:'tikfinity'});
  assert.equal(app.heard[1].narrate,false);assert.equal(app.heard[1].speechKind,undefined);
});

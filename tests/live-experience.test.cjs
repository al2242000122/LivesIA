'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEngine}=require('../games/block-wars/engine.js');
const {createRules}=require('../games/block-wars/rules.js');
const {createExperience}=require('../games/block-wars/experience.js');
function harness(){
  const engine=createEngine({seed:14,layout:'endless',width:7,height:40,eventInterval:5});
  const rules=createRules(engine),heard=[],notices=[];
  const experience=createExperience(engine,rules,{notify(event){heard.push(event);}},text=>notices.push(text));
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

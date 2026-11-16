'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createEngine}=require('../games/block-wars/engine');
const {createRules}=require('../games/block-wars/rules');
const {createExperience}=require('../games/block-wars/experience');
function setup(){
 const engine=createEngine({seed:42,layout:'endless',eventInterval:180}),heard=[],notices=[];
 const app=createExperience(engine,createRules(engine),{notify:e=>heard.push(e)},(message,detail)=>notices.push({message,detail}),{platform:'youtube'});
 const send=(n,source='youtube')=>app.handleEvent({type:'comment',source,id:'burst-'+n,receivedAt:n,actor:{stableHash:'user-'+n,displayName:'Minero '+n},data:{text:'NUKE'}});
 return {engine,app,heard,notices,send};
}
test('overflow chat commands are accepted, then sound and attribution start exactly once when dispatched',()=>{
 const f=setup();for(let n=0;n<40;n++)assert.equal(f.send(n),true);
 assert.ok(f.engine.state.pendingActionCount>0);assert.ok(f.heard.length<40);
 assert.match(f.notices.at(-1).message,/queued/i);
 for(let frame=0;frame<1200&&f.heard.length<40;frame++)f.app.update(1/60);
 assert.equal(f.engine.state.pendingActionCount,0);assert.equal(f.heard.length,40);
 assert.equal(new Set(f.heard.map(e=>e.id)).size,40);
 assert.deepEqual(f.heard.map(e=>e.actorName),Array.from({length:40},(_,n)=>'Minero '+n));
 assert.ok(f.heard.every(e=>e.source==='youtube'&&e.narrate===false));
});
test('reader cancellation removes queued YouTube comments but retains queued simulator actions',()=>{
 const f=setup();for(let n=0;n<40;n++)assert.equal(f.send(n),true);
 assert.equal(f.send(41,'simulator'),true);
 const before=f.heard.length;f.app.cancelRewards();
 for(let frame=0;frame<1200&&f.engine.state.pendingActionCount;frame++)f.app.update(1/60);
 assert.equal(f.engine.state.pendingActionCount,0);assert.equal(f.heard.length,before+1);
 assert.equal(f.heard.at(-1).source,'simulator');assert.equal(f.heard.at(-1).actorName,'Minero 41');
});
test('a full membership registry never blocks instant effects from another participant',()=>{
 const engine=createEngine({seed:42,layout:'endless',eventInterval:180});
 const rules=createRules(engine,{maxActors:1});
 const send=(id,text)=>rules.handle({type:'comment',source:'youtube',id,receivedAt:1,actor:{stableHash:id},data:{text}});
 assert.equal(send('member','!dark'),true);
 assert.equal(send('another','TNT'),true);assert.equal(rules.state.trackedActors,1);
 assert.equal(engine.state.entities.length,3);
});
test('instant commands refresh an existing member instead of expiring an active team choice',()=>{
 const engine=createEngine({seed:42,layout:'endless',eventInterval:180});
 const rules=createRules(engine,{actorTtlMs:60000});
 const send=(id,text,at)=>rules.handle({type:'comment',source:'youtube',id,receivedAt:at,actor:{stableHash:'member'},data:{text}});
 assert.equal(send('join','!dark',0),true);assert.equal(send('first','TNT',59000),true);
 assert.equal(send('next','TNT',60001),true);
 assert.equal(rules.state.membershipCounts.dark,1);assert.equal(engine.state.lastEvent.team,'dark');
});
test('an automatic event queued behind a full mine announces its own start once, never the previous viewer action',()=>{
 const f=setup();for(let n=0;n<32;n++)f.app.action({type:'tnt'});
 f.engine.state.nextEventIn=0;f.app.update(1/60);
 assert.equal(f.heard.filter(e=>e.source==='automatic').length,0);
 assert.equal(f.engine.state.eventCount,0);
 for(let frame=0;frame<1200&&f.engine.state.pendingActionCount;frame++)f.app.update(1/60);
 assert.equal(f.engine.state.pendingActionCount,0);
 assert.equal(f.heard.filter(e=>e.source==='automatic').length,1);
 assert.equal(f.engine.state.eventCount,1);
 const automatic=f.heard.at(-1);assert.equal(automatic.actorName,'');
 assert.equal(automatic.kind,f.engine.state.lastEvent.kind);
 assert.equal(f.app.state.lastActivation.engineActionId,f.engine.state.lastEvent.actionId);
});

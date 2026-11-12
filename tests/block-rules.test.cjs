'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createRules} = require('../games/block-wars/rules.js');
function fixture(options={}) {
  const actions=[];
  const engine={state:{round:1,phase:'playing',paused:false,teams:{dark:{pickaxe:'wood',unlocked:['wood','stone','gold']},light:{pickaxe:'wood',unlocked:['wood','stone','gold']}}},action(action){actions.push(action);return true;}};
  const rules=createRules(engine,options); let sequence=0;
  function event(type,data={},actor='alice',at=0,source='simulator',id) {
    return rules.handle({type,data,source,id:id===undefined?`e${++sequence}`:id,receivedAt:at,actor:{stableHash:actor,displayName:'DO NOT DISPLAY <script>'}});
  }
  return {engine,rules,actions,event};
}
test('25 likes dispatch one TNT, sources and remainder are isolated',()=>{
  const f=fixture();f.event('like',{delta:24});f.event('like',{delta:1},'alice',0,'tikfinity');assert.equal(f.actions.length,0);
  f.event('like',{delta:2});assert.equal(f.actions.filter(a=>a.type==='tnt').length,1);
  assert.equal(f.rules.state.likeProgress,2);assert.equal(f.rules.metrics.bySource.simulator.likes,26);assert.equal(f.rules.metrics.bySource.tikfinity.likes,1);
});
test('a huge like burst is bounded and eventually drains without losing credits',()=>{
  const f=fixture({maxEffectsPerFlush:3});f.event('like',{delta:25007});assert.ok(f.actions.length<=3);
  for(let i=0;i<400;i++)f.rules.flush();
  assert.equal(f.actions.reduce((n,a)=>n+(a.type==='tnt'?(a.count||1):0),0),1000);assert.equal(f.rules.state.likeProgress,7);assert.equal(f.rules.state.pendingTnt,0);
});
test('duplicate IDs never cross sources, ignored paid events do nothing',()=>{
  const f=fixture();f.event('like',{delta:25},'a',0,'simulator','same');assert.equal(f.event('like',{delta:25},'a',0,'simulator','same'),false);
  f.event('like',{delta:25},'a',0,'tikfinity','same');f.event('gift',{count:100});f.event('subscribe_paid',{});
  assert.equal(f.actions.length,2);assert.equal(f.rules.metrics.bySource.simulator.duplicates,1);
});
test('team changes, mining and boom cooldown use stable identity and source',()=>{
  const f=fixture({boomThreshold:1});assert.equal(f.event('comment',{text:'!mine'}),false);
  assert.equal(f.event('comment',{text:'!dark'}),true);
  assert.equal(f.event('comment',{text:'!mine'},'alice',0),true);assert.equal(f.event('comment',{text:'!mine'},'alice',14999),false);
  assert.equal(f.event('comment',{text:'!mine'},'alice',15000),true);assert.equal(f.event('comment',{text:'!boom'},'alice',15000),true);
  assert.equal(f.event('comment',{text:'!boom'},'alice',15001),false);assert.equal(f.event('comment',{text:'!light'},'alice',59999),false);assert.equal(f.event('comment',{text:'!light'},'alice',60000),true);
  assert.equal(f.event('comment',{text:'!light'},'alice',60000,'tikfinity'),true);
  assert.equal(f.rules.state.teams.dark.members,0);assert.equal(f.rules.state.teams.light.members,2);
});
test('rain votes are once per round and pick votes once per window with unlock checks',()=>{
  const f=fixture({rainThreshold:2,pickVoteThreshold:2,pickWindowMs:1000});
  for(const actor of ['a','b'])f.event('comment',{text:'!dark'},actor);
  assert.equal(f.event('comment',{text:'!netherita'},'a'),false);
  assert.equal(f.event('comment',{text:'!oro'},'a'),true);assert.equal(f.event('comment',{text:'!piedra'},'a'),false);
  f.event('comment',{text:'!oro'},'b');assert.equal(f.actions.at(-1).pickaxe,'gold');
  f.event('comment',{text:'!rain'},'a');assert.equal(f.event('comment',{text:'!rain'},'a'),false);
  f.event('comment',{text:'!rain'},'b');assert.equal(f.actions.at(-1).type,'rain');
  f.engine.state.round=2;assert.equal(f.event('comment',{text:'!rain'},'a',1001),true);assert.equal(f.rules.state.rainVotes,1);
  assert.equal(f.event('comment',{text:'!piedra'},'a',1001),true);
});
test('follow gets a team or neutral bonus, fallback cooldown, safe info summaries',()=>{
  const f=fixture();f.event('follow',{},'',0,'simulator',null);assert.equal(f.event('follow',{},'',1,'simulator',null),false);
  f.event('comment',{text:'!dark'});f.event('follow',{},'alice');assert.equal(f.actions.at(-1).team,'dark');
  f.event('comment',{text:'!pico'});assert.equal(JSON.stringify(f.rules.state).includes('DO NOT DISPLAY'),false);
  assert.equal(JSON.stringify(f.rules.metrics).includes('alice'),false);assert.equal('viewers' in f.rules.metrics,false);
});
test('caps fail closed, TTL expires and reset clears all session state',()=>{
  const f=fixture({maxActors:2,maxDedupe:3,actorTtlMs:60000,dedupeTtlMs:1000});
  f.event('comment',{text:'!dark'},'a');f.event('comment',{text:'!dark'},'b');assert.equal(f.event('comment',{text:'!dark'},'c'),false);
  assert.ok(f.rules.state.trackedActors<=2);f.event('comment',{text:'!light'},'c',60001);assert.equal(f.rules.state.teams.light.members,1);
  f.rules.reset();assert.equal(f.rules.state.trackedActors,0);assert.equal(f.rules.state.likes,0);assert.equal(f.rules.state.notifications.length,0);
});
test('invalid configuration and events reject without engine effects',()=>{
  assert.throws(()=>fixture({likeThreshold:0}),RangeError);for(const option of [null,false,0,''])assert.throws(()=>fixture(option),RangeError);const f=fixture();
  for(const delta of [Infinity,NaN,-1,1.5,Number.MAX_SAFE_INTEGER])assert.equal(f.event('like',{delta}),false);
  assert.equal(f.rules.handle({type:'like',source:'spoofed',receivedAt:0,data:{delta:25}}),false);
  assert.equal(f.rules.configure({likeThreshold:0}),false);assert.equal(f.actions.length,0);
});
test('pause and engine rejection preserve queued likes until accepted',()=>{
  const f=fixture();f.engine.state.paused=true;f.event('like',{delta:50});assert.equal(f.actions.length,0);assert.equal(f.rules.state.pendingTnt,2);
  f.engine.state.paused=false;f.engine.action=()=>false;f.rules.flush();assert.equal(f.rules.state.pendingTnt,2);
  f.engine.action=a=>{f.actions.push(a);return true;};f.rules.flush();assert.equal(f.rules.state.pendingTnt,0);
});

test('anonymous buckets never collide with a supplied stable identity',()=>{
  const f=fixture();f.event('comment',{text:'!dark'},'__anonymous__');f.event('follow',{},'');
  assert.equal(f.actions.at(-1).team,'neutral');
});
test('a pick vote winner equips only once per team per window',()=>{
  const f=fixture({pickVoteThreshold:1});for(const actor of ['a','b'])f.event('comment',{text:'!dark'},actor);
  f.event('comment',{text:'!oro'},'a');f.event('comment',{text:'!oro'},'b');
  assert.equal(f.actions.filter(a=>a.type==='pickaxe').length,1);
});
test('live config cannot shrink limits below current occupancy or accept inherited keys',()=>{
  const f=fixture();for(const actor of ['a','b'])f.event('comment',{text:'!dark'},actor);
  assert.equal(f.rules.configure({maxActors:1}),false);assert.equal(f.rules.configure({toString:4}),false);
});
test('real engine consumes rules actions, rejects locked picks and retains likes during pause',()=>{
  const {createEngine}=require('../games/block-wars/engine.js');const engine=createEngine({seed:42});const rules=createRules(engine,{pickVoteThreshold:1});let id=0;
  const send=(type,data,at=0)=>rules.handle({type,data,source:'simulator',id:`actual-${++id}`,receivedAt:at,actor:{stableHash:'fixture'}});
  send('comment',{text:'!dark'});assert.equal(send('comment',{text:'!oro'}),false);
  assert.equal(engine.state.teams.dark.pickaxe,'wood');engine.action({type:'pickaxe',team:'dark',pickaxe:'gold'});
  assert.equal(send('comment',{text:'!oro'}),true);assert.equal(engine.state.teams.dark.pickaxe,'gold');
  engine.pause(true);send('like',{delta:50});assert.equal(engine.state.queue.length,0);assert.equal(rules.state.pendingTnt,2);
  engine.pause(false);rules.flush();assert.equal(engine.state.queue.length,2);assert.equal(rules.state.pendingTnt,0);
  for(let i=0;i<40;i++)engine.update(0.25);
  assert.ok(engine.state.teams.dark.blocks+engine.state.teams.light.blocks>0);
});
test('a round turnover inside one vote window allows a fresh vote',()=>{
  const f=fixture({pickVoteThreshold:1});f.event('comment',{text:'!dark'});f.event('comment',{text:'!oro'});
  f.engine.state.round=2;assert.equal(f.event('comment',{text:'!piedra'}),true);
});
const effectAliases=[['TNT','tnt'],['Rainbow','rainbow'],['Mega','mega'],['Arrow','arrow'],['Butterfly','butterfly'],['Nuke','nuke'],['TNT RAIN','tnt_rain'],['TNTRAIN','tnt_rain'],['Thunder','thunder'],['Fire','fire'],['Rain','rain'],['Tsunami','tsunami'],['BLACK HOLE','black_hole'],['BLACKHOLE','black_hole'],['Jackpot','jackpot'],['Demon','demon'],['Meteor','meteor'],['Spin','spin'],['Fast','fast'],['Big','big']];
test('every catalog chat alias works case-insensitively bare or prefixed, without a team',()=>{
  for(const [alias,type] of effectAliases)for(const prefix of ['','!']){
    if(alias==='Rain'&&prefix==='!')continue;
    const f=fixture();assert.equal(f.event('comment',{text:`  ${prefix}${alias.toUpperCase()}  `},''),true,alias+prefix);
    assert.equal(f.actions.at(-1).type,type);assert.equal(f.actions.at(-1).team,'neutral');
  }
});
test('catalog effects share a global cooldown and source-isolated actor cooldowns',()=>{
  const f=fixture();assert.equal(f.event('comment',{text:'TNT'},'a',0),true);
  assert.equal(f.event('comment',{text:'Meteor'},'b',9999,'tikfinity'),false);
  assert.equal(f.event('comment',{text:'Meteor'},'a',10000),false);
  assert.equal(f.event('comment',{text:'Meteor'},'a',10000,'tikfinity'),true);
  assert.equal(f.event('comment',{text:'Mega'},'a',20000),true);
  assert.equal(f.actions.length,3);
});
test('effect cooldowns keep identity, dedupe, anonymous bounds, teams, and reset semantics',()=>{
  const f=fixture();f.event('comment',{text:'!dark'},'a');
  f.event('comment',{text:'!Fire'},'a',0,'simulator','effect-id');assert.equal(f.actions.at(-1).team,'dark');
  assert.equal(f.event('comment',{text:'Fire'},'a',20000,'simulator','effect-id'),false);
  assert.equal(f.event('comment',{text:'Fire'},'',20000,'simulator',null),true);
  assert.equal(f.event('comment',{text:'TNT'},'',30000,'simulator',null),false);
  f.rules.reset();assert.equal(f.event('comment',{text:'TNT'},'',0,'simulator',null),true);
});
test('!rain remains a vote and bare Rain dispatches one cooldown-protected action',()=>{
  const f=fixture({rainThreshold:2});assert.equal(f.event('comment',{text:'!rain'},'a'),true);assert.equal(f.actions.length,0);
  assert.equal(f.event('comment',{text:'RAIN'},'a'),true);assert.equal(f.actions.at(-1).type,'rain');assert.equal(f.rules.state.rainVotes,1);
  assert.equal(f.event('comment',{text:'!rain'},'b'),true);assert.equal(f.rules.state.rainVotes,2);
  for(const text of ['please TNT','TNT now','!black_hole','TNT RAIN;whoami','eval(1)','Jackpot<script>','!!TNT'])assert.equal(f.event('comment',{text},'a',20000),false,text);
});
test('rejected/paused engine actions do not consume an effect cooldown',()=>{
  const f=fixture();f.engine.state.paused=true;assert.equal(f.event('comment',{text:'TNT'}),false);
  f.engine.state.paused=false;f.engine.action=()=>false;assert.equal(f.event('comment',{text:'TNT'}),false);
  f.engine.action=a=>{f.actions.push(a);return true;};assert.equal(f.event('comment',{text:'TNT'}),true);
});
test('new effect cooldown configuration is validated and cannot outlive actor TTL',()=>{
  const f=fixture({effectCooldownMs:1000,actorEffectCooldownMs:2000});f.event('comment',{text:'TNT'},'a');
  assert.equal(f.event('comment',{text:'Fire'},'b',1000),true);assert.equal(f.event('comment',{text:'TNT'},'a',2000),true);
  assert.equal(f.rules.configure({effectCooldownMs:0}),false);assert.equal(f.rules.configure({actorEffectCooldownMs:86400001}),false);
  assert.throws(()=>fixture({actorTtlMs:60000,actorEffectCooldownMs:60001}),RangeError);
});
test('global effect cooldown rejects new-actor spam before allocating membership records',()=>{
  const f=fixture({maxActors:2});f.event('comment',{text:'TNT'},'a');
  for(let i=0;i<20;i++)assert.equal(f.event('comment',{text:'TNT'},`spam-${i}`,1),false);
  assert.equal(f.rules.state.trackedActors,1);assert.equal(f.event('comment',{text:'!dark'},'legitimate',2),true);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEngine}=require('../games/block-wars/engine.js');
const {createRules}=require('../games/block-wars/rules.js');
const {MINECRAFT_EFFECTS:MC,LIMITS,EVENTS,BUFFS}=require('../games/block-wars/config.js');
const context={actor:'Miner',source:'youtube',actionId:'frenzy'};
function world(){
  const e=createEngine({seed:42,layout:'endless',eventInterval:180});
  e.state.blocks=e.state.blocks.map((_,i)=>i<70?null:{material:'stone',hp:1.8,maxHp:1.8,value:2});
  return e;
}
function advance(e,seconds){for(let i=0;i<Math.round(seconds*60);i++){Object.assign(e.state.body,{x:3.5,y:1,vx:0,vy:0});e.update(1/60);}}

test('endless frenzy launches tripled physical commands and twelve arrows without altering legacy descriptors',()=>{
  for(const [kind,count] of Object.entries({tnt:3,rain:12,creeper:3,meteor:3,fire:12,tsunami:3,arrow:12,mega:3,nuke:3})){
    const e=world();assert.equal(e.action({type:kind,team:'dark'},context),true,kind);
    assert.equal(e.state.entities.length,count,kind);
    assert.ok(e.state.entities.every(v=>v.actor===context.actor&&v.actionId===context.actionId));
  }
  assert.equal(EVENTS.tnt.count,1);assert.equal(EVENTS.rain.count,8);assert.equal(EVENTS.thunder.duration,4);
});

test('endless THUNDER and STORM stay active twelve seconds and produce denser pulses',()=>{
  for(const kind of ['thunder','storm']){
    const e=world();e.action({type:kind,team:'dark'},context);
    assert.equal(e.state.weather.duration,12);advance(e,8);
    assert.ok(e.state.weatherEvents.some(v=>v.actionId===context.actionId),kind+' remains active after eight seconds');
    assert.ok(e.state.actionResults[0].blocks>0);
    advance(e,4);assert.equal(e.state.weather,null);
  }
  assert.equal(MC.thunder.pulseSeconds,.22);assert.equal(MC.storm.pulseSeconds,.06);
});

test('ten-NUKE internal rewards mean exactly ten credited charges, cycling safe launch positions and palettes',()=>{
  const e=world();assert.equal(e.action({type:'nuke',team:'dark',count:10},context),true);
  const charges=e.state.entities.slice();assert.equal(charges.length,10);
  assert.deepEqual(charges.map(v=>v.variantIndex),[0,1,2,0,1,2,0,1,2,0]);
  assert.deepEqual(charges.map(v=>v.volleyIndex),[0,1,2,3,4,5,6,7,8,9]);
  assert.ok(charges.every(v=>v.x>=v.radius&&v.x<=7-v.radius&&v.delay<=1.2));
  assert.equal(charges[0].x,charges[3].x);assert.equal(charges[1].x,charges[4].x);
  advance(e,12);assert.ok(e.state.actionResults[0].completed);assert.ok(e.state.actionResults[0].blocks>0);
  assert.ok(charges.every(v=>v.actionId===context.actionId&&v.actor===context.actor));
  assert.equal(world().action({type:'nuke',count:11},context),false);
  assert.equal(world().action({type:'tnt',count:9},context),false);
  for(const layout of ['arena','shaft'])assert.equal(createEngine({layout}).action({type:'nuke',count:10},context),false,'count extension is endless only');
});

test('same-time distinct and repeated endless chat effects overlap while duplicate messages stay rejected',()=>{
  const e=world(),rules=createRules(e);
  const send=(id,text)=>rules.handle({type:'comment',source:'youtube',id,receivedAt:0,actor:{stableHash:'miner'},data:{text}});
  for(const [i,kind] of ['THUNDER','STORM','TNT','TNT'].entries())assert.equal(send('rapid-'+i,kind),true,kind);
  assert.equal(send('rapid-3','TNT'),false);assert.equal(rules.state.lastOutcome.reason,'duplicate');
  assert.equal(e.state.weatherEvents.length,2);assert.equal(e.state.entities.filter(v=>v.kind==='tnt').length,6);
  assert.equal(rules.state.nextEffectInMs,0);
});

test('endless buff durations and strength grow with bounded collision-safe body size',()=>{
  for(const kind of ['fast','big','spin']){
    const e=world();e.action({type:kind,team:'dark'},context);
    assert.ok(e.state.teams.dark.buffs[kind]>=BUFFS[kind].duration*3);
    e.update(1/60);
    if(kind==='big')assert.ok(e.state.body.radius<=.45&&e.state.body.visualScale>2);
  }
  assert.ok(MC.spin.rotationRate>=18);assert.ok(MC.fire.burnSeconds>=6);assert.ok(MC.fire.burnDamage> .9);
  assert.ok(LIMITS.maxQueue>=96);assert.ok(LIMITS.maxWeather>=16);
});

test('legacy BIG cleave preserves its five-cell footprint in arena and shaft',()=>{
  for(const layout of ['arena','shaft']){
    const e=createEngine({layout,seed:42,eventInterval:180});
    const team=e.state.teams.dark;
    e.state.blocks=e.state.blocks.map(()=>({material:'stone',hp:100,maxHp:100,value:2}));
    team.target={x:2,y:2};team.progress=.01;team.buffs.big=9;
    e.state.blocks[2*e.state.width+2].hp=.001;
    e.update(.001);
    const blast=e.state.queue.find(entry=>entry.kind==='big');
    assert.ok(blast,layout+' produces a contact cleave');
    assert.equal(blast.indices.length,5,layout+' keeps its original radius rather than the endless diagonal cleave');
  }
});

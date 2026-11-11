'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createEngine, PICKAXES, MATERIALS, LIMITS } = require('../games/block-wars/engine.js');

function ticks(engine, seconds, dt = 0.05) {
  for (let i = 0; i < Math.ceil(seconds / dt); i++) engine.update(dt);
}

test('same seed and actions produce identical worlds, wear and scores; other seeds differ', () => {
  const a = createEngine({seed:42});
  const b = createEngine({seed:42});
  assert.deepEqual(a.state, b.state);
  assert.notDeepEqual(a.state.blocks, createEngine({seed:43}).state.blocks);
  for (const engine of [a,b]) {
    engine.action({type:'pickaxe', team:'dark', pickaxe:'gold'});
    engine.action({type:'enchant', team:'dark', efficiency:5, unbreaking:3, fortune:3});
    engine.action({type:'meteor', team:'light'});
    ticks(engine, 20);
  }
  assert.deepEqual(a.state, b.state);
});

test('configuration expresses specified speeds, durability and virtual material values', () => {
  assert.deepEqual(Object.values(PICKAXES).map(p=>[p.baseSpeed,p.durability]),
    [[0.6,20],[1,40],[2.8,12],[1.75,120],[2.2,180]]);
  for (const block of Object.values(MATERIALS)) {
    assert.ok(block.hardness >= 1 && block.value > 0);
    assert.match(block.color, /^#[0-9a-f]{6}$/i);
  }
  const engine = createEngine({seed:5});
  engine.action({type:'pickaxe', team:'dark', pickaxe:'gold'});
  engine.action({type:'enchant', team:'dark', efficiency:5});
  assert.equal(engine.state.teams.dark.effectiveSpeed, 16.8);
  engine.action({type:'turbo', team:'dark'});
  engine.action({type:'descomunal', team:'dark'});
  assert.ok(Math.abs(engine.state.teams.dark.effectiveSpeed - 100.8) < 1e-10);
});

test('autonomous mining makes genuine damage, points, progress and free unlocks', () => {
  const engine = createEngine({seed:12,duration:900,eventInterval:180});
  ticks(engine, 2);
  assert.ok(engine.state.teams.dark.blocks >= 1);
  assert.ok(engine.state.teams.light.blocks >= 1);
  assert.ok(engine.state.blocks.some(block=>block === null));
  ticks(engine, 80);
  assert.ok(engine.state.teams.dark.unlocked.includes('diamond'));
  assert.ok(engine.state.teams.dark.score > 0);
  assert.ok(engine.state.teams.dark.durability > 0);
});

test('fractional work observes hardness and gold V mines faster than wood', () => {
  const wood = createEngine({seed:24,eventInterval:180});
  const gold = createEngine({seed:24,eventInterval:180});
  gold.action({type:'pickaxe',team:'dark',pickaxe:'gold'});
  gold.action({type:'enchant',team:'dark',efficiency:5});
  ticks(wood,0.5); ticks(gold,0.5);
  assert.equal(wood.state.teams.dark.blocks,0);
  assert.ok(gold.state.teams.dark.blocks >= 5);
  // First topsoil block has hardness 1; 0.6 work/sec for 0.5 sec leaves 0.7 HP.
  assert.ok(Math.abs(wood.state.blocks[0].hp-0.7)<1e-10);
});

test('pause freezes everything and reset reproduces initial state without stale effects', () => {
  const engine = createEngine({seed:33});
  engine.action({type:'rain'});
  ticks(engine,0.1);
  engine.pause(true);
  const snapshot = JSON.stringify(engine.state);
  ticks(engine,5);
  assert.equal(JSON.stringify(engine.state),snapshot);
  assert.equal(engine.action({type:'nuke'}),false);
  engine.reset(33);
  assert.deepEqual(engine.state, createEngine({seed:33}).state);
});

test('round ends with score result, a visible summary and automatic next round', () => {
  const engine = createEngine({seed:3,duration:10,eventInterval:180});
  ticks(engine,10.1);
  assert.equal(engine.state.phase,'summary');
  const {dark,light} = engine.state.teams;
  assert.equal(engine.state.result,dark.score===light.score?'tie':dark.score>light.score?'dark':'light');
  assert.equal(engine.state.queue.length,0);
  const round = engine.state.round;
  ticks(engine,6);
  assert.equal(engine.state.round,round+1);
  assert.equal(engine.state.phase,'playing');
});

test('periodic free events occur with no audience and expire buffs', () => {
  const engine = createEngine({seed:2,eventInterval:5,duration:900});
  ticks(engine,5.1);
  assert.ok(engine.state.eventCount>=1);
  assert.ok(engine.state.lastEvent);
  engine.action({type:'turbo',team:'light'});
  assert.ok(engine.state.teams.light.buffs.turbo>0);
  engine.configure({eventInterval:180});
  ticks(engine,15);
  assert.equal(engine.state.teams.light.buffs.turbo,0);
});

test('temporary speed states have a fixed duration and cannot be prolonged by spam', () => {
  const engine=createEngine({seed:91,eventInterval:180});
  assert.equal(engine.action({type:'turbo',team:'dark'}),true);
  ticks(engine,5);
  assert.equal(engine.action({type:'turbo',team:'dark'}),false);
  ticks(engine,6);
  assert.equal(engine.state.teams.dark.buffs.turbo,0);
  assert.equal(engine.action({type:'turbo',team:'dark'}),false);
  ticks(engine,10);
  assert.equal(engine.action({type:'turbo',team:'dark'}),true);
});

test('all external actions, dt, settings and seeds are validated, with no coercion', () => {
  const engine = createEngine({seed:1});
  for (const action of [null,[],{}, {type:'gift'}, {type:'mine',team:'bad'},
    {type:'tnt',count:1e20}, {type:'tnt',x:NaN}, {type:'tnt',x:-1,y:2},
    {type:'pickaxe',pickaxe:'__proto__'}, {type:'enchant',efficiency:6},
    {type:'pickaxe',pickaxe:['gold']},
    {type:'enchant',fortune:'3'}, {type:'turbo',duration:Infinity},
    {type:'mine',team:'dark',extra:true}]) assert.equal(engine.action(action),false);
  const snapshot = JSON.stringify(engine.state);
  for (const dt of [-1,NaN,Infinity,'1',null]) engine.update(dt);
  assert.equal(JSON.stringify(engine.state),snapshot);
  assert.equal(engine.configure({duration:'60'}),false);
  assert.equal(engine.configure({eventInterval:0}),false);
  assert.equal(engine.configure({unknown:1}),false);
  assert.equal(engine.pause('false'),false);
  assert.equal(engine.reset('seed'),false);
});

test('manually selecting a powerful free pick is not downgraded by early unlocks', () => {
  const engine=createEngine({seed:4,eventInterval:180});
  engine.action({type:'pickaxe',team:'dark',pickaxe:'diamond'});
  engine.action({type:'enchant',team:'dark',efficiency:5});
  ticks(engine,0.85);
  assert.ok(engine.state.teams.dark.blocks>=8);
  assert.equal(engine.state.teams.dark.pickaxe,'diamond');
});

test('gold depletes after 12 blocks and falls back to a free durable unlocked pick', () => {
  const engine=createEngine({seed:4,width:40,height:40,eventInterval:180,duration:900});
  engine.action({type:'pickaxe',team:'dark',pickaxe:'gold'});
  engine.action({type:'enchant',team:'dark',efficiency:5});
  ticks(engine,0.75);
  assert.equal(engine.state.teams.dark.inventory.gold,0);
  assert.equal(engine.state.teams.dark.pickaxe,'stone');
  assert.ok(engine.state.teams.dark.durability>0);
  const before=engine.state.teams.dark.blocks;
  ticks(engine,20);
  assert.ok(engine.state.teams.dark.blocks>before);
});

test('unbreaking saves seeded wear and fortune increases virtual ore points only', () => {
  const setup=(unbreaking,fortune)=>{
    const engine=createEngine({seed:124,width:40,height:40,eventInterval:180,duration:900});
    engine.action({type:'pickaxe',team:'dark',pickaxe:'netherite'});
    engine.action({type:'enchant',team:'dark',efficiency:5,unbreaking,fortune});
    ticks(engine,10);
    return engine.state.teams.dark;
  };
  const normal=setup(0,0),enchanted=setup(3,3);
  assert.equal(normal.blocks,enchanted.blocks);
  assert.ok(enchanted.durability>normal.durability);
  assert.ok(enchanted.score>normal.score);
});

test('batched TNT acceptance is atomic and emergency clears work and speed buffs', () => {
  const engine=createEngine({seed:8});
  assert.equal(engine.action({type:'tnt',team:'neutral',count:8}),true);
  assert.equal(engine.action({type:'tnt',team:'neutral',count:8}),true);
  assert.equal(engine.action({type:'tnt',team:'neutral',count:8}),true);
  assert.equal(engine.state.queue.length,24);
  assert.equal(engine.action({type:'tnt',team:'neutral',count:2}),false);
  assert.equal(engine.state.queue.length,24);
  engine.action({type:'turbo',team:'dark'});
  engine.action({type:'mine',team:'dark',count:8});
  engine.clearEffects();
  assert.equal(engine.state.queue.length,0);
  assert.equal(engine.state.teams.dark.progress,0);
  assert.equal(engine.state.teams.dark.effectiveSpeed,0.6);
});

test('nuke has global cooldown and does not bypass bounded work or visual limits', () => {
  const engine = createEngine({seed:11,duration:900,eventInterval:180});
  assert.equal(engine.action({type:'nuke',team:'dark'}),true);
  assert.equal(engine.action({type:'nuke',team:'light'}),false);
  for(let i=0;i<1000;i++) engine.action({type:'rain',team:'light'});
  assert.ok(engine.state.queue.length<=LIMITS.maxQueue);
  const before = engine.state.blocks.filter(Boolean).length;
  engine.update(0.25);
  assert.ok(before-engine.state.blocks.filter(Boolean).length<=LIMITS.maxBlockOps);
  assert.ok(engine.state.particles.length<=LIMITS.maxParticles);
  assert.ok(engine.state.effects.length<=LIMITS.maxEffects);
  ticks(engine,46);
  assert.equal(engine.action({type:'nuke',team:'light'}),true);
  engine.clearEffects();
  assert.equal(engine.state.queue.length+engine.state.effects.length+engine.state.particles.length,0);
});

test('reduced motion stops particles while preserving excavation and fixed state reference', () => {
  const engine = createEngine({seed:99,reducedMotion:true});
  const state = engine.state;
  engine.action({type:'meteor',team:'dark'});
  ticks(engine,1);
  assert.equal(engine.state.particles.length,0);
  assert.ok(engine.state.teams.dark.blocks>0);
  engine.reset(99);
  assert.equal(engine.state,state);
  assert.equal(engine.configure({duration:45,eventInterval:10,reducedMotion:false}),true);
  assert.equal(engine.state.config.duration,45);
});

test('visual accessibility does not alter seeded gameplay or durability', () => {
  const normal=createEngine({seed:73}),reduced=createEngine({seed:73,reducedMotion:true});
  for(const engine of [normal,reduced]) {
    engine.action({type:'pickaxe',team:'dark',pickaxe:'gold'});
    engine.action({type:'enchant',team:'dark',efficiency:5,unbreaking:3,fortune:3});
    ticks(engine,30);
  }
  assert.deepEqual(normal.state.blocks,reduced.state.blocks);
  assert.deepEqual(normal.state.teams,reduced.state.teams);
});

test('long suspension consumes bounded time and global nuke cooldown crosses round boundaries', () => {
  const engine=createEngine({seed:99,duration:10,eventInterval:180});
  engine.update(60*60);
  assert.equal(engine.state.remaining,9.75);
  engine.action({type:'nuke'});
  ticks(engine,14);
  assert.ok(engine.state.round>=2);
  assert.ok(engine.state.nukeCooldown>0);
  assert.equal(engine.action({type:'nuke'}),false);
});

test('UMD browser globals work without require or DOM', () => {
  const sandbox = {};
  vm.createContext(sandbox);
  for (const name of ['config.js','engine.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../games/block-wars',name),'utf8'),sandbox);
  assert.equal(typeof sandbox.BlockWarsEngine.createEngine,'function');
  assert.equal(sandbox.BlockWarsEngine.createEngine({seed:8}).state.width,20);
});

test('120000 ticks with event floods stay bounded and continue through many rounds', () => {
  const engine = createEngine({seed:800,duration:30,eventInterval:5});
  let totalBlocks=0;
  for(let i=0;i<120000;i++) {
    if(i%17===0) {
      for(const type of ['rain','meteor','tnt','nuke','descomunal']) engine.action({type,team:i%2?'dark':'light'});
    }
    engine.update(0.05);
    totalBlocks=Math.max(totalBlocks,engine.state.teams.dark.blocks+engine.state.teams.light.blocks);
    assert.ok(engine.state.queue.length<=LIMITS.maxQueue);
    assert.ok(engine.state.particles.length<=LIMITS.maxParticles);
    assert.ok(engine.state.effects.length<=LIMITS.maxEffects);
    assert.ok(Number.isFinite(engine.state.teams.dark.score));
    assert.ok(engine.state.teams.dark.progress>=0 && engine.state.teams.dark.progress<=LIMITS.maxProgress);
  }
  assert.ok(engine.state.round>100);
  assert.ok(totalBlocks>100);
});

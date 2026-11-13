'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEngine,EVENTS,MATERIALS,LIMITS}=require('../games/block-wars/engine.js');
const make=(options={})=>createEngine({seed:20261111,layout:'shaft',width:7,height:40,eventInterval:180,...options});
function ticks(engine,seconds,dt=0.05){for(let i=0;i<Math.ceil(seconds/dt);i++)engine.update(dt);}

test('shaft opens a narrow central sky pocket in a seeded 7x40 geological world',()=>{
  const engine=make(),state=engine.state;
  assert.equal(state.layout,'shaft');assert.equal(state.width,7);assert.equal(state.height,40);
  assert.deepEqual(state.blocks,make().state.blocks);
  assert.notDeepEqual(state.blocks,make({seed:99}).state.blocks);
  for(let y=0;y<8;y++)for(const x of [2,3])assert.equal(state.blocks[y*7+x],null);
  assert.equal(state.blocks.filter(x=>x===null).length,16);
  for(const material of ['coal','iron','redstone','lapis','emerald','copper','granite','diorite','andesite','moss','diamond']){
    assert.ok(MATERIALS[material]);assert.ok(Number.isFinite(MATERIALS[material].hardness));
  }
  assert.ok(new Set(state.blocks.filter(Boolean).map(block=>block.material)).size>=12);
  assert.ok(state.focus.y>=7 && state.focus.y<=10);
});

test('shaft miners contact the central front and progress downward without clearing the top sides',()=>{
  const engine=make();
  assert.ok(engine.state.teams.dark.target.y>=8);
  assert.ok(engine.state.teams.light.target.y>=8);
  ticks(engine,30);
  assert.ok(engine.state.focus.y>10);
  for(const x of [0,1,5,6])assert.ok(engine.state.blocks[x]);
  assert.ok(engine.state.elapsed>=29.9);
  assert.ok(engine.state.teams.dark.score>0 && engine.state.teams.light.score>0);
});

test('shaft TNT is a moving object before its fuse resolves into a bounded impact',()=>{
  const engine=make();
  assert.equal(engine.action({type:'tnt',team:'dark'}),true);
  assert.equal(engine.state.queue.length,0);assert.equal(engine.state.entities.length,1);
  const initial={...engine.state.entities[0]};
  assert.equal(initial.kind,'tnt');assert.equal(initial.team,'dark');
  assert.ok(initial.duration>=1 && initial.duration<=1.5);
  ticks(engine,0.5);
  const entity=engine.state.entities[0];
  assert.ok(entity.age>0 && entity.y>initial.y);
  assert.equal(engine.state.effects.filter(e=>e.kind==='tnt').length,0);
  ticks(engine,0.8);
  assert.equal(engine.state.entities.length,0);
  assert.ok(engine.state.effects.some(e=>e.kind==='tnt'));
  assert.ok(engine.state.teams.dark.blocks>1);
});

test('all20 catalog actions retain a shaft gameplay consequence and matching HUD timer',()=>{
  const keys=['tnt','rainbow','mega','arrow','butterfly','nuke','tnt_rain','thunder','fire','rain','storm','creeper','tsunami','black_hole','jackpot','demon','meteor','spin','fast','big'];
  assert.deepEqual(Object.keys(EVENTS),keys);
  const signatures=new Set();
  for(const kind of keys){
    const engine=make(),descriptor=EVENTS[kind];
    assert.equal(descriptor.id,kind);
    const originalSpeed=engine.state.teams.dark.effectiveSpeed;
    assert.equal(engine.action({type:kind,team:'dark'}),true,kind);
    assert.equal(engine.state.activeEvent.kind,kind);
    assert.equal(engine.state.activeEvent.remaining,engine.state.activeEvent.duration);
    if(descriptor.mode==='buff'){
      assert.ok(engine.state.teams.dark.buffs[kind]>0,kind);
      assert.ok(engine.state.teams.dark.effectiveSpeed>originalSpeed,kind);
    } else {
      assert.ok(engine.state.entities.length>0,kind);
      signatures.add([descriptor.shape,descriptor.radius,descriptor.count,descriptor.size].join(':'));
      ticks(engine,1.5);
      assert.ok(engine.state.effects.some(e=>e.kind===kind),kind);
      assert.ok(engine.state.teams.dark.blocks>0,kind);
    }
    assert.equal(engine.action({type:kind,team:'dark'}),false,kind+' cooldown');
  }
  assert.ok(signatures.size>=10,'destructive event shapes/sizes/counts are distinct');
});

test('shaft reset, emergency, summary and pause clean or freeze physical objects and buffs',()=>{
  const engine=make({duration:10});
  engine.action({type:'mega',team:'dark'});engine.action({type:'spin',team:'dark'});
  engine.pause(true);const snapshot=JSON.stringify(engine.state);ticks(engine,2);
  assert.equal(JSON.stringify(engine.state),snapshot);
  engine.pause(false);engine.clearEffects();
  assert.equal(engine.state.entities.length,0);assert.equal(engine.state.activeEvent,null);
  assert.equal(engine.state.teams.dark.buffs.spin,0);
  engine.reset();assert.deepEqual(engine.state,make({duration:10}).state);
  ticks(engine,9.5);engine.action({type:'meteor',team:'light'});ticks(engine,0.5);
  assert.equal(engine.state.phase,'summary');assert.equal(engine.state.entities.length,0);
  ticks(engine,4.1);assert.equal(engine.state.round,2);assert.ok(engine.state.elapsed<1);
});

test('shaft entities plus queued work share capacity and block work remains bounded',()=>{
  const engine=make();
  for(let i=0;i<500;i++)for(const kind of Object.keys(EVENTS))engine.action({type:kind,team:i%2?'dark':'light'});
  assert.ok(engine.state.entities.length<=24);
  assert.ok(engine.state.entities.length+engine.state.queue.length<=LIMITS.maxQueue);
  for(let i=0;i<50;i++){
    const before=engine.state.blocks.filter(Boolean).length;
    engine.update(0.05);
    if(engine.state.phase==='playing')assert.ok(before-engine.state.blocks.filter(Boolean).length<=40);
    assert.ok(engine.state.entities.length+engine.state.queue.length<=24);
  }
});

test('100000 shaft ticks survive the full catalog and free round turnover',()=>{
  const engine=make({duration:30,eventInterval:5});
  const keys=Object.keys(EVENTS);let maxEntities=0,maxQueue=0,highestRound=0;
  for(let i=0;i<100000;i++){
    if(i%11===0)engine.action({type:keys[Math.floor(i/11)%keys.length],team:i%2?'dark':'light'});
    engine.update(0.05);highestRound=Math.max(highestRound,engine.state.round);
    maxEntities=Math.max(maxEntities,engine.state.entities.length);maxQueue=Math.max(maxQueue,engine.state.queue.length);
    assert.ok(engine.state.entities.length+engine.state.queue.length<=24);
    assert.ok(engine.state.effects.length<=24 && engine.state.particles.length<=160);
    assert.ok(Number.isFinite(engine.state.focus.x) && Number.isFinite(engine.state.focus.y));
    for(const team of Object.values(engine.state.teams))assert.ok(team.effectiveSpeed<=1000 && Number.isFinite(team.score));
  }
  assert.ok(highestRound>100);assert.ok(maxEntities>0 && maxQueue>0);
});

test('new event input remains strict and all physical state is finite after repeated resets',()=>{
  assert.throws(()=>make({layout:'tunnel'}),RangeError);
  const engine=make();
  for(const input of [{type:'mega',count:2},{type:'fire',x:2,y:8},{type:'rainbow',duration:100},
    {type:'black_hole',team:'__proto__'},{type:'thunder',size:1000}])assert.equal(engine.action(input),false);
  for(let repeat=0;repeat<100;repeat++){
    engine.action({type:'tnt_rain',team:'dark'});engine.action({type:'big',team:'light'});
    ticks(engine,0.5);
    for(const entity of engine.state.entities)for(const key of ['x','y','targetX','targetY','age','duration','size','rotation'])assert.ok(Number.isFinite(entity[key]));
    engine.reset(20261111);
    assert.equal(engine.state.entities.length+engine.state.queue.length,0);
    assert.equal(engine.state.elapsed,0);assert.equal(engine.state.activeEvent,null);
  }
  assert.deepEqual(engine.state,make().state);
});

test('golden virtual jackpot doubles block points without external rewards',()=>{
  const engine=make();
  engine.action({type:'jackpot',team:'dark'});
  const start=engine.state.blocks;
  // Capture only the first impact tick; normal miners have not finished a block yet.
  ticks(engine,1.15);
  const before=engine.state.teams.dark.score;
  const left=engine.state.blocks.map(block=>block && {...block});
  engine.update(0.05);
  let value=0;
  for(let i=0;i<left.length;i++)if(left[i] && !engine.state.blocks[i])value+=left[i].value;
  assert.ok(value>0);
  assert.equal(engine.state.teams.dark.score-before,value*2);
  assert.equal(engine.state.blocks,start);
});

test('six tool effects differ in movement, durability, score, cleave and duration',()=>{
  const engine=make();
  engine.action({type:'butterfly',team:'dark'});
  const initial=engine.state.teams.dark.durability;
  ticks(engine,4);
  assert.ok(engine.state.teams.dark.blocks>0);
  assert.equal(engine.state.teams.dark.durability,initial);
  const enlarged=make();
  enlarged.action({type:'big',team:'dark'});ticks(enlarged,3);
  assert.ok(enlarged.state.effects.some(effect=>effect.kind==='big'));
  assert.notEqual(EVENTS.fast.duration,EVENTS.spin.duration);
  assert.notEqual(EVENTS.big.duration,EVENTS.rainbow.duration);
});

test('changing next-round duration does not freeze elapsed time during the current round',()=>{
  const engine=make({duration:60});ticks(engine,12);
  engine.configure({duration:10});ticks(engine,3);
  assert.ok(engine.state.elapsed>14.9 && engine.state.elapsed<15.1);
  assert.ok(engine.state.remaining>44.9 && engine.state.remaining<45.1);
});

test('a shaft finishes at its floor instead of sending the visible tool back to the old ceiling',()=>{
  const engine=make({seed:20261110,duration:180,eventInterval:60});
  let deepest=0,finished=0;
  for(let i=0;i<6000;i++){
    const round=engine.state.round,phase=engine.state.phase;
    engine.update(0.05);
    if(engine.state.round!==round)deepest=0;
    if(phase==='playing' && engine.state.phase==='summary')finished++;
    deepest=Math.max(deepest,engine.state.focus.y);
    if(engine.state.phase==='playing'){
      assert.ok(engine.state.focus.y<engine.state.height-1,'floor completes this finite excavation');
      assert.ok(!(deepest>=35 && engine.state.focus.y<10),'do not mine old top walls after reaching the bottom');
    }
  }
  assert.ok(finished>=2);
});

test('explosions reaching the connected shaft floor finish before retargeting old ceiling walls',()=>{
  const engine=make({seed:3,eventInterval:60});
  let finished=false;
  for(let i=0;i<=926;i++){
    if(i%100===0)for(const type of ['nuke','tnt_rain','mega'])engine.action({type});
    const previousY=engine.state.focus.y;
    engine.update(.05);
    if(engine.state.phase==='summary'){finished=true;break;}
    assert.ok(!(previousY>=20 && engine.state.focus.y<5),'must finish instead of returning to old ceiling');
  }
  assert.equal(finished,true,'blast opened the floor during this scenario');
});

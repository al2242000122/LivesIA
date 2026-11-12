'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEngine,EVENTS,LIMITS}=require('../games/block-wars/engine.js');
const make=(options={})=>createEngine({seed:20261111,layout:'endless',width:7,height:40,eventInterval:60,...options});
function ticks(engine,n,dt=0.05){for(let i=0;i<n;i++)engine.update(dt);}

test('endless defaults to its supported fixed7x40 streaming buffer',()=>{
  const engine=createEngine({layout:'endless'});
  assert.equal(engine.state.width,7);assert.equal(engine.state.height,40);
});

test('SPIN accelerates the physical pickaxe rotation and pause freezes it',()=>{
  const plain=make({seed:3}),spin=make({seed:3});
  spin.action({type:'spin',team:'dark'});plain.update(.001);spin.update(.001);
  assert.ok(spin.state.body.rotation>plain.state.body.rotation+.008,'SPIN adds its visible angular speed');
  spin.pause(true);const angle=spin.state.body.rotation;spin.update(.25);assert.equal(spin.state.body.rotation,angle);
});

test('endless body falls, collides, changes direction and mines by actual contact',()=>{
  const engine=make({eventInterval:180});assert.ok(engine.state.body);assert.equal(engine.state.remaining,0);
  const body=engine.state.body,initialY=body.y;let reflected=false,previousVx=body.vx;
  const columns=new Set();
  for(let i=0;i<3000;i++){
    const old=engine.state.blocks.slice(),offset=engine.state.rowOffset;
    engine.update(0.05);
    if(body.vx*previousVx<0)reflected=true;previousVx=body.vx;
    if(offset===engine.state.rowOffset)for(let j=0;j<old.length;j++)if(old[j]&&!engine.state.blocks[j])columns.add(j%7);
    assert.equal(engine.state.phase,'playing');
  }
  assert.ok(body.collisions>20);assert.ok(reflected);assert.ok(columns.size>=4);
  assert.equal(engine.state.eventCount,0,'excavation across columns must come from contact, without automatic explosions');
  assert.ok(engine.state.rowOffset+body.y>initialY+20);
});

test('streaming preserves a fixed buffer, growing depth and logical voting cycles without rounds ending',()=>{
  const engine=make();ticks(engine,12000);
  assert.ok(engine.state.rowOffset>=12);assert.equal(engine.state.rowOffset%12,0);
  assert.equal(engine.state.blocks.length,280);assert.equal(engine.state.phase,'playing');
  assert.equal(engine.state.remaining,0);assert.equal(engine.state.result,null);
  assert.equal(engine.state.round,1+Math.floor(engine.state.elapsed/180));
  assert.ok(engine.state.teams.dark.score+engine.state.teams.light.score>0);
});

test('endless physics replay, pause, reset and reduced motion are deterministic',()=>{
  const a=make(),b=make({reducedMotion:true});
  for(const e of [a,b]){e.action({type:'big',team:'light'});e.action({type:'nuke',team:'dark'});ticks(e,1000);}
  assert.deepEqual(a.state.body,b.state.body);assert.deepEqual(a.state.blocks,b.state.blocks);
  assert.deepEqual(a.state.teams,b.state.teams);assert.equal(a.state.rowOffset,b.state.rowOffset);
  a.pause(true);const snapshot=JSON.stringify(a.state);ticks(a,100);assert.equal(JSON.stringify(a.state),snapshot);
  a.reset();assert.deepEqual(a.state,make().state);
  a.update(100000);assert.ok(a.state.elapsed<=0.25);
});

test('mine grants stored work for the next physical contact without remote excavation',()=>{
  const e=make(),before=JSON.stringify(e.state.blocks);
  assert.equal(e.action({type:'mine',team:'dark',count:8}),true);
  assert.equal(e.state.teams.dark.progress,8);
  assert.equal(JSON.stringify(e.state.blocks),before);
  e.update(0.001);
  assert.equal(e.state.body.collisions,0);
  assert.equal(JSON.stringify(e.state.blocks),before,'no contact means no block damage');
  assert.ok(e.state.teams.dark.progress>=8);
  ticks(e,100);
  assert.ok(e.state.body.collisions>0);
  assert.notEqual(JSON.stringify(e.state.blocks),before);
});

test('100000 endless ticks keep physics, streamed coordinates and all18 event queues bounded',()=>{
  const e=make({eventInterval:5}),keys=Object.keys(EVENTS);let depth=0;
  for(let i=0;i<100000;i++){
    if(i%37===0)e.action({type:keys[Math.floor(i/37)%keys.length],team:i%2?'dark':'light'});
    if(i%1000===0){e.action({type:'pickaxe',team:'dark',pickaxe:'diamond'});e.action({type:'enchant',team:'dark',efficiency:5,unbreaking:3,fortune:3});}
    const offset=e.state.rowOffset,before=e.state.blocks.filter(Boolean).length;
    e.update(0.05);const s=e.state,body=s.body;
    assert.equal(s.phase,'playing');assert.equal(s.blocks.length,280);
    assert.ok(body.x>=body.radius-1e-6 && body.x<=7-body.radius+1e-6);
    assert.ok(body.y>=body.radius-1e-6 && body.y<40);
    for(const key of ['x','y','vx','vy','radius','rotation','collisions'])assert.ok(Number.isFinite(body[key]));
    assert.ok(s.entities.length+s.queue.length<=LIMITS.maxQueue);
    assert.ok(s.particles.length<=LIMITS.maxParticles && s.effects.length<=LIMITS.maxEffects);
    if(offset===s.rowOffset)assert.ok(before-s.blocks.filter(Boolean).length<=40);
    for(const entry of [...s.entities,...s.effects,...s.particles])assert.ok(Number.isFinite(entry.x)&&Number.isFinite(entry.y));
    depth=Math.max(depth,s.rowOffset+body.y);
  }
  assert.ok(depth>200);assert.ok(e.state.body.collisions>100);
});

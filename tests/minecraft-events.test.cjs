'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEngine}=require('../games/block-wars/engine.js');
const {EVENTS,SELECTED_EVENTS,LIMITS}=require('../games/block-wars/config.js');
function world(){
  const e=createEngine({seed:42,layout:'endless',eventInterval:180});
  for(let i=0;i<e.state.blocks.length;i++)e.state.blocks[i]=i<70?null:{material:'stone',hp:1.8,maxHp:1.8,value:2};
  return e;
}
function advance(e,seconds){for(let i=0;i<Math.ceil(seconds/.05);i++){e.state.body.x=3.5;e.state.body.y=1;e.state.body.vx=0;e.state.body.vy=0;e.update(.05);}}
const context={actor:'Ana',source:'simulator',actionId:'event-ana'};
test('fourteen selected commands retain every original effect and add storm and creeper',()=>{
  assert.equal(SELECTED_EVENTS.length,14);assert.equal(new Set(SELECTED_EVENTS).size,14);
  for(const id of SELECTED_EVENTS)assert.ok(EVENTS[id],id);
  assert.ok(EVENTS.rainbow&&EVENTS.butterfly&&EVENTS.black_hole&&EVENTS.jackpot&&EVENTS.demon&&EVENTS.tnt_rain);
});
test('TNT falls onto actual terrain and waits for its fuse; its destruction belongs to the accepted author',()=>{
  const e=world();assert.equal(e.action({type:'tnt',team:'dark'},context),true);
  assert.equal(e.state.entities[0].actor,'Ana');assert.equal(e.state.entities[0].actionId,'event-ana');
  advance(e,.6);assert.equal(e.state.actionResults[0].blocks,0,'no explosion in empty air');
  let grounded=false;
  for(let i=0;i<100;i++){advance(e,.05);grounded||=e.state.entities.some(v=>v.grounded);}
  assert.ok(grounded,'must touch a solid block');assert.ok(e.state.actionResults[0].blocks>0);
  assert.equal(e.state.actionResults[0].completed,true);
});
test('RAIN releases eight staggered TNT bodies and keeps one provenance through all impacts',()=>{
  const e=world();e.action({type:'rain',team:'light'},context);
  assert.equal(e.state.entities.length,8);assert.equal(new Set(e.state.entities.map(v=>v.delay)).size,8);
  assert.ok(e.state.entities.every(v=>v.actor==='Ana'&&v.kind==='rain'));
  advance(e,10);assert.ok(e.state.actionResults[0].blocks>0);assert.equal(e.state.actionResults[0].completed,true);
});
test('THUNDER and STORM create distinct bounded weather with terrain damage; clearing cancels weather and burning zones',()=>{
  for(const kind of ['thunder','storm']){
    const e=world();e.action({type:kind,team:'dark'},context);assert.equal(e.state.weather.kind,kind);
    advance(e,8);assert.ok(e.state.actionResults[0].blocks>0,kind);
    assert.equal(e.state.weather,null);assert.ok(e.state.entities.length+e.state.queue.length<=LIMITS.maxQueue);
    e.clearEffects();assert.equal(e.state.hazards.length,0);assert.equal(e.state.weather,null);
  }
});
test('STORM changes pick horizontal velocity without replacing collision physics',()=>{
  const a=world(),b=world();b.action({type:'storm',team:'dark'},context);
  a.update(.2);b.update(.2);assert.notEqual(a.state.body.vx,b.state.body.vx);
  assert.ok(b.state.body.x>=b.state.body.radius&&b.state.body.x<=7-b.state.body.radius);
});
test('METEOR damages a terrain path before its final blast and FIRE leaves a damaging timed area',()=>{
  const meteor=world();meteor.action({type:'meteor',team:'dark'},context);
  advance(meteor,1.6);assert.ok(meteor.state.actionResults[0].blocks>0);
  assert.ok(meteor.state.entities.some(v=>v.kind==='meteor'),'penetration precedes final impact');
  const fire=world();fire.action({type:'fire',team:'dark'},context);
  advance(fire,2);assert.ok(fire.state.hazards.length>0,'fire must continue after projectile impact');
  const count=fire.state.actionResults[0].blocks;advance(fire,3);
  assert.ok(fire.state.actionResults[0].blocks>count,'burning must destroy further terrain');
});
test('TSUNAMI sweeps sideways and pushes the physical pick rather than applying a stationary radial blast',()=>{
  const e=world(),control=world();
  for(const engine of [e,control])Object.assign(engine.state.body,{x:1,y:8.5,vx:2.8,vy:0});
  assert.equal(e.action({type:'tsunami',team:'dark'},context),true);
  const wave=e.state.entities[0],initial=wave.x;
  e.update(.05);control.update(.05);
  assert.equal(wave.stage,'wave');assert.notEqual(wave.x,initial);
  assert.ok(e.state.body.vx>control.state.body.vx,'a nearby wave increases horizontal velocity');
  assert.ok(e.state.body.x>control.state.body.x,'the push changes actual movement before any reset helper');
  advance(e,5);assert.ok(e.state.actionResults[0].blocks>0);
});
test('CREEPER waits for landing and NUKE has a three-second fuse before chain explosions',()=>{
  for(const kind of ['creeper','nuke']){
    const e=world();e.action({type:kind,team:'dark'},context);
    advance(e,1);assert.equal(e.state.actionResults[0].blocks,0);
    if(kind==='nuke')assert.ok(e.state.entities[0].fuse>=2.9);
    advance(e,8);assert.ok(e.state.actionResults[0].blocks>0,kind);
  }
});
test('FAST changes physical movement, BIG collision radius and SPIN rotation while pause freezes everything',()=>{
  const normal=world(),fast=world(),big=world(),spin=world();
  fast.action({type:'fast',team:'light'});big.action({type:'big',team:'light'});spin.action({type:'spin',team:'light'});
  for(const e of [normal,fast,big,spin])e.update(.05);
  assert.ok(Math.abs(fast.state.body.vx)>Math.abs(normal.state.body.vx));
  assert.ok(big.state.body.radius>normal.state.body.radius);
  assert.notEqual(spin.state.body.rotation,normal.state.body.rotation);
  fast.pause(true);const snapshot=JSON.stringify(fast.state);fast.update(.25);assert.equal(JSON.stringify(fast.state),snapshot);
});
test('ARROW launches an actual volley from a wall and MEGA has a larger footprint than normal TNT',()=>{
  const arrows=world();arrows.action({type:'arrow',team:'dark'},context);
  assert.ok(arrows.state.entities.length>=3);assert.ok(arrows.state.entities.every(v=>v.stage==='flight'));
  advance(arrows,6);assert.ok(arrows.state.actionResults[0].blocks>0);
  const tnt=world(),mega=world();tnt.action({type:'tnt',team:'dark'},context);mega.action({type:'mega',team:'dark'},context);
  assert.ok(mega.state.entities[0].size>tnt.state.entities[0].size);
  assert.ok(mega.state.entities[0].fuse>tnt.state.entities[0].fuse);
  advance(tnt,8);advance(mega,8);assert.ok(mega.state.actionResults[0].blocks>tnt.state.actionResults[0].blocks);
});
test('internal attribution is bounded, never accepted in action JSON, and does not affect seeded gameplay',()=>{
  const a=world(),b=world();
  assert.equal(a.action({type:'tnt',actor:'Ana'}),false);
  a.action({type:'tnt',team:'dark'},{actor:'A\u0000'.repeat(100),source:'forged',actionId:'<script>'});
  b.action({type:'tnt',team:'dark'});
  assert.ok(a.state.activeEvent.actor.length<=32);assert.equal(a.state.activeEvent.source,'automatic');
  advance(a,8);advance(b,8);assert.deepEqual(a.state.blocks,b.state.blocks);
  assert.deepEqual(a.state.body,b.state.body);
});
test('recycling the terrain keeps pending damage and attribution aligned, and emergency cancels all outstanding work',()=>{
  const e=createEngine({seed:42,layout:'endless',eventInterval:180});
  e.state.body.y=26;e.state.body.x=3.5;
  for(const team of Object.values(e.state.teams))team.target={x:3,y:27};
  const before=e.state.rowOffset;
  e.action({type:'rain',team:'dark'},context);e.update(.05);
  assert.equal(e.state.rowOffset,before+12);
  assert.ok(e.state.entities.every(v=>v.actionId===context.actionId&&Number.isFinite(v.targetY)));
  e.action({type:'storm',team:'light'},{...context,actionId:'storm-ana'});
  e.clearEffects();const blocks=JSON.stringify(e.state.blocks);
  e.pause(true);e.update(.25);
  assert.equal(JSON.stringify(e.state.blocks),blocks);assert.equal(e.state.entities.length,0);
  assert.equal(e.state.queue.length,0);assert.equal(e.state.weather,null);assert.equal(e.state.hazards.length,0);
  assert.ok(e.state.actionResults.every(v=>v.completed&&v.cancelled));
});
test('each selected destructive command remains deterministic with reduced motion and all state buffers stay bounded',()=>{
  for(const kind of SELECTED_EVENTS){
    const a=createEngine({seed:56,layout:'endless',eventInterval:180}),b=createEngine({seed:56,layout:'endless',eventInterval:180,reducedMotion:true});
    for(const e of [a,b])assert.equal(e.action({type:kind,team:'dark'},{...context,actionId:kind}),true,kind+' must actually execute');
    for(let tick=0;tick<200;tick++)for(const e of [a,b]){
      e.update(.05);assert.ok(e.state.actionResults.length<=64);assert.ok(e.state.hazards.length<=8);
      assert.ok(e.state.entities.length+e.state.queue.length<=LIMITS.maxQueue);
      assert.equal(e.state.blocks.length,280);
    }
    assert.deepEqual(a.state.blocks,b.state.blocks);assert.deepEqual(a.state.body,b.state.body);
    assert.deepEqual(a.state.actionResults,b.state.actionResults);
  }
});
test('flooded commands have explicit accepted or rejected outcomes without growing event storage',()=>{
  const e=world();let accepted=0,rejected=0;
  for(let i=0;i<500;i++){
    const kind=SELECTED_EVENTS[i%SELECTED_EVENTS.length],previous=e.state.lastEvent,id='flood-'+i;
    if(e.action({type:kind,team:'dark'},{...context,actionId:id})){
      accepted++;assert.equal(e.state.lastEvent.actionId,id);
    }else{rejected++;assert.equal(e.state.lastEvent,previous);}
    e.update(.05);
    assert.ok(e.state.actionResults.length<=64);assert.ok(e.state.hazards.length<=8);
    assert.ok(e.state.entities.length+e.state.queue.length<=LIMITS.maxQueue);
  }
  assert.ok(accepted>=14);assert.ok(rejected>0);
});
test('large falling charges use their complete visible footprint on a ledge and never spawn inside solid terrain',()=>{
  for(const kind of ['tnt','mega','nuke']){
    const e=world();assert.equal(e.action({type:kind,team:'dark'},context),true);
    const entity=e.state.entities[0];entity.vx=0;
    if(kind==='mega'){
      // A two-cell opening is narrower than a three-cell MEGA TNT.
      for(let x=0;x<7;x++)if(x!==3&&x!==4)e.state.blocks[8*7+x]={material:'stone',hp:1.8,maxHp:1.8,value:2};
    }
    let landed=false;
    for(let i=0;i<100&&!landed;i++){advance(e,.05);landed=entity.grounded;}
    assert.ok(landed,kind);
    const expectedFloor=kind==='mega'?8:10;
    assert.ok(entity.y+entity.size/2<=expectedFloor+1e-6,kind+' rendered bottom must not penetrate terrain');
  }
  const narrow=createEngine({layout:'endless',eventInterval:180});narrow.action({type:'mega',team:'dark'},context);
  const entity=narrow.state.entities[0],half=entity.size/2;
  for(let y=Math.max(0,Math.floor(entity.y-half));y<Math.min(40,Math.ceil(entity.y+half));y++){
    for(let x=Math.max(0,Math.floor(entity.x-half));x<Math.min(7,Math.ceil(entity.x+half));x++)assert.equal(narrow.state.blocks[y*7+x],null,'spawn footprint must be empty');
  }
});
test('physical impact effects and their damage footprint share the projectile center without a half-cell shift',()=>{
  const e=world();e.action({type:'tnt',team:'dark'},context);
  const entity=e.state.entities[0];entity.vx=0;
  for(let i=0;i<150&&e.state.entities.includes(entity);i++)advance(e,.05);
  const effect=e.state.effects.find(v=>v.actionId===context.actionId&&v.stage==='impact');
  assert.ok(effect);assert.ok(Math.abs(effect.x+.5-entity.x)<1e-8);
  assert.ok(Math.abs(effect.y+.5-entity.y)<1e-8);
  for(let row=0;row<40;row++)for(let col=0;col<7;col++){
    if(row>=10&&!e.state.blocks[row*7+col])assert.ok((col+.5-entity.x)**2+(row+.5-entity.y)**2<=EVENTS.tnt.radius**2,'damage is centered where the TNT exploded');
  }
});
test('endless periodic events use the fourteen selected effects while the legacy shaft retains its complete pool',()=>{
  const endless=createEngine({seed:39,layout:'endless',eventInterval:5});
  const seen=new Set();let sequence=0;
  for(let i=0;i<5000;i++){
    endless.update(.05);
    if(endless.state.eventCount>sequence){
      const kind=endless.state.lastEvent.kind;
      assert.ok(SELECTED_EVENTS.includes(kind),'every automatic endless action belongs to the selected fourteen');
      seen.add(kind);sequence=endless.state.eventCount;
    }
  }
  assert.ok(sequence>20);assert.ok(seen.size>=5);
  const shaft=createEngine({seed:39,layout:'shaft',eventInterval:5,duration:900});
  const shaftSeen=new Set();sequence=0;
  for(let i=0;i<4000;i++){
    shaft.update(.05);
    if(shaft.state.eventCount>sequence){shaftSeen.add(shaft.state.lastEvent.kind);sequence=shaft.state.eventCount;}
  }
  assert.ok([...shaftSeen].some(kind=>!SELECTED_EVENTS.includes(kind)&&kind!=='turbo'),'legacy pool still includes unselected catalog effects');
});
test('initial RAIN uses the visible air shaft for all eight TNT charges rather than spawning above solid sidewalls',()=>{
  const e=createEngine({seed:42,layout:'endless',eventInterval:180});
  assert.equal(e.action({type:'rain',team:'dark'},context),true);
  assert.equal(e.state.entities.length,8);
  for(const entity of e.state.entities){
    assert.ok(entity.y>=0,'each TNT starts visibly inside the world');
    assert.ok(entity.targetY>=8,'its fall is aimed at the mining front, not row-zero sidewalls');
    for(let row=Math.max(0,Math.floor(entity.y-entity.radius));row<Math.ceil(entity.y+entity.radius);row++){
      for(let col=Math.floor(entity.x-entity.radius+1e-6);col<Math.ceil(entity.x+entity.radius-1e-6);col++)assert.equal(e.state.blocks[row*7+col],null);
    }
  }
  let deepestImpact=0;
  for(let i=0;i<160;i++){
    e.update(.05);
    for(const effect of e.state.effects)if(effect.actionId===context.actionId&&effect.stage==='impact')deepestImpact=Math.max(deepestImpact,effect.y+.5+e.state.rowOffset);
  }
  assert.ok(deepestImpact>=7,'the visible rain reaches terrain near the mining front');
  assert.ok(e.state.actionResults.find(result=>result.actionId===context.actionId).blocks>0);
});

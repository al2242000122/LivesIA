'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createEngine,MINECRAFT_EFFECTS:MC,EVENTS,SELECTED_EVENTS,LIMITS}=require('../games/block-wars/engine.js');
const {createRules}=require('../games/block-wars/rules.js');
const make=()=>createEngine({seed:42,layout:'endless',eventInterval:180});
const context={actor:'Miner',source:'youtube',actionId:'ultra'};
function run(e,seconds,pin){for(let i=0;i<seconds*60;i++){if(pin)Object.assign(e.state.body,pin);e.update(1/60);}}

test('67 salvo spacing follows the configured interval and group pause',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),base=require('../games/block-wars/config.js');
  const altered={...base,MINECRAFT_EFFECTS:{...MC,sixty_seven:{...MC.sixty_seven,spawnInterval:.1,groupPause:.2}}};
  const sandbox={module:{exports:{}},require:name=>name==='./config.js'?altered:require('../games/block-wars/physics.js')};
  vm.runInNewContext(fs.readFileSync(require.resolve('../games/block-wars/engine.js'),'utf8'),sandbox);
  const e=sandbox.module.exports.createEngine({seed:42,layout:'endless',eventInterval:180});
  e.action({type:'sixty_seven'},context);
  for(const [i,entity]of e.state.entities.entries()){
    const expected=i<6?i*.1:6*.1+.2+(i-6)*.1;
    assert.ok(Math.abs(entity.delay-expected)<1e-10,'projectile '+i+' delay '+entity.delay+' vs '+expected);
  }
});

test('ULTRANUKE row recycling preserves visible free bodies after their old target scrolls away',()=>{
  for(const kind of ['messi','siuuu','rain']){
    const e=make();run(e,90);e.action({type:kind,team:'dark'},{...context,actionId:'dynamic-'+kind});
    const bodies=e.state.entities.filter(v=>v.actionId==='dynamic-'+kind);
    e.action({type:'nuke',team:'dark'},{...context,actionId:'wave',rewardVariant:'subscriber'});
    let staleVisible=0;
    for(let frame=0;frame<600;frame++){
      const before=new Set(e.state.entities);e.update(1/60);
      for(const body of bodies){
        if(!before.has(body))continue;
        const finishedJump=body.stage==='jump'&&body.jumps>=MC.siuuu.maxJumps;
        const alive=!finishedJump&&body.age<body.duration-1e-8&&body.y>=0&&body.y<e.state.height;
        if(alive&&body.targetY<0){
          staleVisible++;
          assert.ok(e.state.entities.includes(body),kind+' '+body.stage+' disappeared at '+body.age+'s despite visible y='+body.y);
        }
      }
    }
    assert.ok(staleVisible>0,kind+' must exercise a visible body whose old destination has scrolled away');
    if(kind==='siuuu')assert.equal(bodies.find(v=>v.stage==='jump').jumps,MC.siuuu.maxJumps);
  }
});

test('reward ULTRANUKE profiles differ in actual sprites, sizes and radii while ordinary chat NUKE stays standard',()=>{
  for(const [variant,sprite,size,radius,duration] of [['like','nuke_like',4.2,7.5,7],['subscriber','nuke_subscriber',5.2,11,9]]){
    const e=make();e.action({type:'nuke',count:variant==='like'?3:10,team:'dark'},{...context,rewardVariant:variant});
    assert.equal(e.state.entities.length,variant==='like'?3:10);
    assert.ok(e.state.entities.every(v=>v.rewardVariant===variant&&v.spriteId===sprite&&v.size===size&&v.blastRadius===radius&&v.radius<=.45));
    run(e,2,{x:3.5,y:1,vx:0,vy:0});
    const cloud=e.state.effects.find(v=>v.kind==='nuke'&&v.rewardVariant===variant);
    assert.ok(cloud);assert.equal(cloud.duration,duration);
  }
  const e=make();e.action({type:'nuke'},context);
  assert.ok(e.state.entities.every(v=>v.size===3.6&&v.blastRadius===5.5&&!v.rewardVariant));
  assert.equal(make().action({type:'nuke',rewardVariant:'subscriber'},context),false,'variant is never public action JSON');
  const invalid=make();invalid.action({type:'nuke'},{...context,rewardVariant:'forged'});
  assert.ok(invalid.state.entities.every(v=>!v.rewardVariant));
});

test('subscriber shockwaves destroy more seeded initial and deep terrain than like waves at equal charge counts',()=>{
  for(const deep of [false,true]){
    const destroyed=[];
    for(const rewardVariant of [null,'like','subscriber']){
      const e=make();if(deep)run(e,90);
      const pin={x:e.state.body.x,y:e.state.body.y,vx:0,vy:0};
      const seen=[];
      e.action({type:'nuke',count:3,team:'dark'},{...context,...(rewardVariant?{rewardVariant}:{})});
      for(let frame=0;frame<600;frame++){
        const before=e.state.blocks.filter(Boolean).length,offset=e.state.rowOffset;
        Object.assign(e.state.body,pin);e.update(1/60);
        if(offset===e.state.rowOffset)assert.ok(before-e.state.blocks.filter(Boolean).length<=LIMITS.maxBlockOps);
        for(const effect of e.state.effects)if(effect.actionId==='ultra'&&!seen.includes(effect))seen.push(effect);
        assert.ok(e.state.queue.length+e.state.entities.length<=LIMITS.maxQueue);
      }
      destroyed.push(e.state.actionResults.find(v=>v.actionId==='ultra').blocks);
      if(rewardVariant){
        assert.ok(seen.some(v=>v.shockwaveIndex>0),'a later real blast phase must be visible');
        assert.ok(seen.every(v=>v.rewardVariant===rewardVariant&&v.actor==='Miner'&&v.source==='youtube'));
      }
    }
    assert.ok(destroyed[1]>destroyed[0],JSON.stringify({deep,destroyed}));
    assert.ok(destroyed[2]>destroyed[1],JSON.stringify({deep,destroyed}));
  }
});

test('reward profile metadata survives pending FIFO with exact ten-charge subscriber payload',()=>{
  const e=make();for(let i=0;i<32;i++)e.action({type:'tnt',team:'dark'});
  e.action({type:'nuke',count:10,team:'light'},{...context,rewardVariant:'subscriber'});
  assert.equal(e.state.pendingActionCount,1);e.state.entities.length=0;e.update(.001);
  assert.equal(e.state.entities.length,10);
  assert.ok(e.state.entities.every(v=>v.rewardVariant==='subscriber'&&v.spriteId==='nuke_subscriber'&&v.actionId==='ultra'));
});

test('terrain recycling retains later ultra shockwaves when the current phase scrolls out of the buffer',()=>{
  const e=make();e.action({type:'nuke',count:1,team:'dark'},{...context,rewardVariant:'subscriber'});
  for(let frame=0;frame<180&&!e.state.queue.length;frame++){
    Object.assign(e.state.body,{x:3.5,y:1,vx:0,vy:0});e.update(1/60);
  }
  const blast=e.state.queue[0];assert.ok(blast);
  blast.indices=Array.from({length:80},(_,i)=>i);blast.cursor=0;blast.started=true;
  const originY=blast.waveOriginY;Object.assign(e.state.body,{x:3.5,y:26,vx:0,vy:0});e.update(.0001);
  assert.ok(e.state.queue.includes(blast),'later waves remain pending even when all current cells are discarded');
  assert.equal(blast.waveOriginY,originY-12);
  let laterWave=false;
  for(let frame=0;frame<180;frame++){
    Object.assign(e.state.body,{x:3.5,y:14,vx:0,vy:0});e.update(1/60);
    laterWave ||= e.state.effects.some(v=>v.rewardVariant==='subscriber'&&v.shockwaveIndex>0);
  }
  assert.ok(laterWave);
});

test('67, MESSI and SIUUU aliases dispatch distinct real physics with attributed terrain destruction',()=>{
  for(const [alias,kind] of [['67','sixty_seven'],['!67','sixty_seven'],['sixseven','sixty_seven'],['six seven','sixty_seven'],['sixty_seven','sixty_seven'],['MESSI','messi'],['SIUUU','siuuu'],['siuu','siuuu']]){
    const e=make(),rules=createRules(e);
    assert.equal(rules.handle({type:'comment',source:'youtube',receivedAt:0,id:alias,actor:{stableHash:'miner'},data:{text:alias}}),true,alias);
    assert.equal(e.state.lastEvent.kind,kind);
  }
  const salvo=make();salvo.action({type:'sixty_seven'},context);
  assert.equal(salvo.state.entities.length,13);
  assert.equal(salvo.state.entities.filter(v=>v.digit===6).length,6);assert.equal(salvo.state.entities.filter(v=>v.digit===7).length,7);
  const ball=make();ball.action({type:'messi'},context);const football=ball.state.entities[0];
  assert.equal(football.stage,'ricochet');run(ball,6);assert.ok(football.hits>1);
  const jump=make();jump.action({type:'siuuu'},context);
  assert.equal(jump.state.entities.filter(v=>v.stage==='jump').length,1);
  const jumper=jump.state.entities.find(v=>v.stage==='jump');
  assert.equal(jump.state.entities.filter(v=>v.stage==='pickaxe').length,5);
  run(salvo,8);run(jump,8);
  assert.ok(jumper.jumps>0,'the jumping actor actually lands, independently of its pickaxe fan');
  for(const e of [salvo,ball,jump])assert.ok(e.state.actionResults.find(v=>v.actionId==='ultra').blocks>0,e.state.lastEvent.kind);
  assert.equal(SELECTED_EVENTS.length,17);assert.equal(Object.keys(EVENTS).length,23);
  assert.ok(MC.ultranuke.subscriber.radius>MC.ultranuke.like.radius);
});

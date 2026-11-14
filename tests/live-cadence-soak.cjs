'use strict';
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {createEngine,LIMITS}=require('../games/block-wars/engine.js');
const {SELECTED_EVENTS}=require('../games/block-wars/config.js');
const {createRules}=require('../games/block-wars/rules.js');
const {createExperience}=require('../games/block-wars/experience.js');
const engine=createEngine({layout:'endless',seed:20261114,eventInterval:10});
const rules=createRules(engine);let notices=0,accepted=0,rejected=0;
const app=createExperience(engine,rules,{notify(e){assert.equal(e.source==='youtube'?e.narrate:false,false);notices++;},impact(){}},()=>{},{platform:'youtube'});
const peak={queue:0,entities:0,weather:0,particles:0,results:0};
const start=performance.now(),frames=30*60*60;
for(let i=0;i<frames;i++){
  if(i%30===0){
    const n=i/30,kind=SELECTED_EVENTS[n%SELECTED_EVENTS.length];
    const ok=app.handleEvent({type:'comment',source:'youtube',id:'soak-'+n,receivedAt:n*500,
      actor:{stableHash:'fixture-'+(n%4),displayName:'Minero de prueba'},data:{text:kind.toUpperCase()}});
    if(ok)accepted++;else rejected++;
  }
  app.update(1/60);const s=engine.state;
  assert.equal(s.blocks.length,280);assert.equal(s.phase,'playing');
  assert.ok(s.queue.length+s.entities.length<=LIMITS.maxQueue);
  assert.ok(s.weatherEvents.length<=LIMITS.maxWeather&&s.particles.length<=LIMITS.maxParticles&&s.effects.length<=LIMITS.maxEffects);
  assert.ok(s.actionResults.length<=64&&Number.isFinite(s.body.x)&&Number.isFinite(s.body.y));
  for(const [key,value]of Object.entries({queue:s.queue.length,entities:s.entities.length,weather:s.weatherEvents.length,particles:s.particles.length,results:s.actionResults.length}))peak[key]=Math.max(peak[key],value);
}
assert.ok(accepted>3000);assert.ok(engine.state.rowOffset>100);
console.log(JSON.stringify({virtualMinutes:30,stepHz:60,comments:frames/30,accepted,rejected,notices,depth:engine.state.rowOffset+engine.state.body.y,peak,wallSeconds:+((performance.now()-start)/1000).toFixed(2)},null,2));

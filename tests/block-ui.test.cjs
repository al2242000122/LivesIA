'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const engineModule=require('../games/block-wars/engine.js');
const rulesModule=require('../games/block-wars/rules.js');
const config=require('../games/block-wars/config.js');
const render=require('../games/block-wars/render.js');
const root=path.join(__dirname,'..');
function harness(){
  const nodes=new Map(),listeners={},requests=[];
  const context2d=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get(object,key){if(!(key in object))object[key]=()=>{};return object[key];}});
  function node(id){if(!nodes.has(id))nodes.set(id,{textContent:'',style:{},dataset:{},classList:{toggle(){}},getContext(){return context2d;},width:720,height:1280});return nodes.get(id);}
  let callbacks,frame,instance,updateCalls=0;
  const sandbox={console,BlockWarsEngine:{createEngine(options){instance=engineModule.createEngine(options);const update=instance.update;instance.update=dt=>{updateCalls++;update(dt);};return instance;}},BlockWarsRules:rulesModule,BlockWarsConfig:config,BlockWarsRender:render,
    LiveTransport:{connect(options){callbacks=options;return{stop(){}};}},document:{getElementById:node,addEventListener(type,listener){listeners[type]=listener;}},matchMedia(){return{matches:false};},performance:{now(){return 0;}},addEventListener(type,listener){listeners[type]=listener;},requestAnimationFrame(callback){frame=callback;},fetch(url,options){requests.push({url,options});return Promise.resolve({ok:true});}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'games/block-wars/app.js'),'utf8'),sandbox,{filename:'app.js'});
  return {nodes,requests,listeners,get engine(){return instance;},get updates(){return updateCalls;},get transport(){return callbacks;},tick(now){frame(now);}};
}
test('Block Wars app executes real engine/render, bounds suspended-frame catch-up and processes controls',()=>{
  const app=harness();app.tick(10);app.tick(100000);assert.equal(app.updates,5);
  assert.equal(app.engine.state.layout,'endless');assert.equal(app.engine.state.phase,'playing');
  assert.equal(app.nodes.get('clock').textContent,'00:00','counts active session time instead of counting down to a finish');
  app.transport.onControl({type:'bw_settings',target:'block-wars',settings:{duration:90,eventInterval:30,likeThreshold:50,reducedMotion:true}});
  assert.equal(app.engine.state.config.duration,90);assert.equal(app.engine.state.config.reducedMotion,true);
  app.transport.onControl({type:'bw_action',target:'block-wars',action:'pickaxe',team:'dark',pickaxe:'gold'});assert.equal(app.engine.state.teams.dark.pickaxe,'gold');
  app.transport.onControl({type:'bw_emergency',target:'block-wars'});assert.equal(app.engine.state.paused,true);assert.equal(app.engine.state.queue.length,0);
  app.transport.onControl({type:'bw_pause',target:'block-wars',paused:false});assert.equal(app.engine.state.paused,false);
  app.transport.onControl({type:'bw_reset',target:'block-wars',seed:24});assert.equal(app.engine.state.teams.dark.score,0);
});
test('Block Wars app identifies simulator/relay separately and never claims verified LIVE',()=>{
  const app=harness();
  app.transport.onEvent({type:'like',source:'simulator',id:'s1',receivedAt:1,data:{delta:20}});
  app.transport.onEvent({type:'like',source:'tikfinity',id:'t1',receivedAt:2,data:{delta:10}});
  app.transport.onStatus({relay:'connected',verified:false});app.tick(6000);
  assert.match(app.nodes.get('source').textContent,/DEMO \+ RELAY/);
  assert.match(app.nodes.get('relay').textContent,/NO VERIFICADO/);
  const telemetry=JSON.parse(app.requests.find(request=>request.url==='/api/block-wars/telemetry').options.body);
  assert.equal(telemetry.source,'mixed');assert.equal(telemetry.fps>=0,true);assert.equal(telemetry.mode,'endless');
  assert.deepEqual(Object.keys(telemetry).sort(),['fps','frameMs','particles','paused','queue','reducedMotion','remaining','round','source','mode','depth','elapsed'].sort());
});
test('Block Wars renderer handles mined, damaged, paused, summary and destructive effects',()=>{
  const canvas={width:720,height:1280,getContext(){return new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get(object,key){return object[key]||(object[key]=()=>{});}});}};
  const renderer=render.createRenderer(canvas),engine=engineModule.createEngine({seed:14});
  for(const type of ['tnt','meteor','nuke','descomunal'])engine.action({type,team:'dark'});
  engine.update(.1);renderer.draw(engine.state,{time:1});engine.pause(true);renderer.draw(engine.state,{time:1,reducedMotion:true});
  engine.state.phase='summary';engine.state.result='tie';engine.pause(false);renderer.draw(engine.state,{time:2});
  assert.equal(engine.state.particles.length<=config.LIMITS.maxParticles,true);
});

test('operator emergency cancels the deferred community backlog before resuming',()=>{
  const app=harness();
  app.transport.onEvent({type:'like',source:'simulator',id:'burst',receivedAt:1,data:{delta:1000000}});
  app.transport.onControl({type:'bw_emergency',target:'block-wars'});
  app.transport.onControl({type:'bw_pause',target:'block-wars',paused:false});
  app.tick(10);app.tick(100);
  assert.equal(app.engine.state.queue.length,0);
});

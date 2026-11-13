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
const experience=require('../games/block-wars/experience.js');
const root=path.join(__dirname,'..');
const gameIds=new Set([...fs.readFileSync(path.join(root,'games/block-wars/index.html'),'utf8').matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
function harness(platform='local'){
  const nodes=new Map(),listeners={},requests=[];
  const context2d=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get(object,key){if(!(key in object))object[key]=()=>{};return object[key];}});
  function node(id){if(!gameIds.has(id))throw new Error('Missing game markup ID: '+id);if(!nodes.has(id))nodes.set(id,{textContent:'',style:{},dataset:{},classList:{toggle(){}},addEventListener(){},getContext(){return context2d;},width:720,height:1280});return nodes.get(id);}
  let callbacks,frame,instance,updateCalls=0;
  const sandbox={console,location:{search:platform==='youtube'?'?platform=youtube':''},URLSearchParams,BlockWarsEngine:{createEngine(options){instance=engineModule.createEngine(options);const update=instance.update;instance.update=dt=>{updateCalls++;update(dt);};return instance;}},BlockWarsRules:rulesModule,BlockWarsConfig:config,BlockWarsRender:render,
    BlockWarsExperience:experience,BlockWarsAudio:{createAudio(){return{enable(){},mute(){},pause(){},notify(){},setVolume(){},setNarration(){},stop(){}};}},
    LiveTransport:{connect(options){callbacks=options;return{stop(){}};}},document:{getElementById:node,addEventListener(type,listener){listeners[type]=listener;}},matchMedia(){return{matches:false};},performance:{now(){return 0;}},addEventListener(type,listener){listeners[type]=listener;},requestAnimationFrame(callback){frame=callback;},fetch(url,options){requests.push({url,options});return Promise.resolve({ok:true,json:async()=>({enabled:false})});}};
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
test('YouTube scene blocks TikFinity events and labels all interaction as local rehearsal',()=>{
  const app=harness('youtube');
  assert.equal(app.transport.relayEnabled,false);
  app.transport.onEvent({type:'like',source:'tikfinity',id:'yt-no-tikfinity',receivedAt:1,data:{delta:25}});
  assert.equal(app.engine.state.entities.length,0);
  app.transport.onEvent({type:'like',source:'simulator',id:'yt-simulator',receivedAt:2,data:{delta:25}});
  assert.ok(app.engine.state.entities.length>0);app.tick(6000);
  assert.match(app.nodes.get('source').textContent,/YOUTUBE.*ENSAYO/);
  assert.match(app.nodes.get('relay').textContent,/CHAT.*SIN CONECTAR/);
  assert.match(app.nodes.get('like-progress').textContent,/NO CONTROLAN/);
});

test('comment activation names the correct author and a rejected command is never labelled activated',()=>{
  const app=harness();
  const event={type:'comment',source:'simulator',id:'rain-ana',receivedAt:100,actor:{stableHash:'ana',displayName:'Ana'},data:{text:'!rain'}};
  app.transport.onEvent(event);app.tick(10);app.tick(200);
  assert.match(app.nodes.get('activation-title').textContent,/RAIN|LLUVIA/);
  assert.match(app.nodes.get('activation-actor').textContent,/Ana/);
  assert.match(app.nodes.get('activation-source').textContent,/PRUEBA/);
  app.transport.onEvent({...event,id:'rain-beto',receivedAt:101,actor:{stableHash:'beto',displayName:'Beto'}});
  app.tick(400);
  assert.match(app.nodes.get('command-feedback').textContent,/enfriamiento|espera|ocupad/i);
  assert.doesNotMatch(app.nodes.get('activation-actor').textContent,/Beto/);
  app.transport.onControl({type:'bw_emergency',target:'block-wars'});app.tick(600);
  assert.equal(app.nodes.get('activation-card').hidden,true);
});

test('the public menu promotes exactly the selected14 while keeping compatibility effects in the operator panel',()=>{
  const html=fs.readFileSync(path.join(root,'games/block-wars/index.html'),'utf8');
  const menu=html.match(/<ol id="command-list">([\s\S]*?)<\/ol>/)[1];
  const ids=[...menu.matchAll(/id="menu-([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(ids,['tnt','rain','thunder','storm','creeper','meteor','fire','tsunami','spin','fast','mega','nuke','arrow','big']);
  assert.ok(html.indexOf('/block-wars/effects-render.js')<html.indexOf('/block-wars/render.js'));
});

test('the server and shared event adapter retain the fictitious comment author displayed in the game',()=>{
  const {validateCommand}=require('../lib/contracts.js');
  const {createAdapter}=require('../integrations/events.js');
  const wire=validateCommand({type:'chat',target:'block-wars',text:'RAIN',actor:'Minera Ana'});
  const event=createAdapter({now:()=>100,salt:'fixture'}).normalize(wire,'simulator');
  const app=harness();app.transport.onEvent(event);app.tick(10);app.tick(200);
  assert.equal(app.nodes.get('activation-actor').textContent,'Minera Ana');
});

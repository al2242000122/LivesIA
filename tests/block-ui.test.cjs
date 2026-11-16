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
  const nodes=new Map(),listeners={},requests=[],sounds=[],mixes=[];
  const context2d=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get(object,key){if(!(key in object))object[key]=()=>{};return object[key];}});
  function node(id){if(!gameIds.has(id))throw new Error('Missing game markup ID: '+id);if(!nodes.has(id))nodes.set(id,{textContent:'',style:{},dataset:{},classList:{toggle(){}},addEventListener(){},querySelector(){return{getAnimations(){return[{cancel(){},play(){alertRestarts++;}}];}};},getContext(){return context2d;},width:720,height:1280});return nodes.get(id);}
  let callbacks,frame,instance,audioStatus,updateCalls=0,cancelledRewardVoices=0,alertRestarts=0;
  const sandbox={console,location:{search:platform==='youtube'?'?platform=youtube':''},URLSearchParams,BlockWarsEngine:{createEngine(options){instance=engineModule.createEngine(options);const update=instance.update;instance.update=dt=>{updateCalls++;update(dt);};return instance;}},BlockWarsRules:rulesModule,BlockWarsConfig:config,BlockWarsRender:render,
    BlockWarsExperience:experience,BlockWarsAudio:{createAudio(options){audioStatus=options.onStatus;return{enable(){},mute(){},pause(){},notify(event){sounds.push(event);},setVolume(){},setMix(value){mixes.push(value);},setNarration(){},cancelYouTubeRewards(){cancelledRewardVoices++;},stop(){}};}},
    LiveTransport:{connect(options){callbacks=options;return{stop(){}};}},document:{getElementById:node,addEventListener(type,listener){listeners[type]=listener;}},matchMedia(){return{matches:false};},performance:{now(){return 0;}},addEventListener(type,listener){listeners[type]=listener;},requestAnimationFrame(callback){frame=callback;},fetch(url,options){requests.push({url,options});return Promise.resolve({ok:true,json:async()=>({enabled:false})});}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'games/block-wars/app.js'),'utf8'),sandbox,{filename:'app.js'});
  return {nodes,requests,listeners,sounds,mixes,audioStatus,get engine(){return instance;},get updates(){return updateCalls;},get alertRestarts(){return alertRestarts;},get cancelledRewardVoices(){return cancelledRewardVoices;},get transport(){return callbacks;},tick(now){frame(now);}};
}

test('mining HUD replaces team slogans with actual mineral counts and maximum depth',()=>{
  const html=fs.readFileSync(path.join(root,'games/block-wars/index.html'),'utf8');
  assert.doesNotMatch(html,/DARK <i>VS|interaction-trigger|interaction-chat-label/);
  assert.match(html,/data-mineral-icon="item_diamond"/);
  const app=harness('youtube');
  app.engine.pause(true);app.engine.state.materialCounts={diamond:12,crystal:3,coal:7,gold:4};
  app.engine.state.teams.dark.score=999999;app.engine.state.body.y=15.9;
  app.tick(10);app.tick(200);
  assert.equal(app.nodes.get('mineral-diamond').textContent,'15');
  assert.equal(app.nodes.get('mineral-coal').textContent,'7');
  assert.equal(app.nodes.get('depth-value').textContent,'15 m');
  app.engine.state.body.y=10;app.tick(400);
  assert.equal(app.nodes.get('depth-value').textContent,'15 m','bounces do not reduce reached depth');
});

test('operator audio mixes pass only typed mixer fields, independently of mute and narration',()=>{
  const app=harness();
  app.transport.onControl({type:'bw_audio',target:'block-wars',settings:{volume:.65,muted:false,narration:false,musicVolume:.25,fxVolume:.85,voiceVolume:.9,musicEnabled:true}});
  assert.deepEqual(JSON.parse(JSON.stringify(app.mixes)),[{musicVolume:.25,fxVolume:.85,voiceVolume:.9,musicEnabled:true}]);
});

test('operator initial audio fields match the actual playback defaults',()=>{
  const html=fs.readFileSync(path.join(root,'games/block-wars/control.html'),'utf8');
  const state=require('../games/block-wars/audio.js').createAudio().state;
  for(const [id,key]of [['audio-volume','volume'],['music-volume','musicVolume'],['fx-volume','fxVolume'],['voice-volume','voiceVolume']]){
    const input=html.match(new RegExp('<input id="'+id+'"[^>]+>'))[0];
    assert.equal(Number(input.match(/value="([^"]+)"/)[1]),100*state[key],id);
  }
});
test('Block Wars app executes real engine/render, bounds suspended-frame catch-up and processes controls',()=>{
  const app=harness();app.tick(10);app.tick(100000);assert.ok(app.updates<=15&&app.updates>=12);
  assert.equal(app.engine.state.layout,'endless');assert.equal(app.engine.state.phase,'playing');
  assert.equal(app.nodes.get('clock').textContent,'00:00','counts active session time instead of counting down to a finish');
  app.transport.onControl({type:'bw_settings',target:'block-wars',settings:{duration:90,eventInterval:30,likeThreshold:50,reducedMotion:true}});
  assert.equal(app.engine.state.config.duration,90);assert.equal(app.engine.state.config.reducedMotion,true);
  app.transport.onControl({type:'bw_action',target:'block-wars',action:'pickaxe',team:'dark',pickaxe:'gold'});assert.equal(app.engine.state.teams.dark.pickaxe,'gold');
  app.transport.onControl({type:'bw_emergency',target:'block-wars'});assert.equal(app.engine.state.paused,true);assert.equal(app.engine.state.queue.length,0);
  app.transport.onControl({type:'bw_pause',target:'block-wars',paused:false});assert.equal(app.engine.state.paused,false);
  app.transport.onControl({type:'bw_reset',target:'block-wars',seed:24});assert.equal(app.engine.state.teams.dark.score,0);
});

test('normal browser frames advance the physical game every frame at60Hz instead of20Hz',()=>{
  const app=harness();app.tick(10);
  for(let i=1;i<=60;i++)app.tick(10+i*1000/60);
  assert.ok(app.updates>=59&&app.updates<=60,String(app.updates));
  assert.ok(app.engine.state.elapsed>.98&&app.engine.state.elapsed<=1.001);
});
test('Block Wars app identifies simulator/relay separately and never claims verified LIVE',()=>{
  const app=harness();
  app.transport.onEvent({type:'like',source:'simulator',id:'s1',receivedAt:1,data:{delta:20}});
  app.transport.onEvent({type:'like',source:'tikfinity',id:'t1',receivedAt:2,data:{delta:10}});
  app.transport.onStatus({relay:'connected',verified:false});app.tick(6000);
  assert.match(app.nodes.get('source').textContent,/DEMO \+ RELAY/);
  assert.match(app.nodes.get('relay').textContent,/UNVERIFIED/);
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
test('YouTube scene blocks TikFinity while preserving simulator rewards and truthful chat status',()=>{
  const app=harness('youtube');
  assert.equal(app.transport.relayEnabled,false);
  app.transport.onEvent({type:'like',source:'tikfinity',id:'yt-no-tikfinity',receivedAt:1,data:{delta:25}});
  assert.equal(app.engine.state.entities.length,0);
  app.transport.onEvent({type:'like',source:'simulator',id:'yt-simulator',receivedAt:2,data:{delta:25}});
  assert.ok(app.engine.state.entities.length>0);app.tick(6000);
  assert.match(app.nodes.get('source').textContent,/YOUTUBE.*WAITING FOR COMMENTS/);
  assert.match(app.nodes.get('relay').textContent,/SYNCING CHAT/);
  assert.equal(app.nodes.has('like-progress'),false,'removed slogan has no hidden test-only node');
  assert.equal(app.sounds[0].speechKind,'like_milestone');
  const command=harness('youtube');
  command.transport.onEvent({type:'comment',source:'simulator',id:'yt-rain',receivedAt:3,actor:{stableHash:'miner',displayName:'Minero demo'},data:{text:'RAIN'}});
  assert.equal(command.sounds[0].kind,'rain');assert.equal(command.sounds[0].narrate,false);
  const subscriber=harness('youtube');
  subscriber.transport.onEvent({type:'follow',source:'simulator',id:'yt-sub',receivedAt:4,actor:{stableHash:'sub',displayName:'Sub demo'},data:{}});
  subscriber.tick(200);
  assert.equal(subscriber.sounds[0].speechKind,'youtube_subscriber');
  assert.equal(subscriber.nodes.get('activation-title').textContent,'TEST SUBSCRIBER');
});

test('comment activation names the correct author and a rejected command is never labelled activated',()=>{
  const app=harness();
  const event={type:'comment',source:'simulator',id:'rain-ana',receivedAt:100,actor:{stableHash:'ana',displayName:'Ana'},data:{text:'!rain'}};
  app.transport.onEvent(event);app.tick(10);app.tick(200);
  assert.match(app.nodes.get('activation-title').textContent,/PICKAXE RAIN/);
  assert.match(app.nodes.get('activation-actor').textContent,/Ana/);
  assert.match(app.nodes.get('activation-source').textContent,/TEST/);
  app.transport.onControl({type:'bw_pause',target:'block-wars',paused:true});
  app.transport.onEvent({...event,id:'rain-beto',receivedAt:101,actor:{stableHash:'beto',displayName:'Beto'}});
  app.tick(400);
  assert.match(app.nodes.get('command-feedback').textContent,/paused/i);
  assert.doesNotMatch(app.nodes.get('activation-actor').textContent,/Beto/);
  app.transport.onControl({type:'bw_emergency',target:'block-wars'});app.tick(600);
  assert.equal(app.nodes.get('activation-card').hidden,true);
});

test('the public menu promotes all seventeen selected commands while keeping compatibility effects in the operator panel',()=>{
  const html=fs.readFileSync(path.join(root,'games/block-wars/index.html'),'utf8');
  const menu=html.match(/<ol id="command-list">([\s\S]*?)<\/ol>/)[1];
  const ids=[...menu.matchAll(/id="menu-([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(ids,['tnt','rain','thunder','storm','creeper','meteor','fire','tsunami','spin','fast','mega','nuke','arrow','big','sixty_seven','messi','siuuu']);
  assert.ok(html.indexOf('/block-wars/effects-render.js')<html.indexOf('/block-wars/render.js'));
});
test('NOOB = BAN is a decorative joke without a button, command or moderation handler',()=>{
 const html=fs.readFileSync(path.join(root,'games/block-wars/index.html'),'utf8'),script=fs.readFileSync(path.join(root,'games/block-wars/app.js'),'utf8');
 assert.match(html,/<span class="bw-joke"[^>]*>NOOB = BAN<\/span>/);assert.doesNotMatch(html,/<button[^>]*>NOOB/);assert.doesNotMatch(script,/bw-joke|NOOB|\bban\b/i);
});

test('the server and shared event adapter retain the fictitious comment author displayed in the game',()=>{
  const {validateCommand}=require('../lib/contracts.js');
  const {createAdapter}=require('../integrations/events.js');
  const wire=validateCommand({type:'chat',target:'block-wars',text:'RAIN',actor:'Minera Ana'});
  const event=createAdapter({now:()=>100,salt:'fixture'}).normalize(wire,'simulator');
  const app=harness();app.transport.onEvent(event);app.tick(10);app.tick(200);
  assert.equal(app.nodes.get('activation-actor').textContent,'Minera Ana');
});

test('YouTube activation UI preserves author/source and clears connected status on reconnect',()=>{
  const app=harness('youtube');assert.equal(app.transport.youtubeEnabled,true);
  app.transport.onYouTubeState({state:'connected'});app.tick(200);
  assert.match(app.nodes.get('relay').textContent,/CHAT TRANSPORT CONNECTED/);
  app.transport.onEvent({type:'comment',source:'youtube',id:'yt:'+'a'.repeat(32),receivedAt:1,actor:{stableHash:'b'.repeat(32),displayName:'Ana'},data:{text:'THUNDER'}});app.tick(400);
  assert.equal(app.nodes.get('activation-source').textContent,'');assert.equal(app.nodes.get('activation-source').hidden,true);assert.equal(app.nodes.get('activation-actor').textContent,'Ana');assert.equal(app.sounds[0].narrate,false);
  assert.doesNotMatch(app.nodes.get('event-banner').textContent,/YOUTUBE CHAT|YOUTUBE REWARD/);assert.match(app.nodes.get('event-banner').textContent,/Ana/);
  app.transport.onYouTubeState({state:'reconnecting'});app.tick(600);assert.match(app.nodes.get('relay').textContent,/DISCONNECTED/);
});

test('YouTube reward callout reflects reader state and public subscriber privacy without changing local mode',()=>{
  const app=harness('youtube');
  assert.equal(app.nodes.get('youtube-rewards').hidden,false);
  assert.match(app.nodes.get('reward-status').textContent,/PENDING/);
  const html=fs.readFileSync(path.join(root,'games/block-wars/index.html'),'utf8');
  assert.match(html,/LIKE <em>=<\/em> <b>ULTRANUKE ×3/);assert.match(html,/SUB <em>=<\/em> <b>ULTRANUKE ×10/);
  assert.match(html,/Public subscriptions only.*Delays possible/);
  app.transport.onYouTubeState({state:'connected',rewards:{state:'active'}});app.tick(200);
  assert.match(app.nodes.get('reward-status').textContent,/ACTIVE/);
  app.transport.onYouTubeState({state:'reconnecting'});app.tick(400);
  assert.match(app.nodes.get('reward-status').textContent,/PENDING/);
  assert.equal(harness().nodes.get('youtube-rewards').hidden,true);
});

test('app routes public subscriber reward attribution and pause cancels reward backlog immediately',()=>{
  const app=harness('youtube'),reward=(n,type='like')=>({type,source:'youtube',id:'ytr:'+n.toString(16).padStart(32,'0'),receivedAt:Date.now(),actor:{displayName:type==='subscriber'?'Ana':'',stableHash:'a'.repeat(32)},data:type==='like'?{delta:1}:{}});
  app.transport.onEvent(reward(1,'subscriber'));app.tick(200);
  assert.equal(app.sounds[0].kind,'nuke');assert.equal(app.nodes.get('activation-source').textContent,'');
  assert.equal(app.nodes.get('activation-actor').textContent,'Ana');assert.match(app.nodes.get('source').textContent,/EVENTS RECEIVED/);
  app.transport.onEvent(reward(2));app.transport.onControl({type:'bw_pause',target:'block-wars',paused:true});
  app.transport.onControl({type:'bw_pause',target:'block-wars',paused:false});app.tick(400);app.tick(650);
  assert.equal(app.sounds.length,1);
});
test('OBS view removes the title and boxed diagnostics but keeps actual control IDs and truthful reward actions',()=>{
  const html=fs.readFileSync(path.join(root,'games/block-wars/index.html'),'utf8'),css=fs.readFileSync(path.join(root,'games/block-wars/style.css'),'utf8');
  assert.doesNotMatch(html,/<h1>INFINITE MINE|Type a command from the menu|Wait For|30 Seconds/i);
  const callout=html.match(/<aside id="youtube-rewards"[\s\S]*?<\/aside>/)[0];
  assert.match(callout,/LIKE/);assert.match(callout,/NUKE ×3/);assert.match(callout,/SUB/);assert.match(callout,/NUKE ×10/);
  assert.match(callout,/id="reward-status"[^>]*class="bw-sr-only"/);
  assert.match(html,/<footer class="bw-footer" hidden/);assert.match(html,/<div[^>]*id="tool-readout"[^>]*hidden/);
  assert.match(html,/id="audio-status"[^>]*class="bw-sr-only"/);
  assert.match(css,/\.bw-rewards\{[^}]*background:transparent/);
  assert.match(css,/\.bw-rewards\{[^}]*border:0/);
  const app=harness('youtube');app.audioStatus({enabled:false});assert.equal(app.nodes.get('audio-gate').hidden,false);
  app.audioStatus({enabled:true});assert.equal(app.nodes.get('audio-gate').hidden,true,'activated sound has no permanent operator box on screen');
});

test('YouTube stop, baseline change and missing reward state cancel queued actions while healthy chat reconnect retains them',()=>{
  const reward=n=>({type:'like',source:'youtube',id:'ytr:'+n.toString(16).padStart(32,'0'),receivedAt:Date.now(),actor:{displayName:'',stableHash:'a'.repeat(32)},data:{delta:1}});
  for(const status of [{state:'stopped'},{state:'ended'},{state:'idle'},{state:'unconfigured'},{state:'synchronizing'},{state:'error'},{state:'quota_exhausted'},{state:'reconnecting'},{state:'connected',rewards:{state:'synchronizing'}}]){
    const app=harness('youtube');app.transport.onEvent(reward(1));app.transport.onEvent(reward(2));
    app.transport.onYouTubeState(status);app.tick(10);app.tick(260);app.tick(510);
    assert.equal(app.cancelledRewardVoices,1,'reader cancellation reaches typed audio cancellation');
    assert.equal(app.sounds.length,1,JSON.stringify(status));assert.equal(app.engine.state.entities.filter(e=>e.actionId===reward(1).id).length,3,'accepted NUKE charges continue');
  }
  const app=harness('youtube');app.transport.onEvent(reward(1));app.transport.onEvent(reward(2));
  app.transport.onYouTubeState({state:'reconnecting',rewards:{state:'active'}});app.tick(10);app.tick(260);
  assert.equal(app.cancelledRewardVoices,0);
  assert.equal(app.sounds.length,2,'normal chat stream rotation does not cancel healthy rewards');
});
test('Minecraft public subscriber alert uses moderated text and a stable six-second deadline without HUD animation restarts',()=>{
  const app=harness('youtube'),reward={type:'subscriber',source:'youtube',id:'ytr:'+'f'.repeat(32),receivedAt:Date.now(),actor:{displayName:'Ana 🌻 López!',stableHash:'a'.repeat(32)},data:{}};
  app.transport.onEvent(reward);app.tick(200);
  assert.equal(app.nodes.get('subscriber-alert').hidden,false);assert.equal(app.nodes.get('subscriber-name').textContent,'Ana López');
  const html=fs.readFileSync(path.join(root,'games/block-wars/index.html'),'utf8'),css=fs.readFileSync(path.join(root,'games/block-wars/style.css'),'utf8');
  assert.match(html,/NEW SUBSCRIBER/);assert.match(html,/ULTRANUKE ×10/);assert.match(html,/data-reward-icon="nuke_subscriber"/);
  assert.match(css,/@keyframes bw-subscriber/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)[\s\S]*bw-subscriber/);
  const demo=harness('youtube');demo.transport.onEvent({...reward,source:'simulator',type:'follow',id:'demo-sub'});demo.tick(200);
  assert.equal(demo.nodes.get('subscriber-alert').hidden,true,'simulated follow cannot display a real subscriber alert');
  const comment=harness('youtube');comment.transport.onEvent({...reward,type:'comment',id:'yt:'+'f'.repeat(32),data:{text:'NUKE'}});comment.tick(200);
  assert.equal(comment.nodes.get('subscriber-alert').hidden,true,'a NUKE comment cannot impersonate a subscriber reward');
  const firstId=app.nodes.get('subscriber-alert').dataset.actionId;
  app.tick(400);app.tick(600);assert.equal(app.nodes.get('subscriber-alert').dataset.actionId,firstId);assert.equal(app.alertRestarts,1,'HUD updates do not restart the sprite animation');
  app.transport.onControl({target:'block-wars',type:'bw_settings',settings:{reducedMotion:true}});app.tick(800);
  assert.equal(app.nodes.get('subscriber-alert').dataset.reducedMotion,'true');
  app.transport.onControl({target:'block-wars',type:'bw_pause',paused:true});app.tick(1000);assert.equal(app.nodes.get('subscriber-alert').hidden,true);
});
test('event timer uses short English captions while the active banner retains event attribution',()=>{
  const app=harness();assert.equal(app.nodes.get('timer-caption').textContent,'NEXT EVENT');
  app.transport.onEvent({type:'comment',source:'simulator',id:'caption-ana',receivedAt:1,actor:{displayName:'Ana',stableHash:'ana'},data:{text:'NUKE'}});app.tick(200);
  assert.equal(app.nodes.get('timer-caption').textContent,'EVENT ACTIVE');assert.match(app.nodes.get('event-banner').textContent,/Ana/);
});

test('queued commands show a receipt without a fake activation or sound',()=>{
  const app=harness('youtube');
  for(let i=0;i<96;i++)app.engine.state.entities.push({kind:'tnt'});
  app.transport.onEvent({type:'comment',source:'youtube',id:'queue-visible',receivedAt:1,actor:{displayName:'Ana',stableHash:'ana'},data:{text:'NUKE'}});
  app.tick(200);
  assert.equal(app.nodes.get('command-feedback').hidden,false);
  assert.match(app.nodes.get('command-feedback').textContent,/Ana.*queued/);
  assert.equal(app.nodes.get('activation-card').hidden,true);assert.equal(app.sounds.length,0);
});

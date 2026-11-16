(function () {
  'use strict';
  const element = id => document.getElementById(id);
  const youtube=typeof location==='object'&&new URLSearchParams(location.search).get('platform')==='youtube';
  if(youtube){
    element('command-heading').textContent='FREE COMMANDS';
    element('command-instruction').textContent='LEVEL 1–4 · RAIN: 12 PICKS / 10s';
    element('notice').textContent='YouTube · Waiting for chat status';
  }
  const engine=BlockWarsEngine.createEngine({seed:20261110,layout:'endless',width:7,height:40,duration:180,eventInterval:60,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  const rules=BlockWarsRules.createRules(engine,{likeThreshold:25});
  const renderer=BlockWarsRender.createRenderer(element('mine'));
  let voiceAvailable=false,narrationRequested=true;
  const audio=BlockWarsAudio.createAudio({narrationEnabled:false,onStatus(status){
    element('audio-enable').hidden=Boolean(status.enabled);
    element('audio-gate').hidden=Boolean(status.enabled);
    const music=status.musicStatus==='playing'?' · MUSIC LOOPING':status.musicStatus==='unavailable'?' · MUSIC UNAVAILABLE':'';
    element('audio-status').textContent=(status.muted||status.volume===0?'AUDIO MUTED':!status.enabled?'AUDIO: ENABLE IN OBS → INTERACT':
      status.fxAssetStatus==='unavailable'?'LOCAL MINECRAFT SOUNDS MISSING':
      status.paused?'AUDIO PAUSED':status.lastStatus==='voice_error'||status.lastStatus==='voice_timeout'?'SOUNDS ACTIVE · VOICE UNAVAILABLE':
      voiceAvailable&&narrationRequested?(youtube?'MINECRAFT + LIKE/SUB VOICE':'MINECRAFT + VOICE CONFIGURED · TEST FIRST'):'MINECRAFT SOUNDS')+music;
  }});
  const experience=BlockWarsExperience.createExperience(engine,rules,audio,text=>{element('notice').textContent=text;},{platform:youtube?'youtube':'local'});
  element('audio-enable').addEventListener('click',()=>audio.enable());
  async function speechHealth(){
    try{const response=await fetch('/api/block-wars/speech/status',{cache:'no-store'});voiceAvailable=response.ok&&Boolean((await response.json()).enabled);}
    catch{voiceAvailable=false;}
    audio.setNarration(voiceAvailable&&narrationRequested);
  }
  speechHealth();
  let maximumDepth=0;
  let reducedMotion=Boolean(engine.state.config && engine.state.config.reducedMotion);
  let relay='offline',last=0,accumulator=0,hudAt=0,fpsAt=0,frames=0,fps=0,frameMs=0,telemetryAt=0,stopped=false;
  const sources=new Set();
  const totals={simulator:0,tikfinity:0,youtube:0};
  let youtubeStatus='synchronizing';
  let rewardStatus='synchronizing',youtubeEvents=0;
  element('youtube-rewards').hidden=!youtube;
  const youtubeLabels={unconfigured:'CHAT NOT CONFIGURED',idle:'NO CHAT SELECTED',waiting_live:'WAITING FOR STREAM',synchronizing:'SYNCING CHAT',connected:'CHAT TRANSPORT CONNECTED',reconnecting:'CHAT DISCONNECTED · RECONNECTING',ended:'STREAM ENDED',error:'CHAT UNAVAILABLE',quota_exhausted:'QUOTA EXHAUSTED',stopped:'CHAT STOPPED'};
  const toolNames={wood:'WOOD',stone:'STONE',gold:'GOLD',diamond:'DIAMOND',netherite:'NETHERITE'};
  function control(command){
    if(!command||command.target!=='block-wars')return;
    sources.add('simulator');
    element('notice').textContent='OPERATOR TEST · '+command.type+' · Check the result.';
    switch(command.type){
      case 'bw_action':
        {const action={type:command.action,team:command.team};for(const key of ['count','pickaxe','efficiency','unbreaking','fortune'])if(Object.prototype.hasOwnProperty.call(command,key))action[key]=command[key];
          if(!experience.action(action))element('notice').textContent='TEST · Action rejected: mine paused, unavailable or at capacity.';}break;
      case 'bw_audio':
        if(typeof command.settings?.muted==='boolean')audio.mute(command.settings.muted);
        if(typeof command.settings?.volume==='number')audio.setVolume(command.settings.volume);
        if(typeof command.settings?.narration==='boolean'){narrationRequested=command.settings.narration;speechHealth();}
        if(command.settings){const mix={};for(const key of ['musicEnabled','musicVolume','fxVolume','voiceVolume'])if(Object.hasOwn(command.settings,key))mix[key]=command.settings[key];if(Object.keys(mix).length)audio.setMix?.(mix);}
        break;
      case 'bw_settings':
        if(!command.settings)return;
        {const settings={};for(const key of ['duration','eventInterval','reducedMotion'])if(Object.prototype.hasOwnProperty.call(command.settings,key))settings[key]=command.settings[key];engine.configure(settings);}
        if(Object.prototype.hasOwnProperty.call(command.settings,'likeThreshold'))rules.configure({likeThreshold:command.settings.likeThreshold});
        if(typeof command.settings.reducedMotion==='boolean')reducedMotion=command.settings.reducedMotion;
        break;
      case 'bw_pause': engine.pause(typeof command.paused==='boolean'?command.paused:!engine.state.paused);experience.pause(engine.state.paused);audio.pause(engine.state.paused);break;
      case 'bw_reset':maximumDepth=0;audio.pause(true);engine.reset(command.seed);rules.reset();experience.reset();presentInteraction();audio.pause(false);break;
      case 'bw_emergency':audio.pause(true);engine.clearEffects();rules.clearPending();experience.clear();presentInteraction();engine.pause(true);element('notice').textContent='EMERGENCY · Mine paused; audio, effects and pending charges cancelled.';break;
    }
  }
  const transport=LiveTransport.connect({target:'block-wars',relayEnabled:!youtube,youtubeEnabled:youtube,onYouTubeState(status){
    youtubeStatus=status.state;rewardStatus=status.rewards?.state||'synchronizing';
    if(['idle','unconfigured','synchronizing','stopped','ended','error','quota_exhausted'].includes(status.state)||rewardStatus!=='active')experience.cancelRewards();
  },onEvent(event){
    if(youtube&&!['simulator','youtube'].includes(event.source))return;
    if(event.source in totals){totals[event.source]++;sources.add(event.source);}if(event.source==='youtube')youtubeEvents++;experience.handleEvent(event);
  },onControl:control,onStatus(status){relay=status.relay||'offline';}});
  function originLabel(source){return source==='simulator'?'TEST':source==='tikfinity'?'UNVERIFIED RELAY':'';}
  function presentInteraction(){
    const activation=experience.state.lastActivation,feedback=experience.state.lastFeedback;
    const subscriber=experience.state.subscriberAlert,alert=element('subscriber-alert');
    if(subscriber&&alert.dataset.actionId!==subscriber.id){
      alert.dataset.actionId=subscriber.id;
      element('subscriber-name').textContent=subscriber.actorName;
      const sprite=alert.querySelector?.('.bw-subscriber-sprite');
      // Restart only for a genuinely new accepted subscription, never a HUD tick.
      sprite?.getAnimations?.().forEach(animation=>{animation.cancel();animation.play();});
    }
    alert.hidden=!subscriber;
    alert.dataset.reducedMotion=String(reducedMotion);
    element('activation-card').hidden=!activation;
    if(activation){
      const source=element('activation-source');source.textContent=originLabel(activation.source);source.hidden=!source.textContent;
      element('activation-title').textContent=activation.rewardVariant?'ULTRANUKE':youtube&&activation.kind==='follow'?'TEST SUBSCRIBER':BlockWarsConfig.EVENTS[activation.kind]?.label||'BOOST';
      element('activation-actor').textContent=activation.source==='automatic'?'THE MINE':activation.actorName||'THE COMMUNITY';
    }
    const showFeedback=feedback&&(!feedback.accepted||feedback.reason==='queued');
    element('command-feedback').hidden=!showFeedback;
    if(showFeedback)element('command-feedback').textContent=feedback.message;
  }
  function updateHud(){
    const state=engine.state,active=state.activeEvent;
    const depth=Math.floor((state.rowOffset||0)+(state.body?.y||0));
    maximumDepth=Math.max(maximumDepth,depth);
    element('depth-value').textContent=maximumDepth+' m';
    const minerals=state.materialCounts||{};
    for(const material of ['coal','iron','copper','gold','redstone','lapis','diamond','emerald']){
      const count=(minerals[material]||0)+(material==='diamond'?(minerals.crystal||0):0);
      element('mineral-'+material).textContent=count.toLocaleString('en-US');
    }
    const elapsed=Math.floor(state.elapsed||0);
    element('clock').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');
    const team=state.teams[state.focus?.team||'dark'];
    element('tool-readout').textContent='PICKAXE '+toolNames[team.pickaxe]+(team.efficiency?' · E'+team.efficiency:'')+' · POWER '+team.effectiveSpeed.toFixed(1);
    element('source').textContent=youtube?(youtubeEvents?'YOUTUBE · EVENTS RECEIVED':'YOUTUBE · WAITING FOR COMMENTS'):sources.has('tikfinity')?(sources.has('simulator')?'DEMO + RELAY':'RELAY · UNVERIFIED'):'DEMO · AUTONOMOUS';
    element('relay').textContent=youtube?youtubeLabels[youtubeStatus]:relay==='connected'?'RELAY OPEN · UNVERIFIED':relay==='connecting'?'CONNECTING RELAY · LIVE UNVERIFIED':'RELAY DISCONNECTED · LIVE UNVERIFIED';
    const rewardActive=['connected','reconnecting'].includes(youtubeStatus)&&rewardStatus==='active'&&!state.paused;
    element('youtube-rewards').dataset.active=String(rewardActive);
    element('reward-status').textContent=state.paused?'REWARDS PAUSED':rewardActive?'REWARDS ACTIVE':
      ['error','quota_exhausted','stopped'].includes(rewardStatus)?'REWARDS UNAVAILABLE':'REWARDS PENDING';
    const descriptor=active&&BlockWarsConfig.EVENTS[active.kind];
    const label=active?.rewardVariant?'ULTRANUKE':descriptor?.label||({descomunal:'COLOSSAL'})[active?.kind]||active?.kind||'';
    element('timer-caption').textContent=active?'EVENT ACTIVE':'NEXT EVENT';
    const remainingLabel=active?(active.remaining>0?active.remaining.toFixed(1)+'s':'IN PROGRESS'):state.nextEventIn.toFixed(1)+'s';
    element('next-event').textContent=state.paused?'PAUSED':remainingLabel;
    element('timer-card').classList.toggle('is-active',Boolean(active));
    element('time-fill').style.width=Math.max(0,Math.min(100,100*(active?active.remaining/active.duration:state.nextEventIn/state.config.eventInterval)))+'%';
    const banner=element('event-banner');banner.hidden=!active;
    if(active){
      const actor=active.source==='automatic'?'THE MINE':active.actor||'THE COMMUNITY';
      banner.textContent=[originLabel(active.source),label,actor,remainingLabel].filter(Boolean).join(' · ');banner.style.borderColor=descriptor?.color||'#ff4444';
    }
    for(const kind of BlockWarsConfig.SELECTED_EVENTS)element('menu-'+kind).classList.toggle('is-active',active?.kind===kind||(kind==='rain'&&active?.kind==='tnt_rain'));
    for(const kind of BlockWarsConfig.SELECTED_EVENTS)element('menu-'+kind).dataset.rank=String(BlockWarsConfig.COMMAND_RANKS?.[kind]||1);
    presentInteraction();
  }
  function paintIcons(){
    for(const icon of document.querySelectorAll?.('canvas[data-reward-icon]')||[]){
      const painter=icon.getContext('2d'),original=globalThis.BlockWarsTextures?.source('sprite',icon.dataset.rewardIcon);
      painter.imageSmoothingEnabled=false;painter.clearRect(0,0,16,16);
      if(original)painter.drawImage(original,0,0,16,16,0,0,16,16);
      else{painter.fillStyle=icon.dataset.rewardIcon==='nuke_like'?'#e6c034':'#42714b';painter.fillRect(2,2,12,12);painter.fillStyle='#152019';painter.font='bold 11px monospace';painter.fillText('?',5,12);icon.title='Fallback texture';}
    }
    for(const icon of document.querySelectorAll?.('canvas[data-icon]')||[]){
      const textures=globalThis.BlockWarsTextures;if(!textures)continue;
      const painter=icon.getContext('2d'),original=textures.source('tnt',icon.dataset.icon);
      painter.imageSmoothingEnabled=false;
      if(original){painter.clearRect(0,0,16,16);painter.drawImage(original,0,0,16,16,0,0,16,16);continue;}
      const pixels=painter.createImageData(16,16);pixels.data.set(textures.tnt(icon.dataset.icon).pixels);painter.putImageData(pixels,0,0);
    }
    const commandArt={tnt:'tnt',rain:'diamond_pickaxe',thunder:'diamond',storm:'rain',creeper:'creeper',meteor:'magma',fire:'fire',tsunami:'water',
      spin:'diamond_pickaxe',fast:'gold_pickaxe',mega:'tnt',nuke:'tnt',arrow:'arrow',big:'netherite_pickaxe'};
    for(const icon of document.querySelectorAll?.('canvas[data-command-icon]')||[]){
      if(['sixty_seven','messi','siuuu'].includes(icon.dataset.commandIcon)){
        const painter=icon.getContext('2d');painter.clearRect(0,0,16,16);painter.imageSmoothingEnabled=false;
        if(icon.dataset.commandIcon==='sixty_seven'){painter.fillStyle='#ffe248';painter.font='bold 12px monospace';painter.fillText('67',0,13);}
        else if(icon.dataset.commandIcon==='messi'){for(let row=0;row<8;row++)for(let col=0;col<8;col++){if((row===0||row===7)&&(col<2||col>5))continue;painter.fillStyle=(row+col)%5===0?'#1a2920':'#eef2e8';painter.fillRect(col*2,row*2,2,2);}}
        else{painter.fillStyle='#e1bb88';painter.fillRect(6,1,4,4);painter.fillStyle='#f2f4e7';painter.fillRect(4,5,8,7);painter.fillRect(0,4,16,3);painter.fillStyle='#315a67';painter.fillRect(3,12,4,4);painter.fillRect(9,12,4,4);}
        continue;
      }
      const name=commandArt[icon.dataset.commandIcon],image=globalThis.BlockWarsTextures?.source('sprite',name);
      if(!image)continue;
      const painter=icon.getContext('2d');painter.imageSmoothingEnabled=false;painter.clearRect(0,0,16,16);
      // The creeper icon is its face UV, never the full flattened skin.
      if(name==='creeper')painter.drawImage(image,8,8,8,8,0,0,16,16);
      else painter.drawImage(image,0,0,16,16,0,0,16,16);
    }
  }
  function paintMinerals(){
    for(const icon of document.querySelectorAll?.('canvas[data-mineral-icon]')||[]){
      const image=globalThis.BlockWarsTextures?.source('sprite',icon.dataset.mineralIcon);if(!image)continue;
      const painter=icon.getContext('2d');painter.imageSmoothingEnabled=false;painter.clearRect(0,0,16,16);painter.drawImage(image,0,0,16,16,0,0,16,16);
    }
  }
  paintIcons();paintMinerals();
  globalThis.BlockWarsTextures?.loadOriginals().then(result=>{
    element('asset-status').textContent=result.ok?(result.complete?'MINECRAFT TEXTURES · '+result.version:'BASE MINECRAFT TEXTURES · EFFECT OR ORE ASSETS MISSING'):'FALLBACK TEXTURES · IMPORT LOCAL ASSETS';
    paintIcons();paintMinerals();
  });
  function telemetry(){
    const state=engine.state;
    fetch('/api/block-wars/telemetry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fps,frameMs:Math.round(frameMs*100)/100,round:state.round,remaining:Math.max(0,state.remaining),queue:state.queue.length,particles:state.particles.length,source:sources.size>1?'mixed':sources.values().next().value||'none',paused:state.paused,reducedMotion,mode:state.layout,depth:Math.min(1000000000,Math.floor((state.rowOffset||0)+(state.body?.y||0))),elapsed:state.elapsed||0})}).then(response=>{if(!response.ok)element('notice').textContent='Local telemetry unavailable · Game continues.';}).catch(()=>{element('notice').textContent='Local telemetry disconnected · Game continues.';});
  }
  function frame(now){
    if(stopped)return;
    const elapsed=last?Math.max(0,Math.min(.25,(now-last)/1000)):0;last=now;accumulator+=elapsed;
    const step=1/60,maxSteps=15;
    let steps=0;while(accumulator+1e-9>=step&&steps<maxSteps){experience.update(step);accumulator=Math.max(0,accumulator-step);steps++;}if(steps===maxSteps)accumulator=0;
    renderer.draw(engine.state,{time:now/1000,reducedMotion});frames++;
    if(now-fpsAt>=1000){fps=Math.round(frames*1000/(now-fpsAt));frameMs=frames?(now-fpsAt)/frames:0;fpsAt=now;frames=0;}
    if(now-hudAt>=150){updateHud();hudAt=now;}
    if(now-telemetryAt>=5000){telemetry();telemetryAt=now;}
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;fpsAt=performance.now();frames=0;});
  addEventListener('pagehide',()=>{stopped=true;transport.stop();audio.stop();},{once:true});
  updateHud();requestAnimationFrame(frame);
})();

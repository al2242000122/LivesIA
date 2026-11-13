(function () {
  'use strict';
  const element = id => document.getElementById(id);
  const youtube=typeof location==='object'&&new URLSearchParams(location.search).get('platform')==='youtube';
  if(youtube){
    element('interaction-trigger').textContent='ENSAYO';
    element('interaction-chat-label').textContent='CHAT';
    element('interaction-events-label').textContent='PENDIENTE';
    element('command-heading').textContent='EFECTOS DEMO';
    element('command-instruction').textContent='ACTIVADOS POR EL OPERADOR';
    element('notice').textContent='YouTube · Ensayo local · Chat real todavía sin conectar';
  }
  const engine=BlockWarsEngine.createEngine({seed:20261110,layout:'endless',width:7,height:40,duration:180,eventInterval:60,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  const rules=BlockWarsRules.createRules(engine,{likeThreshold:25});
  const renderer=BlockWarsRender.createRenderer(element('mine'));
  let voiceAvailable=false,narrationRequested=true;
  const audio=BlockWarsAudio.createAudio({narrationEnabled:false,onStatus(status){
    element('audio-enable').hidden=Boolean(status.enabled);
    element('audio-status').textContent=status.muted||status.volume===0?'AUDIO SILENCIADO':!status.enabled?'AUDIO: ACTIVAR EN OBS → INTERACTUAR':
      status.paused?'AUDIO EN PAUSA':status.lastStatus==='voice_error'||status.lastStatus==='voice_timeout'?'SONIDOS ACTIVOS · VOZ NO DISPONIBLE':
      voiceAvailable&&narrationRequested?'SONIDOS + VOZ CONFIGURADA · ENSAYAR':'SONIDOS ACTIVOS · VOZ PENDIENTE';
  }});
  const experience=BlockWarsExperience.createExperience(engine,rules,audio,text=>{element('notice').textContent=text;});
  element('audio-enable').addEventListener('click',()=>audio.enable());
  async function speechHealth(){
    try{const response=await fetch('/api/block-wars/speech/status',{cache:'no-store'});voiceAvailable=response.ok&&Boolean((await response.json()).enabled);}
    catch{voiceAvailable=false;}
    audio.setNarration(voiceAvailable&&narrationRequested);
  }
  speechHealth();
  let reducedMotion=Boolean(engine.state.config && engine.state.config.reducedMotion);
  let relay='offline',last=0,accumulator=0,hudAt=0,fpsAt=0,frames=0,fps=0,frameMs=0,telemetryAt=0,stopped=false;
  const sources=new Set();
  const totals={simulator:0,tikfinity:0};
  const toolNames={wood:'MADERA',stone:'PIEDRA',gold:'ORO',diamond:'DIAMANTE',netherite:'NETHERITA'};
  function control(command){
    if(!command||command.target!=='block-wars')return;
    sources.add('simulator');
    element('notice').textContent='PRUEBA DE OPERADOR · '+command.type+' · Verifica el resultado y los enfriamientos.';
    switch(command.type){
      case 'bw_action':
        {const action={type:command.action,team:command.team};for(const key of ['count','pickaxe','efficiency','unbreaking','fortune'])if(Object.prototype.hasOwnProperty.call(command,key))action[key]=command[key];
          if(!experience.action(action))element('notice').textContent='PRUEBA · Acción rechazada: pausa, resumen, cola o enfriamiento activo.';}break;
      case 'bw_audio':
        if(typeof command.settings?.muted==='boolean')audio.mute(command.settings.muted);
        if(typeof command.settings?.volume==='number')audio.setVolume(command.settings.volume);
        if(typeof command.settings?.narration==='boolean'){narrationRequested=command.settings.narration;speechHealth();}
        break;
      case 'bw_settings':
        if(!command.settings)return;
        {const settings={};for(const key of ['duration','eventInterval','reducedMotion'])if(Object.prototype.hasOwnProperty.call(command.settings,key))settings[key]=command.settings[key];engine.configure(settings);}
        if(Object.prototype.hasOwnProperty.call(command.settings,'likeThreshold'))rules.configure({likeThreshold:command.settings.likeThreshold});
        if(typeof command.settings.reducedMotion==='boolean')reducedMotion=command.settings.reducedMotion;
        break;
      case 'bw_pause': engine.pause(typeof command.paused==='boolean'?command.paused:!engine.state.paused);audio.pause(engine.state.paused);break;
      case 'bw_reset':audio.pause(true);engine.reset(command.seed);rules.reset();experience.reset();presentInteraction();audio.pause(false);break;
      case 'bw_emergency':audio.pause(true);engine.clearEffects();rules.clearPending();experience.clear();presentInteraction();engine.pause(true);element('notice').textContent='EMERGENCIA · Mina pausada, audio, efectos y cargas pendientes cancelados.';break;
    }
  }
  const transport=LiveTransport.connect({target:'block-wars',relayEnabled:!youtube,onEvent(event){
    if(youtube&&event.source!=='simulator')return;
    if(event.source in totals){totals[event.source]++;sources.add(event.source);}experience.handleEvent(event);
  },onControl:control,onStatus(status){relay=status.relay||'offline';}});
  function originLabel(source){return source==='simulator'?'PRUEBA':source==='tikfinity'?'RELAY SIN VERIFICAR':'EVENTO DE LA MINA';}
  function presentInteraction(){
    const activation=experience.state.lastActivation,feedback=experience.state.lastFeedback;
    element('activation-card').hidden=!activation;
    if(activation){
      element('activation-source').textContent=originLabel(activation.source);
      element('activation-title').textContent=BlockWarsConfig.EVENTS[activation.kind]?.label||'REFUERZO';
      element('activation-actor').textContent=activation.source==='automatic'?'LA MINA':activation.actorName||'LA COMUNIDAD';
    }
    element('command-feedback').hidden=!feedback||feedback.accepted;
    if(feedback&&!feedback.accepted)element('command-feedback').textContent=feedback.message;
  }
  function updateHud(){
    const state=engine.state,active=state.activeEvent;
    const depth=Math.floor((state.rowOffset||0)+(state.body?.y||0));
    element('round').textContent=String(depth).padStart(4,'0');
    const elapsed=Math.floor(state.elapsed||0);
    element('clock').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');
    element('scoreline').textContent='◆ DARK '+state.teams.dark.score+' · ✦ LIGHT '+state.teams.light.score;
    const team=state.teams[state.focus?.team||'dark'];
    element('tool-readout').textContent='PICO '+toolNames[team.pickaxe]+(team.efficiency?' · E'+team.efficiency:'')+' · FUERZA '+team.effectiveSpeed.toFixed(1);
    const threshold=rules.state.likeThreshold,progress=rules.state.likeProgressBySource;
    element('like-progress').textContent=youtube?'LOS LIKES DE YOUTUBE NO CONTROLAN LA MINA':threshold+' likes por TNT · DEMO '+progress.simulator+' / RELAY '+progress.tikfinity;
    element('source').textContent=youtube?'YOUTUBE · ENSAYO LOCAL':sources.has('tikfinity')?(sources.has('simulator')?'DEMO + RELAY':'RELAY · SIN VERIFICAR'):'DEMO · AUTÓNOMO';
    element('relay').textContent=youtube?'CHAT YOUTUBE SIN CONECTAR · EFECTOS DE PRUEBA':relay==='connected'?'RELAY ABIERTO · NO VERIFICADO':relay==='connecting'?'CONECTANDO RELAY · LIVE SIN VERIFICAR':'RELAY DESCONECTADO · LIVE SIN VERIFICAR';
    const descriptor=active&&BlockWarsConfig.EVENTS[active.kind];
    const label=descriptor?.label||active?.kind||'';
    element('timer-caption').textContent=active?'EVENTO: '+label:'PRÓXIMO EVENTO GRATIS';
    const remainingLabel=active?(active.remaining>0?active.remaining.toFixed(1)+'s':'EN CURSO'):state.nextEventIn.toFixed(1)+'s';
    element('next-event').textContent=state.paused?'PAUSA':remainingLabel;
    element('timer-card').classList.toggle('is-active',Boolean(active));
    element('time-fill').style.width=Math.max(0,Math.min(100,100*(active?active.remaining/active.duration:state.nextEventIn/state.config.eventInterval)))+'%';
    const banner=element('event-banner');banner.hidden=!active;
    if(active){
      const actor=active.source==='automatic'?'LA MINA':active.actor||'LA COMUNIDAD';
      banner.textContent=originLabel(active.source)+' · '+label+' · '+actor+' · '+remainingLabel;banner.style.borderColor=descriptor?.color||'#ff4444';
    }
    for(const kind of BlockWarsConfig.SELECTED_EVENTS)element('menu-'+kind).classList.toggle('is-active',active?.kind===kind||(kind==='rain'&&active?.kind==='tnt_rain'));
    presentInteraction();
  }
  function paintIcons(){
    for(const icon of document.querySelectorAll?.('canvas[data-icon]')||[]){
      const textures=globalThis.BlockWarsTextures;if(!textures)continue;
      const painter=icon.getContext('2d'),original=textures.source('tnt',icon.dataset.icon);
      painter.imageSmoothingEnabled=false;
      if(original){painter.clearRect(0,0,16,16);painter.drawImage(original,0,0,16,16,0,0,16,16);continue;}
      const pixels=painter.createImageData(16,16);pixels.data.set(textures.tnt(icon.dataset.icon).pixels);painter.putImageData(pixels,0,0);
    }
  }
  paintIcons();
  globalThis.BlockWarsTextures?.loadOriginals().then(result=>{
    element('asset-status').textContent=result.ok?(result.complete?'TEXTURAS MINECRAFT · '+result.version:'TEXTURAS MINECRAFT BASE · FALTAN TEXTURAS DE EFECTOS'):'TEXTURAS DE RESPALDO · IMPORTAR RECURSOS LOCALES';
    paintIcons();
  });
  function telemetry(){
    const state=engine.state;
    fetch('/api/block-wars/telemetry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fps,frameMs:Math.round(frameMs*100)/100,round:state.round,remaining:Math.max(0,state.remaining),queue:state.queue.length,particles:state.particles.length,source:sources.size>1?'mixed':sources.values().next().value||'none',paused:state.paused,reducedMotion,mode:state.layout,depth:Math.min(1000000000,Math.floor((state.rowOffset||0)+(state.body?.y||0))),elapsed:state.elapsed||0})}).then(response=>{if(!response.ok)element('notice').textContent='Señal local no disponible · El juego continúa.';}).catch(()=>{element('notice').textContent='Señal local desconectada · El juego continúa.';});
  }
  function frame(now){
    if(stopped)return;
    const elapsed=last?Math.max(0,Math.min(.25,(now-last)/1000)):0;last=now;accumulator+=elapsed;
    let steps=0;while(accumulator>=.05&&steps<5){experience.update(.05);accumulator-=.05;steps++;}if(steps===5)accumulator=0;
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

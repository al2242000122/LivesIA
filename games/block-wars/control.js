(function () {
  'use strict';
  const element=id=>document.getElementById(id);
  const youtube=typeof location==='object'&&new URLSearchParams(location.search).get('platform')==='youtube';
  if(youtube){
    element('youtube-setup').hidden=false;
    document.querySelector('a[href="/block-wars"]').href='/block-wars?platform=youtube';
    element('follow-demo').textContent='+ Suscriptor gratuito · PRUEBA';
    element('voice-policy').textContent+=' En YouTube la voz sólo ensaya metas de likes y nuevos suscriptores gratuitos. Los comandos y eventos automáticos conservan sonidos y efectos, sin narración. Ningún botón confirma actividad real de YouTube.';
  }
  const youtubeLabels={unconfigured:'Sin configurar',idle:'Sin transmisión seleccionada',waiting_live:'Esperando transmisión',synchronizing:'Sincronizando',connected:'Transporte de chat conectado',reconnecting:'Reconectando',ended:'Transmisión terminada',error:'Chat no disponible',quota_exhausted:'Cuota agotada',stopped:'Chat detenido'};
  const youtubeRequests=new Set();
  async function youtubeRequest(path,body){
    const controller=typeof AbortController==='function'?new AbortController():null;
    if(controller)youtubeRequests.add(controller);
    const timeout=controller?setTimeout(()=>controller.abort(),8000):null;
    try{
      const options=body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
      if(controller)options.signal=controller.signal;
      const response=await fetch('/api/youtube/'+path,options);
      if(!response.ok)throw new Error('YouTube local no disponible');return await response.json();
    }finally{if(timeout!==null)clearTimeout(timeout);if(controller)youtubeRequests.delete(controller);}
  }
  async function youtubeStatus(){
    if(!youtube||disposed)return;
    try{const status=await youtubeRequest('status');if(!disposed)element('youtube-status').textContent=(youtubeLabels[status.state]||'Estado no disponible')+' · Espectadores: no disponible · Likes y suscriptores reales: no disponibles.';}
    catch{if(!disposed)element('youtube-status').textContent='Chat desconectado o sin configurar. Espectadores: no disponible.';}
  }
  if(youtube){
    element('youtube-refresh').addEventListener('click',async()=>{
      const button=element('youtube-refresh');button.disabled=true;
      try{const result=await youtubeRequest('broadcasts');if(disposed)return;
        const select=element('youtube-video');select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Selecciona explícitamente una transmisión';select.append(placeholder);
        if(!Array.isArray(result.broadcasts))throw new Error('invalid');
        for(const item of result.broadcasts.slice(0,50)){if(!item||!/^[A-Za-z0-9_-]{11}$/.test(item.id)||typeof item.title!=='string')continue;const option=document.createElement('option');option.value=item.id;option.textContent=item.title.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').slice(0,140);select.append(option);}select.value='';
      }catch{message('No se pudieron consultar tus transmisiones. Revisa la configuración local.',true);}finally{button.disabled=false;}
    });
    element('youtube-select-form').addEventListener('submit',async event=>{event.preventDefault();const videoId=element('youtube-video').value;if(!/^[A-Za-z0-9_-]{11}$/.test(videoId)){message('Selecciona una transmisión propia.',true);return;}try{await youtubeRequest('select',{videoId});await youtubeStatus();}catch{message('No se pudo seleccionar la transmisión propia.',true);}});
    element('youtube-stop').addEventListener('click',async()=>{try{await youtubeRequest('stop',{});await youtubeStatus();}catch{message('No se pudo detener el chat local.',true);}});
  }
  const feedback=element('feedback');
  let pollTimer,disposed=false;
  function message(text,error){feedback.textContent=text;feedback.dataset.error=String(Boolean(error));}
  async function send(command){
    try{
      const response=await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:'block-wars',...command})});
      if(!response.ok){message('Comando rechazado por el servidor ('+response.status+'). Revisa los límites y la conexión local.',true);return false;}
      const result=await response.json();
      if(!result.receivers){message('Sin arena conectada. Abre /block-wars antes de enviar acciones.',true);return false;}
      message('Enviado a '+result.receivers+' arena(s) · '+(command.action||command.type)+' · SIMULADOR. Verifica el efecto y los enfriamientos.');return true;
    }catch(error){message('No se pudo conectar al servidor local. Comprueba que node server.js siga ejecutándose.',true);return false;}
  }
  const catalog=element('catalog-controls');
  const descriptions={tnt:'TNT con caída, rebote y mecha',rain:'Ocho TNT escalonadas',thunder:'Lluvia y tres rayos que rompen columnas',storm:'Viento y granizo que daña bloques',creeper:'Cae, prende su mecha y explota',meteor:'Magma que perfora su trayectoria',fire:'Cuatro bolas de fuego y zonas encendidas',tsunami:'Ola que erosiona y empuja el pico',spin:'Pico giratorio: daño por contacto',fast:'Prisa: pico más rápido con colisiones',mega:'TNT gigante con cráter ampliado',nuke:'Supercarga y explosiones en cadena',arrow:'Ráfaga de flechas desde dispensadores',big:'Pico gigante con colisión ampliada'};
  const selected=new Set(BlockWarsConfig.SELECTED_EVENTS);
  for(const key of [...selected,...Object.keys(BlockWarsConfig.EVENTS).filter(key=>!selected.has(key))]){
    const descriptor=BlockWarsConfig.EVENTS[key];
    const button=document.createElement('button');button.type='button';button.dataset.action=descriptor.id;
    button.textContent=descriptor.label;button.title=(descriptions[descriptor.id]||'Efecto compatible')+' · enfriamiento del motor '+descriptor.cooldown+' s';
    (selected.has(descriptor.id)?catalog:element('legacy-controls')).append(button);
  }
  function actor(){return element('actor').value.trim()||'operador-demo';}
  function action(type,extra){
    if(Object.prototype.hasOwnProperty.call(BlockWarsConfig.EVENTS,type)&&element('simulate-comment').checked)return send({type:'chat',text:type.replace(/_/g,' '),actor:actor()});
    return send({type:'bw_action',action:type,team:element('team').value,...extra});
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.chat)send({type:'chat',text:button.dataset.chat,actor:actor()});
    if(button.dataset.likes)send({type:'like',count:Number(button.dataset.likes)});
    if(button.dataset.command==='follow')send({type:'follow',actor:actor()});
    if(button.dataset.action)action(button.dataset.action);
  });
  element('chat-form').addEventListener('submit',event=>{event.preventDefault();send({type:'chat',text:element('chat').value.trim(),actor:actor()});});
  element('pickaxe-form').addEventListener('submit',event=>{event.preventDefault();action('pickaxe',{pickaxe:element('pickaxe').value});});
  element('enchant-form').addEventListener('submit',event=>{event.preventDefault();action('enchant',{efficiency:Number(element('efficiency').value),unbreaking:Number(element('unbreaking').value),fortune:Number(element('fortune').value)});});
  element('settings-form').addEventListener('submit',event=>{event.preventDefault();send({type:'bw_settings',settings:{duration:Number(element('duration').value),eventInterval:Number(element('eventInterval').value),likeThreshold:Number(element('likeThreshold').value),reducedMotion:element('reducedMotion').checked}});});
  element('reset-form').addEventListener('submit',event=>{event.preventDefault();send({type:'bw_reset',seed:Number(element('seed').value)});});
  element('pause').addEventListener('click',()=>send({type:'bw_pause',paused:true}));
  element('resume').addEventListener('click',()=>send({type:'bw_pause',paused:false}));
  element('emergency').addEventListener('click',()=>send({type:'bw_emergency'}));
  element('audio-form').addEventListener('submit',event=>{
    event.preventDefault();send({type:'bw_audio',settings:{muted:element('audio-muted').checked,volume:Number(element('audio-volume').value)/100,narration:element('audio-narration').checked,
      musicEnabled:element('audio-music').checked,musicVolume:Number(element('music-volume').value)/100,
      fxVolume:Number(element('fx-volume').value)/100,voiceVolume:Number(element('voice-volume').value)/100}});
  });
  const names={wood:'MADERA',stone:'PIEDRA',gold:'ORO',diamond:'DIAMANTE',netherite:'NETHERITA'};
  function compare(){
    const level=Number(element('efficiency').value);
    const multiplier=BlockWarsConfig.EFFICIENCY[level];
    element('speed-caption').textContent='Fuerza acumulada para el próximo contacto, sin Turbo ni DESCOMUNAL. Eficiencia: '+level+' (×'+multiplier+'). No equivale a bloques rotos por segundo.';
    const table=element('speed-table');table.replaceChildren();
    const max=Math.max(...Object.values(BlockWarsConfig.PICKAXES).map(tool=>tool.baseSpeed*multiplier));
    for(const [key,tool] of Object.entries(BlockWarsConfig.PICKAXES)){
      const row=document.createElement('tr');
      for(const value of [names[key]||key,tool.baseSpeed.toFixed(2),(tool.baseSpeed*multiplier).toFixed(2),tool.durability]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
      const cell=document.createElement('td'),bar=document.createElement('div');bar.className='bw-speed-bar';bar.style.width=(100*tool.baseSpeed*multiplier/max)+'%';cell.append(bar);row.append(cell);table.append(row);
    }
  }
  element('efficiency').addEventListener('change',compare);compare();
  async function poll(){
    await youtubeStatus();
    try{
      const response=await fetch('/api/block-wars/speech/status',{cache:'no-store'});
      if(!response.ok)throw new Error('health unavailable');
      const health=await response.json();
      element('speech-health').textContent=health.enabled?'ElevenLabs configurado · '+health.charactersUsed+' / '+health.characterLimit+' caracteres por hora · Reproducción real pendiente de ensayo.':
        'Voz pendiente: '+(!health.keyConfigured?'falta clave local. ':!health.voiceConfigured?'falta voz elegida. ':'revisa configuración. ')+'Los sonidos locales de Minecraft funcionan sin ElevenLabs.';
    }catch{element('speech-health').textContent='Estado de voz no disponible. Los sonidos locales de Minecraft funcionan sin ElevenLabs.';}
    try{
      const response=await fetch('/api/block-wars/telemetry',{cache:'no-store'});
      if(!response.ok)throw new Error('telemetry unavailable');
      const data=await response.json();
      if(!data.available || data.ageMs>15000){for(const id of ['read-fps','read-round','read-queue','read-source'])element(id).textContent='Sin dato';element('telemetry-status').textContent='Sin telemetría reciente. Abre o vuelve a enfocar la pestaña de la arena. Espectadores: no disponible.';}
      else{
        element('read-fps').textContent=data.fps+' FPS';
        element('read-round').textContent=data.mode==='endless'?Math.floor(data.depth)+' bloques / '+Math.floor(data.elapsed/60)+' min':String(data.round)+' / '+Math.ceil(data.remaining)+'s';
        element('read-queue').textContent=data.queue+' / '+data.particles;
        element('read-source').textContent=({simulator:'DEMO',tikfinity:'RELAY',youtube:'CHAT YOUTUBE',mixed:'FUENTES MIXTAS',none:'AUTÓNOMO'})[data.source]||'Sin dato';
        element('telemetry-status').textContent=(data.paused?'PAUSADO':'EN EJECUCIÓN')+' · '+(data.reducedMotion?'Movimiento reducido':'Movimiento normal')+' · Último dato hace '+Math.ceil(data.ageMs/1000)+'s · LIVE sin verificar · Espectadores: no disponible.';
      }
    }catch(error){element('telemetry-status').textContent='Diagnóstico local no disponible. Comprueba servidor y pestaña del juego.';}
    if(!disposed)pollTimer=setTimeout(poll,3000);
  }
  poll();addEventListener('pagehide',()=>{disposed=true;clearTimeout(pollTimer);for(const controller of youtubeRequests)controller.abort();youtubeRequests.clear();},{once:true});
})();

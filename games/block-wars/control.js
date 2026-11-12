(function () {
  'use strict';
  const element=id=>document.getElementById(id);
  const youtube=typeof location==='object'&&new URLSearchParams(location.search).get('platform')==='youtube';
  if(youtube){
    element('youtube-setup').hidden=false;
    document.querySelector('a[href="/block-wars"]').href='/block-wars?platform=youtube';
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
  for(const descriptor of Object.values(BlockWarsConfig.EVENTS)){
    const button=document.createElement('button');button.type='button';button.dataset.action=descriptor.id;
    button.textContent=descriptor.label;button.title='Prueba gratuita · enfriamiento '+descriptor.cooldown+' s';catalog.append(button);
  }
  function actor(){return element('actor').value.trim()||'operador-demo';}
  function action(type,extra){return send({type:'bw_action',action:type,team:element('team').value,...extra});}
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
    event.preventDefault();send({type:'bw_audio',settings:{muted:element('audio-muted').checked,volume:Number(element('audio-volume').value)/100,narration:element('audio-narration').checked}});
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
    try{
      const response=await fetch('/api/block-wars/speech/status',{cache:'no-store'});
      if(!response.ok)throw new Error('health unavailable');
      const health=await response.json();
      element('speech-health').textContent=health.enabled?'ElevenLabs configurado · '+health.charactersUsed+' / '+health.characterLimit+' caracteres por hora · Reproducción real pendiente de ensayo.':
        'Voz pendiente: '+(!health.keyConfigured?'falta clave local. ':!health.voiceConfigured?'falta voz elegida. ':'revisa configuración. ')+'Los sonidos propios funcionan sin ElevenLabs.';
    }catch{element('speech-health').textContent='Estado de voz no disponible. Los sonidos propios funcionan sin ElevenLabs.';}
    try{
      const response=await fetch('/api/block-wars/telemetry',{cache:'no-store'});
      if(!response.ok)throw new Error('telemetry unavailable');
      const data=await response.json();
      if(!data.available || data.ageMs>15000){for(const id of ['read-fps','read-round','read-queue','read-source'])element(id).textContent='Sin dato';element('telemetry-status').textContent='Sin telemetría reciente. Abre o vuelve a enfocar la pestaña de la arena. Espectadores: no disponible.';}
      else{
        element('read-fps').textContent=data.fps+' FPS';
        element('read-round').textContent=data.mode==='endless'?Math.floor(data.depth)+' bloques / '+Math.floor(data.elapsed/60)+' min':String(data.round)+' / '+Math.ceil(data.remaining)+'s';
        element('read-queue').textContent=data.queue+' / '+data.particles;
        element('read-source').textContent=({simulator:'DEMO',tikfinity:'RELAY',mixed:'DEMO + RELAY',none:'AUTÓNOMO'})[data.source]||'Sin dato';
        element('telemetry-status').textContent=(data.paused?'PAUSADO':'EN EJECUCIÓN')+' · '+(data.reducedMotion?'Movimiento reducido':'Movimiento normal')+' · Último dato hace '+Math.ceil(data.ageMs/1000)+'s · LIVE sin verificar · Espectadores: no disponible.';
      }
    }catch(error){element('telemetry-status').textContent='Diagnóstico local no disponible. Comprueba servidor y pestaña del juego.';}
    if(!disposed)pollTimer=setTimeout(poll,3000);
  }
  poll();addEventListener('pagehide',()=>{disposed=true;clearTimeout(pollTimer);},{once:true});
})();

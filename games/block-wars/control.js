(function () {
  'use strict';
  const element=id=>document.getElementById(id);
  const youtube=typeof location==='object'&&new URLSearchParams(location.search).get('platform')==='youtube';
  if(youtube){
    element('youtube-setup').hidden=false;
    document.querySelector('a[href="/block-wars"]').href='/block-wars?platform=youtube';
    element('follow-demo').textContent='+ Free subscriber · TEST';
    element('voice-policy').textContent+=' On YouTube, voice announces accepted like goals and new free subscribers. Commands and automatic events retain sound effects without narration. No simulator button confirms real YouTube activity.';
  }
  const youtubeLabels={unconfigured:'Not configured',idle:'No broadcast selected',waiting_live:'Waiting for broadcast',synchronizing:'Synchronizing',connected:'Chat transport connected',reconnecting:'Reconnecting',ended:'Broadcast ended',error:'Chat unavailable',quota_exhausted:'Quota exhausted',stopped:'Chat reader stopped'};
  const youtubeRequests=new Set();
  async function youtubeRequest(path,body){
    const controller=typeof AbortController==='function'?new AbortController():null;
    if(controller)youtubeRequests.add(controller);
    const timeout=controller?setTimeout(()=>controller.abort(),8000):null;
    try{
      const options=body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
      if(controller)options.signal=controller.signal;
      const response=await fetch('/api/youtube/'+path,options);
      if(!response.ok)throw new Error('Local YouTube service unavailable');return await response.json();
    }finally{if(timeout!==null)clearTimeout(timeout);if(controller)youtubeRequests.delete(controller);}
  }
  async function youtubeStatus(){
    if(!youtube||disposed)return;
    try{const status=await youtubeRequest('status');if(!disposed)element('youtube-status').textContent=(youtubeLabels[status.state]||'Status unavailable')+' · Viewers: unavailable.';}
    catch{if(!disposed)element('youtube-status').textContent='Chat disconnected or not configured. Viewers: unavailable.';}
  }
  if(youtube){
    element('youtube-refresh').addEventListener('click',async()=>{
      const button=element('youtube-refresh');button.disabled=true;
      try{const result=await youtubeRequest('broadcasts');if(disposed)return;
        const select=element('youtube-video');select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Explicitly select a broadcast';select.append(placeholder);
        if(!Array.isArray(result.broadcasts))throw new Error('invalid');
        for(const item of result.broadcasts.slice(0,50)){if(!item||!/^[A-Za-z0-9_-]{11}$/.test(item.id)||typeof item.title!=='string')continue;const option=document.createElement('option');option.value=item.id;option.textContent=item.title.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').slice(0,140);select.append(option);}select.value='';
      }catch{message('Could not fetch your broadcasts. Check the local configuration.',true);}finally{button.disabled=false;}
    });
    element('youtube-select-form').addEventListener('submit',async event=>{event.preventDefault();const videoId=element('youtube-video').value;if(!/^[A-Za-z0-9_-]{11}$/.test(videoId)){message('Select your own broadcast.',true);return;}try{await youtubeRequest('select',{videoId});await youtubeStatus();}catch{message('Could not select your broadcast.',true);}});
    element('youtube-stop').addEventListener('click',async()=>{try{await youtubeRequest('stop',{});await youtubeStatus();}catch{message('Could not stop the local chat reader.',true);}});
  }
  const feedback=element('feedback');
  let pollTimer,disposed=false;
  function message(text,error){feedback.textContent=text;feedback.dataset.error=String(Boolean(error));}
  async function send(command){
    try{
      const response=await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:'block-wars',...command})});
      if(!response.ok){message('Command rejected by the server ('+response.status+'). Check limits and the local connection.',true);return false;}
      const result=await response.json();
      if(!result.receivers){message('No arena connected. Open /block-wars before sending actions.',true);return false;}
      const label=BlockWarsConfig.EVENTS[command.action]?.label||({descomunal:'COLOSSAL',bw_settings:'Settings',bw_reset:'Reset',bw_pause:'Pause / resume',bw_emergency:'Emergency',bw_audio:'Audio',chat:'Chat',like:'Like',follow:'Follow',pickaxe:'Pickaxe',enchant:'Enchantments',repair:'Repair',mine:'Mine',turbo:'Turbo'})[command.action||command.type]||'Control';
      message('Sent to '+result.receivers+' arena(s) · '+label+' · SIMULATOR. Check the mine for the action’s actual start.');return true;
    }catch(error){message('Could not connect to the local server. Check that node server.js is still running.',true);return false;}
  }
  const catalog=element('catalog-controls');
  const descriptions={tnt:'Three falling TNT charges with bounce and fuses',rain:'Twelve temporary pickaxes for 10 seconds',thunder:'Rain and three lightning strikes that break columns',storm:'Wind and hail that damage blocks',creeper:'Falls, lights its fuse, and explodes',meteor:'Magma that drills along its path',fire:'Four fireballs and burning zones',tsunami:'A wave that erodes blocks and pushes the pickaxe',spin:'Spinning pickaxe with contact damage',fast:'Haste: a faster pickaxe with collisions',mega:'Giant TNT with a larger crater',nuke:'ULTRANUKE charges and chain explosions',arrow:'Arrow burst from dispensers',big:'Giant pickaxe with a larger collision area',sixty_seven:'67 clip with its configured group interval',messi:'Silent MESSI effect',siuuu:'SIUUU clip and visual effect'};
  const selected=new Set(BlockWarsConfig.SELECTED_EVENTS);
  for(const key of [...selected,...Object.keys(BlockWarsConfig.EVENTS).filter(key=>!selected.has(key))]){
    const descriptor=BlockWarsConfig.EVENTS[key];
    const button=document.createElement('button');button.type='button';button.dataset.action=descriptor.id;
    button.textContent=descriptor.label;button.title=(descriptions[descriptor.id]||'Legacy effect')+' · endless viewer commands: no intentional cooldown; active capacity and FIFO limits apply';
    (selected.has(descriptor.id)?catalog:element('legacy-controls')).append(button);
  }
  function actor(){return element('actor').value.trim()||'demo-operator';}
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
  const names={wood:'WOOD',stone:'STONE',gold:'GOLD',diamond:'DIAMOND',netherite:'NETHERITE'};
  function compare(){
    const level=Number(element('efficiency').value);
    const multiplier=BlockWarsConfig.EFFICIENCY[level];
    element('speed-caption').textContent='Accumulated strength for the next contact, without Turbo or COLOSSAL. Efficiency: '+level+' (×'+multiplier+'). This is not blocks broken per second.';
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
      element('speech-health').textContent=health.enabled?'ElevenLabs configured · '+health.charactersUsed+' / '+health.characterLimit+' characters per hour · Check playback in the current session.':
        'Voice pending: '+(!health.keyConfigured?'local key missing. ':!health.voiceConfigured?'voice not selected. ':'check configuration. ')+'Local Minecraft sounds work without ElevenLabs.';
    }catch{element('speech-health').textContent='Voice status unavailable. Local Minecraft sounds work without ElevenLabs.';}
    try{
      const response=await fetch('/api/block-wars/telemetry',{cache:'no-store'});
      if(!response.ok)throw new Error('telemetry unavailable');
      const data=await response.json();
      if(!data.available || data.ageMs>15000){for(const id of ['read-fps','read-round','read-queue','read-source'])element(id).textContent='No data';element('telemetry-status').textContent='No recent telemetry. Open or refocus the arena tab. Viewers: unavailable.';}
      else{
        element('read-fps').textContent=data.fps+' FPS';
        element('read-round').textContent=data.mode==='endless'?Math.floor(data.depth)+' blocks / '+Math.floor(data.elapsed/60)+' min':String(data.round)+' / '+Math.ceil(data.remaining)+'s';
        element('read-queue').textContent=data.queue+' / '+data.particles;
        element('read-source').textContent=({simulator:'DEMO',tikfinity:'RELAY',youtube:'YOUTUBE CHAT',mixed:'MIXED SOURCES',none:'AUTONOMOUS'})[data.source]||'No data';
        element('telemetry-status').textContent=(data.paused?'PAUSED':'RUNNING')+' · '+(data.reducedMotion?'Reduced motion':'Normal motion')+' · Latest data: '+Math.ceil(data.ageMs/1000)+'s ago · LIVE unverified · Viewers: unavailable.';
      }
    }catch(error){element('telemetry-status').textContent='Local diagnostics unavailable. Check the server and game tab.';}
    if(!disposed)pollTimer=setTimeout(poll,3000);
  }
  poll();addEventListener('pagehide',()=>{disposed=true;clearTimeout(pollTimer);for(const controller of youtubeRequests)controller.abort();youtubeRequests.clear();},{once:true});
})();

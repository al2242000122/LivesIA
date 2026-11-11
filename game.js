'use strict';
/* Serpiente Infinita LIVE — original maze + autoplay. No external dependencies. */
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const WIDTH = 25, HEIGHT = 31, CELL = 24, DURATION = 180;
  const $ = id => document.getElementById(id);
  const ui = { score: $('score'), level: $('level'), timer: $('timer'), shields: $('shields'),
    speed: $('speed'), banner: $('banner'), last: $('last-event'), signal: $('signal'), connection: $('connection') };
  const dirs = [[1,0],[0,1],[-1,0],[0,-1]];
  const s = {walls:[],snake:[],apples:[],floor:[],particles:[], score:0, level:1,
    shields:0, seconds:DURATION, paused:false, turboUntil:0, partyUntil:0,
    bannerUntil:0, gameOverUntil:0, nextLevelAt:12, likes:0, fxLast:0};
  const freeCooldown = new Map();
  const seenGifts = new Map();
  const MAX_EVENT_KEYS = 2048;
  let lastChatAt = -Infinity;
  let lastFrame = performance.now(), lastMove=0, previousSec=0, socket=null;
  const key = (x,y) => y * WIDTH + x;
  const isWall = (x,y) => x<0 || y<0 || x>=WIDTH || y>=HEIGHT || s.walls[key(x,y)] === 1;
  const rand = n => Math.floor(Math.random() * n);
  const safeName = value => String(value || 'Espectador').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,24);
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const formatTime = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
  function notify(text, big=false, ms=1800) {
    ui.last.textContent = String(text).slice(0,110);
    if (big) { ui.banner.textContent=String(text).slice(0,54); ui.banner.classList.add('show'); s.bannerUntil=Date.now()+ms; }
  }
  function makeMaze() {
    const walls = new Uint8Array(WIDTH*HEIGHT).fill(1);
    const stack = [[1,1]]; walls[key(1,1)] = 0;
    while(stack.length) {
      const [x,y] = stack[stack.length-1];
      const options = [];
      for(const [dx,dy] of dirs) {
        const nx=x+dx*2, ny=y+dy*2;
        if(nx>0&&ny>0&&nx<WIDTH-1&&ny<HEIGHT-1&&walls[key(nx,ny)]) options.push([nx,ny,dx,dy]);
      }
      if(!options.length){stack.pop();continue;}
      const [nx,ny,dx,dy] = options[rand(options.length)];
      walls[key(x+dx,y+dy)] = 0;
      walls[key(nx,ny)] = 0;
      stack.push([nx,ny]);
    }
    // Carve a handful of loops to make autoplay more resilient and rounds more dynamic.
    for(let i=0;i<36;i++) {
      const x=1+rand(WIDTH-2), y=1+rand(HEIGHT-2);
      if(walls[key(x,y)] && ((x%2===0&&y%2===1)||(x%2===1&&y%2===0))) {
        const horizontal=!walls[key(x-1,y)]&&!walls[key(x+1,y)];
        const vertical=!walls[key(x,y-1)]&&!walls[key(x,y+1)];
        if(horizontal||vertical) walls[key(x,y)]=0;
      }
    }
    s.walls = walls;
    s.floor=[];
    for(let y=1;y<HEIGHT-1;y++) for(let x=1;x<WIDTH-1;x++) if(!isWall(x,y)) s.floor.push({x,y});
  }
  function spawnApples(number) {
    const occupied = new Set(s.snake.map(p=>key(p.x,p.y)).concat(s.apples.map(p=>key(p.x,p.y))));
    const candidates = s.floor.filter(p=>!occupied.has(key(p.x,p.y)));
    const amount = Math.min(number, Math.max(0, 48-s.apples.length), candidates.length);
    for(let i=0;i<amount;i++){
      const j=rand(candidates.length); const [point]=candidates.splice(j,1);
      s.apples.push({...point,born:Date.now(),color:rand(3)});
    }
  }
  function newRound(fullReset=true) {
    if(fullReset) {s.score=0;s.level=1;s.shields=0;s.nextLevelAt=12;}
    s.seconds=DURATION;s.paused=false;s.turboUntil=0;s.partyUntil=0;s.gameOverUntil=0;
    previousSec=0;lastMove=0;lastFrame=performance.now();s.particles=[];
    makeMaze();s.snake=[{x:1,y:1}];s.apples=[];spawnApples(6);
    notify(fullReset?'Nueva partida: ¡la serpiente está en marcha!':'¡Nuevo laberinto, nuevo desafío!',true);
    syncHUD();
  }
  function levelUp() {
    s.level++;s.nextLevelAt+=12;
    makeMaze();s.snake=[{x:1,y:1}];s.apples=[];spawnApples(7);
    notify(`✨ ¡NIVEL ${s.level}! Nuevo laberinto`,true,2400);
  }
  function findStep() {
    const head=s.snake[0], start=key(head.x,head.y);
    const occupied=new Set(s.snake.slice(0,-1).map(p=>key(p.x,p.y)));
    occupied.delete(start);
    const target=new Set(s.apples.map(p=>key(p.x,p.y)));
    const visited=new Uint8Array(WIDTH*HEIGHT), parent=new Int32Array(WIDTH*HEIGHT).fill(-1);
    const queue=[start];visited[start]=1;
    let targetKey=-1;
    for(let i=0;i<queue.length;i++){
      const pos=queue[i];
      if(pos!==start && target.has(pos)) {targetKey=pos;break;}
      const x=pos%WIDTH, y=Math.floor(pos/WIDTH);
      for(const [dx,dy] of dirs){
        const nx=x+dx,ny=y+dy;
        if(isWall(nx,ny))continue;
        const idx=key(nx,ny);
        if(!visited[idx]&&!occupied.has(idx)){visited[idx]=1;parent[idx]=pos;queue.push(idx);}
      }
    }
    if(targetKey!==-1){
      let next=targetKey;
      while(parent[next]!==start && parent[next]!==-1) next=parent[next];
      return {x:next%WIDTH,y:Math.floor(next/WIDTH)};
    }
    // If a fruit is temporarily unreachable, prefer safe moves with open exits.
    const options=dirs.map(([dx,dy])=>({x:head.x+dx,y:head.y+dy}))
      .filter(p=>!isWall(p.x,p.y)&&!occupied.has(key(p.x,p.y)));
    if(!options.length)return null;
    options.sort((a,b)=>{
      const exits=p=>dirs.filter(([dx,dy])=>!isWall(p.x+dx,p.y+dy)&&!occupied.has(key(p.x+dx,p.y+dy))).length;
      return exits(b)-exits(a);
    });
    return options[0];
  }
  function crash() {
    if(s.shields>0){
      s.shields--;s.snake=[{x:1,y:1}];
      s.apples=s.apples.filter(p=>p.x!==1||p.y!==1);
      notify('🛡️ ¡El escudo salvó a la serpiente!',true);return;
    }
    s.gameOverUntil=Date.now()+1750;
    notify(`💥 Fin de la partida · ${s.score} manzanas`,true,1500);
  }
  function step() {
    if(s.paused||s.gameOverUntil) return;
    if(!s.apples.length)spawnApples(5);
    const next=findStep();
    if(!next){crash();return;}
    const fruitIdx=s.apples.findIndex(p=>p.x===next.x&&p.y===next.y);
    const eating=fruitIdx>=0;
    const grows=eating && ((s.score+1)%4===0);
    const blocked=s.snake.slice(0,grows?undefined:-1).some(p=>p.x===next.x&&p.y===next.y);
    if(blocked){crash();return;}
    s.snake.unshift(next);
    if(eating){
      s.apples.splice(fruitIdx,1);s.score++;spawnBurst(next.x,next.y,'#a9ff70',9);
      if(s.score>=s.nextLevelAt){levelUp();return;}
      if(s.apples.length<3)spawnApples(5);
    }
    if(!grows) s.snake.pop();
  }
  function spawnBurst(x,y,color,n=15) {
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2, speed=30+Math.random()*100;
      s.particles.push({x:x*CELL+CELL/2,y:y*CELL+CELL/2,
        vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.5+Math.random()*.45,color});
    }
    if(s.particles.length>260)s.particles.splice(0,s.particles.length-260);
  }
  function gift(name,count=1,by='Espectador') {
    const n=norm(name), qty=Math.max(1,Math.min(20,Math.round(Number(count)||1)));
    let label;
    if(n.includes('rose')||n.includes('rosa')){spawnApples(2*qty);label=`🌹 ${by} agregó manzanas`;}
    else if(n.includes('finger heart')||n.includes('corazon')||n==='heart'||n.includes('heart me')){
      s.shields=Math.min(5,s.shields+qty);label=`❤️ ${by} activó un escudo`;}
    else if(n.includes('doughnut')||n.includes('donut')||n.includes('dona')){
      s.turboUntil=Date.now()+Math.min(35000,8000*qty); label=`🍩 ¡TURBO de ${by}!`;}
    else if(n.includes('galaxy')||n.includes('galaxia')){
      spawnApples(8*qty);s.partyUntil=Date.now()+10000;label=`🌌 ¡LLUVIA FRUTAL de ${by}!`;}
    else {spawnApples(qty);label=`🎁 ${by} envió ${String(name).slice(0,24)}`;}
    notify(label,true);syncHUD();
  }
  function freeEvent(type,by='Espectador',text=''){
    if(type==='like') {spawnApples(1);notify(`👍 ${by}: ¡100 likes! +1 manzana`);}
    else if(type==='follow'){spawnApples(1);notify(`⭐ ¡Gracias por seguir, ${by}!`);}
    else if(type==='subscribe'){spawnApples(5);notify(`💎 ${by} se suscribió: +5 manzanas`,true);}
    else if(type==='chat'){
      if(norm(text).includes('!manzana')){spawnApples(1);notify(`💬 ${by} ayudó con una manzana`);}
    }
    syncHUD();
  }
  function syncHUD(){
    ui.score.textContent=String(s.score).padStart(3,'0');
    ui.level.textContent=String(s.level).padStart(2,'0');
    ui.timer.textContent=formatTime(s.seconds);
    ui.shields.textContent=String(s.shields).padStart(2,'0');
    ui.speed.textContent=Date.now()<s.turboUntil?'⚡ TURBO ACTIVADO':'VELOCIDAD NORMAL';
  }
  function command(data) {
    if(!data||typeof data!=='object'||Array.isArray(data))return;
    const by=`PRUEBA · ${safeName(data.name)}`;
    if(data.type==='gift')gift(data.giftName, data.count, by);
    if(['like','follow','subscribe','chat'].includes(data.type))freeEvent(data.type,by,data.text);
    if(data.type==='pause'){s.paused=!s.paused;lastFrame=performance.now();notify(s.paused?'⏸ Partida pausada':'▶ Partida reanudada',true);}
    if(data.type==='reset')newRound(true);
    if(data.type==='frenzy'){s.partyUntil=Date.now()+14000;spawnApples(20);notify('PRUEBA · ✨ ¡FIESTA DE MANZANAS!',true);}
  }
  // Bounded expiry maps fail closed under overload, keeping active cooldowns.
  // Viewer identifiers stay in memory only and are never logged.
  function claimEvent(map,k,ttl,now){
    for(const [id,until] of map)if(until<=now)map.delete(id);
    if(map.has(k)||map.size>=MAX_EVENT_KEYS)return false;
    map.set(k,now+ttl);return true;
  }
  function handleTikfinity(packet){
    if(typeof packet.data!=='string'||packet.data.length>16384)return;
    let msg;try{msg=JSON.parse(packet.data);}catch{return;}
    if(!msg||typeof msg!=='object'||Array.isArray(msg)||typeof msg.event!=='string')return;
    const type=msg.event.toLowerCase(),d=msg.data;
    if(!d||typeof d!=='object'||Array.isArray(d))return;
    const scalar=value=>typeof value==='string'||(typeof value==='number'&&Number.isFinite(value));
    const identity=[d.userId,d.uniqueId,d.username,d.nickname].find(scalar);
    const userKey=String(identity??'anonymous').slice(0,128);
    const by=safeName([d.nickname,d.uniqueId,d.username].find(scalar));
    const now=Date.now();
    if(type==='gift'){
      if(d.giftType!==undefined&&!scalar(d.giftType))return;
      if(Number(d.giftType)===1&&d.repeatEnd!==true&&d.repeatEnd!==1)return;
      if(d.repeatCount!==undefined&&!scalar(d.repeatCount))return;
      const count=d.repeatCount===undefined?1:Number(d.repeatCount);
      if(!Number.isSafeInteger(count)||count<1)return;
      const name=d.giftName??d.gift?.name??'Regalo';
      if(typeof name!=='string')return;
      // Events without an ID retain the MVP behavior; never invent IDs.
      if(scalar(d.msgId)&&!claimEvent(seenGifts,`gift:${String(d.msgId).slice(0,128)}`,120000,now))return;
      gift(name.slice(0,80),count,by);
    }else if(type==='follow'||type==='subscribe'){
      if(claimEvent(freeCooldown,`${type}:${userKey}`,20000,now))freeEvent(type,by);
    }else if(type==='like'){
      if(!scalar(d.likeCount))return;
      const value=Number(d.likeCount);
      if(!Number.isSafeInteger(value)||value<0)return;
      s.likes+=Math.min(1000,value);
      const batches=Math.floor(s.likes/100);s.likes%=100;
      if(batches){spawnApples(batches);notify(`👍 ¡La comunidad acumuló ${batches*100} likes!`);}
    }else if(type==='chat'){
      if(typeof d.comment!=='string'||d.comment.length>500)return;
      const message=norm(d.comment);
      if(message.includes('!manzana')&&now-lastChatAt>=2500&&claimEvent(freeCooldown,`chat:${userKey}`,15000,now)){
        lastChatAt=now;freeEvent('chat',by,message);
      }
    }
  }
  // TikFinity Desktop local Events API. Not an official TikTok public API.
  let reconnectTimeout;
  function connectTikfinity(){
    try {
      socket=new WebSocket('ws://127.0.0.1:21213/');
      socket.onopen=()=>{
        ui.signal.classList.add('on');ui.connection.textContent='RELAY CONECTADO';
        notify('TikFinity conectado · LIVE sin verificar');
      };
      socket.onmessage=handleTikfinity;
      socket.onclose=()=>{
        ui.signal.classList.remove('on');ui.connection.textContent='MODO DEMO';
        clearTimeout(reconnectTimeout);reconnectTimeout=setTimeout(connectTikfinity,5000);
      };
      socket.onerror=()=>socket.close();
    }catch{clearTimeout(reconnectTimeout);reconnectTimeout=setTimeout(connectTikfinity,5000);}
  }
  let controlsRetry;
  function connectControls(){
    const stream=new EventSource('/api/stream');
    stream.onmessage=e=>{try{command(JSON.parse(e.data));}catch(err){console.error('Evento local inválido',err);}};
    stream.onerror=()=>{
      // Native retries handle CONNECTING; HTTP failures such as a capacity 503
      // can be terminal. Recreate only CLOSED streams, with one pending retry.
      if(stream.readyState===EventSource.CLOSED){
        clearTimeout(controlsRetry);controlsRetry=setTimeout(connectControls,5000);
      }
    };
  }
  function rounded(x,y,w,h,r){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);
  }
  function draw(now,delta){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#09111e';ctx.fillRect(0,0,canvas.width,canvas.height);
    const t=now/1000;
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
      const px=x*CELL,py=y*CELL;
      if(isWall(x,y)){
        ctx.fillStyle='#142c3d';rounded(px+1,py+1,CELL-2,CELL-2,5);ctx.fill();
        ctx.strokeStyle='#24465d';ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle='#274257';ctx.fillRect(px+5,py+3,CELL-10,2);
      }else{
        ctx.fillStyle=((x+y)%2)?'#0b1522':'#0c1826';ctx.fillRect(px,py,CELL,CELL);
        if((x*17+y*11)%37===0){ctx.fillStyle='#2c647255';ctx.fillRect(px+10,py+11,2,2);}
      }
    }
    if(Date.now()<s.partyUntil){
      ctx.fillStyle=`rgba(156,84,244,${.09+Math.sin(t*6)*.05})`;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    for(const apple of s.apples){
      const cx=(apple.x+.5)*CELL,cy=(apple.y+.5)*CELL;
      const wobble=Math.sin(t*5+apple.x)*1.3;
      ctx.save();ctx.shadowBlur=13;ctx.shadowColor='#ff475e';
      ctx.fillStyle=apple.color===0?'#ff5470':apple.color===1?'#ff8b6a':'#ff477f';
      ctx.beginPath();ctx.arc(cx,cy+wobble,7.1,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle='#b5ff7c';ctx.beginPath();ctx.ellipse(cx+3,cy-8+wobble,5,2.5,-.5,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    s.snake.forEach((p,i)=>{
      const px=p.x*CELL,py=p.y*CELL;
      ctx.save();ctx.shadowColor=i===0?'#5effd5':'#38cfb7';ctx.shadowBlur=i===0?19:7;
      ctx.fillStyle=i===0?'#80ffe3':i%2?'#35dfb9':'#24bda5';
      rounded(px+2.2,py+2.2,CELL-4.4,CELL-4.4,i===0?9:7);ctx.fill();
      ctx.restore();
      if(i===0){
        const neck=s.snake[1], dir=neck?{x:p.x-neck.x,y:p.y-neck.y}:{x:1,y:0};
        ctx.fillStyle='#092b34';
        if(Math.abs(dir.x)>0){
          for(const yy of [7,16]){ctx.beginPath();ctx.arc(px+12+dir.x*4,py+yy,2.3,0,Math.PI*2);ctx.fill();}
        }else{
          for(const xx of [7,16]){ctx.beginPath();ctx.arc(px+xx,py+12+dir.y*4,2.3,0,Math.PI*2);ctx.fill();}
        }
      }
    });
    for(let i=s.particles.length-1;i>=0;i--){
      const p=s.particles[i];p.x+=p.vx*delta;p.y+=p.vy*delta;p.life-=delta;
      if(p.life<=0){s.particles.splice(i,1);continue;}
      ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,2.8,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    if(s.paused||s.gameOverUntil){
      ctx.fillStyle='#060b18c9';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 40px system-ui';
      ctx.fillText(s.paused?'PAUSA':'FIN DE PARTIDA',canvas.width/2,canvas.height/2-10);
      ctx.font='bold 17px system-ui';ctx.fillStyle='#a1f7d7';
      ctx.fillText(s.paused?'Control del creador':'¡Nueva ronda enseguida!',canvas.width/2,canvas.height/2+27);
    }
  }
  function loop(now){
    let elapsed=Math.max(0,(now-lastFrame)/1000);
    if(!s.paused && s.gameOverUntil && Date.now()>s.gameOverUntil){newRound(false);elapsed=0;}
    const delta=Math.min(.08,elapsed);lastFrame=now;
    if(!s.paused&&!s.gameOverUntil){
      previousSec+=elapsed;
      if(previousSec>=1){const whole=Math.floor(previousSec);previousSec-=whole;s.seconds=Math.max(0,s.seconds-whole);
        if(s.seconds===0){notify('⏱️ ¡Tiempo! Nueva ronda',true);newRound(false);}syncHUD();}
      lastMove+=delta*1000;
      const speed=(Date.now()<s.turboUntil)?75:Math.max(95,180-s.level*8);
      if(lastMove>=speed){lastMove=0;step();syncHUD();}
    }
    if(s.bannerUntil && Date.now()>s.bannerUntil){ui.banner.classList.remove('show');s.bannerUntil=0;}
    draw(now,delta);requestAnimationFrame(loop);
  }
  newRound(true);connectControls();connectTikfinity();requestAnimationFrame(loop);
})();

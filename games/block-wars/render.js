(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./textures.js'),require('./config.js'),root);
  else root.BlockWarsRender=factory(root.BlockWarsTextures,root.BlockWarsConfig,root);
})(typeof globalThis!=='undefined'?globalThis:this,function(Textures,Config,root){
  'use strict';
  const bounded=(n,min,max)=>Math.max(min,Math.min(max,n));
  function createRenderer(canvas){
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas 2D no disponible');
    const W=canvas.width,H=canvas.height,cache=new Map();
    const view={cameraY:0,cellSize:90,visibleRows:0,focusDepth:0,activeTeam:'dark'};
    let lastTime=0,lastRound=0,lastOffset=0,lastElapsed=0;
    function bitmap(kind,id,variant=0){
      const key=`${kind}:${id}:${variant}`;
      if(cache.has(key))return cache.get(key);
      const image=kind==='tile'?Textures.tile(id,variant):kind==='tool'?Textures.pickaxe(id):Textures.tnt(id);
      const surface=root.OffscreenCanvas?new root.OffscreenCanvas(16,16):root.document?.createElement('canvas');
      if(surface){
        surface.width=16;surface.height=16;const painter=surface.getContext('2d');
        const data=painter.createImageData(16,16);data.data.set(image.pixels);painter.putImageData(data,0,0);
      }
      const entry={image,surface};cache.set(key,entry);return entry;
    }
    function paint(kind,id,x,y,size,variant=0){
      const original=Textures.source(kind,id);
      if(original){ctx.drawImage(original,0,0,16,16,x,y,size,size);return;}
      const {image,surface}=bitmap(kind,id,variant);
      if(surface){ctx.drawImage(surface,x,y,size,size);return;}
      // Node tests have no browser canvas; the same bitmap remains drawable.
      const unit=size/16;
      for(let row=0;row<16;row++)for(let col=0;col<16;col++){
        const i=(row*16+col)*4;if(!image.pixels[i+3])continue;
        ctx.fillStyle=`rgb(${image.pixels[i]},${image.pixels[i+1]},${image.pixels[i+2]})`;
        ctx.fillRect(x+col*unit,y+row*unit,unit+.02,unit+.02);
      }
    }
    function sky(time,reduced){
      const gradient=ctx.createLinearGradient(0,0,0,H);gradient.addColorStop(0,'#4196f8');gradient.addColorStop(.65,'#8ce6fa');gradient.addColorStop(1,'#d6ffff');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
      const clouds=[[130,170,160],[500,330,180],[230,540,150],[550,750,180],[230,1010,170],[620,1190,160]];
      for(let i=0;i<clouds.length;i++){
        const [baseX,y,width]=clouds[i],x=baseX+(reduced?0:Math.sin(time*.04+i)*26);
        ctx.fillStyle='#bce4f5';ctx.fillRect(x-width*.5,y+18,width,25);
        ctx.fillStyle='#e2f6ff';ctx.fillRect(x-width*.58,y+6,width*.92,28);
        ctx.fillStyle='#fff';ctx.fillRect(x-width*.4,y-12,width*.62,30);ctx.fillRect(x-width*.2,y-22,width*.35,20);
        ctx.fillStyle='#f3fcff';ctx.fillRect(x-width*.55,y,width*.9,17);
      }
    }
    function crack(block,x,y,cell){
      const damage=1-block.hp/block.maxHp;if(damage<=0)return;
      const original=Textures.source('crack',bounded(Math.floor(damage*10),0,9));
      if(original){
        ctx.save();ctx.globalCompositeOperation='multiply';ctx.drawImage(original,0,0,16,16,x,y,cell,cell);ctx.restore();return;
      }
      ctx.strokeStyle='#222024';ctx.lineWidth=Math.max(2,cell/32);ctx.beginPath();
      ctx.moveTo(x+cell*.5,y+2);ctx.lineTo(x+cell*.44,y+cell*.3);ctx.lineTo(x+cell*.66,y+cell*.55);ctx.lineTo(x+cell*.42,y+cell*.96);
      if(damage>.4){ctx.moveTo(x+cell*.44,y+cell*.3);ctx.lineTo(x+cell*.1,y+cell*.52);ctx.moveTo(x+cell*.66,y+cell*.55);ctx.lineTo(x+cell*.94,y+cell*.33);}ctx.stroke();
    }
    function projectile(entity,x,y,cell,reduced){
      const kind=entity.kind,age=entity.age||0,size=(entity.size||1)*cell;
      ctx.save();ctx.translate(x,y);
      if(['tnt','tnt_rain','mega','nuke','jackpot'].includes(kind)){
        ctx.rotate(reduced?0:(entity.rotation||0));
        paint('tnt',kind==='tnt_rain'?'tnt':kind,-size/2,-size/2,size);
        ctx.fillStyle='#24221d';ctx.fillRect(-4,-size/2-11,8,12);ctx.fillStyle=age%0.2<.1?'#ffe573':'#ff9a38';ctx.fillRect(0,-size/2-16,5,5);
        if(kind==='jackpot'){
          ctx.strokeStyle='#ffe579';ctx.lineWidth=3;
          for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,size*(.25+i*.1),0,Math.PI*2);ctx.stroke();}
        }
      }else if(kind==='meteor'||kind==='fire'){
        if(!reduced){ctx.fillStyle='#f9812fbb';ctx.beginPath();ctx.moveTo(-size*.3,-size*.1);ctx.lineTo(size*.1,-size*2.3);ctx.lineTo(size*.45,0);ctx.closePath();ctx.fill();}
        ctx.fillStyle=kind==='meteor'?'#7c675d':'#fa811f';ctx.beginPath();ctx.arc(0,0,size*.48,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ffdd53';ctx.beginPath();ctx.arc(0,0,size*.25,0,Math.PI*2);ctx.fill();
      }else if(kind==='arrow'){
        ctx.rotate(.3);ctx.fillStyle='#8b5a31';ctx.fillRect(-3,-size*1.7,6,size*2);
        ctx.fillStyle='#d8dde0';ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(0,18);ctx.lineTo(10,0);ctx.fill();
      }else if(kind==='black_hole'){
        ctx.strokeStyle='#7739a5';ctx.lineWidth=cell*.11;
        for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(0,0,size*(.12+i*.12),(reduced?0:age*3)+i,(reduced?0:age*3)+i+4);ctx.stroke();}
        ctx.fillStyle='#171025';ctx.beginPath();ctx.arc(0,0,size*.2,0,Math.PI*2);ctx.fill();
      }else if(kind==='thunder'){
        ctx.strokeStyle='#fff09c';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(15,-cell*4);ctx.lineTo(-12,-cell*2);ctx.lineTo(22,-cell*2);ctx.lineTo(0,0);ctx.stroke();
      }else if(kind==='tsunami'){
        ctx.fillStyle='#318bd1bb';ctx.fillRect(-cell*2,-cell*.5,cell*4,cell);ctx.fillStyle='#bcefff';ctx.fillRect(-cell*2,-cell*.5,cell*4,8);
      }else{
        ctx.fillStyle='#74dafa';ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(-size*.5,0);ctx.quadraticCurveTo(0,size,size*.5,0);ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }
    function draw(state,options={}){
      const time=options.time||0,reduced=Boolean(options.reducedMotion),endless=state.layout==='endless',shaft=endless||state.layout==='shaft';
      const cell=shaft?W/(state.width+1):W/state.width,offset=shaft?cell:0;
      const focus=endless&&state.body?state.body:state.focus||{...state.teams.dark.target,team:'dark'};
      const visible=H/cell,maxCamera=Math.max(0,state.height-visible);
      const rowOffset=state.rowOffset||0,wasReset=state.elapsed<lastElapsed||rowOffset<lastOffset;
      if(endless)view.cameraY=bounded(view.cameraY-(rowOffset-lastOffset),0,maxCamera);
      let desired=shaft?bounded((focus.y||0)+(endless?0:.5)-visible*(endless?.62:.78),0,maxCamera):0;
      if(endless)desired=Math.max(view.cameraY,desired);
      if(wasReset||!endless&&state.round!==lastRound){view.cameraY=0;lastRound=state.round;}
      else if(!state.paused){const dt=bounded(time-lastTime,0,.1);view.cameraY=reduced?desired:view.cameraY+(desired-view.cameraY)*(1-Math.exp(-dt*7));}
      lastTime=time;lastOffset=rowOffset;lastElapsed=state.elapsed||0;
      Object.assign(view,{cellSize:cell,visibleRows:visible,focusDepth:rowOffset+(focus.y||0),activeTeam:focus.team||'dark'});
      ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,W,H);sky(time,reduced);
      const first=Math.max(0,Math.floor(view.cameraY)),last=Math.min(state.height,Math.ceil(view.cameraY+visible)+1);
      for(let y=first;y<last;y++){
        const py=Math.floor((y-view.cameraY)*cell);
        if(shaft)paint('tile','bedrock',0,py,cell,y%3);
        for(let x=0;x<state.width;x++){
          const block=state.blocks[y*state.width+x];if(!block)continue;
          const px=Math.floor(offset+x*cell);paint('tile',block.material,px,py,cell,(x*7+y*13)%4);crack(block,px,py,cell);
        }
      }
      for(const effect of state.effects||[]){
        const p=bounded(effect.age/effect.duration,0,1),x=offset+(effect.x+.5)*cell,y=(effect.y+.5-view.cameraY)*cell;
        ctx.save();ctx.globalAlpha=(1-p)*.8;ctx.strokeStyle=Config.EVENTS?.[effect.kind]?.color||'#ffe49b';ctx.lineWidth=effect.kind==='nuke'?7:3;
        ctx.beginPath();ctx.arc(x,y,(reduced?.6:Math.max(.05,p))*cell*(effect.kind==='nuke'?6:effect.kind==='mega'||effect.kind==='jackpot'?4:2),0,Math.PI*2);ctx.stroke();ctx.restore();
      }
      for(const entity of state.entities||[])projectile(entity,offset+(entity.x+.5)*cell,(entity.y+.5-view.cameraY)*cell,cell,reduced);
      if(!reduced)for(const p of state.particles||[]){ctx.globalAlpha=bounded(p.life*2,0,1);ctx.fillStyle=p.color;ctx.fillRect(offset+p.x*cell,(p.y-view.cameraY)*cell,cell/14,cell/14);}ctx.globalAlpha=1;
      const active=state.teams[view.activeTeam]||state.teams.dark,target=shaft?focus:active.target;
      if(target){
        const x=offset+(target.x+(endless?0:.5))*cell,y=(target.y+(endless?0:.1)-view.cameraY)*cell;
        const buffs=active.buffs||{},size=cell*(endless?(state.body.radius||.35)*3.2:buffs.big>0?2.75:buffs.descomunal>0?2.1:1.55);
        const angle=endless?(reduced?-.3:state.body.rotation):reduced||state.paused?-.3:buffs.spin>0?time*9:Math.sin(time*Math.min(14,4+active.effectiveSpeed))*.55-.3;
        ctx.save();ctx.translate(x,y);ctx.rotate(endless?angle:Math.round(angle*12)/12);
        if(buffs.rainbow>0&&!reduced)ctx.filter=`hue-rotate(${Math.floor(time*70)%360}deg)`;
        if(buffs.demon>0)ctx.filter='sepia(.5) saturate(3)';
        paint('tool',active.pickaxe,-size*.5,-size*.5,size);ctx.restore();
        if(buffs.butterfly>0){ctx.fillStyle='#eea2e5aa';ctx.beginPath();ctx.ellipse(x-cell*.45,y,cell*.35,cell*.6,-.4,0,Math.PI*2);ctx.ellipse(x+cell*.45,y,cell*.35,cell*.6,.4,0,Math.PI*2);ctx.fill();}
      }
      if(state.paused||state.phase==='summary'){
        ctx.fillStyle='#101116d9';ctx.fillRect(0,H*.43,W,H*.16);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 44px Impact,sans-serif';
        ctx.fillText(state.paused?'EN PAUSA':state.result==='tie'?'EMPATE':`${(state.result||'').toUpperCase()} GANA`,W/2,H*.51);
        ctx.font='17px Consolas,monospace';ctx.fillText(state.paused?'Control del creador':'Nueva excavación enseguida',W/2,H*.55);ctx.textAlign='left';
      }
    }
    return {draw,view};
  }
  return {createRenderer};
});

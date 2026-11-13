(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./textures.js'));
  else root.BlockWarsEffectsRender=factory(root.BlockWarsTextures);
})(typeof globalThis!=='undefined'?globalThis:this,function(Textures){
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function createPainter(ctx,paint,width,height){
    function credit(entry){
      const actor=String(entry.actor||'LA COMUNIDAD').replace(/[\x00-\x1f\x7f<>]/g,'').slice(0,32);
      return entry.source==='automatic'?'EVENTO DE LA MINA':
        entry.source==='simulator'||entry.source==='operator'?'PRUEBA · '+actor:actor;
    }
    function label(entry,x,y){
      if(!entry.source&&!entry.actor)return;
      const text=credit(entry);
      ctx.save();ctx.font='bold 19px Consolas,monospace';ctx.textAlign='center';
      const measured=ctx.measureText(text)?.width||text.length*12;
      const box=Math.min(width-16,measured+16),left=clamp(x-box/2,8,width-box-8),top=clamp(y,48,height-32);
      ctx.fillStyle='#11151ce8';ctx.fillRect(left,top,box,28);
      ctx.fillStyle=entry.source==='simulator'?'#ffdc78':'#fff';ctx.fillText(text,left+box/2,top+20,box-12);ctx.restore();
    }
    function frame(name,x,y,size,age=0){paint('sprite',name,x,y,size,Math.floor(age*8));}
    function creeper(size,age,fuse,reduced){
      const skin=Textures.source('sprite','creeper'),u=size/24;
      if(skin){
        // Front-facing UVs of the actual 64x32 creeper skin: head, body and feet.
        ctx.drawImage(skin,8,8,8,8,-4*u,-13*u,8*u,8*u);
        ctx.drawImage(skin,20,20,8,12,-4*u,-5*u,8*u,12*u);
        ctx.drawImage(skin,4,20,4,6,-4*u,7*u,4*u,6*u);
        ctx.drawImage(skin,4,20,4,6,0,7*u,4*u,6*u);
      }else paint('sprite','creeper',-size/2,-size/2,size);
      if(!reduced&&fuse>0&&Math.floor(age*8)%2===0){ctx.fillStyle='#ffffff70';ctx.fillRect(-4*u,-13*u,8*u,26*u);}
    }
    function tnt(entry,size,reduced){
      const kind=entry.kind;
      paint('tnt',kind==='rain'||kind==='tnt_rain'?'tnt':kind,-size/2,-size/2,size);
      if(kind==='nuke'){
        const unit=size/5;
        for(let i=-1;i<=1;i++)paint('tile','redstone',i*unit-unit/2,-size/2-unit,unit);
        ctx.fillStyle='#ff3131';ctx.fillRect(-size/2,size*.28,size,Math.max(4,size*.06));
      }
      const flash=entry.stage==='fuse'&&!reduced&&Math.floor(entry.age*7)%2===0;
      if(flash){ctx.fillStyle='#ffffff65';ctx.fillRect(-size/2,-size/2,size,size);}
      if(entry.stage==='fuse'){
        ctx.fillStyle='#251d16';ctx.fillRect(-3,-size/2-12,6,12);
        ctx.fillStyle='#ffbd31';ctx.fillRect(0,-size/2-16,5,5);
        if(kind==='nuke'){
          ctx.font='bold 35px Consolas,monospace';ctx.textAlign='center';ctx.fillStyle='#fff';
          ctx.fillText(String(Math.max(1,Math.ceil(entry.fuse||0))),0,10);ctx.textAlign='left';
        }
      }
    }
    function lightning(x,y,cell,reduced){
      const unit=Math.max(4,Math.round(cell/16));
      ctx.fillStyle='#7bbdff';
      for(let i=0;i<20;i++){
        const px=x+((Math.floor(i/3)%2)*3-1)*unit,py=y-i*cell/3;
        ctx.fillRect(px-unit,py,unit*3,cell/3+2);
      }
      ctx.fillStyle=reduced?'#c6eaff':'#fff5bf';
      for(let i=0;i<20;i++)ctx.fillRect(x+((Math.floor(i/3)%2)*3-1)*unit,y-i*cell/3,unit,cell/3+2);
    }
    function chargeAtEdge(entry){
      // A full-size charge may rest above a narrow opening; keep its actual fuse visible.
      const left=100,top=205,boxWidth=Math.min(410,width-left-195);
      ctx.save();ctx.fillStyle='#11151ced';ctx.fillRect(left,top,boxWidth,66);
      paint('tnt',entry.kind,left+8,top+8,48);
      ctx.fillStyle='#ffe177';ctx.font='bold 16px Consolas,monospace';ctx.textAlign='left';
      ctx.fillText('↑ '+entry.kind.toUpperCase()+' · ENTRADA',left+65,top+19,boxWidth-75);
      ctx.fillStyle='#fff';ctx.font='bold 14px Consolas,monospace';
      ctx.fillText(entry.stage==='fuse'?'MECHA '+Math.max(0,entry.fuse||0).toFixed(1)+'s':'CARGA SOBRE LA ENTRADA',left+65,top+39,boxWidth-75);
      ctx.fillStyle='#d1e4ba';ctx.font='bold 12px Consolas,monospace';ctx.fillText(credit(entry),left+65,top+57,boxWidth-75);ctx.restore();
    }
    function projectile(entry,cell,offset,cameraY,reduced){
      if(entry.delay>0)return;
      const center=entry.stage?0:.5,x=offset+(entry.x+center)*cell,y=(entry.y+center-cameraY)*cell;
      const age=entry.age||0,size=(entry.size||1)*cell,kind=entry.kind;
      if(['mega','nuke'].includes(kind)&&y+size/2<44){chargeAtEdge(entry);return;}
      if(y>height+size*2||y<-size*3)return;
      ctx.save();ctx.translate(x,y);
      if(['tnt','tnt_rain','rain','mega','nuke','jackpot'].includes(kind)){
        ctx.rotate(reduced||entry.grounded?0:entry.rotation||0);tnt(entry,size,reduced);
      }else if(kind==='creeper')creeper(size,age,entry.stage==='fuse'?entry.fuse||0:0,reduced);
      else if(kind==='meteor'){
        if(!reduced)for(let i=1;i<=4;i++){
          ctx.globalAlpha=(5-i)*.16;frame('fire',-size*.35,-size*(.4+i*.5),size*.7,age+i);
        }
        ctx.globalAlpha=1;paint('tile','magma',-size/2,-size/2,size,Math.floor(age*8));
      }else if(kind==='fire'){
        frame('fire',-size*.65,-size*.8,size*1.3,age);
        paint('tile','magma',-size*.28,-size*.12,size*.56);
      }else if(kind==='arrow'){
        ctx.rotate(Math.atan2(entry.vy||1,entry.vx||0)+Math.PI/4);
        frame('arrow',-size/2,-size/2,size);
      }else if(kind==='storm'){
        ctx.rotate(reduced?0:entry.rotation||0);frame('ice',-size/2,-size/2,size);
      }else if(kind==='thunder')lightning(0,0,cell,reduced);
      else if(kind==='tsunami'){
        ctx.globalAlpha=.8;
        for(let row=-2;row<=2;row++)for(let col=-1;col<=1;col++){
          frame('water',col*cell-cell/2,row*cell-cell/2,cell,age+row);
          if(row===-2){ctx.fillStyle='#c8f4ff';ctx.fillRect(col*cell-cell/2,row*cell-cell/2,cell,5);}
        }
      }else if(kind==='black_hole'){
        ctx.fillStyle='#24143b';ctx.fillRect(-size*.4,-size*.4,size*.8,size*.8);
        ctx.strokeStyle='#b077ed';ctx.lineWidth=6;ctx.strokeRect(-size*.5,-size*.5,size,size);
      }else frame('ice',-size/2,-size/2,size);
      ctx.restore();
      if(kind==='arrow'){
        const sx=offset+((entry.startX||0)+center)*cell,sy=((entry.startY||0)+center-cameraY)*cell;
        frame('dispenser',sx-cell*.35,sy-cell*.35,cell*.7);
      }
      label(entry,x,y-Math.min(size*.7,cell*2)-32);
    }
    function weather(weather,time,reduced,paused=false){
      if(!weather||weather.remaining<=0)return;
      const storm=weather.kind==='storm',clock=Number.isFinite(weather.elapsed)?weather.elapsed:paused?0:time;
      ctx.save();ctx.fillStyle=storm?'#18283944':'#28344833';ctx.fillRect(0,0,width,height);
      const rain=Textures.source('sprite','rain');
      if(rain){
        const frameY=reduced?0:(Math.floor(clock*8)%4)*64,shift=reduced?0:Math.floor(clock*110)%128;
        ctx.globalAlpha=storm?.7:.5;
        for(let y=-128+shift;y<height;y+=128)for(let x=0;x<width;x+=128)ctx.drawImage(rain,0,frameY,64,64,x,y,128,128);
      }else{
        ctx.fillStyle='#8dc8ff88';
        for(let i=0;i<60;i++){
          const x=(i*97+(storm&&!reduced?clock*70:0))%width,y=(i*131+(reduced?0:clock*340))%height;
          ctx.fillRect(x,y,3,18);
        }
      }
      if(storm){
        ctx.globalAlpha=.65;ctx.fillStyle='#d1e8f4';
        for(let i=0;i<7;i++){
          const x=reduced?40:(clock*180+i*167)%(width+200)-200,y=200+i*130;
          ctx.fillRect(x,y,100,3);ctx.fillRect(x+20,y+10,55,3);
        }
      }
      ctx.restore();label(weather,width/2,80);
    }
    function hazards(entries,cell,offset,cameraY){
      for(const entry of entries||[]){
        const x=offset+entry.x*cell,y=(entry.y-cameraY)*cell;
        if(y<-cell||y>height+cell)continue;
        ctx.save();ctx.globalAlpha=.8;
        for(let i=-1;i<=1;i++)frame('fire',x+i*cell*.55-cell*.35,y-cell*.6,cell*.7,entry.duration-entry.remaining+i);
        ctx.restore();
      }
    }
    function explosion(effect,cell,offset,cameraY,reduced){
      const p=clamp(effect.age/effect.duration,0,1),x=offset+(effect.x+.5)*cell,y=(effect.y+.5-cameraY)*cell;
      if(effect.kind==='thunder'){ctx.save();ctx.globalAlpha=1-p;lightning(x,y,cell,reduced);ctx.restore();return;}
      const radius=cell*(effect.kind==='nuke'?5:effect.kind==='mega'?3:1.4);
      ctx.save();ctx.globalAlpha=(1-p)*.8;
      const colors=effect.kind==='storm'?['#bfe7ff','#7fb4d7']:['#eeeeeb','#bbbcb8','#747670'];
      for(let i=0;i<12;i++){
        const angle=i*Math.PI*2/12,distance=radius*(reduced?.35:p),size=cell*(.3+(i%3)*.15)*(1-p*.7);
        ctx.fillStyle=colors[i%colors.length];ctx.fillRect(x+Math.cos(angle)*distance-size/2,y+Math.sin(angle)*distance-size/2,size,size);
      }
      ctx.restore();
    }
    function toolAura(buffs,x,y,cell,time,reduced){
      if(buffs.fast>0){
        ctx.fillStyle='#f4d341';
        for(let i=0;i<5;i++){
          const yOffset=reduced?i*10:((time*80+i*25)%90);
          ctx.fillRect(x-cell*.6-i*5,y-yOffset,6,6);ctx.fillRect(x+cell*.6+i*5,y-yOffset+16,4,4);
        }
      }
      if(buffs.spin>0){
        ctx.strokeStyle='#cba9ee';ctx.lineWidth=4;
        for(let i=0;i<3;i++)ctx.strokeRect(x-cell*.7+i*8,y-cell*.7+i*8,cell*1.4-i*16,cell*1.4-i*16);
      }
    }
    return {projectile,weather,hazards,explosion,toolAura,label};
  }
  return {createPainter};
});

(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./textures.js'));
  else root.BlockWarsEffectsRender=factory(root.BlockWarsTextures);
})(typeof globalThis!=='undefined'?globalThis:this,function(Textures){
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const MAX_DETAILED_CLOUDS=6;
  const MAX_PARTICLE_DRAWS=96;
  function createPainter(ctx,paint,width,height){
    let cloudsLeft=MAX_DETAILED_CLOUDS,particleDrawsLeft=MAX_PARTICLE_DRAWS;
    function beginFrame(){cloudsLeft=MAX_DETAILED_CLOUDS;particleDrawsLeft=MAX_PARTICLE_DRAWS;}
    function credit(entry){
      const actor=entry.source==='youtube'?
        Array.from(String(entry.actor||'LA COMUNIDAD').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'')).slice(0,44).join(''):
        String(entry.actor||'LA COMUNIDAD').replace(/[\x00-\x1f\x7f<>]/g,'').slice(0,32);
      return entry.source==='automatic'?'LA MINA':
        entry.source==='simulator'||entry.source==='operator'?'PRUEBA · '+actor:
        actor;
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
    function ultraBody(entry,size){
      const subscriber=entry.rewardVariant==='subscriber',asset=subscriber?'nuke_subscriber':'nuke_like';
      const original=Textures.source('sprite',asset);
      if(subscriber){
        // Tall warhead with stepped nose, narrow reactor hull and four block fins.
        ctx.fillStyle='#22392d';ctx.fillRect(-size*.22,-size*.48,size*.44,size*.94);
        ctx.fillStyle='#b5c5a0';ctx.fillRect(-size*.1,-size*.7,size*.2,size*.12);ctx.fillRect(-size*.16,-size*.58,size*.32,size*.12);
        ctx.fillStyle='#486e44';ctx.fillRect(-size*.38,size*.25,size*.16,size*.3);ctx.fillRect(size*.22,size*.25,size*.16,size*.3);
        if(original)paint('sprite',asset,-size*.26,-size*.35,size*.52);
        else{ctx.fillStyle='#82d177';ctx.fillRect(-size*.14,-size*.3,size*.28,size*.44);ctx.fillStyle='#16241b';ctx.fillRect(-size*.18,-size*.04,size*.36,size*.08);}
        ctx.fillStyle='#9fe4e7';ctx.fillRect(-size*.13,size*.49,size*.26,size*.12);ctx.fillStyle='#d6ffeb';ctx.fillRect(-size*.07,size*.61,size*.14,size*.13);
      }else{
        // Nuclear cube has a broad front, heavy side plating and a raised lid.
        ctx.fillStyle='#9b671d';ctx.fillRect(-size*.43,-size*.34,size*.86,size*.78);
        ctx.fillStyle='#f0cc37';ctx.fillRect(-size*.4,-size*.45,size*.74,size*.12);
        ctx.fillStyle='#523e23';ctx.fillRect(size*.32,-size*.34,size*.12,size*.78);
        if(original)paint('sprite',asset,-size*.4,-size*.34,size*.74);
        else{ctx.fillStyle='#edc734';ctx.fillRect(-size*.34,-size*.28,size*.6,size*.6);ctx.fillStyle='#25291c';for(const [x,y]of [[-.22,-.16],[.08,-.16],[-.06,.1]])ctx.fillRect(size*x,size*y,size*.15,size*.15);}
      }
      if(!original){ctx.font='bold '+Math.max(9,Math.floor(size*.07))+'px Consolas,monospace';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('RESPALDO',0,size*.27);ctx.textAlign='left';}
    }
    function tnt(entry,size,reduced){
      const kind=entry.kind;
      if(kind==='nuke'&&['like','subscriber'].includes(entry.rewardVariant)){ultraBody(entry,size);return;}
      const variant=Number.isInteger(entry.variantIndex)?entry.variantIndex%3:0;
      if(kind==='nuke')ctx.filter=['hue-rotate(35deg) saturate(1.7)','hue-rotate(170deg) saturate(1.7)','hue-rotate(275deg) saturate(1.7)'][variant];
      else if(kind==='tnt')ctx.filter=['none','hue-rotate(210deg) saturate(1.4)','hue-rotate(100deg) saturate(1.4)'][variant];
      else if(kind==='mega')ctx.filter='hue-rotate(35deg) saturate(1.5)';
      paint('tnt',kind==='rain'||kind==='tnt_rain'?'tnt':kind,-size/2,-size/2,size);
      ctx.filter='none';
      if(kind==='nuke'){
        const unit=size/12;
        ctx.fillStyle=['#ffc936','#37e8ff','#d56dff'][variant];
        ctx.fillRect(-size/2,-size/2,size,unit);ctx.fillRect(-size/2,size/2-unit,size,unit);
        for(let i=0;i<=variant;i++)ctx.fillRect(-size*.2+i*unit*2,size*.26,unit,unit);
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
      chargeGroup([entry],0);
    }
    function chargeGroup(entries,slot){
      const shown=entries.slice(0,10),entry=shown[0];if(!entry)return;
      const left=205,top=350+slot*68,boxWidth=Math.min(330,width-left-160);
      ctx.save();ctx.fillStyle='#11151cbd';ctx.fillRect(left,top,boxWidth,62);
      ctx.fillStyle='#ffe177';ctx.font='bold 13px Consolas,monospace';ctx.textAlign='left';
      const fuse=Math.min(...shown.filter(item=>item.landed||item.stage==='fuse').map(item=>Math.max(0,item.fuse||0)));
      ctx.fillText('↑ '+(entry.rewardVariant?'ULTRANUKE':entry.kind.toUpperCase())+' ×'+entries.length+(Number.isFinite(fuse)?' · MECHA '+fuse.toFixed(1)+'s':''),left+8,top+16,boxWidth-16);
      for(let i=0;i<shown.length;i++){
        ctx.save();ctx.translate(left+19+i*27,top+36);tnt(shown[i],24,true);ctx.restore();
      }
      ctx.fillStyle='#d1e4ba';ctx.font='bold 11px Consolas,monospace';ctx.fillText(credit(entry),left+8,top+58,boxWidth-16);ctx.restore();
    }
    function projectile(entry,cell,offset,cameraY,reduced){
      if(entry.delay>0)return;
      const center=entry.stage?0:.5,x=offset+(entry.x+center)*cell,y=(entry.y+center-cameraY)*cell;
      const age=entry.age||0,size=(entry.size||1)*cell,kind=entry.kind;
      if(['mega','nuke'].includes(kind)&&y+size/2<44){chargeAtEdge(entry);return;}
      if(y>height+size*2||y<-size*3)return;
      ctx.save();ctx.translate(x,y);
      if(entry.stage==='pickaxe'){
        ctx.rotate(reduced?-.3:entry.rotation||0);paint('tool',entry.pickaxe||'diamond',-size/2,-size/2,size);
      }else if(kind==='sixty_seven'){
        ctx.rotate(reduced?0:entry.rotation||0);
        const rows=entry.digit===7?['11111','00011','00110','00110','01100','01100','01100']:['11110','11000','11000','11110','11011','11011','11110'],unit=size/7;
        ctx.fillStyle=entry.digit===7?'#6ae6ff':'#ffdf42';
        for(let row=0;row<rows.length;row++)for(let col=0;col<5;col++)if(rows[row][col]==='1')ctx.fillRect((col-2.5)*unit,(row-3.5)*unit,unit,unit);
      }else if(kind==='messi'){
        ctx.rotate(reduced?0:entry.rotation||0);const unit=size/8;
        for(let row=0;row<8;row++)for(let col=0;col<8;col++){
          if((row===0||row===7)&&(col<2||col>5)||(row===1||row===6)&&(col===0||col===7))continue;
          ctx.fillStyle=((row>=3&&row<=4&&col>=3&&col<=4)||(row+col)%5===0)?'#18211e':'#f3f3e8';
          ctx.fillRect((col-4)*unit,(row-4)*unit,unit,unit);
        }
      }else if(kind==='siuuu'){
        const unit=size/16;ctx.fillStyle='#271e24';ctx.fillRect(-4*unit,-8*unit,8*unit,6*unit);
        ctx.fillStyle='#d9a778';ctx.fillRect(-3*unit,-7*unit,6*unit,5*unit);
        ctx.fillStyle='#eff8f1';ctx.fillRect(-4*unit,-2*unit,8*unit,8*unit);ctx.fillRect(-10*unit,-3*unit,6*unit,3*unit);ctx.fillRect(4*unit,-3*unit,6*unit,3*unit);
        ctx.fillStyle='#66cadd';ctx.fillRect(-3*unit,0,6*unit,2*unit);
        ctx.fillStyle='#19344b';ctx.fillRect(-5*unit,6*unit,4*unit,4*unit);ctx.fillRect(unit,6*unit,4*unit,4*unit);
      }else if(['tnt','tnt_rain','rain','mega','nuke','jackpot'].includes(kind)){
        ctx.rotate(reduced?0:entry.rotation||0);tnt(entry,size,reduced);
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
      if(effect.kind==='thunder'){ctx.save();ctx.globalAlpha=1-p;lightning(x,y,cell,reduced);ctx.restore();if(effect.source==='youtube')label(effect,x,y-cell-32);return;}
      const radius=cell*(effect.blastRadius|| (effect.kind==='nuke'?5.5:effect.kind==='mega'?4:1.4));
      const originalParticles=['tnt','tnt_rain','mega','nuke','sixty_seven','creeper'].includes(effect.kind)&&particleBurst(effect,x,y,cell,reduced);
      if(originalParticles&&['tnt','tnt_rain','sixty_seven','creeper'].includes(effect.kind)){
        if(effect.source==='youtube')label(effect,x,y-cell-32);return;
      }
      if(effect.kind==='nuke'&&['like','subscriber'].includes(effect.rewardVariant)){
        ultraCloud(effect,x,y,cell,radius,p,reduced);return;
      }
      if(effect.kind==='siuuu'){
        ctx.save();ctx.globalAlpha=(1-p)*.85;ctx.fillStyle='#e6fbf7';
        for(let i=0;i<(reduced?10:30);i++){const a=Math.PI+i*Math.PI/(reduced?9:29),r=radius*(reduced?.4:p),unit=cell*.2;ctx.fillRect(x+Math.cos(a)*r,y+Math.sin(a)*r,unit,unit);}
        ctx.restore();if(effect.source==='youtube')label(effect,x,y-cell-32);return;
      }
      ctx.save();ctx.globalAlpha=(1-p)*.8;
      const colors=effect.kind==='storm'?['#bfe7ff','#7fb4d7']:effect.kind==='nuke'?['#fffbe7',['#ffc936','#37e8ff','#d56dff'][effect.variantIndex%3||0],'#999a96']:effect.kind==='mega'?['#fffce6','#ffca58','#999a96']:['#eeeeeb','#bbbcb8','#747670'];
      const count=effect.kind==='nuke'?28:effect.kind==='mega'?20:12;
      const fronts=reduced?1:3;
      for(let i=0;i<count*fronts;i++){
        const front=Math.floor(i/count),angle=(i%count)*Math.PI*2/count+front*.13,distance=radius*(reduced?.35:clamp(p*1.5-front*.15,0,1)),size=cell*(.3+(i%3)*.15)*(1-p*.7)*(1-front*.15);
        ctx.fillStyle=colors[i%colors.length];ctx.fillRect(x+Math.cos(angle)*distance-size/2,y+Math.sin(angle)*distance-size/2,size,size);
      }
      ctx.restore();if(effect.source==='youtube')label(effect,x,y-cell-32);
    }
    function particleBurst(effect,x,y,cell,reduced){
      const age=Math.max(0,effect.age||0),smokeLife=Math.min(1.6,effect.duration||1.6),explosionFrame=Math.min(15,Math.floor(age*20)),smokeFrame=Math.min(7,Math.floor(age/smokeLife*8));
      const burst=Textures.source('particle','particle_explosion_'+explosionFrame),smoke=Textures.source('particle','particle_smoke_'+smokeFrame);
      if(!burst&&!smoke)return false;
      const powerful=['mega','nuke'].includes(effect.kind),count=reduced?1:powerful?12:8;
      ctx.save();ctx.imageSmoothingEnabled=false;
      function draw(image,px,py,size,alpha,filter){
        if(!image||particleDrawsLeft<=0)return;
        if(px+size/2<0||px-size/2>width||py+size/2<0||py-size/2>height)return;
        particleDrawsLeft--;ctx.globalAlpha=alpha;ctx.filter=filter;
        ctx.drawImage(image,0,0,image.width,image.height,px-size/2,py-size/2,size,size);
      }
      for(let i=0;i<count&&particleDrawsLeft>0;i++){
        const angle=i*2.399963+((effect.variantIndex||0)*.3),distance=reduced?0:cell*(powerful?2.2:1.1)*(.2+age*.8)*(i%3+1)/3;
        const px=x+Math.cos(angle)*distance,py=y+Math.sin(angle)*distance;
        if(age<.8)draw(burst,px,py,cell*(powerful?2.1:1.25),reduced?.65:.9,'none');
        if(age<smokeLife)draw(smoke,px,py-(reduced?0:age*cell*.7),cell*(.7+age*.65),Math.max(0,(1-age/smokeLife)*.65),'brightness(.45)');
      }
      ctx.restore();return true;
    }
    function ultraCloud(effect,x,y,cell,radius,p,reduced){
      const subscriber=effect.rewardVariant==='subscriber',primary=subscriber?'#9bddaa':'#ffda64',smoke=subscriber?'#4b6853':'#716550';
      const detailed=!effect.shockwaveIndex&&cloudsLeft>0;
      if(detailed)cloudsLeft--;
      const fronts=reduced||!detailed?1:subscriber?5:4,count=reduced?16:detailed?32:12;
      ctx.save();ctx.globalAlpha=Math.max(0,1-p)*.7;
      for(let front=0;front<fronts;front++)for(let i=0;i<count;i++){
        const a=i*Math.PI*2/count+front*.17,distance=radius*(reduced?.35:clamp(p*2-front*.12,0,1)),unit=cell*(.3+(i%3)*.14);
        ctx.fillStyle=i%3===0?'#f3f1d4':i%3===1?primary:smoke;ctx.fillRect(x+Math.cos(a)*distance-unit/2,y+Math.sin(a)*distance-unit/2,unit,unit);
      }
      if(detailed){
        const growth=reduced?1:clamp(.35+p*2,0,1),top=y-Math.min(620,radius*.8)*growth,cap=Math.min(width*.85,radius*.9)*growth,unit=cell*.22;
        // A persistent stepped mushroom cap and stem; no full-screen flash.
        ctx.globalAlpha=(1-p)*.65;ctx.fillStyle=smoke;
        for(let row=0;row<8;row++)ctx.fillRect(x-cap*(row<3?.65:.3),top+row*unit,cap*(row<3?1.3:.6),unit+1);
        ctx.fillStyle=primary;
        for(let row=0;row<6;row++){
          const half=cap*(row===0?.3:row<4?.5:.38);ctx.fillRect(x-half,top+row*unit,half*2,unit+1);
        }
        ctx.fillStyle='#dad7bc';for(let row=7;row<16;row++)ctx.fillRect(x-cap*.13,top+row*unit,cap*.26,unit+1);
        if(!reduced)for(let i=0;i<24;i++){ctx.fillStyle=i%2?primary:'#6a7765';const a=i*2.4,travel=radius*p*.7;ctx.fillRect(x+Math.cos(a)*travel,y-Math.abs(Math.sin(a))*travel,unit*.6,unit*.6);}
      }
      ctx.restore();if(effect.source==='youtube')label(effect,x,y-cell-32);
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
    return {beginFrame,projectile,weather,hazards,explosion,toolAura,label,chargeGroup};
  }
  return {createPainter};
});

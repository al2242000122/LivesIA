(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlockWarsRender = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const palette = { soil: ['#765347', '#a17858', '#4c3534'], stone: ['#454c59', '#687180', '#2c333f'], crystal: ['#385a64', '#71c5cb', '#273b4d'], gold: ['#66563d', '#f3c367', '#443b31'], obsidian: ['#393546', '#75618b', '#252231'], magma: ['#684540', '#e58c5d', '#3e2e32'] };
  function createRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    const W = canvas.width, H = canvas.height;
    function pickaxe(x, y, team, time, reduced) {
      const config = typeof BlockWarsConfig !== 'undefined' ? BlockWarsConfig.PICKAXES : {};
      const appearance = (config[team.pickaxe] || {}).appearance || {};
      const ink = appearance.color || '#d1a774';
      const motion = reduced ? -.35 : Math.sin(time * Math.min(18, 4 + team.effectiveSpeed)) * .5 - .3;
      const giant = team.buffs && team.buffs.descomunal > 0;
      ctx.save();ctx.translate(x, y - 8);ctx.rotate(motion);ctx.scale(giant ? 1.5 : 1, giant ? 1.5 : 1);
      ctx.strokeStyle='#10171d';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-10,17);ctx.lineTo(13,-15);ctx.stroke();
      ctx.strokeStyle=appearance.handle || '#cca479';ctx.lineWidth=5;ctx.stroke();
      ctx.fillStyle='#10171d';ctx.beginPath();ctx.moveTo(-9,-21);ctx.lineTo(9,-27);ctx.lineTo(26,-20);ctx.lineTo(31,-5);ctx.lineTo(19,-12);ctx.lineTo(10,-16);ctx.lineTo(-8,-14);ctx.closePath();ctx.fill();
      ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(-8,-19);ctx.lineTo(9,-24);ctx.lineTo(24,-18);ctx.lineTo(27,-10);ctx.lineTo(11,-19);ctx.lineTo(-8,-16);ctx.closePath();ctx.fill();
      if(appearance.shape==='square'){ctx.fillRect(-9,-21,9,8);ctx.fillRect(20,-18,8,7);}
      if(appearance.shape==='fork'){ctx.fillRect(-13,-20,8,3);ctx.fillRect(-13,-15,8,3);}
      if(appearance.shape==='diamond'){ctx.beginPath();ctx.moveTo(10,-29);ctx.lineTo(17,-22);ctx.lineTo(10,-15);ctx.lineTo(3,-22);ctx.closePath();ctx.fill();}
      if(appearance.shape==='double'){ctx.fillRect(-10,-13,19,4);ctx.fillRect(19,-20,10,5);}
      ctx.fillStyle='#ffffff88';ctx.fillRect(8,-24,7,2);ctx.restore();
    }
    function draw(state, options) {
      options = options || {};
      const time = options.time || 0, reduced = Boolean(options.reducedMotion);
      const cw=W/state.width, ch=H/state.height;
      ctx.clearRect(0,0,W,H);ctx.fillStyle='#10171d';ctx.fillRect(0,0,W,H);
      for (let y=0;y<state.height;y++) for(let x=0;x<state.width;x++) {
        const block=state.blocks[y*state.width+x],px=x*cw,py=y*ch;
        const n=((x*73856093 ^ y*19349663)>>>0)%11;
        if (!block) {
          ctx.fillStyle=x<state.width/2?'#191b2b':'#16282a';ctx.fillRect(px+1,py+1,cw-2,ch-2);
          ctx.fillStyle='#ffffff07';ctx.fillRect(px+4+n,py+9,cw/5,2);continue;
        }
        const colors=palette[block.material]||palette.stone;
        ctx.fillStyle=colors[2];ctx.fillRect(px+1,py+1,cw-1,ch-1);
        ctx.fillStyle=colors[0];ctx.fillRect(px+1,py+1,cw-3,ch-4);
        ctx.fillStyle=n<4?'#ffffff0b':'#00000010';ctx.fillRect(px+3,py+3,cw-7,ch-8);
        ctx.fillStyle=colors[1];ctx.globalAlpha=.3;ctx.fillRect(px+1,py+1,cw-3,2);ctx.fillRect(px+1,py+1,2,ch-4);ctx.globalAlpha=1;
        if (block.material!=='soil'&&block.material!=='stone'&&block.material!=='obsidian') {
          ctx.fillStyle=colors[1];ctx.fillRect(px+7+n%5,py+7,6,6);ctx.fillRect(px+17,py+18-n%4,5,5);ctx.fillStyle='#ffffff77';ctx.fillRect(px+7+n%5,py+7,3,2);
        } else {ctx.fillStyle='#00000026';ctx.fillRect(px+6+n,py+10,7,2);ctx.fillRect(px+7,py+22-n,3,2);}
        if(block.hp<block.maxHp){
          const damage=1-block.hp/block.maxHp;
          ctx.strokeStyle='#0a0e17';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px+cw*.5,py+2);ctx.lineTo(px+cw*.4,py+ch*.4);ctx.lineTo(px+cw*.65,py+ch*.6);ctx.lineTo(px+cw*.45,py+ch-3);
          if(damage>.5){ctx.moveTo(px+cw*.4,py+ch*.4);ctx.lineTo(px+3,py+ch*.6);ctx.moveTo(px+cw*.65,py+ch*.6);ctx.lineTo(px+cw-3,py+ch*.3);}ctx.stroke();
        }
      }
      ctx.save();ctx.setLineDash([3,8]);ctx.lineWidth=1;ctx.strokeStyle='#d0d7e227';ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.restore();
      for (const effect of (state.effects||[]).slice(-32)) {
        const p=Math.min(1,Math.max(0,effect.age/effect.duration));
        const x=(effect.x+.5)*cw,y=(effect.y+.5)*ch;
        const radius=(effect.kind==='nuke'?8:effect.kind==='meteor'?4:2.8)*cw;
        ctx.save();ctx.globalAlpha=(1-p)*.7;ctx.strokeStyle=effect.kind==='nuke'?'#f4cc81':'#b4eddf';ctx.lineWidth=effect.kind==='nuke'?4:2;
        ctx.beginPath();ctx.arc(x,y,reduced?radius*.6:Math.max(2,radius*p),0,Math.PI*2);ctx.stroke();
        if(p<.6&&['tnt','nuke','meteor'].includes(effect.kind)){
          ctx.fillStyle='#20262c';ctx.fillRect(x-19,y-10,38,20);ctx.fillStyle='#f4cc81';ctx.textAlign='center';ctx.font='11px Consolas,monospace';ctx.fillText(effect.kind==='meteor'?'◆':effect.kind.toUpperCase(),x,y+4);ctx.textAlign='left';
        }
        if(effect.kind==='meteor'&&!reduced){ctx.strokeStyle='#db9e7b';ctx.beginPath();ctx.moveTo(x-30*(1-p),y-85*(1-p));ctx.lineTo(x,y);ctx.stroke();}
        ctx.restore();
      }
      if(!reduced)for(const particle of (state.particles||[]).slice(-180)){
        ctx.globalAlpha=Math.min(1,Math.max(0,particle.life));ctx.fillStyle=particle.color||'#c7ba98';ctx.fillRect(particle.x*cw,particle.y*ch,3,3);
      }
      ctx.globalAlpha=1;
      for (const key of ['dark','light']) {
        const team=state.teams[key];if(!team.target)continue;
        const x=(team.target.x+.5)*cw,y=(team.target.y+.5)*ch;
        ctx.strokeStyle=key==='dark'?'#bd9cff':'#8ff7df';ctx.lineWidth=2;ctx.strokeRect(team.target.x*cw+1,team.target.y*ch+1,cw-2,ch-2);
        ctx.fillStyle=key==='dark'?'#bd9cff':'#8ff7df';ctx.fillRect(x-12,y+14,24*Math.min(1,team.progress||0),2);
        pickaxe(x,y,team,state.paused?0:time,reduced||state.paused);
      }
      if(state.phase==='summary'||state.paused){
        ctx.fillStyle='#10151de0';ctx.fillRect(0,H*.39,W,H*.22);ctx.textAlign='center';ctx.fillStyle='#bac7c8';ctx.font='12px Consolas,monospace';ctx.fillText(state.paused?'CONTROL DEL OPERADOR':'RONDA COMPLETA',W/2,H*.44);
        ctx.fillStyle=state.result==='dark'?'#c4a6ff':state.result==='light'?'#9dfbe9':'#ffd184';ctx.font='48px Impact,sans-serif';
        ctx.fillText(state.paused?'EN PAUSA':state.result==='tie'?'EMPATE':(state.result||'').toUpperCase()+' GANA',W/2,H*.51);
        ctx.fillStyle='#bac7c8';ctx.font='12px Consolas,monospace';ctx.fillText(state.paused?'La arena está congelada':'NUEVA EXCAVACIÓN EN PREPARACIÓN',W/2,H*.56);ctx.textAlign='left';
      }
    }
    return {draw};
  }
  return {createRenderer};
});

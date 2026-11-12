(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config.js'),require('./physics.js'));
  else root.BlockWarsEngine = factory(root.BlockWarsConfig,root.BlockWarsPhysics);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (config,physics) {
  'use strict';
  if (!config) throw new Error('Load BlockWarsConfig before BlockWarsEngine');
  const {PICKAXES,MATERIALS,EFFICIENCY,BUFFS,EVENTS,LIMITS} = config;
  const TEAM_IDS = ['dark','light'];
  const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const integer = (value,min,max) => Number.isInteger(value) && value>=min && value<=max;
  const plain = value => {
    if (!value || typeof value!=='object' || Array.isArray(value)) return false;
    const prototype=Object.getPrototypeOf(value);
    return prototype===null || Object.getPrototypeOf(prototype)===null;
  };
  function rng(seed) {
    let value = seed >>> 0;
    return function () {
      value = (value+0x6D2B79F5)>>>0;
      let x = value;
      x = Math.imul(x ^ x >>> 15,x | 1);
      x ^= x + Math.imul(x ^ x >>> 7,x | 61);
      return ((x ^ x >>> 14) >>> 0) / 4294967296;
    };
  }
  const validSeed = seed => integer(seed,0,0xFFFFFFFF);
  function createEngine(options = {}) {
    if (!plain(options) || Object.keys(options).some(key=>
      !['seed','width','height','duration','eventInterval','reducedMotion','layout'].includes(key))) {
      throw new TypeError('Invalid engine options');
    }
    const settings = {seed:20261110,width:20,height:25,duration:180,eventInterval:60,reducedMotion:false,layout:'arena',
      ...(options.layout==='endless'?{width:7,height:40}:{}),...options};
    if (!validSeed(settings.seed) || !integer(settings.width,4,40) || !integer(settings.height,4,40) ||
        settings.width*settings.height>LIMITS.maxCells || !['arena','shaft','endless'].includes(settings.layout) ||
        settings.layout==='endless' && (!physics || settings.height<32) || !validSettings(settings)) {
      throw new RangeError('Invalid engine configuration');
    }
    let random,visualRandom,baseSeed=settings.seed,summaryRemaining=0,remainingBlocks=0,shaftReachedFloor=false;
    const state = {};

    function makeTeam() {
      const clocks=()=>Object.fromEntries(Object.keys(BUFFS).map(key=>[key,0]));
      return {score:0,blocks:0,pickaxe:'wood',durability:PICKAXES.wood.durability,
        efficiency:0,unbreaking:0,fortune:0,progress:0,target:null,effectiveSpeed:0.6,
        unlocked:['wood'],buffs:clocks(),cooldowns:clocks(),
        inventory:{wood:PICKAXES.wood.durability}};
    }
    function updateSpeed(team) {
      let speed=PICKAXES[team.pickaxe].baseSpeed*EFFICIENCY[team.efficiency];
      for(const [key,buff] of Object.entries(BUFFS)) if(team.buffs[key]>0) speed*=buff.multiplier;
      team.effectiveSpeed=Math.round(Math.min(LIMITS.maxSpeed,speed)*1e9)/1e9;
    }
    function makeWorld(round) {
      const worldRandom=rng((baseSeed+Math.imul(round-1,0x9e3779b9))>>>0);
      if(settings.layout!=='arena') return makeShaft(worldRandom);
      const blocks=new Array(settings.width*settings.height);
      for (let y=0;y<settings.height;y++) {
        for (let x=0;x<Math.ceil(settings.width/2);x++) {
          const depth=y/settings.height, roll=worldRandom();
          let material=depth<0.16?'soil':depth<0.65?'stone':'obsidian';
          if (y>1 && roll<0.09) material='crystal';
          else if (y>1 && roll<0.2) material='gold';
          else if (depth>0.65 && roll>0.8) material='magma';
          const data=MATERIALS[material];
          const block={material,hp:data.hardness,maxHp:data.hardness,value:data.value};
          blocks[y*settings.width+x]={...block};
          blocks[y*settings.width+settings.width-1-x]={...block};
        }
      }
      return blocks;
    }
    function makeShaft(worldRandom) {
      const blocks=[],ores=['coal','iron','gold','redstone','lapis','copper','emerald','diamond'];
      const patches=['granite','diorite','andesite','moss'];
      const startX=Math.floor(settings.width/2)-1;
      for(let y=0;y<settings.height;y++) for(let x=0;x<settings.width;x++) {
        const roll=worldRandom();
        let material='stone';
        if(roll<0.29) material=ores[Math.floor(worldRandom()*ores.length)];
        else if(roll<0.51) material=patches[(Math.floor(y/3)+Math.floor(x/2))%patches.length];
        else if(y>settings.height*0.65 && roll>0.94) material='obsidian';
        const data=MATERIALS[material];
        const sky=y<Math.min(8,settings.height-1) && (x===startX || x===startX+1);
        blocks.push(sky?null:{material,hp:data.hardness,maxHp:data.hardness,value:data.value});
      }
      return blocks;
    }
    function startRound(round) {
      state.blocks=makeWorld(round);
      state.teams={dark:makeTeam(),light:makeTeam()};
      state.round=round;
      state.phase='playing';
      state.result=null;
      state.remaining=settings.duration;
      state.roundDuration=settings.duration;
      state.nextEventIn=settings.eventInterval;
      state.queue.length=0;
      state.entities.length=0;
      state.particles.length=0;
      state.effects.length=0;
      state.lastEvent=null;
      state.activeEvent=null;
      state.elapsed=0;
      state.rowOffset=0;
      if(state.layout==='endless'){
        state.body=physics.createBody(state.width);
        state.body.y=Math.min(4.5,state.height-2);
        state.remaining=0;
      }
      state.eventCooldowns=Object.fromEntries(Object.keys(EVENTS).map(key=>[key,{dark:0,light:0}]));
      remainingBlocks=state.blocks.filter(Boolean).length;
      shaftReachedFloor=false;
      for (const id of TEAM_IDS) chooseTarget(id);
      updateFocus();
    }
    function reset(seed=baseSeed) {
      if (!validSeed(seed)) return false;
      baseSeed=seed;
      settings.seed=seed;
      random=rng(seed ^ 0xa341316c);
      visualRandom=rng(seed ^ 0xc8013ea4);
      Object.assign(state,{width:settings.width,height:settings.height,paused:false,
        layout:settings.layout,queue:[],entities:[],effects:[],particles:[],nukeCooldown:0,eventCount:0,
        config:{duration:settings.duration,eventInterval:settings.eventInterval,reducedMotion:settings.reducedMotion}});
      summaryRemaining=0;
      startRound(1);
      return true;
    }
    function chooseTarget(id) {
      const team=state.teams[id],half=Math.ceil(state.width/2);
      if(state.layout==='endless'){
        const body=state.body;
        team.target={x:Math.max(0,Math.min(state.width-1,Math.floor(body.x))),y:Math.max(0,Math.min(state.height-1,Math.floor(body.y+body.radius)))};
        return team.target.y*state.width+team.target.x;
      }
      if(state.layout==='shaft') return chooseShaftTarget(id);
      // Each side has a mirrored preferred lane; empty halves may cross the frontier.
      for (let pass=0;pass<2;pass++) {
        for (let y=0;y<state.height;y++) {
          for (let offset=0;offset<state.width;offset++) {
            const x=id==='dark'?offset:state.width-1-offset;
            const preferred=id==='dark'?x<half:x>=Math.floor(state.width/2);
            if ((pass===0)!==preferred || !state.blocks[y*state.width+x]) continue;
            team.target={x,y};
            return y*state.width+x;
          }
        }
      }
      team.target=null;
      team.progress=0;
      return -1;
    }
    function chooseShaftTarget(id) {
      // Explore only sky connected to the initial opening: no teleport through solid rock.
      const startX=Math.floor(state.width/2)-1;
      const pending=[startX],seen=new Uint8Array(state.blocks.length);
      seen[startX]=1;
      let best=-1,bestScore=-Infinity;
      const center=(state.width-1)/2+(id==='dark'?-0.6:0.6);
      for(let cursor=0;cursor<pending.length;cursor++) {
        const index=pending[cursor],x=index%state.width,y=Math.floor(index/state.width);
        // A blast can open the connected floor before either miner targets it.
        if(y===state.height-1){shaftReachedFloor=true;break;}
        for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
          if(nx<0 || nx>=state.width || ny<0 || ny>=state.height) continue;
          const next=ny*state.width+nx;
          if(seen[next]) continue;
          seen[next]=1;
          if(!state.blocks[next]) {pending.push(next);continue;}
          const other=state.teams[id==='dark'?'light':'dark'].target;
          const occupied=other && other.x===nx && other.y===ny;
          const buffs=state.teams[id].buffs;
          const sway=buffs.butterfly>0?Math.sin(state.elapsed*2)*1.2:
            buffs.spin>0?Math.sin(state.elapsed*6)*1.6:0;
          const score=ny-Math.abs(nx-center-sway)*1.7-(occupied?2.5:0);
          if(score>bestScore) {bestScore=score;best=next;}
        }
      }
      const team=state.teams[id];
      if(shaftReachedFloor){team.target=null;team.progress=0;return -1;}
      team.target=best<0?null:{x:best%state.width,y:Math.floor(best/state.width)};
      if(best<0) team.progress=0;
      return best;
    }
    function updateFocus() {
      if(state.layout==='endless'){
        for(const id of TEAM_IDS)chooseTarget(id);
        state.focus={x:Math.floor(state.body.x),y:Math.floor(state.body.y),team:state.body.team};
        return;
      }
      let selected='dark';
      const dark=state.teams.dark.target,light=state.teams.light.target;
      if(!dark || light && light.y>dark.y) selected='light';
      const active=state.activeEvent;
      if(active && own(BUFFS,active.kind) && state.teams[active.team].target) selected=active.team;
      const target=state.teams[selected].target;
      state.focus={x:target?.x ?? Math.floor(state.width/2),y:target?.y ?? state.height-1,team:selected};
    }
    function equip(team,id) {
      team.inventory[team.pickaxe]=team.durability;
      if (!team.unlocked.includes(id)) team.unlocked.push(id);
      if (!own(team.inventory,id) || team.inventory[id]<=0) team.inventory[id]=PICKAXES[id].durability;
      team.pickaxe=id;
      team.durability=team.inventory[id];
      updateSpeed(team);
    }
    function wear(team) {
      if(team.buffs.butterfly>0) return;
      if (random()<1/(team.unbreaking+1)) {
        team.durability=Math.max(0,team.durability-(team.buffs.demon>0?2:1));
        team.inventory[team.pickaxe]=team.durability;
      }
      if (team.durability>0) return;
      const replacement=Object.keys(PICKAXES).reverse().find(id=>team.unlocked.includes(id) && team.inventory[id]>0);
      // Unlimited free wooden replacements guarantee unattended mining never stalls.
      equip(team,replacement || 'wood');
    }
    function unlock(team) {
      const order=Object.keys(PICKAXES);
      for (const [id,pick] of Object.entries(PICKAXES)) {
        if (team.blocks<pick.unlockRule || team.unlocked.includes(id)) continue;
        team.unlocked.push(id);
        team.inventory[id]=pick.durability;
        if(order.indexOf(id)>order.indexOf(team.pickaxe)) equip(team,id);
      }
    }
    function particleBurst(x,y,material) {
      if (settings.reducedMotion) return;
      for(let i=0;i<3 && state.particles.length<LIMITS.maxParticles;i++) {
        state.particles.push({x:x+0.5,y:y+0.5,vx:(visualRandom()-0.5)*3,
          vy:-visualRandom()*3,life:0.4+visualRandom()*0.5,color:MATERIALS[material].color});
      }
    }
    function destroy(index,id,mined,multiplier=1) {
      const block=state.blocks[index];
      if (!block) return;
      const team=state.teams[id];
      const ore=block.material==='crystal' || block.material==='gold' || MATERIALS[block.material].ore;
      const bonus=mined && ore ? Math.floor(random()*(team.fortune+1)) : 0;
      const buffBonus=mined && (team.buffs.demon>0 || team.buffs.rainbow>0 && ore)?2:1;
      team.score=Math.min(LIMITS.maxScore,team.score+block.value*(1+bonus)*multiplier*buffBonus);
      team.blocks=Math.min(state.layout==='endless'?LIMITS.maxScore:state.width*state.height,team.blocks+1);
      state.blocks[index]=null;
      remainingBlocks--;
      particleBurst(index%state.width,Math.floor(index/state.width),block.material);
      if (mined) wear(team);
      unlock(team);
    }
    function mine(id,dt,budget) {
      if(shaftReachedFloor)return;
      const team=state.teams[id];
      team.progress=Math.min(LIMITS.maxProgress,team.progress+team.effectiveSpeed*dt);
      while (team.progress>1e-10 && budget.remaining>0) {
        let index=team.target?team.target.y*state.width+team.target.x:-1;
        if (index<0 || !state.blocks[index]) index=chooseTarget(id);
        if(index<0) return;
        const block=state.blocks[index];
        const damage=Math.min(block.hp,team.progress);
        block.hp=Math.max(0,block.hp-damage);
        team.progress=Math.max(0,team.progress-damage);
        budget.remaining--;
        if(block.hp<=1e-10) {
          destroy(index,id,true);
          if(team.buffs.big>0 && state.queue.length+state.entities.length<LIMITS.maxQueue) {
            enqueue('big',id,index%state.width,Math.floor(index/state.width),{radius:1.1,shape:'circle'});
          }
          chooseTarget(id);
        }
      }
    }
    function addEffect(kind,x,y) {
      if(state.effects.length>=LIMITS.maxEffects) state.effects.shift();
      state.effects.push({kind,x,y,age:0,duration:kind==='nuke'?2.5:1.2});
    }
    function enqueue(kind,id,x,y,override) {
      const descriptor=override || EVENTS[kind];
      const arenaLegacy=state.layout==='arena' && ['tnt','meteor','rain','nuke'].includes(kind);
      const radius=arenaLegacy?(kind==='nuke'?Math.max(state.width,state.height)*0.48:kind==='meteor'?3:2):descriptor.radius;
      const shape=arenaLegacy?'circle':descriptor.shape;
      const indices=[];
      for(let row=0;row<state.height;row++) {
        for(let col=0;col<state.width;col++) {
          const dx=col-x,dy=row-y;
          const included=shape==='column'?Math.abs(dx)<=radius && dy>=-3 && dy<=7:
            shape==='band'?Math.abs(dy)<=radius:
            shape==='line'?Math.abs(dx)<=radius && dy>=-2 && dy<=4:
            dx*dx+dy*dy<=radius*radius;
          if(included) indices.push(row*state.width+col);
        }
      }
      // Black holes collapse nearest blocks first; other blasts sweep rows deterministically.
      if(shape==='pull') indices.sort((a,b)=>{
        const distance=index=>(index%state.width-x)**2+(Math.floor(index/state.width)-y)**2;
        return distance(a)-distance(b);
      });
      state.queue.push({kind,team:id,x,y,indices,cursor:0,started:false,multiplier:kind==='jackpot'?2:1});
    }
    function processExplosions(budget) {
      let operations=0;
      while(state.queue.length && operations<LIMITS.maxExplosionOps && budget.remaining>0) {
        const blast=state.queue[0];
        if(!blast.started) {
          addEffect(blast.kind,blast.x,blast.y);
          blast.started=true;
        }
        while(blast.cursor<blast.indices.length && operations<LIMITS.maxExplosionOps && budget.remaining>0) {
          const index=blast.indices[blast.cursor++];
          operations++;
          budget.remaining--;
          destroy(index,blast.team,false,blast.multiplier);
        }
        if(blast.cursor===blast.indices.length) state.queue.shift();
      }
    }
    function launch(kind,id,x,y,sequence=0) {
      if(state.layout==='arena') {enqueue(kind,id,x,y);return;}
      const descriptor=EVENTS[kind];
      const startY=Math.max(0,y-5-sequence*0.5);
      // A programmed descent is an explicit game design choice, not inferred physics.
      const startX=Math.max(0,Math.min(state.width-1,x+(sequence%2?1:-1)*0.6));
      state.entities.push({kind,team:id,x:startX,y:startY,startX,startY,targetX:x,targetY:y,
        age:0,duration:1.2+sequence*0.08,size:descriptor.size,rotation:sequence*0.4});
    }
    function advanceEntities(dt) {
      for(let i=state.entities.length-1;i>=0;i--) {
        const entity=state.entities[i];
        entity.age=Math.min(entity.duration,entity.age+dt);
        const progress=entity.age/entity.duration;
        entity.x=entity.startX+(entity.targetX-entity.startX)*progress;
        entity.y=entity.startY+(entity.targetY-entity.startY)*progress*progress;
        entity.rotation+=settings.reducedMotion?0:dt*(entity.kind==='jackpot'?2.4:0.7);
        if(entity.age>=entity.duration-1e-10) {
          state.entities.splice(i,1);
          enqueue(entity.kind,entity.team,entity.targetX,entity.targetY);
        }
      }
    }
    const commonFields=['type','team'];
    const fields={mine:['count'],repair:['count'],tnt:['count','x','y'],meteor:['count','x','y'],
      rain:['count','x','y'],nuke:['x','y'],turbo:[],descomunal:[],pickaxe:['pickaxe'],
      enchant:['efficiency','unbreaking','fortune']};
    for(const key of Object.keys(EVENTS)) if(!own(fields,key)) fields[key]=[];
    function validAction(action) {
      if(!plain(action) || typeof action.type!=='string' || !own(fields,action.type)) return false;
      if(Object.keys(action).some(key=>!commonFields.includes(key) && !fields[action.type].includes(key))) return false;
      if(own(action,'team') && !['dark','light','neutral'].includes(action.team)) return false;
      if(own(action,'count') && !integer(action.count,1,8)) return false;
      if(own(action,'x')!==own(action,'y')) return false;
      if(own(action,'x') && (!integer(action.x,0,state.width-1) || !integer(action.y,0,state.height-1))) return false;
      if(action.type==='pickaxe' && (typeof action.pickaxe!=='string' || !own(PICKAXES,action.pickaxe))) return false;
      if(action.type==='enchant') {
        if(!['efficiency','unbreaking','fortune'].some(key=>own(action,key))) return false;
        for(const key of ['efficiency','unbreaking','fortune']) {
          if(own(action,key) && !integer(action[key],0,key==='efficiency'?5:3)) return false;
        }
      }
      return true;
    }
    function action(input) {
      if(!validAction(input) || state.paused || state.phase!=='playing') return false;
      const kind=input.type,count=input.count || 1;
      const descriptor=own(EVENTS,kind)?EVENTS[kind]:null;
      const explosion=descriptor?.mode==='blast';
      const arenaLegacy=state.layout==='arena' && ['tnt','meteor','rain','nuke'].includes(kind);
      const entries=arenaLegacy?(kind==='rain'?count*4:count):explosion?count*descriptor.count:count;
      if(explosion && (state.queue.length+state.entities.length+entries>LIMITS.maxQueue ||
          kind==='nuke' && state.nukeCooldown>1e-10)) return false;
      const id=TEAM_IDS.includes(input.team)?input.team:TEAM_IDS[Math.floor(random()*2)];
      const team=state.teams[id];
      if(own(BUFFS,kind) && team.cooldowns[kind]>1e-10) return false;
      if(descriptor && !arenaLegacy && state.eventCooldowns[kind][id]>1e-10) return false;
      if(explosion) {
        for(let i=0;i<entries;i++) {
          const target=team.target || {x:Math.floor(state.width/2),y:Math.floor(state.height/2)};
          const scatter=['rain','tnt_rain','fire'].includes(kind);
          const x=own(input,'x')?input.x:scatter?Math.floor(random()*state.width):
            kind==='nuke'?Math.floor(state.width/2):target.x;
          const y=own(input,'y')?input.y:arenaLegacy?
            (kind==='nuke'?Math.floor(state.height/2):kind==='rain'?Math.floor(random()*state.height):Math.min(state.height-1,target.y+1)):
            Math.min(state.height-1,target.y+(scatter?Math.floor(random()*3):1));
          if(arenaLegacy) enqueue(kind==='rain'?'tnt':kind,id,x,y);
          else launch(kind,id,x,y,i);
        }
        if(kind==='nuke') state.nukeCooldown=LIMITS.nukeCooldown;
      } else if(kind==='mine') {
        team.progress=Math.min(LIMITS.maxProgress,team.progress+count);
      } else if(kind==='repair') {
        team.durability=PICKAXES[team.pickaxe].durability;
        team.inventory[team.pickaxe]=team.durability;
        addEffect('repair',team.target?.x || 0,team.target?.y || 0);
      } else if(kind==='pickaxe') {
        equip(team,input.pickaxe);
      } else if(kind==='enchant') {
        for(const key of ['efficiency','unbreaking','fortune']) if(own(input,key)) team[key]=input[key];
        updateSpeed(team);
      } else {
        team.buffs[kind]=BUFFS[kind].duration;
        team.cooldowns[kind]=BUFFS[kind].cooldown;
        updateSpeed(team);
        addEffect(kind,team.target?.x || 0,team.target?.y || 0);
      }
      if(descriptor) {
        if(!arenaLegacy) state.eventCooldowns[kind][id]=descriptor.cooldown;
        state.activeEvent={kind,remaining:descriptor.duration,duration:descriptor.duration,team:id};
      } else if(own(BUFFS,kind)) {
        state.activeEvent={kind,remaining:BUFFS[kind].duration,duration:BUFFS[kind].duration,team:id};
      }
      state.lastEvent={kind,team:id};
      return true;
    }
    function updateVisuals(dt) {
      for(let i=state.particles.length-1;i>=0;i--) {
        const p=state.particles[i];
        p.life-=dt;
        if(p.life<=0) state.particles.splice(i,1);
        else {
          const hole=state.activeEvent?.kind==='black_hole'?state.focus:null;
          if(hole) {p.vx+=(hole.x-p.x)*dt*4;p.vy+=(hole.y-p.y)*dt*4;}
          p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=4*dt;
        }
      }
      for(let i=state.effects.length-1;i>=0;i--) {
        const effect=state.effects[i];
        effect.age+=dt;
        if(effect.age>=effect.duration) state.effects.splice(i,1);
      }
    }
    function finishRound() {
      state.phase='summary';
      state.remaining=0;
      const dark=state.teams.dark.score,light=state.teams.light.score;
      state.result=dark===light?'tie':dark>light?'dark':'light';
      summaryRemaining=LIMITS.summaryDuration;
      state.queue.length=0;
      state.entities.length=0;
      state.activeEvent=null;
    }
    function streamRows() {
      if(state.body.y<=25)return;
      const shift=12,width=state.width;
      const lastGlobalRow=state.rowOffset+state.height;
      state.blocks.splice(0,shift*width);
      const ores=['coal','iron','gold','redstone','lapis','copper','emerald','diamond'];
      const patches=['granite','diorite','andesite','moss'];
      for(let row=0;row<shift;row++){
        const absolute=lastGlobalRow+row,terrainRandom=rng(baseSeed^Math.imul(absolute+1,0x9e3779b9));
        for(let x=0;x<width;x++){
          const roll=terrainRandom();
          const material=roll<0.29?ores[Math.floor(terrainRandom()*ores.length)]:roll<0.51?patches[(Math.floor(absolute/3)+Math.floor(x/2))%patches.length]:roll>0.97?'obsidian':'stone';
          const data=MATERIALS[material];
          state.blocks.push({material,hp:data.hardness,maxHp:data.hardness,value:data.value});
        }
      }
      state.rowOffset+=shift;state.body.y-=shift;
      for(const entity of state.entities){entity.y-=shift;entity.startY-=shift;entity.targetY-=shift;}
      state.entities=state.entities.filter(entity=>entity.targetY>=0 && entity.y>=-8);
      for(const list of [state.effects,state.particles])for(const entry of list)entry.y-=shift;
      state.effects=state.effects.filter(effect=>effect.y>=-8 && effect.y<state.height+8);
      state.particles=state.particles.filter(particle=>particle.y>=-8 && particle.y<state.height+8);
      for(const blast of state.queue){
        blast.y-=shift;
        blast.indices=blast.indices.slice(blast.cursor).map(index=>index-shift*width).filter(index=>index>=0 && index<state.blocks.length);
        blast.cursor=0;
      }
      state.queue=state.queue.filter(blast=>blast.indices.length>0);
      remainingBlocks=state.blocks.filter(Boolean).length;
    }
    function updateBody(step,budget) {
      const body=state.body,active=state.activeEvent;
      body.team=active && own(BUFFS,active.kind)?active.team:body.x<state.width/2?'dark':'light';
      const team=state.teams[body.team];
      body.radius=team.buffs.big>0?0.5:0.35;
      for(const id of TEAM_IDS){
        const miner=state.teams[id];
        miner.progress=Math.min(LIMITS.maxProgress,miner.progress+miner.effectiveSpeed*step);
      }
      physics.step(body,step,state,index=>{
        const block=state.blocks[index];
        if(!block || budget.remaining<=0 || team.progress<=0)return;
        const damage=Math.min(block.hp,team.progress);
        block.hp=Math.max(0,block.hp-damage);team.progress=Math.max(0,team.progress-damage);budget.remaining--;
        if(block.hp<=1e-10){
          destroy(index,body.team,true);
          if(team.buffs.big>0 && state.queue.length+state.entities.length<LIMITS.maxQueue){
            enqueue('big',body.team,index%state.width,Math.floor(index/state.width),{radius:1.1,shape:'circle'});
          }
        }
      });
      // Keep SPIN's characteristic fast rotation while collisions stay circular.
      if(team.buffs.spin>0)body.rotation=(body.rotation+9*step)%(Math.PI*2);
      streamRows();
    }
    function update(seconds) {
      if(!finite(seconds) || seconds<=0 || state.paused) return;
      const dt=Math.min(seconds,LIMITS.maxDelta);
      updateVisuals(dt);
      if(state.activeEvent) {
        state.activeEvent.remaining=Math.max(0,state.activeEvent.remaining-dt);
        if(state.activeEvent.remaining<=1e-10) state.activeEvent=null;
      }
      state.nukeCooldown=Math.max(0,state.nukeCooldown-dt);
      if(state.phase==='summary') {
        summaryRemaining-=dt;
        if(summaryRemaining<=1e-10) startRound(state.round+1);
        return;
      }
      const endless=state.layout==='endless';
      const step=endless?dt:Math.min(dt,state.remaining);
      state.elapsed=endless?Math.min(Number.MAX_SAFE_INTEGER,state.elapsed+step):Math.min(state.roundDuration,state.elapsed+step);
      if(endless)state.round=1+Math.floor(state.elapsed/180);
      state.remaining=endless?0:Math.max(0,state.remaining-step);
      state.nextEventIn=Math.max(0,state.nextEventIn-step);
      for(const id of TEAM_IDS) {
        const team=state.teams[id];
        for(const key of Object.keys(BUFFS)) {
          team.buffs[key]=Math.max(0,team.buffs[key]-step);
          team.cooldowns[key]=Math.max(0,team.cooldowns[key]-step);
        }
        updateSpeed(team);
      }
      for(const cooldown of Object.values(state.eventCooldowns)) {
        for(const id of TEAM_IDS) cooldown[id]=Math.max(0,cooldown[id]-step);
      }
      if(state.nextEventIn<=1e-10) {
        const events=state.layout!=='arena'?Object.keys(EVENTS):['rain','meteor','tnt','turbo','descomunal','nuke'];
        let accepted=action({type:events[Math.floor(random()*events.length)]});
        if(!accepted) accepted=action({type:'turbo'});
        if(accepted) state.eventCount++;
        state.nextEventIn=settings.eventInterval;
      }
      const budget={remaining:LIMITS.maxBlockOps};
      advanceEntities(step);
      processExplosions(budget);
      if(endless)updateBody(step,budget);
      else {
        // Reserve equal work for both miners even while a full explosion queue drains.
        const perTeam=Math.floor(budget.remaining/2);
        for(const id of TEAM_IDS) mine(id,step,{remaining:perTeam});
      }
      updateFocus();
      // A shaft is a finite downward excavation. Once a miner reaches its floor,
      // start the next round rather than returning to isolated old ceiling walls.
      const reachedFloor=state.layout==='shaft' && (shaftReachedFloor || TEAM_IDS.some(id=>state.teams[id].target?.y>=state.height-1));
      if(!endless && (state.remaining<=1e-10 || remainingBlocks===0 || reachedFloor)) finishRound();
    }
    function pause(value) {
      if(typeof value!=='boolean') return false;
      state.paused=value;
      return true;
    }
    function clearEffects() {
      state.queue.length=0;
      state.entities.length=0;
      state.effects.length=0;
      state.particles.length=0;
      state.lastEvent=null;
      state.activeEvent=null;
      for(const id of TEAM_IDS) {
        const team=state.teams[id];
        for(const key of Object.keys(BUFFS)) team.buffs[key]=0;
        team.progress=0;
        updateSpeed(team);
      }
      return true;
    }
    function configure(input) {
      if(!plain(input) || Object.keys(input).some(key=>!['duration','eventInterval','reducedMotion'].includes(key))) return false;
      const next={...settings,...input};
      if(!validSettings(next)) return false;
      Object.assign(settings,input);
      Object.assign(state.config,{duration:settings.duration,eventInterval:settings.eventInterval,reducedMotion:settings.reducedMotion});
      if(own(input,'eventInterval')) state.nextEventIn=settings.eventInterval;
      if(settings.reducedMotion) state.particles.length=0;
      return true;
    }
    reset(baseSeed);
    return {state,update,action,pause,reset,clearEffects,configure};
  }
  function validSettings(value) {
    return finite(value.duration) && value.duration>=10 && value.duration<=900 &&
      finite(value.eventInterval) && value.eventInterval>=5 && value.eventInterval<=180 &&
      typeof value.reducedMotion==='boolean';
  }
  return Object.freeze({createEngine,...config});
}));

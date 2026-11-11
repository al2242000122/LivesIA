(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config.js'));
  else root.BlockWarsEngine = factory(root.BlockWarsConfig);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (config) {
  'use strict';
  if (!config) throw new Error('Load BlockWarsConfig before BlockWarsEngine');
  const {PICKAXES,MATERIALS,EFFICIENCY,BUFFS,LIMITS} = config;
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
      !['seed','width','height','duration','eventInterval','reducedMotion'].includes(key))) {
      throw new TypeError('Invalid engine options');
    }
    const settings = {seed:20261110,width:20,height:25,duration:180,eventInterval:60,reducedMotion:false,...options};
    if (!validSeed(settings.seed) || !integer(settings.width,4,40) || !integer(settings.height,4,40) ||
        settings.width*settings.height>LIMITS.maxCells || !validSettings(settings)) {
      throw new RangeError('Invalid engine configuration');
    }
    let random,visualRandom,baseSeed=settings.seed,summaryRemaining=0,remainingBlocks=0;
    const state = {};

    function makeTeam() {
      return {score:0,blocks:0,pickaxe:'wood',durability:PICKAXES.wood.durability,
        efficiency:0,unbreaking:0,fortune:0,progress:0,target:null,effectiveSpeed:0.6,
        unlocked:['wood'],buffs:{turbo:0,descomunal:0},cooldowns:{turbo:0,descomunal:0},
        inventory:{wood:PICKAXES.wood.durability}};
    }
    function updateSpeed(team) {
      team.effectiveSpeed=Math.round(PICKAXES[team.pickaxe].baseSpeed*EFFICIENCY[team.efficiency]*
        (team.buffs.turbo>0?BUFFS.turbo.multiplier:1)*
        (team.buffs.descomunal>0?BUFFS.descomunal.multiplier:1)*1e9)/1e9;
    }
    function makeWorld(round) {
      const worldRandom=rng((baseSeed+Math.imul(round-1,0x9e3779b9))>>>0);
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
    function startRound(round) {
      state.blocks=makeWorld(round);
      state.teams={dark:makeTeam(),light:makeTeam()};
      state.round=round;
      state.phase='playing';
      state.result=null;
      state.remaining=settings.duration;
      state.nextEventIn=settings.eventInterval;
      state.queue.length=0;
      state.particles.length=0;
      state.effects.length=0;
      state.lastEvent=null;
      remainingBlocks=state.blocks.length;
      for (const id of TEAM_IDS) chooseTarget(id);
    }
    function reset(seed=baseSeed) {
      if (!validSeed(seed)) return false;
      baseSeed=seed;
      settings.seed=seed;
      random=rng(seed ^ 0xa341316c);
      visualRandom=rng(seed ^ 0xc8013ea4);
      Object.assign(state,{width:settings.width,height:settings.height,paused:false,
        queue:[],effects:[],particles:[],nukeCooldown:0,eventCount:0,
        config:{duration:settings.duration,eventInterval:settings.eventInterval,reducedMotion:settings.reducedMotion}});
      summaryRemaining=0;
      startRound(1);
      return true;
    }
    function chooseTarget(id) {
      const team=state.teams[id],half=Math.ceil(state.width/2);
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
    function equip(team,id) {
      team.inventory[team.pickaxe]=team.durability;
      if (!team.unlocked.includes(id)) team.unlocked.push(id);
      if (!own(team.inventory,id) || team.inventory[id]<=0) team.inventory[id]=PICKAXES[id].durability;
      team.pickaxe=id;
      team.durability=team.inventory[id];
      updateSpeed(team);
    }
    function wear(team) {
      if (random()<1/(team.unbreaking+1)) {
        team.durability=Math.max(0,team.durability-1);
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
    function destroy(index,id,mined) {
      const block=state.blocks[index];
      if (!block) return;
      const team=state.teams[id];
      const ore=block.material==='crystal' || block.material==='gold';
      const bonus=mined && ore ? Math.floor(random()*(team.fortune+1)) : 0;
      team.score=Math.min(LIMITS.maxScore,team.score+block.value*(1+bonus));
      team.blocks=Math.min(state.width*state.height,team.blocks+1);
      state.blocks[index]=null;
      remainingBlocks--;
      particleBurst(index%state.width,Math.floor(index/state.width),block.material);
      if (mined) wear(team);
      unlock(team);
    }
    function mine(id,dt,budget) {
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
          chooseTarget(id);
        }
      }
    }
    function addEffect(kind,x,y) {
      if(state.effects.length>=LIMITS.maxEffects) state.effects.shift();
      state.effects.push({kind,x,y,age:0,duration:kind==='nuke'?2.5:1.2});
    }
    function enqueue(kind,id,x,y) {
      const radius=kind==='nuke'?Math.max(state.width,state.height)*0.48:kind==='meteor'?3:2;
      const indices=[];
      for(let row=Math.max(0,Math.floor(y-radius));row<=Math.min(state.height-1,Math.ceil(y+radius));row++) {
        for(let col=Math.max(0,Math.floor(x-radius));col<=Math.min(state.width-1,Math.ceil(x+radius));col++) {
          if ((row-y)**2+(col-x)**2<=radius**2) indices.push(row*state.width+col);
        }
      }
      state.queue.push({kind,team:id,x,y,indices,cursor:0,started:false});
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
          destroy(index,blast.team,false);
        }
        if(blast.cursor===blast.indices.length) state.queue.shift();
      }
    }
    const commonFields=['type','team'];
    const fields={mine:['count'],repair:['count'],tnt:['count','x','y'],meteor:['count','x','y'],
      rain:['count','x','y'],nuke:['x','y'],turbo:[],descomunal:[],pickaxe:['pickaxe'],
      enchant:['efficiency','unbreaking','fortune']};
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
      const explosion=['tnt','meteor','rain','nuke'].includes(kind);
      const entries=kind==='rain'?count*4:count;
      if(explosion && (state.queue.length+entries>LIMITS.maxQueue ||
          kind==='nuke' && state.nukeCooldown>0)) return false;
      const id=TEAM_IDS.includes(input.team)?input.team:TEAM_IDS[Math.floor(random()*2)];
      const team=state.teams[id];
      if(own(BUFFS,kind) && team.cooldowns[kind]>1e-10) return false;
      if(explosion) {
        for(let i=0;i<entries;i++) {
          const target=team.target || {x:Math.floor(state.width/2),y:Math.floor(state.height/2)};
          const x=own(input,'x')?input.x:kind==='nuke'?Math.floor(state.width/2):
            kind==='rain'?Math.floor(random()*state.width):target.x;
          const y=own(input,'y')?input.y:kind==='nuke'?Math.floor(state.height/2):
            kind==='rain'?Math.floor(random()*state.height):Math.min(state.height-1,target.y+1);
          enqueue(kind==='rain'?'tnt':kind,id,x,y);
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
      state.lastEvent={kind,team:id};
      return true;
    }
    function updateVisuals(dt) {
      for(let i=state.particles.length-1;i>=0;i--) {
        const p=state.particles[i];
        p.life-=dt;
        if(p.life<=0) state.particles.splice(i,1);
        else {p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=4*dt;}
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
    }
    function update(seconds) {
      if(!finite(seconds) || seconds<=0 || state.paused) return;
      const dt=Math.min(seconds,LIMITS.maxDelta);
      updateVisuals(dt);
      state.nukeCooldown=Math.max(0,state.nukeCooldown-dt);
      if(state.phase==='summary') {
        summaryRemaining-=dt;
        if(summaryRemaining<=1e-10) startRound(state.round+1);
        return;
      }
      const step=Math.min(dt,state.remaining);
      state.remaining=Math.max(0,state.remaining-step);
      state.nextEventIn=Math.max(0,state.nextEventIn-step);
      for(const id of TEAM_IDS) {
        const team=state.teams[id];
        for(const key of ['turbo','descomunal']) {
          team.buffs[key]=Math.max(0,team.buffs[key]-step);
          team.cooldowns[key]=Math.max(0,team.cooldowns[key]-step);
        }
        updateSpeed(team);
      }
      if(state.nextEventIn<=1e-10) {
        const events=['rain','meteor','tnt','turbo','descomunal','nuke'];
        let accepted=action({type:events[Math.floor(random()*events.length)]});
        if(!accepted) accepted=action({type:'turbo'});
        if(accepted) state.eventCount++;
        state.nextEventIn=settings.eventInterval;
      }
      const budget={remaining:LIMITS.maxBlockOps};
      processExplosions(budget);
      // Reserve equal work for both miners even while a full explosion queue drains.
      const perTeam=Math.floor(budget.remaining/2);
      for(const id of TEAM_IDS) mine(id,step,{remaining:perTeam});
      if(state.remaining<=1e-10 || remainingBlocks===0) finishRound();
    }
    function pause(value) {
      if(typeof value!=='boolean') return false;
      state.paused=value;
      return true;
    }
    function clearEffects() {
      state.queue.length=0;
      state.effects.length=0;
      state.particles.length=0;
      state.lastEvent=null;
      for(const id of TEAM_IDS) {
        const team=state.teams[id];
        team.buffs.turbo=0;
        team.buffs.descomunal=0;
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

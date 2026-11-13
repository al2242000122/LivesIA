(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config.js'),require('./physics.js'));
  else root.BlockWarsEngine = factory(root.BlockWarsConfig,root.BlockWarsPhysics);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (config,physics) {
  'use strict';
  if (!config) throw new Error('Load BlockWarsConfig before BlockWarsEngine');
  const {PICKAXES,MATERIALS,EFFICIENCY,BUFFS,EVENTS,LIMITS,MINECRAFT_EFFECTS:MC} = config;
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
    let random,visualRandom,baseSeed=settings.seed,summaryRemaining=0,remainingBlocks=0,shaftReachedFloor=false,actionSequence=0;
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
      state.weather=null;
      state.hazards=[];
      state.actionResults=[];
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
      actionSequence=0;
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
    function destroy(index,id,mined,multiplier=1,context) {
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
      const result=context&&state.actionResults.find(entry=>entry.actionId===context.actionId);
      if(result)result.blocks=Math.min(LIMITS.maxScore,result.blocks+1);
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
            enqueue('big',id,index%state.width,Math.floor(index/state.width),{radius:MC.big.contactBlastRadius,shape:'circle'});
          }
          chooseTarget(id);
        }
      }
    }
    function addEffect(kind,x,y,context={},stage='impact') {
      if(state.effects.length>=LIMITS.maxEffects) state.effects.shift();
      state.effects.push({kind,x,y,age:0,duration:kind==='nuke'?2.5:1.2,...context,stage});
    }
    function enqueue(kind,id,x,y,override,context={}) {
      if(state.queue.length+state.entities.length>=LIMITS.maxQueue)return false;
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
      state.queue.push({kind,team:id,x,y,indices,cursor:0,started:false,multiplier:kind==='jackpot'?2:1,...context});
      return true;
    }
    function processExplosions(budget) {
      let operations=0;
      while(state.queue.length && operations<LIMITS.maxExplosionOps && budget.remaining>0) {
        const blast=state.queue[0];
        if(!blast.started) {
          addEffect(blast.kind,blast.x,blast.y,attribution(blast));
          blast.started=true;
        }
        while(blast.cursor<blast.indices.length && operations<LIMITS.maxExplosionOps && budget.remaining>0) {
          const index=blast.indices[blast.cursor++];
          operations++;
          budget.remaining--;
          destroy(index,blast.team,false,blast.multiplier,blast);
        }
        if(blast.cursor===blast.indices.length) state.queue.shift();
      }
    }
    function launch(kind,id,x,y,sequence=0,context={}) {
      if(state.layout==='arena') {enqueue(kind,id,x,y,undefined,context);return;}
      if(state.layout==='endless'&&config.SELECTED_EVENTS.includes(kind)&&!own(BUFFS,kind)){
        launchEndless(kind,id,x,y,sequence,context);return;
      }
      const descriptor=EVENTS[kind];
      const startY=Math.max(0,y-5-sequence*0.5);
      // A programmed descent is an explicit game design choice, not inferred physics.
      const startX=Math.max(0,Math.min(state.width-1,x+(sequence%2?1:-1)*0.6));
      state.entities.push({kind,team:id,x:startX,y:startY,startX,startY,targetX:x,targetY:y,
        age:0,duration:1.2+sequence*0.08,size:descriptor.size,rotation:sequence*0.4,...context});
    }
    function advanceEntities(dt,budget) {
      for(let i=state.entities.length-1;i>=0;i--) {
        const entity=state.entities[i];
        if(entity.stage){
          const done=advanceEndless(entity,dt,budget);
          if(done){state.entities.splice(i,1);if(done!=='spent')detonate(entity);}
          continue;
        }
        entity.age=Math.min(entity.duration,entity.age+dt);
        const progress=entity.age/entity.duration;
        entity.x=entity.startX+(entity.targetX-entity.startX)*progress;
        entity.y=entity.startY+(entity.targetY-entity.startY)*progress*progress;
        entity.rotation+=settings.reducedMotion?0:dt*(entity.kind==='jackpot'?2.4:0.7);
        if(entity.age>=entity.duration-1e-10) {
          state.entities.splice(i,1);
          enqueue(entity.kind,entity.team,entity.targetX,entity.targetY,undefined,attribution(entity));
        }
      }
    }
    const attribution=entry=>({actor:entry.actor||'',source:entry.source||'automatic',actionId:entry.actionId||''});
    function actionContext(input){
      const context=plain(input)?input:{};
      const actor=typeof context.actor==='string'?context.actor.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>]/g,'').slice(0,32):'';
      const source=['simulator','tikfinity','automatic','operator'].includes(context.source)?context.source:'automatic';
      const supplied=typeof context.actionId==='string'&&/^[a-zA-Z0-9:_-]{1,80}$/.test(context.actionId)?context.actionId:null;
      return {actor,source,actionId:supplied||'engine-'+(++actionSequence)};
    }
    function terrainBelow(x,y){
      const col=Math.max(0,Math.min(state.width-1,Math.floor(x)));
      for(let row=Math.max(0,Math.floor(y));row<state.height;row++)if(state.blocks[row*state.width+col])return row;
      return state.height-1;
    }
    function launchEndless(kind,id,x,y,sequence,context){
      const descriptor=EVENTS[kind],tuning=MC[kind]||{},projectile=MC.projectile,targetY=terrainBelow(x,y);
      const startY=Math.max(.5,Math.min(y-projectile.spawnHeight,state.body.y-projectile.spawnHeight));
      const delay=sequence*(tuning.spawnInterval??projectile.spawnInterval);
      const entity={kind,team:id,x:x+.5,y:startY,startX:x+.5,startY,targetX:x+.5,targetY,
        age:0,duration:tuning.lifetime??projectile.lifetime,size:descriptor.size,rotation:0,
        radius:descriptor.size/2,vx:(sequence%2?1:-1)*projectile.driftSpeed,vy:0,
        fuse:tuning.fuse??projectile.fuse,
        delay,grounded:false,stage:'fall',...context};
      entity.x=Math.max(entity.radius,Math.min(state.width-entity.radius,entity.x));
      // The square sprite and its support footprint have the same physical size.
      if(['tnt','rain','creeper','mega','nuke'].includes(kind))chooseAirSpawn(entity);
      entity.y=Math.min(entity.y,supportAcross(entity,entity.y-entity.radius)-entity.radius-.001);
      entity.startX=entity.x;entity.startY=entity.y;
      if(['tnt','rain','creeper','mega','nuke'].includes(kind)){
        entity.targetX=entity.x;entity.targetY=supportAcross(entity,entity.y+entity.radius);
      }
      if(kind==='tsunami')Object.assign(entity,{stage:'wave',x:-.5,y:targetY,vx:state.width/tuning.crossingSeconds,duration:tuning.lifetime});
      if(['arrow','meteor','fire','storm'].includes(kind)){
        const startX=kind==='arrow'?(id==='dark'?-.2:state.width+.2):x+.5;
        const originY=kind==='arrow'?Math.max(.5,targetY-tuning.originHeight):startY;
        const seconds=tuning.flightSeconds??projectile.flightSeconds;
        Object.assign(entity,{stage:'flight',x:startX,y:originY,startX,startY:originY,
          vx:(entity.targetX-startX)/seconds,vy:(targetY-originY)/seconds,
          duration:tuning.flightLifetime??projectile.flightLifetime,radius:tuning.flightRadius??projectile.flightRadius});
      }
      state.entities.push(entity);
    }
    function chooseAirSpawn(entity){
      if(entity.y-entity.radius<0)return; // A giant charge may not fit the opening.
      const preferred=entity.x,half=entity.radius;
      let best=null,distance=Infinity;
      // At most one candidate per world column, independent of chat volume.
      for(let col=0;col<state.width;col++){
        const x=col+.5;if(x-half<0||x+half>state.width)continue;
        const left=Math.floor(x-half+1e-6),right=Math.ceil(x+half-1e-6)-1;
        const top=Math.max(0,Math.floor(entity.y-half+1e-6)),bottom=Math.min(state.height-1,Math.ceil(entity.y+half-1e-6)-1);
        let clear=true;
        for(let row=top;row<=bottom&&clear;row++)for(let cell=left;cell<=right;cell++){
          if(state.blocks[row*state.width+cell]){clear=false;break;}
        }
        const nextDistance=Math.abs(x-preferred);
        if(clear&&nextDistance<distance){best=x;distance=nextDistance;}
      }
      if(best!==null)entity.x=best;
    }
    function damageAt(index,amount,entity,budget){
      const block=state.blocks[index];if(!block||budget.remaining<=0)return false;
      budget.remaining--;block.hp=Math.max(0,block.hp-amount);
      if(block.hp<=1e-10)destroy(index,entity.team,false,1,entity);
      return true;
    }
    function damageArea(entity,radius,amount,budget){
      for(let row=Math.max(0,Math.floor(entity.y-radius));row<=Math.min(state.height-1,Math.ceil(entity.y+radius));row++){
        for(let col=Math.max(0,Math.floor(entity.x-radius));col<=Math.min(state.width-1,Math.ceil(entity.x+radius));col++){
          if((col+.5-entity.x)**2+(row+.5-entity.y)**2<=radius*radius)damageAt(row*state.width+col,amount,entity,budget);
        }
      }
    }
    function detonate(entity){
      const meta=attribution(entity),kind=entity.kind;
      if(kind==='fire'&&state.hazards.length<MC.fire.maxHazards){
        state.hazards.push({kind,team:entity.team,x:entity.x,y:entity.y+MC.fire.burnOffsetY,radius:MC.fire.burnRadius,
          remaining:MC.fire.burnSeconds,duration:MC.fire.burnSeconds,nextPulse:0,...meta});
      }
      if(kind==='nuke'){
        // A single bounded sweep is a chain, ordered around three TNT centers.
        const x=entity.x-.5,y=entity.y-.5,centers=MC.nuke.chainOffsets.map(([dx,dy])=>({x:x+dx,y:y+dy}));
        const radius=MC.nuke.chainRadius,indices=new Set();
        for(const center of centers){
          addEffect(kind,center.x,center.y,meta);
          for(let row=0;row<state.height;row++)for(let col=0;col<state.width;col++){
            if((col-center.x)**2+(row-center.y)**2<=radius*radius)indices.add(row*state.width+col);
          }
        }
        if(state.entities.length+state.queue.length<LIMITS.maxQueue)state.queue.push({kind,team:entity.team,x,y,indices:[...indices],cursor:0,started:true,multiplier:1,...meta});
      }else enqueue(kind,entity.team,entity.x-.5,entity.y-.5,undefined,meta);
    }
    function supportAcross(entity,fromY){
      let floor=state.height;
      const left=Math.max(0,Math.floor(entity.x-entity.radius+1e-6)),right=Math.min(state.width-1,Math.ceil(entity.x+entity.radius-1e-6)-1);
      for(let col=left;col<=right;col++)floor=Math.min(floor,terrainBelow(col,fromY));
      return floor;
    }
    function advanceFalling(entity,dt){
      const tuning=MC.projectile;
      if(entity.grounded){
        // A neighboring blast can remove its support: resume falling, retaining its fuse.
        const support=supportAcross(entity,entity.y+entity.radius+.02);
        if(support>entity.y+entity.radius+.15){entity.grounded=false;entity.stage='fall';}
      }
      if(!entity.grounded){
        const slices=Math.max(1,Math.ceil(dt/tuning.maxFallStep)),h=dt/slices;
        for(let s=0;s<slices;s++){
          entity.vy=Math.min(tuning.maxFallSpeed,entity.vy+tuning.gravity*h);
          const previousX=entity.x;
          entity.x=Math.max(entity.radius,Math.min(state.width-entity.radius,entity.x+entity.vx*h));
          // Do not slide a wide charge sideways through a rock wall at its current height.
          if(supportAcross(entity,entity.y-entity.radius)<entity.y+entity.radius-1e-6){entity.x=previousX;entity.vx*=-1;}
          if(entity.x<=entity.radius||entity.x>=state.width-entity.radius)entity.vx*=-1;
          const floor=supportAcross(entity,entity.y+entity.radius),next=entity.y+entity.vy*h;
          if(next+entity.radius>=floor){
            entity.y=floor-entity.radius-.001;
            if(!entity.bounced&&entity.kind!=='creeper'){
              entity.vy=-Math.max(tuning.minBounceSpeed,entity.vy*tuning.bounceRetention);entity.bounced=true;
            }else{entity.vy=0;entity.grounded=true;entity.stage='fuse';}
          }else entity.y=next;
        }
      }
      if(entity.grounded)entity.fuse=Math.max(0,entity.fuse-dt);
      // Falling block sprites remain axis-aligned with their physical footprint.
      entity.rotation=0;
      return entity.grounded&&entity.fuse<=1e-10;
    }
    function advanceFlight(entity,dt,budget){
      const slices=Math.max(1,Math.ceil(Math.hypot(entity.vx,entity.vy)*dt/MC.projectile.maxFlightStep)),h=dt/slices;
      for(let s=0;s<slices;s++){
        entity.x+=entity.vx*h;entity.y+=entity.vy*h;
        const index=Math.floor(entity.y)*state.width+Math.floor(entity.x);
        const inside=entity.x>=0&&entity.x<state.width&&entity.y>=0&&entity.y<state.height;
        if(inside&&state.blocks[index]){
          if(entity.kind==='meteor'){
            damageArea(entity,MC.meteor.pathRadius,MC.meteor.pathDamage,budget);entity.penetration=(entity.penetration||0)+h;
            if(entity.penetration>=MC.meteor.penetrationSeconds)return true;
          }else if(entity.kind==='arrow'){
            damageAt(index,MC.arrow.damage,entity,budget);addEffect('arrow',entity.x-.5,entity.y-.5,attribution(entity));return 'spent';
          }else return true;
        }
        if(!inside&&entity.age>MC.projectile.outsideGraceSeconds)return 'spent';
      }
      return entity.age>=entity.duration;
    }
    function advanceEndless(entity,dt,budget){
      if(entity.delay>0){entity.delay=Math.max(0,entity.delay-dt);return false;}
      entity.age+=dt;
      let done=false;
      if(entity.stage==='wave'){
        const tuning=MC.tsunami;
        entity.x+=entity.vx*dt;entity.nextPulse=(entity.nextPulse||0)-dt;
        if(entity.nextPulse<=0){damageArea(entity,tuning.radius,tuning.damage,budget);entity.nextPulse=tuning.pulseSeconds;}
        const body=state.body;
        if(Math.abs(body.x-entity.x)<tuning.pushRangeX&&Math.abs(body.y-entity.y)<tuning.pushRangeY)body.vx=Math.min(tuning.maxPushSpeed,body.vx+dt*tuning.pushAcceleration);
        return entity.age>=entity.duration;
      }
      if(entity.stage==='flight')done=advanceFlight(entity,dt,budget);
      else done=advanceFalling(entity,dt);
      // All falling actors have a timeout even if there is no terrain in the buffer.
      return done||entity.age>=entity.duration&&'spent';
    }
    function advanceWeather(dt,budget){
      const weather=state.weather;if(!weather)return;
      weather.elapsed+=dt;weather.remaining=Math.max(0,weather.remaining-dt);weather.nextPulse-=dt;
      if(weather.kind==='storm')state.body.vx+=Math.sin(weather.elapsed*MC.storm.windFrequency)*dt*MC.storm.windAcceleration;
      if(weather.nextPulse<=1e-10){
        const x=Math.floor(random()*state.width),y=terrainBelow(x,state.body.y);
        if(weather.kind==='thunder'){
          enqueue('thunder',weather.team,x,y,undefined,attribution(weather));weather.nextPulse=MC.thunder.pulseSeconds;
        }else{
          if(state.queue.length+state.entities.length<LIMITS.maxQueue)launchEndless('storm',weather.team,x,y,0,attribution(weather));
          weather.nextPulse=MC.storm.pulseSeconds;
        }
      }
      if(weather.remaining<=1e-10)state.weather=null;
    }
    function advanceHazards(dt,budget){
      for(let i=state.hazards.length-1;i>=0;i--){
        const hazard=state.hazards[i];hazard.remaining-=dt;hazard.nextPulse-=dt;
        if(hazard.nextPulse<=0){damageArea(hazard,hazard.radius,MC.fire.burnDamage,budget);hazard.nextPulse=MC.fire.pulseSeconds;}
        if(hazard.remaining<=0)state.hazards.splice(i,1);
      }
    }
    function hasPendingAction(actionId){
      return [state.entities,state.queue,state.hazards].some(list=>list.some(entry=>entry.actionId===actionId))||state.weather?.actionId===actionId;
    }
    function advanceResults(dt){
      for(const result of state.actionResults){
        if(result.completed)continue;
        result.remaining=Math.max(0,result.remaining-dt);
        if(!hasPendingAction(result.actionId)&&result.remaining<=1e-10)result.completed=true;
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
    function action(input,context) {
      if(!validAction(input) || state.paused || state.phase!=='playing') return false;
      const kind=input.type,count=input.count || 1;
      const descriptor=own(EVENTS,kind)?EVENTS[kind]:null;
      const explosion=descriptor?.mode==='blast';
      const arenaLegacy=state.layout==='arena' && ['tnt','meteor','rain','nuke'].includes(kind);
      const endless=state.layout==='endless',weather=endless&&['thunder','storm'].includes(kind);
      const entries=weather?0:endless&&kind==='arrow'?MC.arrow.volleyCount:arenaLegacy?(kind==='rain'?count*4:count):explosion?count*descriptor.count:count;
      if(weather&&state.weather)return false;
      if(explosion && (state.queue.length+state.entities.length+entries>LIMITS.maxQueue ||
          kind==='nuke' && state.nukeCooldown>1e-10)) return false;
      const id=TEAM_IDS.includes(input.team)?input.team:TEAM_IDS[Math.floor(random()*2)];
      const team=state.teams[id];
      if(own(BUFFS,kind) && team.cooldowns[kind]>1e-10) return false;
      if(descriptor && !arenaLegacy && state.eventCooldowns[kind][id]>1e-10) return false;
      const meta=actionContext(context);
      if(state.actionResults.length>=64)state.actionResults.shift();
      state.actionResults.push({kind,...meta,blocks:0,remaining:descriptor?.mode==='buff'?descriptor.duration:0,completed:false});
      if(weather){
        state.weather={kind,team:id,remaining:descriptor.duration,duration:descriptor.duration,elapsed:0,nextPulse:0,...meta};
      }else if(explosion) {
        for(let i=0;i<entries;i++) {
          const target=team.target || {x:Math.floor(state.width/2),y:Math.floor(state.height/2)};
          const scatter=['rain','tnt_rain','fire'].includes(kind);
          const x=own(input,'x')?input.x:scatter?Math.floor(random()*state.width):
            kind==='nuke'?Math.floor(state.width/2):target.x;
          const y=own(input,'y')?input.y:arenaLegacy?
            (kind==='nuke'?Math.floor(state.height/2):kind==='rain'?Math.floor(random()*state.height):Math.min(state.height-1,target.y+1)):
            Math.min(state.height-1,target.y+(scatter?Math.floor(random()*3):1));
          if(arenaLegacy) enqueue(kind==='rain'?'tnt':kind,id,x,y,undefined,meta);
          else launch(kind,id,x,y,i,meta);
        }
        if(kind==='nuke') state.nukeCooldown=LIMITS.nukeCooldown;
      } else if(kind==='mine') {
        team.progress=Math.min(LIMITS.maxProgress,team.progress+count);
      } else if(kind==='repair') {
        team.durability=PICKAXES[team.pickaxe].durability;
        team.inventory[team.pickaxe]=team.durability;
        addEffect('repair',team.target?.x || 0,team.target?.y || 0,meta,'activation');
      } else if(kind==='pickaxe') {
        equip(team,input.pickaxe);
      } else if(kind==='enchant') {
        for(const key of ['efficiency','unbreaking','fortune']) if(own(input,key)) team[key]=input[key];
        updateSpeed(team);
      } else {
        team.buffs[kind]=BUFFS[kind].duration;
        team.cooldowns[kind]=BUFFS[kind].cooldown;
        updateSpeed(team);
        addEffect(kind,team.target?.x || 0,team.target?.y || 0,meta,'activation');
      }
      if(descriptor) {
        if(!arenaLegacy) state.eventCooldowns[kind][id]=descriptor.cooldown;
        state.activeEvent={kind,remaining:descriptor.duration,duration:descriptor.duration,team:id,...meta};
      } else if(own(BUFFS,kind)) {
        state.activeEvent={kind,remaining:BUFFS[kind].duration,duration:BUFFS[kind].duration,team:id,...meta};
      }
      state.lastEvent={kind,team:id,...meta};
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
      for(const hazard of state.hazards)hazard.y-=shift;
      state.hazards=state.hazards.filter(hazard=>hazard.y>=-2&&hazard.y<state.height+2);
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
      body.radius=team.buffs.big>0?MC.big.bodyRadius:0.35;
      const speedScale=team.buffs.fast>0?MC.fast.physicsSpeedScale:1;
      const previousScale=body.speedScale||1;
      if(speedScale!==previousScale){body.vx*=speedScale/previousScale;body.vy*=speedScale/previousScale;}
      body.speedScale=speedScale;
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
            enqueue('big',body.team,index%state.width,Math.floor(index/state.width),{radius:MC.big.contactBlastRadius,shape:'circle'});
          }
        }
      },speedScale);
      // Keep SPIN's characteristic fast rotation while collisions stay circular.
      if(team.buffs.spin>0)body.rotation=(body.rotation+MC.spin.rotationRate*step)%(Math.PI*2);
      streamRows();
    }
    function update(seconds) {
      if(!finite(seconds) || seconds<=0 || state.paused) return;
      const dt=Math.min(seconds,LIMITS.maxDelta);
      updateVisuals(dt);
      if(state.activeEvent) {
        state.activeEvent.remaining=Math.max(0,state.activeEvent.remaining-dt);
        if(state.activeEvent.remaining<=1e-10&&!hasPendingAction(state.activeEvent.actionId))state.activeEvent=null;
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
        const events=endless?config.SELECTED_EVENTS:state.layout!=='arena'?Object.keys(EVENTS):['rain','meteor','tnt','turbo','descomunal','nuke'];
        let accepted=action({type:events[Math.floor(random()*events.length)]});
        if(!accepted) accepted=action({type:endless?'spin':'turbo'});
        if(accepted) state.eventCount++;
        state.nextEventIn=settings.eventInterval;
      }
      const budget={remaining:LIMITS.maxBlockOps};
      if(endless){advanceWeather(step,budget);advanceHazards(step,budget);}
      advanceEntities(step,budget);
      processExplosions(budget);
      if(endless)updateBody(step,budget);
      else {
        // Reserve equal work for both miners even while a full explosion queue drains.
        const perTeam=Math.floor(budget.remaining/2);
        for(const id of TEAM_IDS) mine(id,step,{remaining:perTeam});
      }
      updateFocus();
      advanceResults(step);
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
      state.weather=null;
      state.hazards.length=0;
      for(const result of state.actionResults)if(!result.completed){result.completed=true;result.cancelled=true;}
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

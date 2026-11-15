(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./config.js'));
  else root.BlockWarsExperience=factory(root.BlockWarsConfig);
})(typeof globalThis!=='undefined'?globalThis:this,function(config){
  'use strict';
  const audible=new Set([...Object.keys(config.EVENTS),'mine','follow','turbo','descomunal']);
  const FEEDBACK_TTL=8;
  const SUBSCRIBER_ALERT_SECONDS=6;
  const REWARD_LIMIT=64,REWARD_GAP=.25,REWARD_TTL=30000,REWARD_DEDUPE_TTL=120000,REWARD_DEDUPE_LIMIT=256;
  function actorName(value){
    if(typeof value!=='string'||value.length>64)return 'un minero';
    const name=value.normalize('NFKC').replace(/\s+/g,' ').trim();
    return name&&/^[\p{L}\p{N}\p{M} _-]+$/u.test(name)?name.slice(0,32):'un minero';
  }
  function sourceLabel(source){return source==='simulator'?'PRUEBA':source==='tikfinity'?'RELAY SIN VERIFICAR':source==='youtube'?'':'LA MINA';}
  function createExperience(engine,rules,audio,onNotice=()=>{},options={}){
    const youtube=options.platform==='youtube';
    const now=options.now||Date.now,rewards=[],rewardSeen=new Map(),deferredOrigins=new Map();
    let context=null,sequence=0,impactSeen=new WeakSet(),nextRewardAt=0,lastAutomaticEngineId=null;
    const state={lastActivation:null,lastFeedback:null,subscriberAlert:null,elapsed:0,rewardQueue:0,rewardsDropped:0,rewardsActivated:0};
    // Local IDs never incorporate viewer names, hashes or event identifiers.
    const session=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
    const nextId=()=>session+':'+(++sequence);
    const perform=engine.action;
    function publish(detail,message){
      const feedback={...detail,message,at:state.elapsed,until:state.elapsed+FEEDBACK_TTL};
      state.lastFeedback=feedback;
      try{onNotice(message,feedback);}catch{/* A broken overlay must not interrupt gameplay. */}
      return feedback;
    }
    function announce(kind,team,origin,id=nextId()){
      if(!audible.has(kind))return;
      const source=['simulator','tikfinity','youtube'].includes(origin?.source)?origin.source:'automatic';
      const name=source==='automatic'?'':origin?.actorName||'';
      const subscriberDemo=youtube&&kind==='follow'&&source==='simulator';
      const label=config.EVENTS[kind]?.label||({mine:'MINERÍA',follow:subscriberDemo?'SUSCRIPTOR DE PRUEBA':'NUEVO FOLLOW',turbo:'TURBO',descomunal:'DESCOMUNAL'})[kind];
      const by=name?name:source==='automatic'?'La mina':'La comunidad';
      const activation={id,kind,team:team||'neutral',actorName:name,source,at:state.elapsed,until:state.elapsed+FEEDBACK_TTL};
      if(origin?.reward)activation.speechKind=origin.speechKind;
      if(source==='youtube'&&origin?.reward&&origin.speechKind==='youtube_subscriber'){
        const moderated=name.slice(0,80).normalize('NFKC').replace(/[^\p{L}\p{M}\p{N} _-]/gu,'').replace(/\s+/g,' ').trim().slice(0,24);
        const at=now()/1000;
        state.subscriberAlert={id,actorName:moderated||'NUEVO MINERO',at,until:at+SUBSCRIBER_ALERT_SECONDS};
      }
      if(source==='automatic')activation.engineActionId=origin?.engineActionId||'';
      state.lastActivation=activation;
      const message=[sourceLabel(source),by].filter(Boolean).join(' · ')+(subscriberDemo?' simula un nuevo suscriptor gratuito del canal':kind==='follow'?' recibe un refuerzo de bienvenida':kind==='mine'?' refuerza la minería para el próximo contacto':' activó '+label);
      publish({...activation,accepted:true,reason:'activated',retryAfterMs:0},message);
      const sound={id,kind,team:team||'neutral',actorName:name,source};
      if(youtube||source==='youtube'){
        // Comments retain FX; only dedicated rewards and explicit demos request speech.
        const speechKind=origin?.reward?origin.speechKind:subscriberDemo?'youtube_subscriber':source==='simulator'&&kind==='tnt'&&origin?.trigger==='like'?'like_milestone':null;
        sound.narrate=Boolean(speechKind);
        if(speechKind)sound.speechKind=speechKind;
      }
      try{audio.notify(sound);}catch{/* Accepted actions continue when audio is unavailable. */}
    }
    engine.action=function(action,metadata){
      // Deferred community credits retain their source without borrowing a spectator's name.
      const origin=metadata?.community&&['simulator','tikfinity','youtube'].includes(metadata.source)?{source:metadata.source,actorName:metadata.source==='youtube'?context?.actorName||'':'',trigger:metadata.trigger}:context;
      const id=origin?.reward?origin.id:nextId(),source=['simulator','tikfinity','youtube'].includes(origin?.source)?origin.source:'automatic';
      const accepted=perform(action,{actor:source==='automatic'?'':origin?.actorName||'',source,actionId:id});
      if(accepted){
        const kind=context?.follow?'follow':action.type;
        if(engine.state.lastAdmission?.actionId===id&&engine.state.lastAdmission.queued){
          deferredOrigins.set(id,{kind,origin});
          publish({id,kind,source,actorName:origin?.actorName||'',accepted:true,reason:'queued',retryAfterMs:0},
            [sourceLabel(source),origin?.actorName,config.EVENTS[action.type]?.label||kind,'recibido · en cola'].filter(Boolean).join(' · '));
        }else announce(kind,action.team,origin,id);
      }
      return accepted;
    };
    engine.subscribeDeferredActions?.(detail=>{
      const pending=deferredOrigins.get(detail.actionId);
      if(!pending){if(detail.source==='automatic')announceAutomatic(detail);return;}
      deferredOrigins.delete(detail.actionId);
      announce(pending.kind,detail.team,pending.origin,detail.actionId);
    });
    function announceAutomatic(detail){
      if(detail.source!=='automatic'||detail.actionId===lastAutomaticEngineId)return;
      lastAutomaticEngineId=detail.actionId;
      announce(detail.kind,detail.team,{source:'automatic',engineActionId:detail.actionId});
    }
    function scoped(origin,callback){
      const previous=context;context=origin;
      try{return callback();}finally{context=previous;}
    }
    function feedback(outcome,origin){
      if(!outcome||['unknown','duplicate','ignored','invalid','idle'].includes(outcome.reason))return;
      const seconds=Math.ceil(outcome.retryAfterMs/1000),label=config.EVENTS[outcome.kind]?.label||outcome.kind||'Acción';
      const reasons={
        global_cooldown:'Enfriamiento de comandos: disponible en '+seconds+' s.',
        actor_cooldown:'Tu siguiente acción estará disponible en '+seconds+' s.',
        engine_cooldown:label+' disponible en '+seconds+' s de juego.',
        engine_busy:label+' no se activó: hay otro efecto en curso o el motor está ocupado.',
        paused:label+' no se activó: la mina está pausada.',
        unavailable:label+' no se activó: el motor no está disponible.',
        no_team:'Elige equipo con !dark o !light antes de minar.',
        identity_required:'Esta acción necesita una identidad de chat válida.',
        capacity:'No se activó: se alcanzó el límite local de participantes.',
        already_selected:'Ya perteneces a ese equipo.',
        already_voted:'Tu voto ya fue contado en este ciclo.',
        locked_pick:'Ese pico todavía no está desbloqueado.',
        vote:'Voto registrado. El efecto se activará al completar la votación.',
        accepted:outcome.kind==='dark'||outcome.kind==='light'?'Equipo '+outcome.kind.toUpperCase()+' seleccionado.':rules.state.lastMessage||'Comando aceptado.'
      };
      const message=reasons[outcome.reason]||(outcome.accepted?'Participación aceptada.':'La acción no se activó.');
      publish({id:nextId(),...outcome,source:origin.source,actorName:origin.actorName},[sourceLabel(origin.source),message].filter(Boolean).join(' · '));
    }
    function handleEvent(event){
      if(event?.source==='youtube'&&event.type!=='comment')return handleReward(event);
      const command=typeof event?.data?.text==='string'?event.data.text.trim().toLowerCase():'';
      const community=event?.type==='like'||event?.source!=='youtube'&&['!boom','!voterain'].includes(command);
      const origin={source:event?.source,follow:event?.type==='follow',actorName:community?'':event?.source==='youtube'&&typeof event?.actor?.displayName==='string'?Array.from(event.actor.displayName.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'')).slice(0,44).join(''):actorName(event?.actor?.displayName)};
      const previous=state.lastActivation,previousFeedback=state.lastFeedback;
      const accepted=scoped(origin,()=>rules.handle(event));
      if((event?.type==='comment'||event?.type==='follow')&&previous===state.lastActivation&&previousFeedback===state.lastFeedback)feedback(rules.state.lastOutcome,origin);
      return accepted;
    }
    function action(input){return scoped({source:'simulator',actorName:''},()=>engine.action(input));}
    function clearRewards(){state.rewardsDropped+=rewards.length;rewards.length=0;state.rewardQueue=0;}
    function cancelRewards(){
      clearRewards();state.subscriberAlert=null;
      engine.cancelPendingActions?.('youtube');
      for(const [id,pending]of deferredOrigins)if(pending.origin?.source==='youtube')deferredOrigins.delete(id);
      try{audio.cancelYouTubeRewards?.();}catch{/* Reader cancellation must remain safe when audio is unavailable. */}
    }
    function drainReward(){
      if(engine.state.paused){clearRewards();return;}
      const at=now();
      for(let i=rewards.length-1;i>=0;i--)if(rewards[i].expires<=at){rewards.splice(i,1);state.rewardsDropped++;}
      state.rewardQueue=rewards.length;
      if(!rewards.length||state.elapsed+1e-9<nextRewardAt)return;
      const subscriber=rewards.findIndex(item=>item.type==='subscriber'),index=subscriber<0?0:subscriber,item=rewards[index];
      nextRewardAt=state.elapsed+REWARD_GAP;
      // Official rewards keep their own expiry/priority queue and voice grants;
      // do not transfer them into the command backlog where they could outlive it.
      const charges=item.type==='like'?3:10;
      if(engine.state.pendingActionCount>0||
        (engine.state.entities?.length||0)+(engine.state.queue?.length||0)+charges>config.LIMITS.maxQueue)return;
      let accepted=false,failed=false;
      try{accepted=scoped(item.origin,()=>engine.action({type:'nuke',count:charges,team:'neutral'}));}
      catch{failed=true;}
      // Temporary engine capacity keeps the reward pending until its original expiry.
      if(accepted||failed)rewards.splice(index,1);
      if(accepted)state.rewardsActivated++;else if(failed)state.rewardsDropped++;
      state.rewardQueue=rewards.length;
    }
    function handleReward(event){
      if(!youtube||engine.state.paused||event?.source!=='youtube'||!['like','subscriber'].includes(event.type)||
        typeof event.id!=='string'||!/^ytr:[a-f0-9]{32}$/.test(event.id)||!Number.isSafeInteger(event.receivedAt)||event.receivedAt<0||
        typeof event.actor?.displayName!=='string'||(event.type==='like'?event.data?.delta!==1||event.actor.displayName!=='':!event.actor.displayName.trim()))return false;
      const at=now();
      if(event.receivedAt>at+1000)return false;
      for(const [id,until]of rewardSeen)if(until<=at)rewardSeen.delete(id);
      if(rewardSeen.has(event.id)||at-event.receivedAt>=REWARD_TTL)return false;
      if(rewards.length>=REWARD_LIMIT){
        const like=event.type==='subscriber'?rewards.findIndex(item=>item.type==='like'):-1;
        if(like<0){state.rewardsDropped++;return false;}
        rewards.splice(like,1);state.rewardsDropped++;
      }
      rewardSeen.set(event.id,at+REWARD_DEDUPE_TTL);while(rewardSeen.size>REWARD_DEDUPE_LIMIT)rewardSeen.delete(rewardSeen.keys().next().value);
      rewards.push({type:event.type,expires:Math.min(at,event.receivedAt)+REWARD_TTL,
        origin:{reward:true,id:event.id,source:'youtube',actorName:event.actor.displayName,speechKind:event.type==='like'?'like_milestone':'youtube_subscriber'}});
      state.rewardQueue=rewards.length;drainReward();return true;
    }
    function pause(value){if(value){clearRewards();state.subscriberAlert=null;}}
    function clear(){clearRewards();deferredOrigins.clear();lastAutomaticEngineId=null;nextRewardAt=state.elapsed;state.lastActivation=null;state.lastFeedback=null;state.subscriberAlert=null;impactSeen=new WeakSet();}
    function update(dt){
      if(Number.isFinite(dt)&&dt>0)state.elapsed+=dt;
      drainReward();
      if(state.subscriberAlert&&now()/1000>=state.subscriberAlert.until)state.subscriberAlert=null;
      for(const key of ['lastActivation','lastFeedback'])if(state[key]&&state.elapsed>=state[key].until)state[key]=null;
      const count=engine.state.eventCount,contacts=engine.state.body?.collisions||0;
      engine.update(dt);
      if((engine.state.body?.collisions||0)>contacts)audio.impact?.('mine');
      // Engine IDs repeat on deterministic reset; audio IDs must stay unique across resets/reloads.
      if(engine.state.eventCount>count&&engine.state.lastEvent)announceAutomatic(engine.state.lastEvent);
      for(const effect of engine.state.effects||[]){
        if(effect.stage==='impact'&&!impactSeen.has(effect)){impactSeen.add(effect);audio.impact?.(effect.kind);}
      }
      scoped(null,()=>rules.flush());
    }
    return {handleEvent,handleReward,cancelRewards,action,update,clear,pause,reset:clear,state};
  }
  return {createExperience};
});

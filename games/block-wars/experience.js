(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./config.js'));
  else root.BlockWarsExperience=factory(root.BlockWarsConfig);
})(typeof globalThis!=='undefined'?globalThis:this,function(config){
  'use strict';
  const audible=new Set([...Object.keys(config.EVENTS),'mine','follow','turbo','descomunal']);
  const FEEDBACK_TTL=8;
  function actorName(value){
    if(typeof value!=='string'||value.length>64)return 'un minero';
    const name=value.normalize('NFKC').replace(/\s+/g,' ').trim();
    return name&&/^[\p{L}\p{N}\p{M} _-]+$/u.test(name)?name.slice(0,32):'un minero';
  }
  function sourceLabel(source){return source==='simulator'?'PRUEBA':source==='tikfinity'?'RELAY SIN VERIFICAR':'EVENTO DE LA MINA';}
  function createExperience(engine,rules,audio,onNotice=()=>{}){
    let context=null,sequence=0,impactSeen=new WeakSet();
    const state={lastActivation:null,lastFeedback:null,elapsed:0};
    // Local IDs never incorporate viewer names, hashes or event identifiers.
    const session=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
    const nextId=()=>session+':'+(++sequence);
    const perform=engine.action;
    function publish(detail,message){
      const feedback={...detail,message,at:state.elapsed,until:state.elapsed+FEEDBACK_TTL};
      state.lastFeedback=feedback;onNotice(message,feedback);return feedback;
    }
    function announce(kind,team,origin,id=nextId()){
      if(!audible.has(kind))return;
      const source=['simulator','tikfinity'].includes(origin?.source)?origin.source:'automatic';
      const name=source==='automatic'?'':origin?.actorName||'';
      const label=config.EVENTS[kind]?.label||({mine:'MINERÍA',follow:'NUEVO FOLLOW',turbo:'TURBO',descomunal:'DESCOMUNAL'})[kind];
      const by=name?name:source==='automatic'?'La mina':'La comunidad';
      const activation={id,kind,team:team||'neutral',actorName:name,source,at:state.elapsed,until:state.elapsed+FEEDBACK_TTL};
      if(source==='automatic')activation.engineActionId=origin?.engineActionId||'';
      state.lastActivation=activation;
      const message=sourceLabel(source)+' · '+by+(kind==='follow'?' recibe un refuerzo de bienvenida':kind==='mine'?' refuerza la minería para el próximo contacto':' activó '+label);
      publish({...activation,accepted:true,reason:'activated',retryAfterMs:0},message);
      audio.notify({id,kind,team:team||'neutral',actorName:name,source});
    }
    engine.action=function(action,metadata){
      // Deferred community credits retain their source without borrowing a spectator's name.
      const origin=metadata?.community&&['simulator','tikfinity'].includes(metadata.source)?{source:metadata.source,actorName:''}:context;
      const id=nextId(),source=['simulator','tikfinity'].includes(origin?.source)?origin.source:'automatic';
      const accepted=perform(action,{actor:source==='automatic'?'':origin?.actorName||'',source,actionId:id});
      if(accepted)announce(context?.follow?'follow':action.type,action.team,origin,id);
      return accepted;
    };
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
      publish({id:nextId(),...outcome,source:origin.source,actorName:origin.actorName},sourceLabel(origin.source)+' · '+message);
    }
    function handleEvent(event){
      const command=typeof event?.data?.text==='string'?event.data.text.trim().toLowerCase():'';
      const community=event?.type==='like'||['!boom','!voterain'].includes(command);
      const origin={source:event?.source,follow:event?.type==='follow',actorName:community?'':actorName(event?.actor?.displayName)};
      const previous=state.lastActivation;
      const accepted=scoped(origin,()=>rules.handle(event));
      if((event?.type==='comment'||event?.type==='follow')&&previous===state.lastActivation)feedback(rules.state.lastOutcome,origin);
      return accepted;
    }
    function action(input){return scoped({source:'simulator',actorName:''},()=>engine.action(input));}
    function clear(){state.lastActivation=null;state.lastFeedback=null;impactSeen=new WeakSet();}
    function update(dt){
      if(Number.isFinite(dt)&&dt>0)state.elapsed+=dt;
      for(const key of ['lastActivation','lastFeedback'])if(state[key]&&state.elapsed>=state[key].until)state[key]=null;
      const count=engine.state.eventCount;
      engine.update(dt);
      // Engine IDs repeat on deterministic reset; audio IDs must stay unique across resets/reloads.
      if(engine.state.eventCount>count&&engine.state.lastEvent)announce(engine.state.lastEvent.kind,engine.state.lastEvent.team,{source:'automatic',engineActionId:engine.state.lastEvent.actionId});
      for(const effect of engine.state.effects||[]){
        if(effect.stage==='impact'&&!impactSeen.has(effect)){impactSeen.add(effect);audio.impact?.(effect.kind);}
      }
      scoped(null,()=>rules.flush());
    }
    return {handleEvent,action,update,clear,reset:clear,state};
  }
  return {createExperience};
});

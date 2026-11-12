(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./config.js'));
  else root.BlockWarsExperience=factory(root.BlockWarsConfig);
})(typeof globalThis!=='undefined'?globalThis:this,function(config){
  'use strict';
  const audible=new Set([...Object.keys(config.EVENTS),'mine','follow','turbo','descomunal']);
  function actorName(value){
    if(typeof value!=='string'||!value.trim()||value.length>64||!/^[\p{L}\p{N}\p{M} _-]+$/u.test(value))return 'un minero';
    return value.normalize('NFKC').slice(0,32);
  }
  function createExperience(engine,rules,audio,onNotice=()=>{}){
    let context=null,sequence=0;
    // IDs are local, unique within this browser instance and contain no viewer identifiers.
    const session=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
    const perform=engine.action;
    function announce(kind,team,origin){
      if(!audible.has(kind))return;
      audio.notify({id:session+':'+(++sequence),kind,team:team||'neutral',
        actorName:origin?.actorName||'',source:origin?.source||'automatic'});
    }
    engine.action=function(action,metadata){
      const accepted=perform(action);
      // Rules retain the origin of deferred community credits separately from engine input.
      const origin=metadata?.community&&['simulator','tikfinity'].includes(metadata.source)?{source:metadata.source,actorName:''}:context;
      if(accepted)announce(context?.follow?'follow':action.type,action.team,origin);
      return accepted;
    };
    function scoped(origin,callback){
      const previous=context;context=origin;
      try{return callback();}finally{context=previous;}
    }
    function handleEvent(event){
      const community=event?.type==='like'||['!boom','!rain'].includes(event?.data?.text?.trim().toLowerCase());
      const origin={source:event?.source,follow:event?.type==='follow',actorName:community?'':actorName(event?.actor?.displayName)};
      const accepted=scoped(origin,()=>rules.handle(event));
      if(event?.type==='comment'||event?.type==='follow')onNotice((event.source==='simulator'?'PRUEBA':'RELAY SIN VERIFICAR')+' · '+
        (accepted?'Participación aceptada. Las cargas se aplican al próximo contacto.':'Sin recompensa: elige equipo o espera el enfriamiento; la acción puede estar rechazada.'));
      return accepted;
    }
    function action(input){return scoped({source:'simulator',actorName:''},()=>engine.action(input));}
    function update(dt){
      const count=engine.state.eventCount;
      engine.update(dt);
      if(engine.state.eventCount>count&&engine.state.lastEvent)announce(engine.state.lastEvent.kind,engine.state.lastEvent.team);
      // Deferred community credits have no individual author.
      scoped(null,()=>rules.flush());
    }
    return {handleEvent,action,update};
  }
  return {createExperience};
});

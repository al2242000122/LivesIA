(function(root,factory){
  'use strict';
  const api=typeof module==='object'&&module.exports?factory(require('./events.js'),globalThis):factory(root.LiveEvents,root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.LiveTransport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(LiveEvents,root){
  'use strict';
  function connect(options={}){
    const env=options.env||root,target=options.target||'snake';
    const adapter=options.adapter||LiveEvents.createAdapter();
    const state={relay:'connecting',controls:'connecting',source:'none',verified:false,metrics:adapter.metrics};
    let stopped=false,ws=null,sse=null,wsTimer=null,sseTimer=null,wsAttempt=0,sseAttempt=0;
    function emitStatus(){if(!stopped)options.onStatus?.({...state});}
    function deliver(event){
      if(!event||stopped)return;
      state.source=event.source;
      try{options.onEvent?.(event);}catch{state.callbackErrors=(state.callbackErrors||0)+1;}
      emitStatus();
    }
    function retry(kind){
      if(stopped)return;
      if(kind==='ws'){
        env.clearTimeout(wsTimer);wsTimer=env.setTimeout(openWebSocket,Math.min(30000,1000*2**Math.min(wsAttempt++,5)));
      }else{
        env.clearTimeout(sseTimer);sseTimer=env.setTimeout(openControls,Math.min(30000,1000*2**Math.min(sseAttempt++,5)));
      }
    }
    function openWebSocket(){
      if(stopped)return;
      state.relay='connecting';emitStatus();
      let socket;
      try{socket=new env.WebSocket('ws://127.0.0.1:21213/');ws=socket;}
      catch{state.relay='offline';emitStatus();retry('ws');return;}
      socket.onopen=()=>{if(stopped||ws!==socket)return;wsAttempt=0;state.relay='connected';emitStatus();};
      socket.onmessage=packet=>{if(!stopped&&ws===socket)deliver(adapter.normalize(packet.data,'tikfinity'));};
      socket.onclose=()=>{if(stopped||ws!==socket)return;state.relay='offline';emitStatus();retry('ws');};
      socket.onerror=()=>{if(stopped||ws!==socket)return;try{socket.close();}catch{state.relay='offline';emitStatus();retry('ws');}};
    }
    function openControls(){
      if(stopped)return;
      state.controls='connecting';emitStatus();
      let stream;
      try{stream=new env.EventSource(`/api/stream?target=${encodeURIComponent(target)}`);sse=stream;}
      catch{state.controls='offline';emitStatus();retry('sse');return;}
      stream.onopen=()=>{if(stopped||sse!==stream)return;sseAttempt=0;state.controls='connected';emitStatus();};
      stream.onmessage=packet=>{
        if(stopped||sse!==stream||typeof packet.data!=='string'||packet.data.length>16384)return;
        let raw;try{raw=JSON.parse(packet.data);}catch{return;}
        if(!raw||typeof raw!=='object'||Array.isArray(raw)||(raw.target||'snake')!==target)return;
        if(['pause','reset','frenzy','bw_action','bw_settings','bw_pause','bw_reset','bw_emergency'].includes(raw.type)){
          try{options.onControl?.(raw);}catch{state.callbackErrors=(state.callbackErrors||0)+1;}
        }else deliver(adapter.normalize(raw,'simulator'));
      };
      stream.onerror=()=>{
        if(stopped||sse!==stream)return;
        state.controls='offline';emitStatus();
        if(stream.readyState===env.EventSource.CLOSED)retry('sse');
      };
    }
    function stop(){
      if(stopped)return;stopped=true;
      env.clearTimeout(wsTimer);env.clearTimeout(sseTimer);
      try{ws?.close();}catch{/* already closed */}
      try{sse?.close();}catch{/* already closed */}
    }
    openControls();openWebSocket();
    return {stop,adapter,state};
  }
  return {connect};
});

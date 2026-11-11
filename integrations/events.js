(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LiveEvents=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=128?value:
    Number.isSafeInteger(value)&&value>=0?String(value):null;
  function clean(value,max=44){
    return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,max):'';
  }
  function integer(value,min,max,fallback){
    if(value===undefined)return fallback;
    if(typeof value!=='number'&&typeof value!=='string')return null;
    if(typeof value==='string'&&(!value.trim()||value.length>16))return null;
    const n=Number(value);
    return Number.isSafeInteger(n)&&n>=min?Math.min(n,max):null;
  }
  // Ephemeral pseudonym for cooldowns only, not an authentication credential or
  // a claim of cryptographic anonymization. Nothing is persisted to disk.
  function pseudonym(value,salt){
    let a=2166136261,b=2246822507;
    for(const char of salt+value){a=Math.imul(a^char.charCodeAt(0),16777619);b=Math.imul(b^char.charCodeAt(0),3266489909);}
    return `${(a>>>0).toString(36)}${(b>>>0).toString(36)}`;
  }
  function createAdapter(options={}){
    const now=options.now||Date.now,salt=String(options.salt??Math.random());
    const maxKeys=Math.max(32,Math.min(4096,options.maxKeys||2048));
    const rateLimit=Math.max(10,Math.min(1000,options.rateLimit||200));
    const seen=new Map(),metrics={accepted:0,rejected:0,duplicates:0,pending:0,rateLimited:0,withoutId:0,dedupeSize:0};
    let sequence=0,windowStart=-Infinity,windowCount=0;
    function normalize(input,source){
      const receivedAt=now();
      if(source!=='tikfinity'&&source!=='simulator'){metrics.rejected++;return null;}
      if(receivedAt-windowStart>=1000||receivedAt<windowStart){windowStart=receivedAt;windowCount=0;}
      if(++windowCount>rateLimit){metrics.rateLimited++;return null;}
      let raw=input;
      if(typeof raw==='string'){
        if(raw.length>16384){metrics.rejected++;return null;}
        try{raw=JSON.parse(raw);}catch{metrics.rejected++;return null;}
      }else{
        try{if(JSON.stringify(raw)?.length>16384){metrics.rejected++;return null;}}catch{metrics.rejected++;return null;}
      }
      const reject=()=>{metrics.rejected++;return null;};
      if(!record(raw))return reject();
      const simulated=source==='simulator';
      const d=simulated?raw:raw.data;
      if(!record(d))return reject();
      const wireType=simulated?raw.type:raw.event;
      if(typeof wireType!=='string')return reject();
      const aliases={chat:'comment',comment:'comment',like:'like',follow:'follow',subscribe:'subscribe_paid',subscribe_paid:'subscribe_paid',gift:'gift',roomuser:'viewer_count',viewer_count:'viewer_count'};
      const type=aliases[wireType.toLowerCase()];
      if(!type)return reject();
      const user=record(d.user)?d.user:{};
      const identity=[d.userId,user.id,d.uniqueId,user.uniqueId,user.displayId,d.username,d.actor,d.name,d.nickname,user.nickname].map(identifier).find(Boolean)||'anonymous';
      const actor={displayName:clean(d.nickname??user.nickname??d.name??d.uniqueId??user.displayId)||'Espectador',stableHash:pseudonym(`${source}:${identity}`,salt)};
      const common=record(d.common)?d.common:{};
      const suppliedId=simulated?raw.id:(d.msgId??common.msgId);
      let id=identifier(suppliedId);
      if(suppliedId!==undefined&&suppliedId!==null&&!id)return reject();
      const data={};
      if(type==='like'){
        const delta=simulated?(raw.target==='block-wars'?raw.count??25:100):d.likeCount;
        data.delta=integer(delta,0,1000,null);if(data.delta===null)return reject();
      }else if(type==='comment'){
        const text=simulated?d.text??'!manzana':d.comment;
        if(typeof text!=='string'||text.length>500)return reject();
        data.text=clean(text,500);
      }else if(type==='gift'){
        const gift=record(d.gift)?d.gift:{};
        const giftType=d.giftType??gift.type;
        if(giftType!==undefined&&integer(giftType,0,100,null)===null)return reject();
        if(Number(giftType)===1&&d.repeatEnd!==true&&d.repeatEnd!==1){metrics.pending++;return null;}
        data.count=integer(simulated?d.count:d.repeatCount,1,20,1);if(data.count===null)return reject();
        const name=d.giftName??gift.name??'Regalo';if(typeof name!=='string')return reject();
        data.giftName=clean(name,80);data.giftId=identifier(d.giftId??gift.id);
        const group=identifier(d.groupId);
        if(group&&group!=='0')id=`group:${group}:${actor.stableHash}:${data.giftId||data.giftName}`;
        else if(id)id=`${id}:${actor.stableHash}:${data.giftId||data.giftName}:${data.count}`;
      }else if(type==='viewer_count'){
        // totalUser is cumulative and must never masquerade as concurrency.
        data.count=integer(d.viewerCount,0,100000000,null);if(data.count===null)return reject();
        data.estimated=d.estimated===true;
      }
      for(const [key,until] of seen)if(until<=receivedAt)seen.delete(key);
      if(id){
        const key=`${source}:${type}:${id}`;
        if(seen.has(key)){metrics.duplicates++;return null;}
        if(seen.size>=maxKeys){metrics.rateLimited++;return null;}
        seen.set(key,receivedAt+120000);
      }else{metrics.withoutId++;id=`ephemeral:${++sequence}`;}
      metrics.accepted++;metrics.dedupeSize=seen.size;
      return {type,source,id,receivedAt,actor,data};
    }
    return {normalize,metrics};
  }
  return {createAdapter,clean};
});

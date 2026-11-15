'use strict';

// Counters are observations, not individual liker identities. No names are persisted.
const MAX_SAMPLE_LIKES=200,MAX_IDENTITIES=5000,MAX_GRANTS=256,GRANT_TTL=120000;
const voiceName=value=>value.slice(0,80).normalize('NFKC').replace(/[^\p{L}\p{M}\p{N} _-]/gu,'').replace(/\s+/g,' ').trim().slice(0,24);
function createRewardTracker({now=Date.now,digest,onEvent=()=>{}}){
  const subscribers=new Set(),grants=new Map();
  let highWater=null,subscriberBaseline=null,sequence=0,stopped=false;
  const state={state:'synchronizing',likesObserved:null,likesTriggered:0,subscribersTriggered:0,dropped:0,publicListLimited:false,error:null};
  const invalid=()=>Object.assign(new Error('youtube_reward_snapshot'),{code:'youtube_reward_snapshot'});
  function maintain(){for(const [id,value]of grants)if(value.until<=now())grants.delete(id);}
  function emit(type,name,identity){
    if(stopped)return;
    const id='ytr:'+digest(type+':'+identity+':'+(++sequence));
    const event={type,source:'youtube',id,receivedAt:now(),actor:{displayName:name,stableHash:digest(identity)},data:type==='like'?{delta:1}:{}};
    maintain();
    if(grants.size>=MAX_GRANTS)grants.delete(grants.keys().next().value);
    grants.set(id,{kind:type==='like'?'like_milestone':'youtube_subscriber',name:voiceName(name),until:now()+GRANT_TTL});
    onEvent(event);
  }
  function ready(){if(highWater!==null&&subscriberBaseline!==null){state.state='active';state.error=null;}}
  function likes(value){
    if(stopped)return;
    if(typeof value!=='string'||!/^\d{1,16}$/.test(value)||!Number.isSafeInteger(Number(value)))throw invalid();
    const count=Number(value);state.likesObserved=count;
    if(highWater===null){highWater=count;ready();return;}
    const delta=Math.max(0,count-highWater),take=Math.min(delta,MAX_SAMPLE_LIKES);
    highWater=Math.max(highWater,count);
    for(let i=0;i<take;i++){emit('like','',String(highWater-take+i+1));state.likesTriggered++;}
    state.dropped+=delta-take;ready();
  }
  function subscribersSnapshot(items){
    if(stopped)return;
    if(!Array.isArray(items)||items.length>50)throw invalid();
    const baseline=subscriberBaseline===null;
    if(baseline)subscriberBaseline=now();
    state.publicListLimited=items.length===50;
    for(const item of items){
      const identity=item?.subscriberSnippet?.channelId,title=item?.subscriberSnippet?.title,published=item?.snippet?.publishedAt;
      if(typeof identity!=='string'||!/^UC[A-Za-z0-9_-]{22}$/.test(identity)||typeof title!=='string'||title.length>512)continue;
      const key=digest(identity);if(subscribers.has(key))continue;
      if(subscribers.size>=MAX_IDENTITIES){state.dropped++;continue;}
      subscribers.add(key);
      const time=typeof published==='string'&&published.length<=40?Date.parse(published):NaN;
      const name=Array.from(title.replace(/[\p{C}\p{Zl}\p{Zp}]/gu,'')).slice(0,44).join('').trim();
      if(baseline||!name||!Number.isFinite(time)||time<=subscriberBaseline||time>now())continue;
      emit('subscriber',name,identity);state.subscribersTriggered++;
    }
    ready();
  }
  function claimSpeech(payload){
    maintain();const grant=grants.get(payload.actionId);
    if(stopped||!grant||payload.source!=='youtube'||payload.team!=='neutral'||payload.kind!==grant.kind||payload.actorName!==grant.name)return false;
    grants.delete(payload.actionId);return true;
  }
  function error(code){grants.clear();state.state=code==='youtube_quota'?'quota_exhausted':'error';state.error=['youtube_quota','youtube_auth_required','youtube_ended','youtube_channel_mismatch','youtube_reward_snapshot'].includes(code)?code:'youtube_rewards_unavailable';}
  function stop(){stopped=true;grants.clear();subscribers.clear();state.state='stopped';}
  return {likes,subscribers:subscribersSnapshot,claimSpeech,error,stop,status:()=>({...state})};
}
module.exports={createRewardTracker,voiceName};

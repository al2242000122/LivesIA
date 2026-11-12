(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./config.js'));
  else root.BlockWarsRules=factory(root.BlockWarsConfig);
})(typeof globalThis!=='undefined'?globalThis:this,function(engineConfig){
  'use strict';
  if(!engineConfig||!engineConfig.EVENTS)throw new Error('Load BlockWarsConfig before BlockWarsRules');
  const {EVENTS}=engineConfig;
  const EFFECT_ALIASES=Object.create(null);
  for(const type of Object.keys(EVENTS)){
    const alias=type.replace(/_/g,' ');EFFECT_ALIASES[alias]=type;EFFECT_ALIASES[alias.replace(/ /g,'')]=type;
  }
  function effectType(command){
    if(command==='!rain')return null; // Preserve the original once-per-round vote.
    const alias=command.startsWith('!')?command.slice(1):command;
    return Object.prototype.hasOwnProperty.call(EFFECT_ALIASES,alias)?EFFECT_ALIASES[alias]:null;
  }
  const SOURCES=['simulator','tikfinity'];
  const PICKS={ '!madera':'wood','!piedra':'stone','!oro':'gold','!diamante':'diamond','!netherita':'netherite' };
  const DEFAULTS={likeThreshold:25,teamCooldownMs:60000,mineCooldownMs:15000,boomCooldownMs:30000,followCooldownMs:60000,effectCooldownMs:10000,actorEffectCooldownMs:15000,
    rainThreshold:5,boomThreshold:3,pickVoteThreshold:3,pickWindowMs:30000,maxEffectsPerFlush:8,maxActors:2000,maxDedupe:4000,
    actorTtlMs:1800000,dedupeTtlMs:300000,maxLikeDelta:1000000,maxNotifications:6};
  const RANGES={likeThreshold:[5,1000],teamCooldownMs:[60000,3600000],mineCooldownMs:[15000,3600000],boomCooldownMs:[30000,3600000],
    followCooldownMs:[1000,3600000],effectCooldownMs:[1000,3600000],actorEffectCooldownMs:[1000,3600000],rainThreshold:[1,1000],boomThreshold:[1,1000],pickVoteThreshold:[1,1000],pickWindowMs:[1000,60000],
    maxEffectsPerFlush:[1,8],maxActors:[1,10000],maxDedupe:[1,20000],actorTtlMs:[60000,86400000],dedupeTtlMs:[1000,86400000],
    maxLikeDelta:[1,1000000],maxNotifications:[1,20]};
  const COUNTER_CAP=Number.MAX_SAFE_INTEGER;
  function add(a,b){return Math.min(COUNTER_CAP,a+b);}
  function config(options,base){
    if(!options||typeof options!=='object'||Array.isArray(options))throw new RangeError('Invalid rules settings');
    const result=Object.assign({},base);
    for(const key of Object.keys(options)){
      if(!Object.prototype.hasOwnProperty.call(RANGES,key)||!Number.isSafeInteger(options[key])||options[key]<RANGES[key][0]||options[key]>RANGES[key][1])throw new RangeError('Invalid rules setting: '+key);
      result[key]=options[key];
    }
    if(result.actorTtlMs<Math.max(result.teamCooldownMs,result.mineCooldownMs,result.boomCooldownMs,result.followCooldownMs,result.actorEffectCooldownMs,result.pickWindowMs))throw new RangeError('Actor TTL must preserve cooldowns');
    return result;
  }
  function voteCounts(){return {wood:0,stone:0,gold:0,diamond:0,netherite:0};}
  function sourceMetrics(){return {likes:0,follows:0,comments:0,commands:0,duplicates:0,ignored:0,rejected:0,tnt:0,effects:0};}
  function createRules(engine,options){
    if(!engine||typeof engine.action!=='function'||!engine.state)throw new TypeError('An engine is required');
    let settings=config(options===undefined?{}:options,DEFAULTS),clock=0,lastSweep=-Infinity,round=engine.state.round,pickWindow=-1;
    const actors=new Map(),dedupe=new Map(),rainVoters=new Map();
    const buckets={simulator:{progress:0,pending:0},tikfinity:{progress:0,pending:0}};
    const metrics={bySource:{simulator:sourceMetrics(),tikfinity:sourceMetrics()},rejected:0};
    const state={likes:0,likeProgress:0,likesRemainder:0,likeThreshold:settings.likeThreshold,pendingTnt:0,likeProgressBySource:{simulator:0,tikfinity:0},
      membershipCounts:{dark:0,light:0},teams:{dark:{members:0,votes:voteCounts(),pickWinner:null},light:{members:0,votes:voteCounts(),pickWinner:null}},
      rainVotes:0,rainThreshold:settings.rainThreshold,boomCharge:0,boomThreshold:settings.boomThreshold,pickWindowMs:settings.pickWindowMs,
      effectCooldownMs:settings.effectCooldownMs,actorEffectCooldownMs:settings.actorEffectCooldownMs,nextEffectInMs:0,notifications:[],lastMessage:'',trackedActors:0,trackedDedupe:0,trackedVotes:0};
    let rainTriggered=false,drainFirst=0,lastEffectAt=-Infinity;
    function notify(kind,message,team){
      state.notifications.push({kind,message,team:team||'neutral'});
      if(state.notifications.length>settings.maxNotifications)state.notifications.shift();
      state.lastMessage=message;
    }
    function refresh(){
      state.nextEffectInMs=Math.max(0,settings.effectCooldownMs-(clock-lastEffectAt));
      state.likes=add(metrics.bySource.simulator.likes,metrics.bySource.tikfinity.likes);
      state.likeProgress=buckets.simulator.progress+buckets.tikfinity.progress;state.likesRemainder=state.likeProgress;
      state.pendingTnt=buckets.simulator.pending+buckets.tikfinity.pending;
      for(const source of SOURCES)state.likeProgressBySource[source]=buckets[source].progress;
      state.trackedActors=actors.size;state.trackedDedupe=dedupe.size;state.trackedVotes=rainVoters.size;
      for(const team of ['dark','light'])state.teams[team].members=state.membershipCounts[team];
    }
    function sync(at){
      clock=Math.max(clock,at);
      if(round!==engine.state.round){
        round=engine.state.round;rainVoters.clear();state.rainVotes=0;rainTriggered=false;state.boomCharge=0;
        state.teams.dark.votes=voteCounts();state.teams.light.votes=voteCounts();pickWindow=-1;
      }
      const window=round+':'+settings.pickWindowMs+':'+Math.floor(clock/settings.pickWindowMs);
      if(window!==pickWindow){pickWindow=window;state.teams.dark.votes=voteCounts();state.teams.light.votes=voteCounts();state.teams.dark.pickWinner=null;state.teams.light.pickWinner=null;}
      if(clock-lastSweep>=1000){
        lastSweep=clock;
        for(const [key,record] of actors)if(clock-record.lastSeen>=settings.actorTtlMs){if(record.team)state.membershipCounts[record.team]--;actors.delete(key);}
        for(const [key,until] of dedupe)if(until<=clock)dedupe.delete(key);
      }
      refresh();
    }
    function record(key){
      let value=actors.get(key);
      if(!value){
        if(actors.size>=settings.maxActors)return null;
        value={team:null,changedAt:-Infinity,mineAt:-Infinity,boomAt:-Infinity,followAt:-Infinity,effectAt:-Infinity,pickWindow:null,lastSeen:clock};actors.set(key,value);
      }
      value.lastSeen=clock;return value;
    }
    function ready(){return !engine.state.paused&&engine.state.phase==='playing';}
    function act(action){return ready()&&engine.action(action)===true;}
    function flush(){
      sync(clock);if(!ready())return 0;
      let budget=settings.maxEffectsPerFlush,accepted=0;
      for(let i=0;i<2&&budget;i++){
        const source=SOURCES[(drainFirst+i)%2],bucket=buckets[source],count=Math.min(budget,bucket.pending);
        if(count&&act({type:'tnt',team:'neutral',count})){
          bucket.pending-=count;budget-=count;accepted+=count;metrics.bySource[source].tnt=add(metrics.bySource[source].tnt,count);
          notify('tnt','TNT comunitaria activada');
        }
      }
      drainFirst=1-drainFirst;refresh();return accepted;
    }
    function reject(source){metrics.rejected=add(metrics.rejected,1);if(source)metrics.bySource[source].rejected=add(metrics.bySource[source].rejected,1);return false;}
    function handle(event){
      if(!event||typeof event!=='object'||!SOURCES.includes(event.source)||!Number.isSafeInteger(event.receivedAt)||event.receivedAt<0||!event.data||typeof event.data!=='object')return reject();
      const source=event.source,m=metrics.bySource[source];sync(event.receivedAt);
      if(event.type==='gift'||event.type==='subscribe_paid'){m.ignored=add(m.ignored,1);return false;}
      if(!['like','follow','comment'].includes(event.type))return reject(source);
      if(event.id!==undefined&&event.id!==null){
        if(typeof event.id!=='string'||event.id.length<1||event.id.length>160)return reject(source);
        const key=source+':'+event.id;
        if(dedupe.has(key)&&dedupe.get(key)>clock){m.duplicates=add(m.duplicates,1);return false;}
        if(dedupe.has(key))dedupe.delete(key);
        if(dedupe.size>=settings.maxDedupe)return reject(source);
        dedupe.set(key,clock+settings.dedupeTtlMs);refresh();
      }
      if(event.type==='like'){
        const delta=event.data.delta;
        if(!Number.isSafeInteger(delta)||delta<1||delta>settings.maxLikeDelta)return reject(source);
        const bucket=buckets[source];
        if(bucket.pending>Math.floor(COUNTER_CAP/settings.likeThreshold)-delta)return reject(source);
        m.likes=add(m.likes,delta);const sum=bucket.progress+delta;bucket.pending+=Math.floor(sum/settings.likeThreshold);bucket.progress=sum%settings.likeThreshold;
        flush();return true;
      }
      const hash=event.actor&&event.actor.stableHash;
      if(hash!==undefined&&hash!==null&&hash!==''&&(typeof hash!=='string'||!/^[a-zA-Z0-9:_-]{1,128}$/.test(hash)))return reject(source);
      const identified=typeof hash==='string'&&hash.length>0,key=source+':'+(identified?'user:'+hash:'anonymous');
      if(event.type==='comment'){
        m.comments=add(m.comments,1);
        if(typeof event.data.text!=='string'||event.data.text.length>256)return reject(source);
        const command=event.data.text.trim().toLowerCase().replace(/\s+/g,' '),effect=effectType(command);
        if(!effect&&!['!dark','!light','!mine','!boom','!rain','!pico',...Object.keys(PICKS)].includes(command))return false;
        if(effect&&(!ready()||clock-lastEffectAt<settings.effectCooldownMs))return reject(source);
        const user=record(key);if(!user)return reject(source);
        const ok=comment(command,user,key,identified,effect);
        if(ok&&effect)m.effects=add(m.effects,1);
        if(ok)m.commands=add(m.commands,1);else return reject(source);
        refresh();return true;
      }
      const user=record(key);if(!user||clock-user.followAt<settings.followCooldownMs)return reject(source);
      if(!act({type:'repair',team:user.team||'neutral'}))return reject(source);
      user.followAt=clock;m.follows=add(m.follows,1);notify('follow','Nuevo follow: refuerzo gratuito',user.team);refresh();return true;
    }
    function comment(command,user,key,identified,effect){
      if(effect){
        if(clock-lastEffectAt<settings.effectCooldownMs||clock-user.effectAt<settings.actorEffectCooldownMs)return false;
        if(!act({type:effect,team:user.team||'neutral'}))return false;
        lastEffectAt=clock;user.effectAt=clock;notify('effect','Evento gratuito: '+EVENTS[effect].label,user.team);return true;
      }
      if(command==='!pico'){
        const team=user.team,tool=team&&engine.state.teams[team].pickaxe;
        const names={wood:'madera',stone:'piedra',gold:'oro',diamond:'diamante',netherite:'netherita'};
        notify('info',team?'Pico de equipo: '+(names[tool]||'disponible'):'Elige equipo con !dark o !light',team);return true;
      }
      if(!identified)return false;
      if(command==='!dark'||command==='!light'){
        const team=command.slice(1);
        if(user.team===team||clock-user.changedAt<settings.teamCooldownMs)return false;
        if(user.team)state.membershipCounts[user.team]--;user.team=team;user.changedAt=clock;state.membershipCounts[team]++;
        notify('team','Equipo '+team.toUpperCase()+' seleccionado',team);return true;
      }
      if(command==='!rain'){
        if(rainTriggered||rainVoters.has(key)||rainVoters.size>=settings.maxActors)return false;
        rainVoters.set(key,true);state.rainVotes++;
        if(state.rainVotes>=settings.rainThreshold){
          if(act({type:'rain',team:'neutral'})){rainTriggered=true;notify('rain','Lluvia comunitaria activada');}
          else{rainVoters.delete(key);state.rainVotes--;return false;}
        }
        return true;
      }
      if(!user.team)return false;
      if(command==='!mine'){
        if(clock-user.mineAt<settings.mineCooldownMs||!act({type:'mine',team:user.team}))return false;
        user.mineAt=clock;return true;
      }
      if(command==='!boom'){
        if(clock-user.boomAt<settings.boomCooldownMs)return false;
        if(state.boomCharge+1>=settings.boomThreshold){if(!act({type:'tnt',team:user.team}))return false;state.boomCharge=0;notify('tnt','Carga comunitaria activada',user.team);}
        else state.boomCharge++;
        user.boomAt=clock;return true;
      }
      const pick=PICKS[command],team=engine.state.teams[user.team],unlocked=team.unlocked;
      if(!pick||user.pickWindow===pickWindow||!(Array.isArray(unlocked)?unlocked.includes(pick):unlocked&&unlocked[pick]===true))return false;
      const ballot=state.teams[user.team],votes=ballot.votes;
      if(!ballot.pickWinner&&votes[pick]+1>=settings.pickVoteThreshold){
        if(!act({type:'pickaxe',team:user.team,pickaxe:pick}))return false;
        ballot.pickWinner=pick;notify('pickaxe','Pico elegido por votación',user.team);
      }
      votes[pick]++;user.pickWindow=pickWindow;
      return true;
    }
    function configure(patch){
      let next;try{next=config(patch,settings);}catch{return false;}
      if(next.maxActors<Math.max(actors.size,rainVoters.size)||next.maxDedupe<dedupe.size)return false;
      // Existing credits retain their original threshold; only each source's remainder is repriced.
      for(const source of SOURCES){const bucket=buckets[source];bucket.pending+=Math.floor(bucket.progress/next.likeThreshold);bucket.progress%=next.likeThreshold;}
      settings=next;state.effectCooldownMs=next.effectCooldownMs;state.actorEffectCooldownMs=next.actorEffectCooldownMs;state.likeThreshold=next.likeThreshold;state.rainThreshold=next.rainThreshold;state.boomThreshold=next.boomThreshold;state.pickWindowMs=next.pickWindowMs;
      while(state.notifications.length>settings.maxNotifications)state.notifications.shift();
      refresh();return true;
    }
    function reset(){
      actors.clear();dedupe.clear();rainVoters.clear();clock=0;lastSweep=-Infinity;round=engine.state.round;pickWindow=-1;rainTriggered=false;lastEffectAt=-Infinity;
      for(const source of SOURCES){Object.assign(metrics.bySource[source],sourceMetrics());buckets[source].progress=0;buckets[source].pending=0;}
      metrics.rejected=0;state.membershipCounts.dark=0;state.membershipCounts.light=0;state.teams.dark.votes=voteCounts();state.teams.light.votes=voteCounts();
      state.teams.dark.pickWinner=null;state.teams.light.pickWinner=null;state.rainVotes=0;state.boomCharge=0;state.notifications.length=0;state.lastMessage='';refresh();
    }
    function clearPending(){
      for(const source of SOURCES){buckets[source].pending=0;buckets[source].progress=0;}
      state.boomCharge=0;refresh();
    }
    return {handle,flush,reset,configure,clearPending,metrics,state};
  }
  return {createRules,DEFAULTS:Object.freeze(DEFAULTS)};
});

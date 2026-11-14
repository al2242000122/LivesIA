'use strict';
const {
  randomBytes,createHmac
}=require('node:crypto');
const fail=code=>Object.assign(new Error(code), {
  code
});
const MAX_BYTES=262144, MAX_ITEMS=200, MAX_DEDUPE=2048;
const MAX_STREAM_BYTES=1024*1024;
const MAX_STREAM_DURATION_MS=300000;
const {
  JsonArrayFramer,boundedShape,providerCode
}=require('./youtube-chat-parser');
function createYouTubeChat({
  fetchImpl=globalThis.fetch,getAccessToken,expectedChannelId,onEvent=()=> {
  },onState=()=> {
  },now=Date.now,timers=globalThis,random=Math.random,quotaLimit=8000,minPollMs=15000,idleTimeoutMs=90000
}= {
}) {
  const salt=randomBytes(32);
  let generation=0,controller=null,waiters=new Set(),discovery=null,cache=null,owned=false,day='',used=0;
  let s= {
    state:'idle',videoId:null,received:0,discarded:0,duplicates:0,quotaUsed:0,error:null,transport:null
  };
  const digest=x=>createHmac('sha256',salt).update(x).digest('hex').slice(0,32);
  const status=()=>({
    ...s
  });
  const valid=g=>g===generation&&!controller?.signal.aborted;
  function update(g,patch) {
    if(!valid(g))return;
    const before=JSON.stringify(s);
    Object.assign(s,patch);
    if(before!==JSON.stringify(s))onState(status());
  }
  function cancel() {
    controller?.abort();
    for(const w of waiters) {
      timers.clearTimeout(w.id);
      w.resolve();
    }
    waiters.clear();
  }
  async function deadline(p,ms,signal) {
    let id,abort;
    try {
      return await Promise.race([p,new Promise((_,reject)=> {
        id=timers.setTimeout(()=>reject(fail('youtube_timeout')),ms);
        abort=()=>reject(fail('youtube_cancelled'));
        if(signal?.aborted)abort();
        else signal?.addEventListener('abort',abort, {
          once:true
        });
      })]);
    } finally {
      timers.clearTimeout(id);
      signal?.removeEventListener('abort',abort);
    }
  }
  function sleep(ms,g) {
    if(!valid(g))return Promise.resolve();
    return new Promise(resolve=> {
      const w= {
        resolve,id:null
      };
      w.id=timers.setTimeout(()=> {
        waiters.delete(w);
        resolve();
      },ms);
      waiters.add(w);
    });
  }
  function charge(cost) {
    const d=new Intl.DateTimeFormat('en-CA', {
      timeZone:'America/Los_Angeles'
    }).format(new Date(now()));
    if(d!==day) {
      used=0;
      day=d;
    }
    if(used+cost>quotaLimit)throw fail('youtube_quota');
    used+=cost;
    s.quotaUsed=used;
  }
  function discardBody(response) {
    try {
      Promise.resolve(response?.body?.cancel()).catch(()=> {
      });
    } catch {
    }
  }
  async function request(endpoint,params,g,cost=1) {
    if(!valid(g))throw fail('youtube_cancelled');
    charge(cost);
    const signal=controller.signal;
    const token=await deadline(Promise.resolve().then(()=>getAccessToken({
      signal
    })),15000,signal);
    if(!valid(g))throw fail('youtube_cancelled');
    const url=new URL(endpoint);
    for(const[k,v]of Object.entries(params))if(v!==null&&v!==undefined)url.searchParams.set(k,String(v));
    let expired=false;
    const pending=Promise.resolve().then(()=>fetchImpl(url.href, {
      method:'GET',redirect:'error',headers: {
        Authorization:`Bearer ${token}`
      },signal
    }));
    pending.then(r=> {
      if(expired||!valid(g))discardBody(r);
    },()=> {
    });
    let r;
    try {
      r=await deadline(pending,20000,signal);
    } catch(e) {
      expired=true;
      throw e;
    }
    if(!valid(g)) {
      discardBody(r);
      throw fail('youtube_cancelled');
    }
    if(!r.ok) {
      discardBody(r);
      throw fail(r.status===401||r.status===403?'youtube_auth_required':r.status===429?'youtube_quota':r.status===404?'youtube_ended':r.status>=500?'youtube_transient':'youtube_stream_unsupported');
    }
    return r;
  }
  async function json(endpoint,params,g,cost) {
    const r=await request(endpoint,params,g,cost);
    let reader;
    try {
      reader=r.body.getReader();
      let bytes=0,chunks=[];
      const finish=async()=> {
        while(true) {
          const x=await reader.read();
          if(x.done)break;
          bytes+=x.value.byteLength;
          if(bytes>MAX_BYTES)throw fail('youtube_response_large');
          chunks.push(x.value);
        }
        const b=Buffer.concat(chunks.map(x=>Buffer.from(x)));
        return boundedShape(JSON.parse(new TextDecoder('utf-8', {
          fatal:true
        }).decode(b)));
      };
      const value=await deadline(finish(),20000,controller.signal);
      if(!valid(g))throw fail('youtube_cancelled');
      if(value.error)throw fail(providerCode(value.error));
      return value;
    } finally {
      try {
        Promise.resolve(reader?.cancel()).catch(()=> {
        });
      } catch {
      }
    }
  }
  const base='https://www.googleapis.com/youtube/v3/';
  async function owner(g) {
    if(owned)return;
    const r=await json(base+'channels', {
      part:'id',mine:true,fields:'items(id)',maxResults:50
    },g);
    if(!valid(g))throw fail('youtube_cancelled');
    if(!/^UC[A-Za-z0-9_-]{22}$/.test(expectedChannelId||'')||!r.items?.some(x=>x.id===expectedChannelId))throw fail('youtube_channel_mismatch');
    owned=true;
  }
  async function broadcasts() {
    if(discovery)return discovery;
    if(cache&&now()-cache.at<60000)return cache.items.map(x=>({
      ...x
    }));
    if(!controller||controller.signal.aborted)controller=new AbortController();
    const g=generation;
    discovery=(async()=> {
      await owner(g);
      const r=await json(base+'liveBroadcasts', {
        part:'snippet,status',mine:true,broadcastType:'all',maxResults:50,fields:'items(id,snippet(title),status(privacyStatus,lifeCycleStatus))'
      },g);
      if(!valid(g))throw fail('youtube_cancelled');
      const items=(r.items||[]).slice(0,50).filter(x=>/^[\w-]{11}$/.test(x.id)).map(x=>({
        id:x.id,title:String(x.snippet?.title||'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,160),privacy:String(x.status?.privacyStatus||'unknown').slice(0,20),status:String(x.status?.lifeCycleStatus||'unknown').slice(0,30)
      }));
      cache= {
        at:now(),items
      };
      return items.map(x=>({
        ...x
      }));
    })().finally(()=> {
      discovery=null;
    });
    return discovery;
  }
  async function run(videoId,g) {
    let cursor=null,baseline=0,history=true,chatId=null,transport='stream',attempt=0,responseBudget=MAX_ITEMS;
    const seen=new Map();
    function batch(value) {
      if(!valid(g))return;
      if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>32)throw fail('youtube_framing');
      if(value.error)throw fail(providerCode(value.error));
      if(value.offlineAt)throw fail('youtube_ended');
      if(typeof value.nextPageToken==='string'&&value.nextPageToken.length<=4096)cursor=value.nextPageToken;
      const items=Array.isArray(value.items)?value.items:[];
      const take=Math.min(items.length,MAX_ITEMS);
      for(const item of items.slice(0,take)) {
        s.received++;
        if(history) {
          if(typeof item?.id==='string'&&item.id.length<=256)seen.set(item.id,now());
          while(seen.size>MAX_DEDUPE)seen.delete(seen.keys().next().value);
          s.discarded++;
          continue;
        }
        const id=item?.id,a=item?.authorDetails,sp=item?.snippet,ts=Date.parse(sp?.publishedAt);
        if(typeof id!=='string'||id.length>256||!id||typeof a?.channelId!=='string'||!/^UC[\w-]{22}$/.test(a.channelId)||typeof a.displayName!=='string'||!a.displayName.trim()||a.displayName.length>500||sp?.type!=='textMessageEvent'||typeof sp.textMessageDetails?.messageText!=='string'||!Number.isFinite(ts)||ts<baseline||now()-ts>15000||ts>now()+5000) {
          s.discarded++;
          continue;
        }
        if(seen.has(id)) {
          s.duplicates++;
          continue;
        }
        seen.set(id,now());
        while(seen.size>MAX_DEDUPE)seen.delete(seen.keys().next().value);
        const clean=x=>x.replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,'');
        const name=Array.from(clean(a.displayName)).slice(0,44).join('').trim();
        if(!name) {
          s.discarded++;
          continue;
        }
        if(responseBudget<=0) {
          s.discarded++;
          continue;
        }
        responseBudget--;
        if(valid(g))onEvent({
          type:'comment',source:'youtube',id:'yt:'+digest(id),receivedAt:now(),actor: {
            displayName:name,stableHash:digest(a.channelId)
          },data: {
            text:Array.from(clean(sp.textMessageDetails.messageText)).slice(0,500).join('')
          }
        });
      }
      s.discarded+=Math.max(0,items.length-take);
      history=false;
      for(const[id,time]of seen)if(now()-time>60000)seen.delete(id);
      update(g, {
        state:'connected',error:null,transport
      });
      // Rotate only after the complete batch has established its continuation cursor.
      // Never keep a healthy stream open after its callback allowance is spent.
      if(transport==='stream'&&responseBudget===0)throw fail('youtube_stream_rotate');
    }
    try {
      await owner(g);
      while(valid(g)&&!chatId) {
        const r=await json(base+'videos', {
          part:'snippet,liveStreamingDetails',id:videoId,fields:'items(id,snippet(channelId),liveStreamingDetails(activeLiveChatId,actualStartTime,actualEndTime))'
        },g);
        if(!valid(g))return;
        const v=r.items?.find(x=>x.id===videoId);
        if(!v||v.snippet?.channelId!==expectedChannelId)throw fail('youtube_channel_mismatch');
        if(v.liveStreamingDetails?.actualEndTime)throw fail('youtube_ended');
        const cid=v.liveStreamingDetails?.activeLiveChatId;
        if(typeof cid==='string'&&cid.length>0&&cid.length<=512&&v.liveStreamingDetails.actualStartTime) {
          chatId=cid;
          baseline=now();
          break;
        }
        update(g, {
          state:'waiting_live'
        });
        await sleep(60000,g);
      }
      while(valid(g)) {
        try {
          update(g, {
            state:history?'synchronizing':'reconnecting',transport
          });
          if(transport==='poll') {
            responseBudget=MAX_ITEMS;
            const r=await json(base+'liveChat/messages', {
              part:'snippet,authorDetails',liveChatId:chatId,maxResults:200,pageToken:cursor,fields:'items(id,snippet(type,publishedAt,textMessageDetails(messageText)),authorDetails(channelId,displayName)),nextPageToken,pollingIntervalMillis,offlineAt'
            },g,5);
            if(!valid(g))return;
            batch(r);
            attempt=0;
            await sleep(Math.max(15000,minPollMs,Number.isFinite(Number(r.pollingIntervalMillis))&&Number(r.pollingIntervalMillis)<=2147483647?Number(r.pollingIntervalMillis):2147483647),g);
          } else {
            responseBudget=MAX_ITEMS;
            const r=await request('https://youtube.googleapis.com/youtube/v3/liveChat/messages/stream', {
              part:'snippet,authorDetails',liveChatId:chatId,maxResults:200,pageToken:cursor
            },g,5);
            const reader=r.body?.getReader();
            if(!reader)throw fail('youtube_stream_unsupported');
            const parser=new JsonArrayFramer(batch);
            const expiresAt=now()+MAX_STREAM_DURATION_MS;
            let streamBytes=0;
            try {
              while(valid(g)) {
                const remaining=expiresAt-now();
                if(remaining<=0)throw fail('youtube_stream_rotate');
                let x;
                try {
                  x=await deadline(reader.read(),Math.min(90000,idleTimeoutMs,remaining),controller.signal);
                } catch(e) {
                  if(e.code==='youtube_timeout'&&now()>=expiresAt)throw fail('youtube_stream_rotate');
                  throw e;
                }
                if(!valid(g))return;
                if(x.done) {
                  parser.end();
                  break;
                }
                streamBytes+=x.value.byteLength;
                if(streamBytes>MAX_STREAM_BYTES)throw fail('youtube_stream_rotate');
                parser.push(x.value);
              }
              attempt=0;
            } finally {
              try {
                Promise.resolve(reader.cancel()).catch(()=> {
                });
              } catch {
              }
            }
            if(!cursor) {
              history=true;
              baseline=now();
            }
            await sleep(15000,g);
          }
        } catch(e) {
          if(!valid(g))return;
          const code=e.code||'youtube_transient';
          if(code==='youtube_stream_rotate') {
            attempt=0;
            if(!cursor) {
              history=true;
              baseline=now();
            }
            update(g,{state:'reconnecting',error:null});
            await sleep(15000,g);
            continue;
          }
          if(['youtube_framing','youtube_stream_unsupported','youtube_provider'].includes(code)&&transport==='stream') {
            transport='poll';
            if(!cursor) {
              history=true;
              baseline=now();
            }
            continue;
          }
          if(!['youtube_timeout','youtube_transient'].includes(code))throw e;
          update(g, {
            state:'reconnecting',error:'youtube_transient'
          });
          if(!cursor) {
            history=true;
            baseline=now();
          }
          const jittered=1000*2**Math.min(attempt++,6)*(0.75+random()*0.5);
          await sleep(Math.max(15000,Math.min(60000,jittered)),g);
        }
      }
    } catch(e) {
      if(!valid(g))return;
      const code=/^youtube_auth_[a-z_]+$/.test(e.code||'')?e.code:({
        youtube_quota:'youtube_quota',youtube_ended:'youtube_ended',youtube_disabled:'youtube_disabled',youtube_channel_mismatch:'youtube_channel_mismatch'
      }
      [e.code]||'youtube_unavailable');
      update(g, {
        state:code==='youtube_quota'?'quota_exhausted':code==='youtube_ended'?'ended':'error',error:code
      });
    }
  }
  async function select(videoId) {
    cancel();
    generation++;
    controller=new AbortController();
    const g=generation;
    s= {
      ...s,state:'idle',videoId:null,error:null,transport:null
    };
    if(typeof videoId!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      update(g, {
        state:'error',error:'youtube_video_invalid'
      });
      return false;
    }
    update(g, {
      state:'synchronizing',videoId
    });
    void run(videoId,g);
    return true;
  }
  function stop() {
    cancel();
    generation++;
    s= {
      ...s,state:'stopped'
    };
    onState(status());
  }
  return {
    select,broadcasts,stop,status
  };
}
module.exports= {
  createYouTubeChat,JsonArrayFramer
};

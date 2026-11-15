const test=require('node:test'),assert=require('node:assert/strict');
const {createYouTubeChat}=require('../lib/youtube-chat');
const channel='UC'+'a'.repeat(22),video='abcdefghijk';
function fixture({wrong=false}={}){
 let time=100000,likes=10,subscriptions=[],scheduled=new Set();const events=[],calls=[];
 const timers={setTimeout(fn,ms){const t={fn,ms};scheduled.add(t);return t;},clearTimeout(t){scheduled.delete(t);}};
 const response=value=>({ok:true,body:new ReadableStream({start(c){c.enqueue(Buffer.from(JSON.stringify(value)));c.close();}})});
 const fetchImpl=async url=>{const u=new URL(url);calls.push(u);if(u.pathname.endsWith('/channels'))return response({items:[{id:wrong?'UC'+'b'.repeat(22):channel}]});if(u.pathname.endsWith('/subscriptions'))return response({items:subscriptions});if(u.pathname.endsWith('/videos'))return response({items:[{id:video,snippet:{channelId:channel},statistics:{likeCount:String(likes)},liveStreamingDetails:{activeLiveChatId:'chat',actualStartTime:'2026-01-01'}}]});return response([{items:[],nextPageToken:'cursor'}]);};
 const c=createYouTubeChat({rewardsEnabled:true,expectedChannelId:channel,fetchImpl,getAccessToken:async()=> 'fixture',now:()=>time,timers,onReward:e=>events.push(e)});
 return {c,calls,events,setLikes:n=>likes=n,setSubscribers:v=>subscriptions=v,advance(ms){time+=ms;for(const t of [...scheduled])if(t.ms<=ms){scheduled.delete(t);t.fn();}},async flush(){for(let i=0;i<60;i++)await new Promise(setImmediate);}};
}
test('owned live selection polls official rewards with baseline, one-per-like and public subscriber provenance',async()=>{
 const h=fixture();h.setSubscribers([{snippet:{publishedAt:new Date(90000).toISOString()},subscriberSnippet:{channelId:'UC'+'b'.repeat(22),title:'Old'}}]);await h.c.select(video);await h.flush();assert.equal(h.events.length,0);assert.equal(h.c.status().rewards.state,'active');
 h.setLikes(11);h.advance(15000);await h.flush();assert.equal(h.events.length,1);assert.equal(h.events[0].type,'like');assert.equal(h.events[0].actor.displayName,'');
 h.setSubscribers([{snippet:{publishedAt:new Date(130000).toISOString()},subscriberSnippet:{channelId:'UC'+'c'.repeat(22),title:'Ana 🌻'}}]);h.advance(45000);await h.flush();assert.equal(h.events.length,2);const sub=h.events[1];assert.equal(sub.type,'subscriber');assert.equal(sub.actor.displayName,'Ana 🌻');assert.equal(h.c.claimRewardSpeech({actionId:sub.id,source:'youtube',kind:'youtube_subscriber',actorName:'Ana',team:'neutral'}),true);
 assert.ok(h.calls.some(u=>u.pathname.endsWith('/subscriptions')&&u.searchParams.get('myRecentSubscribers')==='true'));assert.ok(h.c.status().quotaUsed>=9);
 const count=h.calls.length;h.c.stop();h.advance(60000);await h.flush();assert.equal(h.calls.length,count);assert.equal(h.c.status().rewards.state,'stopped');assert.equal(h.c.claimRewardSpeech({actionId:h.events[0].id,source:'youtube',kind:'like_milestone',actorName:'',team:'neutral'}),false);
});
test('reward discovery never starts before verifying channel ownership',async()=>{const h=fixture({wrong:true});await h.c.select(video);await h.flush();assert.equal(h.calls.length,1);assert.equal(h.events.length,0);assert.equal(h.c.status().error,'youtube_channel_mismatch');h.c.stop();});

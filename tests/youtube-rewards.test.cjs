const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {createRewardTracker}=require('../lib/youtube-rewards');
function fixture(){let time=100000;const events=[];const tracker=createRewardTracker({now:()=>time,digest:x=>createHash('sha256').update(x).digest('hex').slice(0,32),onEvent:e=>events.push(e)});return {tracker,events,advance:n=>time+=n};}
const subscriber=(n,time=101000,name='Ana 🌻')=>({snippet:{publishedAt:new Date(time).toISOString()},subscriberSnippet:{channelId:'UC'+String(n).padStart(22,'0'),title:name}});
test('existing likes establish baseline; observed decreases rearm subsequent anonymous like rewards',()=>{const f=fixture();f.tracker.likes('12');assert.equal(f.events.length,0);f.tracker.likes('15');assert.equal(f.events.length,3);assert.ok(f.events.every(e=>e.type==='like'&&e.data.delta===1&&e.actor.displayName===''));f.tracker.likes('13');assert.equal(f.events.length,3);f.tracker.likes('15');assert.equal(f.events.length,5);f.tracker.likes('15');assert.equal(f.events.length,5);f.tracker.likes('16');assert.equal(f.events.length,6);assert.equal(new Set(f.events.map(e=>e.id)).size,6);assert.equal(f.tracker.status().likesObserved,16);});

test('a newly created public resubscription can trigger again; invalid future snapshots never poison identity',()=>{
 const f=fixture();f.tracker.subscribers([subscriber(1,90000)]);f.advance(2000);
 f.tracker.subscribers([subscriber(1,101000),subscriber(2,9999999)]);
 assert.equal(f.events.length,1);
 f.tracker.subscribers([subscriber(1,101000)]);assert.equal(f.events.length,1);
 f.tracker.subscribers([]);f.advance(2000);
 f.tracker.subscribers([subscriber(1,103000),subscriber(2,103000)]);
 assert.equal(f.events.length,3);
 f.tracker.subscribers([subscriber(1,101000),subscriber(2,103000)]);assert.equal(f.events.length,3);
 assert.equal(new Set(f.events.map(e=>e.id)).size,3);
});
test('subscriber baseline and timestamp cutoff suppress history, duplicates and old newly-public subscriptions',()=>{const f=fixture();f.tracker.subscribers([subscriber(1,90000)]);assert.equal(f.events.length,0);f.advance(2000);f.tracker.subscribers([subscriber(2),subscriber(1,90000),subscriber(3,80000)]);assert.equal(f.events.length,1);assert.equal(f.events[0].actor.displayName,'Ana 🌻');f.tracker.subscribers([subscriber(2)]);assert.equal(f.events.length,1);assert.equal(f.tracker.status().subscribersTriggered,1);});
test('only detected typed reward grants authorize a single matching moderated narration for120seconds',()=>{const f=fixture();f.tracker.likes('0');f.tracker.likes('1');f.tracker.subscribers([]);f.advance(2000);f.tracker.subscribers([subscriber(2)]);const [like,sub]=f.events;const payload={actionId:like.id,kind:'like_milestone',actorName:'',source:'youtube',team:'neutral'};assert.equal(f.tracker.claimSpeech({...payload,kind:'nuke'}),false);assert.equal(f.tracker.claimSpeech({...payload,actorName:'Ana'}),false);assert.equal(f.tracker.claimSpeech(payload),true);assert.equal(f.tracker.claimSpeech(payload),false);assert.equal(f.tracker.claimSpeech({...payload,actionId:sub.id,kind:'youtube_subscriber',actorName:'Ana'}),true);f.tracker.likes('2');f.advance(120001);assert.equal(f.tracker.claimSpeech({...payload,actionId:f.events.at(-1).id}),false);});
test('malformed snapshots do not establish baselines, future subscriptions do not fire and bursts stay bounded',()=>{const f=fixture();for(const value of ['-1','1.5','9007199254740992',null])assert.throws(()=>f.tracker.likes(value));f.tracker.likes('0');f.tracker.likes('10000');assert.equal(f.events.length,200);assert.equal(f.tracker.status().dropped,9800);f.tracker.subscribers([]);f.tracker.subscribers([subscriber(1,9999999999)]);assert.equal(f.events.length,200);f.tracker.stop();assert.equal(f.tracker.claimSpeech({actionId:f.events[0].id,kind:'like_milestone',actorName:'',source:'youtube',team:'neutral'}),false);assert.equal(f.tracker.status().state,'stopped');});

test('provider errors invalidate all outstanding reward voice grants',()=>{
 for(const code of ['youtube_ended','youtube_auth_required','youtube_quota','youtube_channel_mismatch','youtube_rewards_unavailable']){
  const f=fixture();f.tracker.likes('0');f.tracker.likes('1');f.tracker.error(code);
  assert.equal(f.tracker.claimSpeech({actionId:f.events[0].id,kind:'like_milestone',actorName:'',source:'youtube',team:'neutral'}),false,code);
 }
});

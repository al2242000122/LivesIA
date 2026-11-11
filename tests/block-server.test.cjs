'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {start}=require('./helpers/server.cjs');
test('Block Wars game, panel and each allowlisted asset load; unknown files remain private',async t=>{
  const s=await start(t);
  for(const path of ['/block-wars','/block-wars/control','/block-wars/style.css','/block-wars/config.js','/block-wars/engine.js','/block-wars/rules.js','/block-wars/render.js','/block-wars/app.js','/block-wars/control.js'])assert.equal((await s.request(path)).status,200,path);
  assert.equal((await s.request('/games/block-wars/engine.js')).status,404);
  assert.equal(JSON.parse((await s.request('/api/block-wars/telemetry')).text).available,false);
});
test('typed Block Wars commands are routed only to their game and always marked simulated',async t=>{
  const s=await start(t),abort=new AbortController();t.after(()=>abort.abort());
  const stream=await fetch(s.base+'/api/stream?target=block-wars',{signal:abort.signal}),reader=stream.body.getReader();await reader.read();
  const wrong=JSON.parse((await s.post({type:'pause'})).text);assert.equal(wrong.receivers,0);
  const command={type:'bw_action',target:'block-wars',action:'pickaxe',team:'dark',pickaxe:'gold',source:'tikfinity',id:'client-id'};
  assert.equal((await s.post(command)).status,200);
  const {value}=await reader.read(),received=JSON.parse(new TextDecoder().decode(value).match(/data: (.*)/)[1]);
  assert.equal(received.target,'block-wars');assert.equal(received.source,'simulation');assert.equal(received.pickaxe,'gold');assert.notEqual(received.id,'client-id');
  assert.equal((await s.post({type:'like',target:'block-wars',count:25})).status,200);
  await reader.cancel();abort.abort();
});
test('Block Wars control rejects malformed settings/actions and cannot enable paid events',async t=>{
  const s=await start(t);
  for(const command of [
    {type:'gift',giftName:'Rose'}, {type:'subscribe'}, {type:'bw_action',action:'shell',text:'whoami'},
    {type:'bw_action',action:'pickaxe',team:'dark',pickaxe:[]},
    {type:'bw_action',action:'enchant',team:'dark',efficiency:6},
    {type:'bw_action',action:'nuke',team:'evil'},
    {type:'bw_settings',settings:{duration:0}}, {type:'bw_settings',settings:{__extra:'secret'}},
    {type:'bw_settings',settings:{reducedMotion:'yes'}}, {type:'bw_reset',seed:-1},
    {type:'bw_pause',paused:'false'}, {type:'like',count:1.5},
  ])assert.equal((await s.post({target:'block-wars',...command})).status,400,JSON.stringify(command));
  assert.equal((await s.post({type:'bw_pause',target:'snake',paused:true})).status,400);
  for(const command of [{type:'bw_settings',settings:{duration:60,eventInterval:5,reducedMotion:true,likeThreshold:25}},
    {type:'bw_pause',paused:false},{type:'bw_reset',seed:42},{type:'bw_emergency'},
    {type:'bw_action',action:'enchant',team:'dark',efficiency:5,unbreaking:3,fortune:3}])assert.equal((await s.post({target:'block-wars',...command})).status,200);
});
test('telemetry is bounded aggregated data, no PII fields or foreign origins',async t=>{
  const s=await start(t),data={fps:60,frameMs:16.67,round:1,remaining:180,queue:0,particles:12,source:'none',paused:false,reducedMotion:false};
  const post=(value,headers={})=>s.request('/api/block-wars/telemetry',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(value)});
  assert.equal((await post({...data,nickname:'private'})).status,400);
  assert.equal((await post({...data,queue:10000})).status,400);
  assert.equal((await post(data,{Origin:'https://evil.example'})).status,403);
  assert.equal((await post(data)).status,200);
  const snapshot=JSON.parse((await s.request('/api/block-wars/telemetry')).text);
  assert.equal(snapshot.available,true);assert.equal(snapshot.fps,60);assert.equal(snapshot.source,'none');assert.ok(snapshot.ageMs>=0);assert.equal('nickname' in snapshot,false);
});

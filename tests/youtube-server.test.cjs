'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {start}=require('./helpers/server.cjs');
const {validateCommand,validateTelemetry,validateYouTubeSelection,validateYouTubeStop}=require('../lib/contracts');

test('YouTube contracts accept only an explicit video and cannot relabel simulator controls',()=>{
  assert.deepEqual(validateYouTubeSelection({videoId:'abcDEF123_-'}),{videoId:'abcDEF123_-'});
  assert.equal(validateYouTubeSelection({videoId:'abcDEF123_-',source:'youtube'}),null);
  assert.deepEqual(validateYouTubeStop({}),{});
  assert.equal(validateCommand({type:'chat',target:'block-wars',text:'RAIN',source:'youtube'}).source,'simulation');
  assert.ok(validateTelemetry({fps:30,frameMs:33,round:1,remaining:10,queue:0,particles:0,source:'youtube',paused:false,reducedMotion:false}));
  assert.equal(validateTelemetry({fps:30,frameMs:33,round:1,remaining:10,queue:0,particles:0,source:'youtube',paused:false,reducedMotion:false,actor:'unexpected'}),null);
});

test('YouTube routes stay disabled without explicit private auth and never expose credentials',async t=>{
  const s=await start(t,{YOUTUBE_AUTH_FILE:''});
  const state=await s.request('/api/youtube/status');
  assert.equal(state.status,200);
  const status=JSON.parse(state.text);
  assert.equal(status.state,'unconfigured');
  assert.equal(status.auth.configured,false);
  assert.equal(status.auth.authenticated,false);
  assert.equal((await s.request('/api/youtube/broadcasts')).status,503);
  for(const [route,body] of [['select',{videoId:'abcDEF123_-'}],['stop',{}]]){
    const result=await s.request('/api/youtube/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal(result.status,route==='select'?503:200);
    assert.doesNotMatch(result.text,/access_token|refresh_token|client_secret|Bearer|YOUTUBE_AUTH_FILE/);
  }
  assert.doesNotMatch(state.text,/access_token|refresh_token|client_secret|Bearer|YOUTUBE_AUTH_FILE/);
});

test('YouTube controls retain host, origin, body and exact selection guards',async t=>{
  const s=await start(t,{YOUTUBE_AUTH_FILE:''});
  const command=(route,body,headers={})=>s.request('/api/youtube/'+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  for(const body of [null,[],{}, {videoId:'https://evil.invalid'}, {videoId:'abcDEF123_-' ,scope:'write'}, {videoId:123}]){
    assert.equal((await command('select',body)).status,400);
  }
  assert.equal((await command('stop',{videoId:'abcDEF123_-'})).status,400);
  for(const route of ['select','stop']){
    assert.equal((await command(route,route==='select'?{videoId:'abcDEF123_-'}:{},{Origin:'https://evil.invalid'})).status,403);
    assert.equal((await command(route,{}, {'Sec-Fetch-Site':'cross-site'})).status,403);
    assert.equal((await command(route,{}, {Host:'evil.invalid:'+s.port})).status,403);
    assert.equal((await command(route,{}, {'Content-Type':'text/plain'})).status,415);
  }
  for(const route of ['status','broadcasts']){
    assert.equal((await s.request('/api/youtube/'+route,{headers:{Origin:'https://evil.invalid'}})).status,403);
  }
});

test('only Block Wars SSE receives the initial safe YouTube state, without comment replay',async t=>{
  const s=await start(t,{YOUTUBE_AUTH_FILE:''});
  const controller=new AbortController();t.after(()=>controller.abort());
  const response=await fetch(s.base+'/api/stream?target=block-wars',{signal:controller.signal});
  const reader=response.body.getReader();
  const first=new TextDecoder().decode((await reader.read()).value);
  assert.match(first,/event: youtube_state/);
  assert.match(first,/unconfigured/);
  assert.doesNotMatch(first,/youtube_comment|refresh_token|client_secret/);
  await reader.cancel();
  const snake=await fetch(s.base+'/api/stream',{signal:controller.signal});
  const snakeReader=snake.body.getReader();
  const initial=new TextDecoder().decode((await snakeReader.read()).value);
  assert.equal(initial,': connected\n\n');await snakeReader.cancel();
});

test('YouTube voice requests need a current server-detected one-time reward grant',async t=>{
 const s=await start(t,{YOUTUBE_AUTH_FILE:''});
 for(const kind of ['like_milestone','youtube_subscriber']){
  const result=await s.request('/api/block-wars/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actionId:'ytr:'+'a'.repeat(32),kind,actorName:'',team:'neutral',source:'youtube'})});
  assert.equal(result.status,403);assert.doesNotMatch(result.text,/token|Bearer|client_secret/);
 }
});

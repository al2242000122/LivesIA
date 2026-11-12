'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateCommand}=require('../lib/contracts.js');
const {start}=require('./helpers/server.cjs');
test('audio commands are typed, bounded and exclusive to Block Wars',()=>{
  const command={type:'bw_audio',target:'block-wars',settings:{muted:true,volume:.5,narration:false}};
  assert.deepEqual(validateCommand(command)?.settings,command.settings);
  for(const settings of [{},{muted:'false'},{volume:1.1},{volume:-1},{volume:NaN},{narration:1},{apiKey:'private'}])assert.equal(validateCommand({...command,settings}),null);
  assert.equal(validateCommand({...command,target:'snake'}),null);
});
test('speech health is local, unconfigured speech fails without any provider request',async t=>{
  const server=await start(t,{ELEVENLABS_API_KEY:'',ELEVENLABS_VOICE_ID:''});
  const status=await server.request('/api/block-wars/speech/status');assert.equal(status.status,200);
  const health=JSON.parse(status.text);assert.equal(health.enabled,false);
  assert.doesNotMatch(status.text,/xi-api-key|sk_[a-zA-Z0-9]{10}/);
  const payload={actionId:'local-test-1',kind:'nuke',actorName:'Demo',source:'simulator',team:'dark'};
  const post=(value,headers={})=>server.request('/api/block-wars/speech',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(value)});
  assert.equal((await post({...payload,text:'Read arbitrary chat'})).status,400);
  assert.equal((await post(payload,{Origin:'https://evil.example'})).status,403);
  const result=await post(payload);assert.equal(result.status,503);assert.equal(JSON.parse(result.text).code,'not_configured');
  for(const file of ['/block-wars/audio.js','/block-wars/experience.js'])assert.equal((await server.request(file)).status,200);
  assert.match((await server.request('/block-wars')).headers['content-security-policy'],/media-src 'self' blob:/);
});

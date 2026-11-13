'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const script=path.join(__dirname,'../scripts/start-youtube-voice.ps1');
const windows=process.platform==='win32';
function run(args,env={}){
  return spawnSync('powershell.exe',['-NoProfile','-File',script,...args],{encoding:'utf8',timeout:15000,env:{...process.env,...env}});
}
test('voice launcher CheckOnly is noninteractive, reveals no key and never starts broadcasting',{skip:!windows},()=>{
  const secret='fixture_secret_must_never_appear';
  const result=run(['-VoiceId','FixtureVoice123','-CheckOnly'],{ELEVENLABS_API_KEY:secret});
  assert.equal(result.status,0,result.stderr);
  assert.ok(!result.stdout.includes(secret));
  const data=JSON.parse(result.stdout);
  assert.equal(data.keyEntry,'masked-local-prompt');assert.equal(data.storesKey,false);assert.equal(data.startsBroadcast,false);
  assert.equal(data.voiceSelected,true);assert.equal(data.characterLimit,12000);
  assert.equal(typeof data.portAvailable,'boolean');
});
test('voice launcher rejects malformed Voice IDs and excessive budgets before prompting',{skip:!windows},()=>{
  for(const args of [['-VoiceId','../secret'],['-MaxCharactersPerHour','100001']]){
    const result=run([...args,'-CheckOnly']);assert.notEqual(result.status,0);assert.ok(!result.error,'must finish without waiting for input');
  }
});

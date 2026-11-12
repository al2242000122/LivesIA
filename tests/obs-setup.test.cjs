'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const setup=require('../scripts/prepare-obs.cjs');

function profileSettings(profile){
  const sections={};let section;
  for(const line of profile.split(/\r?\n/)){
    if(line.startsWith('[')){section=line.slice(1,-1);sections[section]={};}
    else if(line.includes('=')){const index=line.indexOf('=');sections[section][line.slice(0,index)]=line.slice(index+1);}
  }
  return sections;
}
test('OBS rehearsal includes only the local vertical game and its own audio',()=>{
  const scene=setup.buildScene();
  assert.equal(scene.DesktopAudioDevice1,undefined);
  assert.equal(scene.AuxAudioDevice1,undefined);
  assert.deepEqual(scene.sources.map(source=>source.id).sort(),['browser_source','scene']);
  const browser=scene.sources.find(source=>source.id==='browser_source');
  assert.equal(browser.settings.url,'http://127.0.0.1:4173/block-wars');
  assert.equal(browser.settings.width,720);assert.equal(browser.settings.height,1280);
  assert.equal(browser.settings.reroute_audio,true);
  assert.equal(browser.settings.shutdown,false);assert.equal(browser.settings.restart_when_active,false);
  assert.equal(browser.settings.fps,30);assert.equal(browser.settings.webpage_control_level,0);
  assert.equal(browser.mixers,1);assert.equal(browser.monitoring_type,0);
  const profile=setup.buildProfile(path.resolve('artifacts'));
  for(const line of ['BaseCX=720','BaseCY=1280','OutputCX=720','OutputCY=1280','FPSCommon=30','RecFormat2=mkv'])assert.ok(profile.includes(line));
  assert.doesNotMatch(profile,/key=|server=|StartStream/i);
  assert.equal(scene.name,'LivesIA Ensayo');
  const settings=profileSettings(profile);
  assert.equal(settings.SimpleOutput.VBitrate,'3500');
  assert.equal(settings.SimpleOutput.ABitrate,'160');
  assert.equal(settings.Audio.SampleRate,'48000');
  assert.equal(settings.SimpleOutput.UseAdvanced,undefined);
});

test('YouTube OBS collection has one vertical browser and no camera, microphone or desktop capture',()=>{
  const scene=setup.buildScene({platform:'youtube'});
  assert.equal(scene.name,'LivesIA YouTube');
  assert.equal(scene.current_scene,'Mina YouTube');
  assert.equal(scene.current_program_scene,'Mina YouTube');
  assert.deepEqual(scene.scene_order,[{name:'Mina YouTube'}]);
  assert.deepEqual(scene.sources.map(source=>source.id).sort(),['browser_source','scene']);
  for(const device of ['DesktopAudioDevice1','DesktopAudioDevice2','AuxAudioDevice1','AuxAudioDevice2','AuxAudioDevice3','AuxAudioDevice4'])assert.equal(scene[device],undefined);
  const browser=scene.sources.find(source=>source.id==='browser_source');
  assert.equal(browser.settings.url,'http://127.0.0.1:4173/block-wars?platform=youtube');
  assert.equal(browser.settings.width,720);assert.equal(browser.settings.height,1280);
  assert.equal(browser.settings.fps,30);assert.equal(browser.settings.reroute_audio,true);
  assert.equal(browser.mixers,1);assert.equal(browser.monitoring_type,0);
  assert.equal(browser.settings.shutdown,false);assert.equal(browser.settings.restart_when_active,false);
  assert.equal(browser.settings.webpage_control_level,0);
  const item=scene.sources.find(source=>source.id==='scene').settings.items;
  assert.equal(item.length,1);assert.equal(item[0].source_uuid,browser.uuid);
  assert.doesNotMatch(JSON.stringify(scene),/startstream|stream_key|oauth|rtmp[s]?:\/\//i);
});

test('YouTube OBS profile selects x264 CBR 8000, AAC 128 and 44.1kHz stereo with two-second GOP',()=>{
  const profile=setup.buildProfile(path.resolve('artifacts'),{platform:'youtube'});
  const settings=profileSettings(profile);
  assert.equal(settings.General.Name,'LivesIA YouTube');
  assert.equal(settings.Output.Mode,'Simple');
  assert.equal(settings.SimpleOutput.StreamEncoder,'x264');
  assert.equal(settings.SimpleOutput.VBitrate,'8000');
  assert.equal(settings.SimpleOutput.StreamAudioEncoder,'aac');
  assert.equal(settings.SimpleOutput.ABitrate,'128');
  assert.equal(settings.SimpleOutput.UseAdvanced,'true');
  assert.equal(settings.SimpleOutput.x264Settings,'keyint=60');
  assert.equal(settings.SimpleOutput.RecFormat2,'mkv');
  assert.equal(settings.SimpleOutput.RecQuality,'Stream');
  assert.equal(settings.Audio.SampleRate,'44100');assert.equal(settings.Audio.ChannelSetup,'Stereo');
  assert.equal(settings.Video.BaseCX,'720');assert.equal(settings.Video.BaseCY,'1280');
  assert.equal(settings.Video.OutputCX,'720');assert.equal(settings.Video.OutputCY,'1280');
  assert.equal(settings.Video.FPSCommon,'30');
  assert.equal(60*Number(settings.Video.FPSDen)/Number(settings.Video.FPSNum),2);
  assert.doesNotMatch(profile,/key=|server=|StartStream|oauth|rtmp[s]?:\/\//i);
});
test('OBS preparation refuses to overwrite any existing named profile or scene',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'livesia-obs-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const output=setup.prepare(directory,path.join(directory,'recordings'));
  assert.ok(fs.existsSync(output.scene));assert.ok(fs.existsSync(output.profile));
  const original=fs.readFileSync(output.scene,'utf8');
  assert.throws(()=>setup.prepare(directory,path.join(directory,'recordings')),/exist/i);
  assert.equal(fs.readFileSync(output.scene,'utf8'),original);
});

test('local and YouTube preparations coexist in either order without changing existing settings',t=>{
  for(const order of [['local','youtube'],['youtube','local']]){
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'livesia-obs-separated-'));
    t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
    const global=path.join(directory,'global.ini');fs.writeFileSync(global,'CurrentProfile=Personal\n');
    const outputs={};
    for(const platform of order)outputs[platform]=setup.prepare(directory,path.join(directory,'recordings',platform),{platform});
    assert.match(outputs.youtube.profile,/LivesIA_YouTube[\\/]basic\.ini$/);
    assert.match(outputs.youtube.scene,/LivesIA_YouTube\.json$/);
    assert.match(outputs.local.profile,/LivesIA_Ensayo[\\/]basic\.ini$/);
    assert.notEqual(outputs.local.profile,outputs.youtube.profile);
    const before=Object.values(outputs).flatMap(output=>[output.profile,output.scene]).map(file=>[file,fs.readFileSync(file,'utf8')]);
    for(const platform of order)assert.throws(()=>setup.prepare(directory,path.join(directory,'recordings','other'),{platform}),/exist/i);
    for(const [file,contents] of before)assert.equal(fs.readFileSync(file,'utf8'),contents);
    assert.equal(fs.readFileSync(global,'utf8'),'CurrentProfile=Personal\n');
    assert.equal(fs.existsSync(path.join(directory,'recordings','other')),false);
    assert.equal(fs.existsSync(path.join(path.dirname(outputs.youtube.profile),'service.json')),false);
  }
});

test('an existing YouTube scene alone blocks preparation before writing a profile',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'livesia-obs-scene-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const scene=path.join(directory,'basic','scenes','LivesIA_YouTube.json');
  fs.mkdirSync(path.dirname(scene),{recursive:true});fs.writeFileSync(scene,'existing scene');
  assert.throws(()=>setup.prepare(directory,path.join(directory,'recordings'),{platform:'youtube'}),/exist/i);
  assert.equal(fs.readFileSync(scene,'utf8'),'existing scene');
  assert.equal(fs.existsSync(path.join(directory,'basic','profiles','LivesIA_YouTube')),false);
});

test('unknown platforms fail before any OBS files are written',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'livesia-obs-invalid-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  for(const platform of ['twitch','../personal','youtube\nName=Other','',42]){
    assert.throws(()=>setup.buildScene({platform}),/platform/i);
    assert.throws(()=>setup.buildProfile(path.resolve('artifacts'),{platform}),/platform/i);
    assert.throws(()=>setup.prepare(directory,path.join(directory,'recordings'),{platform}),/platform/i);
  }
  assert.deepEqual(fs.readdirSync(directory),[]);
});

test('OBS preparation CLI accepts optional youtube and preserves the original two-argument usage',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'livesia-obs-cli-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  for(const optional of [[],['youtube']]){
    const result=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/prepare-obs.cjs'),directory,path.join(directory,'recordings'),...optional],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const output=JSON.parse(result.stdout);
    assert.equal(JSON.parse(fs.readFileSync(output.scene,'utf8')).name,optional.length?'LivesIA YouTube':'LivesIA Ensayo');
  }
  const invalid=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/prepare-obs.cjs'),directory,path.join(directory,'recordings'),'twitch'],{encoding:'utf8'});
  assert.notEqual(invalid.status,0);
});

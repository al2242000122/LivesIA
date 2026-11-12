'use strict';
// Produces a new, isolated OBS profile/collection. Never changes active OBS settings.
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const NAME='LivesIA Ensayo';
function buildScene(){
  const browserId=randomUUID(),sceneId=randomUUID();
  const browser={name:'Mina infinita',uuid:browserId,id:'browser_source',versioned_id:'browser_source',
    settings:{url:'http://127.0.0.1:4173/block-wars',width:720,height:1280,fps_custom:true,fps:30,
      is_local_file:false,shutdown:false,restart_when_active:false,reroute_audio:true,webpage_control_level:0},
    mixers:1,sync:0,flags:0,volume:.8,balance:.5,enabled:true,muted:false,monitoring_type:0,private_settings:{}};
  const scene={name:'Mina LIVE',uuid:sceneId,id:'scene',versioned_id:'scene',settings:{id_counter:1,custom_size:false,items:[{
    name:browser.name,source_uuid:browserId,visible:true,locked:true,rot:0,pos:{x:0,y:0},scale:{x:1,y:1},align:5,
    bounds_type:0,bounds_align:0,bounds:{x:0,y:0},crop_left:0,crop_top:0,crop_right:0,crop_bottom:0,id:1,
    scale_filter:'disable',blend_method:'default',blend_type:'normal',show_transition:{duration:0},hide_transition:{duration:0}}]},
    mixers:0,sync:0,flags:0,volume:1,balance:.5,enabled:true,muted:false,hotkeys:{'OBSBasic.SelectScene':[]},
    canvas_uuid:'6c69626f-6273-4c00-9d88-c5136d61696e',private_settings:{}};
  return {name:NAME,sources:[browser,scene],groups:[],scene_order:[{name:scene.name}],current_scene:scene.name,
    current_program_scene:scene.name,canvases:[],current_transition:'Fade',transition_duration:300,transitions:[],
    quick_transitions:[],saved_projectors:[],preview_locked:true,scaling_enabled:false,modules:{},version:2};
}
function buildProfile(recordingDirectory){
  if(!path.isAbsolute(recordingDirectory)||/[\r\n\0]/.test(recordingDirectory))throw new TypeError('Absolute recording directory required');
  const directory=recordingDirectory.replace(/\\/g,'/');
  return `[General]\nName=${NAME}\n\n[Output]\nMode=Simple\nFilenameFormatting=LivesIA-%CCYY-%MM-%DD_%hh-%mm-%ss\nReconnect=true\nRetryDelay=2\nMaxRetries=25\n\n[SimpleOutput]\nFilePath=${directory}\nRecFormat2=mkv\nVBitrate=3500\nABitrate=160\nStreamEncoder=x264\nRecEncoder=x264\nPreset=veryfast\nRecQuality=Stream\nRecTracks=1\nStreamAudioEncoder=aac\nRecAudioEncoder=aac\n\n[Video]\nBaseCX=720\nBaseCY=1280\nOutputCX=720\nOutputCY=1280\nFPSType=0\nFPSCommon=30\nFPSInt=30\nFPSNum=30\nFPSDen=1\nScaleType=bicubic\nColorFormat=NV12\nColorSpace=709\nColorRange=Partial\n\n[Audio]\nSampleRate=48000\nChannelSetup=Stereo\n`;
}
function prepare(configDirectory,recordingDirectory){
  const profileDirectory=path.join(configDirectory,'basic','profiles','LivesIA_Ensayo');
  const scene=path.join(configDirectory,'basic','scenes','LivesIA_Ensayo.json');
  if(fs.existsSync(profileDirectory)||fs.existsSync(scene))throw new Error('LivesIA profile or scene already exists; no files overwritten');
  const profileText=buildProfile(recordingDirectory),sceneText=JSON.stringify(buildScene(),null,2);
  fs.mkdirSync(profileDirectory,{recursive:true});fs.mkdirSync(path.dirname(scene),{recursive:true});
  fs.mkdirSync(recordingDirectory,{recursive:true});
  const profile=path.join(profileDirectory,'basic.ini');
  fs.writeFileSync(profile,profileText,{flag:'wx'});fs.writeFileSync(scene,sceneText,{flag:'wx'});
  return {profile,scene,recordingDirectory};
}
if(require.main===module){
  if(process.argv.length!==4){console.error('node scripts/prepare-obs.cjs <OBS config directory> <recordings directory>');process.exitCode=1;}
  else {try{console.log(JSON.stringify(prepare(path.resolve(process.argv[2]),path.resolve(process.argv[3])),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
}
module.exports={buildScene,buildProfile,prepare};

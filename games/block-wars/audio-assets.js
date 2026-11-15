(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BlockWarsAudioAssets=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Original Ogg files imported locally from the pinned official Minecraft asset index.
  const SOUNDS=Object.freeze({
    mine:'dig/stone1',mine2:'dig/stone2',mine3:'dig/stone3',fuse:'random/fuse',
    explode:'random/explode1',explode2:'random/explode2',explode3:'random/explode3',
    thunder:'ambient/weather/thunder1',rain:'ambient/weather/rain1',fire:'fire/fire',
    splash:'liquid/splash',bow:'random/bow',bowhit:'random/bowhit1',levelup:'random/levelup',
    orb:'random/orb',anvil:'random/anvil_land',portal:'portal/trigger',dragon:'mob/enderdragon/growl1',
    elytra:'item/elytra/elytra_loop',riptide:'item/trident/riptide1',creeper:'mob/creeper/say1',break:'random/break'
  });
  const CUES=Object.freeze({
    sixty_seven:['meme_67'],siuuu:['meme_siuuu'],
    mine:['mine'],follow:['levelup'],tnt:['fuse'],nuke:['dragon','fuse'],mega:['anvil','fuse'],
    arrow:['bow'],rainbow:['orb'],butterfly:['elytra'],tnt_rain:['fuse','bow'],
    thunder:['thunder'],fire:['fire'],rain:['rain','elytra'],storm:['rain','thunder'],
    creeper:['creeper','fuse'],tsunami:['splash'],black_hole:['portal'],jackpot:['levelup','fuse'],
    demon:['dragon'],meteor:['fire','anvil'],spin:['riptide'],fast:['elytra'],big:['anvil'],
    turbo:['riptide'],descomunal:['dragon','riptide']
  });
  const IMPACTS=Object.freeze({
    mine:['mine2'],tnt:['explode'],rain:['mine2'],tnt_rain:['explode2'],mega:['explode3'],
    nuke:['explode3','thunder'],creeper:['explode'],thunder:['thunder'],storm:['mine3'],
    meteor:['explode3'],fire:['fire'],arrow:['bowhit'],tsunami:['splash']
  });
  const LOCAL_CLIPS=Object.freeze({meme_67:'/block-wars/audio/meme_67.ogg',meme_siuuu:'/block-wars/audio/meme_siuuu.mp3'});
  return Object.freeze({SOUNDS,CUES,IMPACTS,LOCAL_CLIPS,MUSIC_URL:'/assets-local/audio/background-loop.wav'});
});

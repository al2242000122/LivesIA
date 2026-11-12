'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {tile,pickaxe,tnt}=require('../games/block-wars/textures.js');
const Textures=require('../games/block-wars/textures.js');

test('original Minecraft catalog loads atomically and aliases existing materials',async()=>{
  const requested=[];
  class ImageStub{set src(url){this.url=url;requested.push(url);this.width=16;this.height=url.includes('magma')?512:16;queueMicrotask(()=>this.onload());}}
  const result=await Textures.loadOriginals({ImageClass:ImageStub});
  assert.equal(result.loaded,24);assert.equal(result.ok,true);
  assert.equal(new Set(requested).size,24);
  assert.ok(requested.every(url=>/^\/block-wars\/assets\/[a-z_]+\.png$/.test(url)));
  assert.equal(Textures.source('tile','crystal'),Textures.source('tile','diamond'));
  assert.equal(Textures.source('tool','gold').url,'/block-wars/assets/gold_pickaxe.png');
  assert.ok(Textures.source('tnt','jackpot'));
  assert.equal(Textures.source('tile','constructor'),null);
  assert.equal(Textures.source('tile','magma').height,512);
  const config=require('../configs/minecraft-assets.json');
  assert.equal(Textures.SOURCE_VERSION,config.version);
  assert.deepEqual([...Textures.ORIGINAL_NAMES].sort(),Object.keys(config.textures).sort());
});

test('renderer crops the first square frame of an original animated PNG instead of stretching the sheet',async()=>{
  class ImageStub{set src(url){this.url=url;this.width=16;this.height=url.includes('magma')?512:16;queueMicrotask(()=>this.onload());}}
  await Textures.loadOriginals({ImageClass:ImageStub});
  const draws=[],ctx=new Proxy({drawImage(...args){draws.push(args);},createLinearGradient:()=>({addColorStop(){}})},{get:(object,key)=>object[key]||(object[key]=()=>{})});
  const engine=require('../games/block-wars/engine.js').createEngine({seed:42,layout:'shaft',width:7,height:40});
  engine.state.blocks[0].material='magma';
  require('../games/block-wars/render.js').createRenderer({width:720,height:1280,getContext:()=>ctx}).draw(engine.state,{time:0});
  const magma=draws.find(args=>args[0].url==='/block-wars/assets/magma.png');
  assert.ok(magma,'uses the imported PNG');
  assert.deepEqual(magma.slice(1,5),[0,0,16,16]);
  assert.equal(magma[7],90);assert.equal(magma[8],90);
});

test('missing or invalid original texture leaves a complete fallback, with bounded load time',async()=>{
  class Missing{set src(url){this.width=16;this.height=16;queueMicrotask(()=>url.includes('gold.png')?this.onerror():this.onload());}}
  let result=await Textures.loadOriginals({ImageClass:Missing});
  assert.equal(result.ok,false);assert.equal(result.loaded,0);assert.equal(Textures.source('tile','stone'),null);
  class Invalid{set src(_url){this.width=2000;this.height=2000;queueMicrotask(()=>this.onload());}}
  result=await Textures.loadOriginals({ImageClass:Invalid});assert.equal(result.ok,false);
  class Silent{set src(_url){}}
  result=await Textures.loadOriginals({ImageClass:Silent,timeoutMs:5});assert.equal(result.ok,false);
});
test('procedural block textures are deterministic dense pixel art, with distinct ore colors',()=>{
  const a=tile('stone',2),b=tile('stone',2);
  assert.deepEqual(a,b);assert.equal(a.width,16);assert.equal(a.pixels.length,16*16*4);
  const colors=new Set();for(let i=0;i<a.pixels.length;i+=4)colors.add(a.pixels.slice(i,i+4).join(','));
  assert.ok(colors.size>12,'stone has grain rather than a flat swatch');
  for(const kind of ['gold','redstone','lapis','emerald','diamond','copper','coal','iron','granite','diorite','moss','obsidian','bedrock'])assert.notDeepEqual(tile(kind,2),a,kind);
  assert.notDeepEqual(tile('stone',1),a);
});
test('pickaxes have transparent silhouettes, dark outlines and material-specific pixels',()=>{
  const wood=pickaxe('wood'),gold=pickaxe('gold'),diamond=pickaxe('diamond');
  assert.notDeepEqual(wood,gold);assert.notDeepEqual(gold,diamond);
  const alpha=[];for(let i=3;i<gold.pixels.length;i+=4)alpha.push(gold.pixels[i]);
  assert.ok(alpha.includes(0));assert.ok(alpha.includes(255));
});
test('TNT variants preserve their white letter band and visible size-independent bitmap',()=>{
  for(const name of ['tnt','mega','nuke','jackpot']){
    const image=tnt(name);assert.equal(image.width,16);
    const band=(8*16)*4,letter=(6*16+2)*4;
    assert.deepEqual([...image.pixels.slice(band,band+3)],[239,238,215]);
    assert.deepEqual([...image.pixels.slice(letter,letter+3)],[22,23,23]);
  }
  assert.notDeepEqual(tnt('tnt'),tnt('jackpot'));
});

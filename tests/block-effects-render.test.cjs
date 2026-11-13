'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Textures=require('../games/block-wars/textures.js');
const {createPainter}=require('../games/block-wars/effects-render.js');
function recorder(){
  const calls=[];
  const ctx=new Proxy({measureText:text=>({width:text.length*10})},{get:(object,key)=>object[key]||(object[key]=(...args)=>calls.push([key,...args]))});
  const paint=(...args)=>calls.push(['paint',...args]);
  return {calls,painter:createPainter(ctx,paint,720,1280)};
}
async function originals(){
  class ImageStub{set src(url){this.url=url;[this.width,this.height]=url.endsWith('/creeper.png')?[64,32]:url.endsWith('/rain.png')?[64,256]:[16,512];queueMicrotask(()=>this.onload());}}
  // Fixed-layout sprites require their original exact dimensions.
  class Exact extends ImageStub{set src(url){this.url=url;[this.width,this.height]=Textures.EFFECT_NAMES[url.split('/').at(-1).slice(0,-4)]||[16,16];if(!this.height)this.height=512;queueMicrotask(()=>this.onload());}}
  assert.equal((await Textures.loadOriginals({ImageClass:Exact})).complete,true);
}
test('physical TNT uses its collision center, delays remain invisible, and attribution never becomes HTML',()=>{
  const {calls,painter}=recorder(),entity={kind:'rain',stage:'fall',x:2,y:4,size:.8,age:.5,actor:'<Ana>\n',source:'simulator'};
  painter.projectile(entity,90,90,1,false);
  assert.deepEqual(calls.find(call=>call[0]==='translate'),['translate',270,270]);
  assert.ok(calls.some(call=>call[0]==='paint'&&call[1]==='tnt'&&call[2]==='tnt'));
  assert.ok(calls.some(call=>call[0]==='fillText'&&call[1]==='PRUEBA · Ana'));
  calls.length=0;painter.projectile({...entity,delay:.4},90,90,1,false);assert.equal(calls.length,0);
});
test('creeper uses four front-facing UV sections from the authentic skin, not a stretched full skin',async()=>{
  await originals();const {calls,painter}=recorder();
  painter.projectile({kind:'creeper',stage:'fuse',x:3,y:8,size:1,age:.4,fuse:.8,actor:'Luis',source:'tikfinity'},90,90,0,true);
  const uv=calls.filter(call=>call[0]==='drawImage').map(call=>call.slice(2,6));
  assert.deepEqual(uv,[[8,8,8,8],[20,20,8,12],[4,20,4,6],[4,20,4,6]]);
  assert.ok(calls.some(call=>call[0]==='fillText'&&call[1]==='Luis'));
});
test('storm reads complete64x64 rain frames, uses bounded tiled draws and automatic credit',async()=>{
  await originals();const {calls,painter}=recorder(),weather={kind:'storm',elapsed:.3,remaining:5,duration:6,source:'automatic'};
  const before=JSON.stringify(weather);painter.weather(weather,100,false);
  const draws=calls.filter(call=>call[0]==='drawImage');
  assert.ok(draws.length>0&&draws.length<100);
  assert.ok(draws.every(call=>call[1].url.endsWith('/rain.png')&&call[3]===128&&call[4]===64&&call[5]===64));
  assert.ok(calls.some(call=>call[0]==='fillText'&&call[1]==='EVENTO DE LA MINA'));
  assert.equal(JSON.stringify(weather),before);
});
test('all approved projectiles have pixel textures and reduced motion cannot mutate gameplay',()=>{
  const {calls,painter}=recorder();
  for(const kind of ['tnt','rain','thunder','storm','creeper','meteor','fire','tsunami','mega','nuke','arrow']){
    const entity={kind,stage:kind==='tsunami'?'wave':'fuse',x:3,y:8,startX:0,startY:4,size:1,age:.2,remaining:1,fuse:2,vx:1,vy:4};
    const before=JSON.stringify(entity);painter.projectile(entity,90,90,0,false);painter.projectile(entity,90,90,0,true);
    assert.equal(JSON.stringify(entity),before,kind);
  }
  assert.equal(calls.filter(call=>call[0]==='arc').length,0,'approved effects avoid generic smooth circular projectiles');
  for(const sprite of ['water','fire','ice','arrow','dispenser'])assert.ok(calls.some(call=>call[0]==='paint'&&call[2]===sprite),sprite);
});

test('giant charges above the viewport retain a visible TNT preview, owner and real fuse countdown',()=>{
  for(const kind of ['mega','nuke']){
    const {calls,painter}=recorder();
    painter.projectile({kind,stage:'fuse',x:3.5,y:-1.901,size:3.8,age:.5,fuse:2.4,actor:'Ana',source:'simulator'},90,90,0,false);
    assert.ok(calls.some(call=>call[0]==='fillText'&&/MECHA 2.4s/.test(call[1])),kind);
    assert.ok(calls.some(call=>call[0]==='fillText'&&/PRUEBA · Ana/.test(call[1])),kind);
    const preview=calls.find(call=>call[0]==='paint'&&call[1]==='tnt');
    assert.ok(preview&&preview[4]>=0&&preview[4]+preview[5]<=1280,'preview stays inside canvas');
  }
});

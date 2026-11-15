'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Textures=require('../games/block-wars/textures.js'),{createPainter}=require('../games/block-wars/effects-render.js');
function recorder(){const calls=[],styles=[];const ctx=new Proxy({measureText:text=>({width:text.length*9})},{get:(o,k)=>o[k]||(o[k]=(...args)=>calls.push([k,...args])),set(o,k,v){styles.push([k,v]);o[k]=v;return true;}});return{calls,styles,painter:createPainter(ctx,(...args)=>calls.push(['paint',...args]),720,1280)};}
test('official ULTRANUKE variants use different imported nuclear cube and warhead bodies without tinting ordinary NUKE',()=>{
 const old=Textures.source;Textures.source=(kind,id)=>['nuke_like','nuke_subscriber'].includes(id)?{}:null;
 try{const results=[];for(const rewardVariant of ['like','subscriber']){const f=recorder();f.painter.projectile({kind:'nuke',rewardVariant,size:4,x:3,y:6,stage:'fall',age:.5},90,90,0,false);results.push(f);assert.ok(f.calls.some(c=>c[0]==='paint'&&c[1]==='sprite'&&c[2]==='nuke_'+rewardVariant));assert.ok(!f.calls.some(c=>c[0]==='paint'&&c[1]==='tnt'));}
 assert.notDeepEqual(results[0].calls.filter(c=>c[0]==='fillRect'),results[1].calls.filter(c=>c[0]==='fillRect'),'cube and warhead geometry must differ, not just color');
 const normal=recorder();normal.painter.projectile({kind:'nuke',size:3.6,x:3,y:6,stage:'fall'},90,90,0,false);assert.ok(normal.calls.some(c=>c[0]==='paint'&&c[1]==='tnt'));
 }finally{Textures.source=old;}
});
test('missing mod assets use an explicitly labelled fallback and ULTRANUKE clouds remain restrained under reduced motion',()=>{
 const old=Textures.source;Textures.source=()=>null;
 try{const f=recorder();f.painter.projectile({kind:'nuke',rewardVariant:'subscriber',size:5.2,x:3,y:6,stage:'fall'},90,90,0,true);assert.ok(f.calls.some(c=>c[0]==='fillText'&&c[1]==='RESPALDO'));
 }finally{Textures.source=old;}
 const effect={kind:'nuke',rewardVariant:'subscriber',shockwaveIndex:0,x:3,y:8,age:3,duration:9,blastRadius:11},full=recorder(),reduced=recorder();
 full.painter.explosion(effect,90,90,0,false);reduced.painter.explosion(effect,90,90,0,true);
 assert.ok(full.calls.filter(c=>c[0]==='fillRect').length>100,'mushroom cloud and multiple block shockwaves');
 assert.ok(reduced.calls.filter(c=>c[0]==='fillRect').length<full.calls.filter(c=>c[0]==='fillRect').length);
 assert.ok(!full.calls.some(c=>c[0]==='fillRect'&&c[1]===0&&c[2]===0&&c[3]===720&&c[4]===1280),'no full screen flash');
});
test('67 digit salvos, silent football and SIUUU jumper have original pixel silhouettes',()=>{
 const scenes=[['sixty_seven','fall'],['messi','ricochet'],['siuuu','jump']];const signatures=[];
 for(const [kind,stage]of scenes){const f=recorder();f.painter.projectile({kind,stage,x:3,y:6,size:1,digit:6,age:.5,rotation:1},90,90,0,false);assert.ok(f.calls.filter(c=>c[0]==='fillRect').length>=5,kind+' pixel silhouette');assert.ok(!f.calls.some(c=>c[0]==='paint'&&c[2]==='ice'));signatures.push(JSON.stringify(f.calls));}
 assert.equal(new Set(signatures).size,3);
});
test('a frame caps detailed mushroom clouds at six and renders remaining impacts as light shockwaves',()=>{
 const f=recorder(),effect={kind:'nuke',rewardVariant:'subscriber',x:3,y:8,age:3,duration:9,blastRadius:11};
 f.painter.beginFrame();for(let i=0;i<20;i++)f.painter.explosion(effect,90,90,0,false);
 assert.equal(f.calls.filter(c=>c[0]==='fillRect').length,6*207+14*12,'six detailed clouds, fourteen light twelve-block shockwaves');
 f.calls.length=0;f.painter.beginFrame();f.painter.explosion(effect,90,90,0,false);assert.equal(f.calls.filter(c=>c[0]==='fillRect').length,207,'the next frame renews its visual budget');
});

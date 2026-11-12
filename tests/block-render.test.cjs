'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createRenderer}=require('../games/block-wars/render.js');
function canvas(){const gradient={addColorStop(){}};const ctx=new Proxy({createLinearGradient:()=>gradient},{get(o,k){return k in o?o[k]:(o[k]=()=>{});}});return{width:720,height:1280,getContext:()=>ctx};}
function world(){return{layout:'shaft',width:7,height:40,round:1,elapsed:0,paused:false,phase:'playing',focus:{x:3,y:8,team:'dark'},
  teams:{dark:{target:{x:3,y:8},pickaxe:'gold',buffs:{},effectiveSpeed:2.8,progress:0},light:{target:{x:4,y:8},pickaxe:'wood',buffs:{},effectiveSpeed:.6,progress:0}},
  blocks:Array.from({length:280},()=>({material:'stone',hp:1.8,maxHp:1.8})),entities:[],effects:[],particles:[]};}
test('shaft render uses eight large columns including wall and follows the mining front',()=>{
  const r=createRenderer(canvas()),s=world();r.draw(s,{time:1});
  assert.equal(r.view.cellSize,90);assert.equal(r.view.cameraY,0);
  s.focus.y=25;s.teams.dark.target.y=25;
  for(let i=0;i<120;i++)r.draw(s,{time:1+i/60});
  assert.ok(r.view.cameraY>10);assert.ok(r.view.cameraY<26);
  const screenY=(s.focus.y+.5-r.view.cameraY)*90;
  assert.ok(screenY>700&&screenY<1150,'tool remains near lower active front');
  s.round=2;s.focus.y=8;s.teams.dark.target.y=8;r.draw(s,{time:4});assert.equal(r.view.cameraY,0);
});
test('renderer accepts each real entity and reduced motion without changing engine data',()=>{
  const r=createRenderer(canvas()),s=world();
  s.entities=['tnt','mega','nuke','jackpot','meteor','fire','arrow','rain','thunder','tsunami','black_hole'].map((kind,i)=>({kind,x:3,y:8,age:.5,duration:1.2,size:1+(i%3),rotation:.2,team:'dark'}));
  const before=JSON.stringify(s);r.draw(s,{time:5});r.draw(s,{time:6,reducedMotion:true});assert.equal(JSON.stringify(s),before);
});

test('endless renderer follows the physical center and rotation without jumping at a recycled row or voting cycle',()=>{
  const moves=[],angles=[],ctx=new Proxy({translate:(...args)=>moves.push(args),rotate:angle=>angles.push(angle),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(o[k]=()=>{})});
  const r=createRenderer({width:720,height:1280,getContext:()=>ctx}),s=world();
  s.layout='endless';s.rowOffset=0;s.elapsed=40;s.body={x:3.25,y:23.5,rotation:1.3,team:'light'};
  for(let i=0;i<120;i++)r.draw(s,{time:1+i/60});
  assert.equal(r.view.cellSize,90);assert.equal(r.view.activeTeam,'light');
  assert.equal(moves.at(-1)[0],90+3.25*90);assert.ok(angles.includes(1.3));
  const before=moves.at(-1)[1];
  s.rowOffset=12;s.body.y-=12;s.round=2;
  r.draw(s,{time:4,reducedMotion:true});
  assert.ok(Math.abs(moves.at(-1)[1]-before)<1,'recycling coordinates and changing vote cycle do not move the world on screen');
  s.rowOffset=0;s.body.y=6;s.elapsed=0;r.draw(s,{time:5});assert.equal(r.view.cameraY,0,'explicit reset clears the camera');
});

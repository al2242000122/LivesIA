'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Physics=require('../games/block-wars/physics.js');
function world(){return {width:7,height:40,blocks:new Array(280).fill(null)};}

test('solid side contact reflects horizontal velocity and reports its normal',()=>{
  const map=world();map.blocks[5*7+4]={hp:2};
  const body={...Physics.createBody(7),x:3.5,y:5.5,vx:4,vy:0};
  const contacts=[];Physics.step(body,0.05,map,(index,normal)=>contacts.push({index,normal}));
  assert.ok(body.vx<0);assert.ok(body.x<=4-body.radius+1e-5);
  assert.ok(contacts.some(contact=>contact.index===39 && contact.normal.x===-1));
});

test('solid floor contact reflects downward velocity without tunneling through it',()=>{
  const map=world();for(let x=0;x<7;x++)map.blocks[6*7+x]={hp:2};
  const body={...Physics.createBody(7),x:3.5,y:5.4,vx:2.5,vy:5};
  let touched=false;Physics.step(body,0.25,map,()=>{touched=true;});
  assert.ok(touched);assert.ok(body.vy<0);assert.ok(body.y<=6-body.radius+1e-5);
});

test('persistent terrain collision stays outside solids and horizontal walls for10000 steps',()=>{
  const map=world();for(let x=0;x<7;x++)map.blocks[8*7+x]={hp:2};
  const body=Physics.createBody(7);
  for(let i=0;i<10000;i++){
    Physics.step(body,0.05,map,()=>{});
    assert.ok(body.x>=body.radius-1e-6 && body.x<=7-body.radius+1e-6);
    assert.ok(body.y<=8-body.radius+1e-5);
    assert.ok(Math.abs(body.vx)>=Physics.MIN_HORIZONTAL);
    assert.ok(Math.abs(body.vy)<=Physics.MAX_SPEED);
  }
  assert.ok(body.collisions>100);
});

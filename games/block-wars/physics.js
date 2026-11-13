(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.BlockWarsPhysics=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const GRAVITY=14,MAX_SPEED=7.5,MIN_HORIZONTAL=2.5,RESTITUTION=0.8;
  function createBody(width){
    return {x:width/2,y:4.5,vx:2.8,vy:0,radius:0.35,rotation:0,team:'dark',collisions:0};
  }
  function normal(body,x,y){
    const nearestX=clamp(body.x,x,x+1),nearestY=clamp(body.y,y,y+1);
    const dx=body.x-nearestX,dy=body.y-nearestY,distance=Math.hypot(dx,dy);
    if(distance>=body.radius)return null;
    if(distance>1e-9)return {x:dx/distance,y:dy/distance,depth:body.radius-distance};
    const faces=[{x:-1,y:0,d:body.x-x},{x:1,y:0,d:x+1-body.x},
      {x:0,y:-1,d:body.y-y},{x:0,y:1,d:y+1-body.y}];
    const nearest=faces.reduce((best,face)=>face.d<best.d?face:best);
    return {x:nearest.x,y:nearest.y,depth:body.radius+nearest.d};
  }
  function step(body,dt,world,onContact,speedScale=1){
    const scale=Number.isFinite(speedScale)?clamp(speedScale,1,1.6):1,maxSpeed=MAX_SPEED*scale;
    const steps=Math.min(8,Math.max(1,Math.ceil(dt/0.025))),h=dt/steps;
    for(let substep=0;substep<steps;substep++){
      body.vy=clamp(body.vy+GRAVITY*h,-maxSpeed,maxSpeed);
      body.vx=clamp(body.vx,-maxSpeed,maxSpeed);
      body.x+=body.vx*h;body.y+=body.vy*h;
      if(body.x<body.radius){body.x=body.radius;body.vx=Math.abs(body.vx);body.collisions++;}
      if(body.x>world.width-body.radius){body.x=world.width-body.radius;body.vx=-Math.abs(body.vx);body.collisions++;}
      if(body.y<body.radius){body.y=body.radius;body.vy=Math.abs(body.vy);}
      for(let pass=0;pass<2;pass++){
        const left=Math.max(0,Math.floor(body.x-body.radius)),right=Math.min(world.width-1,Math.floor(body.x+body.radius));
        const top=Math.max(0,Math.floor(body.y-body.radius)),bottom=Math.min(world.height-1,Math.floor(body.y+body.radius));
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
          const index=y*world.width+x;if(!world.blocks[index])continue;
          const contact=normal(body,x,y);if(!contact)continue;
          const dot=body.vx*contact.x+body.vy*contact.y;
          body.x+=contact.x*(contact.depth+1e-6);body.y+=contact.y*(contact.depth+1e-6);
          if(dot<0){
            body.vx-=(1+RESTITUTION)*dot*contact.x;body.vy-=(1+RESTITUTION)*dot*contact.y;
            body.collisions=Math.min(Number.MAX_SAFE_INTEGER,body.collisions+1);
            onContact(index,contact,-dot);
          }
        }
      }
      body.x=clamp(body.x,body.radius,world.width-body.radius);
      body.y=clamp(body.y,body.radius,world.height-body.radius);
      if(Math.abs(body.vx)<MIN_HORIZONTAL*scale)body.vx=(body.vx<0?-1:1)*MIN_HORIZONTAL*scale;
      body.vy=clamp(body.vy,-maxSpeed,maxSpeed);
      body.rotation=(body.rotation+body.vx*h*0.8)%(Math.PI*2);
    }
  }
  return Object.freeze({createBody,step,normal,GRAVITY,MAX_SPEED,MIN_HORIZONTAL,RESTITUTION});
});

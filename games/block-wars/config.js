(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BlockWarsConfig = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function pick(id, baseSpeed, durability, color, handle, shape, blocks) {
    return Object.freeze({id,baseSpeed,durability,
      appearance:Object.freeze({color,handle,shape}),unlockRule:blocks});
  }
  const PICKAXES = Object.freeze({
    wood:pick('wood',0.6,20,'#d9a064','#785237','simple',0),
    stone:pick('stone',1,40,'#a6b4c0','#765241','square',8),
    gold:pick('gold',2.8,12,'#ffd36b','#a97536','fork',16),
    diamond:pick('diamond',1.75,120,'#7ce2e4','#567ab1','diamond',30),
    netherite:pick('netherite',2.2,180,'#d4a0ef','#654c83','double',45)
  });
  const MATERIALS = Object.freeze({
    soil:Object.freeze({hardness:1,value:1,color:'#b46d56'}),
    stone:Object.freeze({hardness:1.8,value:2,color:'#718199'}),
    crystal:Object.freeze({hardness:2.5,value:8,color:'#70d4df'}),
    gold:Object.freeze({hardness:2,value:6,color:'#dcb965'}),
    obsidian:Object.freeze({hardness:4,value:5,color:'#63516f'}),
    magma:Object.freeze({hardness:3,value:4,color:'#c26753'}),
    coal:Object.freeze({hardness:1.8,value:3,color:'#353945',ore:true}),
    iron:Object.freeze({hardness:2.2,value:4,color:'#bea18b',ore:true}),
    redstone:Object.freeze({hardness:2.4,value:5,color:'#d4444b',ore:true}),
    lapis:Object.freeze({hardness:2.3,value:6,color:'#4567d5',ore:true}),
    emerald:Object.freeze({hardness:3,value:10,color:'#49ba77',ore:true}),
    copper:Object.freeze({hardness:2,value:4,color:'#b97f54',ore:true}),
    granite:Object.freeze({hardness:2.1,value:2,color:'#ba8575'}),
    diorite:Object.freeze({hardness:2,value:2,color:'#c3c7bc'}),
    andesite:Object.freeze({hardness:2.2,value:2,color:'#949d91'}),
    moss:Object.freeze({hardness:1.4,value:2,color:'#719367'}),
    diamond:Object.freeze({hardness:3.2,value:12,color:'#69dadd',ore:true})
  });
  const EFFICIENCY = Object.freeze([1,1.3,1.7,2.5,4,6]);
  const BUFFS = Object.freeze({
    turbo:Object.freeze({multiplier:2,duration:10,cooldown:20}),
    descomunal:Object.freeze({multiplier:3,duration:6,cooldown:30}),
    rainbow:Object.freeze({multiplier:1.8,duration:8,cooldown:22}),
    butterfly:Object.freeze({multiplier:1.4,duration:10,cooldown:24}),
    demon:Object.freeze({multiplier:2.2,duration:7,cooldown:25}),
    spin:Object.freeze({multiplier:2,duration:8,cooldown:20}),
    fast:Object.freeze({multiplier:3,duration:5,cooldown:18}),
    big:Object.freeze({multiplier:1.5,duration:9,cooldown:23})
  });
  function event(id,label,color,mode,cooldown,duration,size,radius,count,shape) {
    return Object.freeze({id,label,color,mode,cooldown,duration,size,radius,count,shape});
  }
  // Gameplay choices: the screenshots establish names and appearance, not physics.
  const EVENTS = Object.freeze({
    tnt:event('tnt','TNT','#ef6559','blast',2.5,3,1,2,1,'circle'),
    rainbow:event('rainbow','RAINBOW','#c287ef','buff',22,8,1,0,1,'tool'),
    mega:event('mega','MEGA TNT','#7cd4cf','blast',18,5,3,4.5,1,'circle'),
    arrow:event('arrow','ARROW','#f1d581','blast',6,3,0.65,0.5,1,'line'),
    butterfly:event('butterfly','BUTTERFLY','#ec9de6','buff',24,10,1,0,1,'tool'),
    nuke:event('nuke','NUKE','#a6df71','blast',45,6,3.8,7,1,'circle'),
    tnt_rain:event('tnt_rain','TNT RAIN','#f69e69','blast',16,5,0.9,1.7,6,'circle'),
    thunder:event('thunder','THUNDER','#ffdd79','blast',9,4,1,0.55,1,'column'),
    fire:event('fire','FIRE STORM','#ff9a48','blast',14,6,0.65,1.3,4,'circle'),
    rain:event('rain','PICKAXE RAIN','#79d9cf','blast',8,10,1.1,1.7,8,'circle'),
    storm:event('storm','STORM','#9bcde8','blast',24,6,0.65,0.8,1,'circle'),
    creeper:event('creeper','CREEPER','#70bd53','blast',12,6,1,2.5,1,'circle'),
    tsunami:event('tsunami','TSUNAMI','#48b4c9','blast',20,5,3,2,1,'band'),
    black_hole:event('black_hole','BLACK HOLE','#b899e2','blast',30,6,2.5,3.5,1,'pull'),
    jackpot:event('jackpot','JACKPOT TNT','#f9db78','blast',35,6,3.2,5,1,'circle'),
    demon:event('demon','DEMON','#dc7997','buff',25,7,1,0,1,'tool'),
    meteor:event('meteor','METEOR','#ecab70','blast',12,5,1.5,3,1,'circle'),
    spin:event('spin','SPIN','#c89ae7','buff',20,8,1,0,1,'tool'),
    fast:event('fast','FAST','#81d4ec','buff',18,5,1,0,1,'tool'),
    big:event('big','BIG','#e6c484','buff',23,9,1,0,1,'tool'),
    sixty_seven:event('sixty_seven','67','#ffd754','blast',5,7,1.1,2.4,13,'circle'),
    messi:event('messi','MESSI','#80d9ff','blast',5,8,.9,1.8,1,'circle'),
    siuuu:event('siuuu','SIUUU','#f5bd65','blast',5,7,1.6,4,6,'circle')
  });
  const LIMITS = Object.freeze({maxQueue:96,maxParticles:320,maxEffects:64,
    maxBlockOps:40,maxExplosionOps:32,maxProgress:64,maxDelta:0.25,
    maxCells:1600,maxEntities:96,maxWeather:16,maxSpeed:240,nukeCooldown:45,summaryDuration:4,maxScore:1000000000});
  const LEGACY_LIMITS=Object.freeze({...LIMITS,maxQueue:24,maxParticles:160,maxEffects:24,maxEntities:24,maxWeather:8});
  const LEGACY_EFFECTS=Object.freeze({big:Object.freeze({contactBlastRadius:1.1})});
  const LEGACY_EVENTS=Object.freeze(Object.keys(EVENTS).filter(id=>!['sixty_seven','messi','siuuu'].includes(id)));
  const SELECTED_EVENTS=Object.freeze(['tnt','rain','thunder','storm','creeper','meteor','fire','tsunami','spin','fast','mega','nuke','arrow','big','sixty_seven','messi','siuuu']);
  const COMMAND_RANKS=Object.freeze({tnt:1,arrow:1,spin:1,fast:1,big:2,rain:2,creeper:2,thunder:2,fire:3,storm:3,meteor:3,tsunami:3,mega:3,nuke:4,sixty_seven:3,messi:3,siuuu:3});
  // Local gameplay tuning: seconds, cells, cells/second and HP. Not platform limits.
  const MINECRAFT_EFFECTS=Object.freeze({
    mining:Object.freeze({contactWorkMultiplier:3}),
    tiers:Object.freeze({
      tnt:Object.freeze({size:1,radius:2,count:3,collisionRadius:.32}),
      mega:Object.freeze({size:2.8,radius:4,count:3,collisionRadius:.4}),
      nuke:Object.freeze({size:3.6,radius:5.5,count:3,collisionRadius:.45})
    }),
    projectile:Object.freeze({spawnHeight:5,spawnInterval:.1,lifetime:6,driftSpeed:1.2,fuse:.4,
      gravity:28,maxFallSpeed:20,maxFallStep:.025,bounceRetention:.5,minBounceSpeed:1,maxBounces:3,rotationRate:2.2,
      flightSeconds:.65,flightLifetime:2.5,flightRadius:.2,maxFlightStep:.2,outsideGraceSeconds:.5}),
    rain:Object.freeze({count:12,spawnInterval:.06,lifetime:10,contactMultiplier:3,radius:.32}),
    tnt:Object.freeze({fuse:.85}),
    mega:Object.freeze({lifetime:7,fuse:.45}),
    nuke:Object.freeze({lifetime:9,fuse:.6,spawnInterval:.12,maxCount:10}),
    ultranuke:Object.freeze({
      like:Object.freeze({spriteId:'nuke_like',size:4.2,radius:7.5,collisionRadius:.45,visualDuration:7,shockwaveOffsets:Object.freeze([3,7])}),
      subscriber:Object.freeze({spriteId:'nuke_subscriber',size:5.2,radius:11,collisionRadius:.45,visualDuration:9,shockwaveOffsets:Object.freeze([5,11,18,25])})
    }),
    sixty_seven:Object.freeze({count:13,lifetime:7,fuse:.3,collisionRadius:.28,spawnInterval:.05,groupPause:.1}),
    messi:Object.freeze({lifetime:8,collisionRadius:.3,contactRadius:1.8,damage:6,pulseSeconds:.08,curveAcceleration:8,rotationRate:14}),
    siuuu:Object.freeze({lifetime:7,collisionRadius:.3,contactRadius:4,damage:8,maxJumps:3,jumpSpeed:13,contactMultiplier:10}),
    creeper:Object.freeze({count:3,fuse:.8,collisionRadius:.3}),
    scatter:Object.freeze({height:1.1,horizontalSpacing:.55,verticalSpacing:.4,velocity:3,spawnInterval:.08,searchStep:.25,searchRadius:2}),
    arrow:Object.freeze({spawnInterval:.06,volleyCount:12,flightSeconds:.45,originHeight:3,damage:2.4}),
    meteor:Object.freeze({count:3,flightSeconds:.8,flightLifetime:3,flightRadius:.6,pathRadius:.95,pathDamage:4,penetrationSeconds:.45}),
    fire:Object.freeze({count:12,maxHazards:24,burnOffsetY:.8,burnRadius:1.5,burnSeconds:6,burnDamage:1.8,pulseSeconds:.18}),
    tsunami:Object.freeze({count:3,spawnInterval:.3,crossingSeconds:1.5,lifetime:2,radius:2,damage:1.2,pulseSeconds:.12,
      pushRangeX:1.7,pushRangeY:3,pushAcceleration:12,maxPushSpeed:15}),
    thunder:Object.freeze({duration:12,pulseSeconds:.22}),
    storm:Object.freeze({duration:12,pulseSeconds:.06,windFrequency:2,windAcceleration:8}),
    fast:Object.freeze({duration:15,multiplier:12,physicsSpeedScale:2.4,rotationRate:45}),
    big:Object.freeze({duration:27,multiplier:4,bodyRadius:.35,visualScale:2.4,contactBlastRadius:1.8}),
    spin:Object.freeze({duration:24,multiplier:12,rotationRate:60})
  });
  return Object.freeze({PICKAXES,MATERIALS,EFFICIENCY,BUFFS,EVENTS,LIMITS,LEGACY_LIMITS,LEGACY_EFFECTS,LEGACY_EVENTS,SELECTED_EVENTS,COMMAND_RANKS,MINECRAFT_EFFECTS});
}));

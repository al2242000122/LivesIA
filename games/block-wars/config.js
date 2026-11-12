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
    rain:event('rain','RAIN','#6ccbea','blast',8,5,0.4,0.8,5,'circle'),
    tsunami:event('tsunami','TSUNAMI','#48b4c9','blast',20,5,3,2,1,'band'),
    black_hole:event('black_hole','BLACK HOLE','#b899e2','blast',30,6,2.5,3.5,1,'pull'),
    jackpot:event('jackpot','JACKPOT TNT','#f9db78','blast',35,6,3.2,5,1,'circle'),
    demon:event('demon','DEMON','#dc7997','buff',25,7,1,0,1,'tool'),
    meteor:event('meteor','METEOR','#ecab70','blast',12,5,1.5,3,1,'circle'),
    spin:event('spin','SPIN','#c89ae7','buff',20,8,1,0,1,'tool'),
    fast:event('fast','FAST','#81d4ec','buff',18,5,1,0,1,'tool'),
    big:event('big','BIG','#e6c484','buff',23,9,1,0,1,'tool')
  });
  const LIMITS = Object.freeze({maxQueue:24,maxParticles:160,maxEffects:24,
    maxBlockOps:40,maxExplosionOps:32,maxProgress:64,maxDelta:0.25,
    maxCells:1600,maxEntities:24,maxSpeed:240,nukeCooldown:45,summaryDuration:4,maxScore:1000000000});
  return Object.freeze({PICKAXES,MATERIALS,EFFICIENCY,BUFFS,EVENTS,LIMITS});
}));

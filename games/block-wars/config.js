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
    magma:Object.freeze({hardness:3,value:4,color:'#c26753'})
  });
  const EFFICIENCY = Object.freeze([1,1.3,1.7,2.5,4,6]);
  const BUFFS = Object.freeze({
    turbo:Object.freeze({multiplier:2,duration:10,cooldown:20}),
    descomunal:Object.freeze({multiplier:3,duration:6,cooldown:30})
  });
  const LIMITS = Object.freeze({maxQueue:24,maxParticles:160,maxEffects:24,
    maxBlockOps:40,maxExplosionOps:32,maxProgress:64,maxDelta:0.25,
    maxCells:1600,nukeCooldown:45,summaryDuration:4,maxScore:1000000000});
  return Object.freeze({PICKAXES,MATERIALS,EFFICIENCY,BUFFS,LIMITS});
}));

'use strict';
const {randomUUID}=require('node:crypto');
const {PICKAXES,LIMITS,EVENTS}=require('../games/block-wars/config.js');
const own=(o,k)=>Object.hasOwn(o,k);
const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const number=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const text=(value,fallback,max)=>(value??fallback).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,max);
const legacy=new Set(['gift','like','follow','subscribe','chat','pause','reset','frenzy']);
const actions=new Set([...Object.keys(EVENTS),'mine','repair','turbo','descomunal','pickaxe','enchant']);
function validateCommand(event){
  if(!record(event)||typeof event.type!=='string')return null;
  const target=event.target??'snake';
  if(!['snake','block-wars'].includes(target))return null;
  for(const field of ['name','giftName','text','actor'])if(own(event,field)&&typeof event[field]!=='string')return null;
  if(own(event,'count')&&!int(event.count,1,Number.MAX_SAFE_INTEGER))return null;
  const base={type:event.type,target,source:'simulation',id:randomUUID()};
  if(target==='snake'){
    if(!legacy.has(event.type))return null;
    return {...base,name:text(event.name,'Prueba',44),giftName:text(event.giftName,'Rosa',44),count:Math.min(20,event.count??1),text:text(event.text,'!manzana',100)};
  }
  if(['like','follow','chat'].includes(event.type)){
    if(event.type==='like'&&!int(event.count??25,1,1000))return null;
    return {...base,actor:text(event.actor??event.name,'operador-demo',128),name:text(event.name??event.actor,'Prueba local',44),text:text(event.text,'!dark',100),count:event.count??25};
  }
  if(event.type==='bw_pause'){
    if(own(event,'paused')&&typeof event.paused!=='boolean')return null;
    return own(event,'paused')?{...base,paused:event.paused}:base;
  }
  if(event.type==='bw_emergency')return base;
  if(event.type==='bw_audio'){
    const settings=event.settings;
    if(!record(settings)||!Object.keys(settings).length||Object.keys(settings).some(key=>!['muted','volume','narration'].includes(key)))return null;
    if(own(settings,'muted')&&typeof settings.muted!=='boolean'||own(settings,'narration')&&typeof settings.narration!=='boolean'||own(settings,'volume')&&!number(settings.volume,0,1))return null;
    return {...base,settings:{...settings}};
  }
  if(event.type==='bw_reset')return int(event.seed??20261110,0,0xFFFFFFFF)?{...base,seed:event.seed??20261110}:null;
  if(event.type==='bw_settings'){
    const settings=event.settings;
    if(!record(settings)||!Object.keys(settings).length||Object.keys(settings).some(k=>!['duration','eventInterval','likeThreshold','reducedMotion'].includes(k)))return null;
    if(own(settings,'duration')&&!int(settings.duration,10,900)||own(settings,'eventInterval')&&!int(settings.eventInterval,5,180)||
      own(settings,'likeThreshold')&&!int(settings.likeThreshold,5,1000)||own(settings,'reducedMotion')&&typeof settings.reducedMotion!=='boolean')return null;
    return {...base,settings:{...settings}};
  }
  if(event.type!=='bw_action'||!actions.has(event.action)||!['dark','light','neutral'].includes(event.team??'neutral'))return null;
  const result={...base,action:event.action,team:event.team??'neutral'};
  if(event.action==='pickaxe'){
    if(typeof event.pickaxe!=='string'||!own(PICKAXES,event.pickaxe))return null;result.pickaxe=event.pickaxe;
  }
  if(event.action==='enchant'){
    if(!['efficiency','unbreaking','fortune'].some(k=>own(event,k)))return null;
    for(const key of ['efficiency','unbreaking','fortune'])if(own(event,key)){
      if(!int(event[key],0,key==='efficiency'?5:3))return null;result[key]=event[key];
    }
  }
  if(own(event,'count')){
    if(!['mine','repair','tnt','meteor','rain'].includes(event.action)||!int(event.count,1,8))return null;
    result.count=event.count;
  }
  return result;
}
function validateTelemetry(input){
  const fields=['fps','frameMs','round','remaining','queue','particles','source','paused','reducedMotion'];
  const extended=record(input)&&Object.keys(input).length===12;
  if(extended){
    fields.push('mode','depth','elapsed');
    if(!['arena','shaft','endless'].includes(input.mode)||!number(input.depth,0,1000000000)||!number(input.elapsed,0,Number.MAX_SAFE_INTEGER))return null;
  }
  if(!record(input)||Object.keys(input).length!==fields.length||Object.keys(input).some(k=>!fields.includes(k)))return null;
  if(!number(input.fps,0,1000)||!number(input.frameMs,0,60000)||!int(input.round,1,1000000000)||!number(input.remaining,0,900)||
    !int(input.queue,0,LIMITS.maxQueue)||!int(input.particles,0,LIMITS.maxParticles)||!['none','simulator','tikfinity','mixed'].includes(input.source)||
    typeof input.paused!=='boolean'||typeof input.reducedMotion!=='boolean')return null;
  return {...input};
}
module.exports={validateCommand,validateTelemetry};

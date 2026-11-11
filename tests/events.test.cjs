'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createAdapter} = require('../integrations/events.js');

test('normalizes flat and nested relay envelopes without disclosing identifiers', () => {
  const a = createAdapter({now:()=>10000,salt:'test'});
  const flat = a.normalize({event:'chat',data:{msgId:'a',uniqueId:'real-id',nickname:'<b>Nombre</b>\u202e',comment:'!dark'}},'tikfinity');
  const nested = a.normalize({event:'chat',data:{common:{msgId:'b'},user:{displayId:'real-id',nickname:'Otro'},comment:'!mine'}},'tikfinity');
  assert.equal(flat.type,'comment'); assert.equal(flat.data.text,'!dark');
  assert.equal(nested.actor.stableHash,flat.actor.stableHash);
  assert.notEqual(flat.actor.stableHash,'real-id'); assert.equal(flat.actor.displayName,'<b>Nombre</b>');
  assert.equal(flat.receivedAt,10000); assert.equal(flat.source,'tikfinity');
  assert.ok(!JSON.stringify(a.metrics).includes('real-id'));
});

test('duplicates are source isolated and gift frame IDs do not conflate different gifts', () => {
  const a = createAdapter({now:()=>10000});
  const packet = {event:'gift',data:{msgId:'same',giftId:1,giftName:'Rose',repeatCount:2}};
  assert.equal(a.normalize(packet,'tikfinity').data.count,2);
  assert.equal(a.normalize(packet,'tikfinity'),null);
  assert.ok(a.normalize({...packet,data:{...packet.data,giftId:2,giftName:'Heart'}},'tikfinity'));
  assert.ok(a.normalize({type:'gift',id:'same',giftName:'Rose',count:2},'simulator'));
});

test('flat/nested streak updates wait for final and group replay is ignored', () => {
  const a = createAdapter({now:()=>1});
  for (const nested of [false,true]) {
    const data = {msgId:`${nested}-a`,groupId:`${nested}-group`,repeatCount:3,giftName:'Rose',giftId:1};
    if(nested)data.gift={type:1,name:'Rose'}; else data.giftType=1;
    assert.equal(a.normalize({event:'gift',data:{...data,repeatEnd:0}},'tikfinity'),null);
    assert.equal(a.normalize({event:'gift',data:{...data,repeatEnd:1}},'tikfinity').data.count,3);
    assert.equal(a.normalize({event:'gift',data:{...data,msgId:`${nested}-b`,repeatEnd:true}},'tikfinity'),null);
  }
});

test('likes use increments only and viewer totals are not treated as concurrent viewers', () => {
  const a=createAdapter();
  assert.equal(a.normalize({event:'like',data:{likeCount:50,totalLikeCount:10000}},'tikfinity').data.delta,50);
  assert.equal(a.normalize({event:'like',data:{totalLikeCount:10000}},'tikfinity'),null);
  assert.equal(a.normalize({event:'roomUser',data:{totalUser:1234}},'tikfinity'),null);
  assert.equal(a.normalize({event:'roomUser',data:{viewerCount:24}},'tikfinity').data.count,24);
});

test('malformed fields reject safely before coercion and unknown source cannot become real', () => {
  const a=createAdapter();
  for(const raw of [null,[],{event:'gift',data:null},{event:'like',data:{likeCount:{toString:null,valueOf:null}}},
    {event:'gift',data:{giftType:{toString:null,valueOf:null}}},{event:'chat',data:{comment:[]}},
    {event:'like',data:{likeCount:-3}},{event:'gift',data:{repeatCount:1.5}},
    {event:'gift',data:{repeatCount:2},padding:'x'.repeat(17000)}]){
    assert.doesNotThrow(()=>assert.equal(a.normalize(raw,'tikfinity'),null));
  }
  assert.equal(a.normalize({type:'like',count:25},'external'),null);
  assert.equal(a.normalize({type:'like',source:'tikfinity',target:'block-wars',count:25},'simulator').source,'simulator');
});

test('dedupe expires and memory/rate limits recover without raw payload retention', () => {
  let now=0; const a=createAdapter({now:()=>now,rateLimit:200,maxKeys:64});
  const packet={event:'follow',data:{msgId:'x',uniqueId:'fixture'}};
  assert.ok(a.normalize(packet,'tikfinity')); assert.equal(a.normalize(packet,'tikfinity'),null);
  now=120001; assert.ok(a.normalize(packet,'tikfinity'));
  for(let i=0;i<5000;i++)a.normalize({event:'follow',data:{msgId:String(i),uniqueId:`fixture-${i}`}},'tikfinity');
  assert.ok(a.metrics.dedupeSize<=64); assert.ok(a.metrics.rateLimited>0);
  now+=120001; assert.ok(a.normalize({event:'follow',data:{msgId:'new'}},'tikfinity'));
});

test('simulator commands keep explicit amounts and paid subscription type distinct', () => {
  const a=createAdapter();
  assert.equal(a.normalize({type:'like',target:'block-wars',count:25},'simulator').data.delta,25);
  assert.equal(a.normalize({type:'like'},'simulator').data.delta,100);
  assert.equal(a.normalize({type:'subscribe'},'simulator').type,'subscribe_paid');
});

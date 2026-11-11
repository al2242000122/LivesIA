'use strict';
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {loadGame} = require('./helpers/game.cjs');

// Accelerated lifecycle test, not a real six-hour OBS broadcast or FPS test.
const hours = Number(process.env.SOAK_HOURS || 2);
if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error('SOAK_HOURS must be > 0 and <= 24');
const g = loadGame(20261110), start = performance.now();
let rounds = 0, lastSeconds = 180, maxParticles = 0, maxKeys = 0;
let heapMin = Infinity, heapMax = 0;
for (let ms = 0; ms < hours * 3600000; ms += 100) {
  if (ms % 1000 === 0) {
    g.live('like', {likeCount: 37});
    g.live('chat', {uniqueId: `fixture-${ms % 100000}`, comment:'!manzana'});
    g.live('follow', {uniqueId:`fixture-${ms}`});
  }
  if (ms % 60000 === 0) g.command({type:'gift', giftName:'Galaxy'});
  g.jump(100);
  if (g.s.seconds > lastSeconds) rounds++;
  lastSeconds = g.s.seconds;
  maxParticles = Math.max(maxParticles, g.s.particles.length);
  maxKeys = Math.max(maxKeys, g.freeCooldown.size);
  assert.ok(g.s.apples.length <= 48);
  assert.ok(g.s.particles.length <= 260);
  assert.ok(g.freeCooldown.size <= 2048);
  assert.ok(g.s.seconds >= 0 && g.s.seconds <= 180);
  assert.ok(g.s.snake.length > 0);
  for (const p of g.s.snake) assert.equal(g.s.walls[p.y * 25 + p.x], 0);
  if (ms >= 3600000 && ms % 60000 === 0) {
    if (global.gc) global.gc();
    const heap = process.memoryUsage().heapUsed;
    heapMin = Math.min(heapMin, heap); heapMax = Math.max(heapMax, heap);
  }
}
assert.ok(rounds > hours * 10, 'autonomous rounds keep restarting');
console.log(JSON.stringify({seed:20261110, virtualHours:hours, frameStepMs:100, rounds,
  maxParticles, maxCooldownKeys:maxKeys, wallSeconds:Number(((performance.now()-start)/1000).toFixed(2)),
  heapSampledAfterWarmup:Number.isFinite(heapMin), forcedGc:Boolean(global.gc),
  heapRangeMiB:Number.isFinite(heapMin)?[heapMin,heapMax].map(n=>Number((n/1048576).toFixed(2))):null},null,2));

'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadGame} = require('./helpers/game.cjs');

test('maze floors remain reachable and apples never overlap walls, snake or each other', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const g = loadGame(seed), seen = new Set(['1,1']), queue = [{x: 1, y: 1}];
    for (const p of queue) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x = p.x + dx, y = p.y + dy, k = `${x},${y}`;
      if (x >= 0 && y >= 0 && x < 25 && y < 31 && !g.s.walls[y * 25 + x] && !seen.has(k)) { seen.add(k); queue.push({x,y}); }
    }
    assert.equal(seen.size, g.s.floor.length);
    g.spawnApples(5000);
    assert.equal(g.s.apples.length, 48);
    const positions = new Set(g.s.apples.map(p => `${p.x},${p.y}`));
    assert.equal(positions.size, 48);
    for (const p of g.s.apples) { assert.ok(seen.has(`${p.x},${p.y}`)); assert.ok(!g.s.snake.some(q => q.x === p.x && q.y === p.y)); }
  }
});

test('all gift effects and every panel command remain available offline', () => {
  const g = loadGame();
  g.command({type: 'gift', giftName: 'Rose', count: 2}); assert.equal(g.s.apples.length, 10);
  g.command({type: 'gift', giftName: 'Corazón', count: 20}); assert.equal(g.s.shields, 5);
  g.command({type: 'gift', giftName: 'Donut'}); assert.ok(g.s.turboUntil > 0);
  g.command({type: 'gift', giftName: 'Galaxy'}); assert.equal(g.s.apples.length, 18);
  g.command({type: 'gift', giftName: 'Otro'}); assert.equal(g.s.apples.length, 19);
  g.command({type: 'follow'}); assert.equal(g.s.apples.length, 20);
  g.command({type: 'subscribe'}); assert.equal(g.s.apples.length, 25);
  g.command({type: 'chat', text: '!manzana'}); assert.equal(g.s.apples.length, 26);
  g.command({type: 'frenzy'}); assert.equal(g.s.apples.length, 46);
  g.command({type: 'pause'}); assert.equal(g.s.paused, true);
  g.command({type: 'pause'}); assert.equal(g.s.paused, false);
  g.command({type: 'reset'}); assert.equal(g.s.apples.length, 6); assert.equal(g.s.shields, 0);
});

test('panel likes do not contaminate the live like remainder', () => {
  const g = loadGame();
  g.live('like', {likeCount: 50});
  g.command({type: 'like'});
  g.live('like', {likeCount: 50});
  assert.equal(g.s.apples.length, 8);
  assert.equal(g.s.likes, 0);
});

test('1000 live likes produce ten apples without losing batches', () => {
  const g = loadGame(); g.live('like', {likeCount: 1000});
  assert.equal(g.s.apples.length, 16); assert.equal(g.s.likes, 0);
});

test('malformed or oversized relay messages cannot throw or apply effects', () => {
  const g = loadGame();
  for (const value of ['null', '[]', '{', '{"event":"gift","data":[]}', '{"event":"gift","data":{"repeatCount":{}}}',
    '{"event":"gift","data":{"repeatCount":{"valueOf":null,"toString":null}}}',
    '{"event":"gift","data":{"giftType":{"valueOf":null,"toString":null}}}',
    '{"event":"like","data":{"likeCount":{"valueOf":null,"toString":null}}}',
    JSON.stringify({event:'gift', data:{giftName:'Rose'}, padding:'x'.repeat(17000)})]) {
    assert.doesNotThrow(() => g.sockets[0].onmessage({data: value}));
  }
  assert.equal(g.s.apples.length, 6);
});

test('gift streaks wait for completion and final message IDs apply once', () => {
  const g = loadGame();
  const gift = {giftType: 1, giftName: 'Rose', repeatCount: 3, msgId: 'gift-1', uniqueId: 'viewer-a'};
  g.live('gift', {...gift, repeatEnd: false}); assert.equal(g.s.apples.length, 6);
  g.live('gift', {...gift, repeatEnd: true}); assert.equal(g.s.apples.length, 12);
  g.live('gift', {...gift, repeatEnd: true}); assert.equal(g.s.apples.length, 12);
  g.live('gift', {...gift, msgId: 'gift-2', repeatEnd: true}); assert.equal(g.s.apples.length, 18);
});

test('chat cooldown uses stable identity and permits distinct users with equal nicknames', () => {
  const g = loadGame();
  g.live('chat', {uniqueId: 'a', nickname: 'igual', comment: '!manzana'});
  g.expire(2600);
  g.live('chat', {uniqueId: 'b', nickname: 'igual', comment: '!manzana'});
  assert.equal(g.s.apples.length, 8);
  g.expire(2600);
  g.live('chat', {uniqueId: 'a', nickname: 'cambiado', comment: '!manzana'});
  assert.equal(g.s.apples.length, 8);
});

test('follow and chat cooldowns expire; spam never removes the global cooldown', () => {
  const g = loadGame();
  g.live('follow', {uniqueId: 'a'}); g.live('follow', {uniqueId: 'a'});
  assert.equal(g.s.apples.length, 7);
  g.expire(20001); g.live('follow', {uniqueId: 'a'}); assert.equal(g.s.apples.length, 8);
  g.live('chat', {uniqueId: 'a', comment: '!manzana'});
  g.live('chat', {uniqueId: 'b', comment: '!manzana'}); assert.equal(g.s.apples.length, 9);
  g.expire(15001); g.live('chat', {uniqueId: 'a', comment: '!manzana'}); assert.equal(g.s.apples.length, 10);
});

test('cooldown memory stays bounded during a burst of unique viewers', () => {
  const g = loadGame();
  for (let i = 0; i < 5000; i++) g.live('follow', {uniqueId: `viewer-${i}`});
  assert.ok(g.freeCooldown.size <= 2048);
});

test('full reset starts with a complete first second and clears particles', () => {
  const g = loadGame(); g.advance(920); g.spawnBurst(1,1,'red');
  g.command({type: 'reset'}); g.advance(100);
  assert.equal(g.s.seconds, 180); assert.equal(g.s.particles.length, 0);
});

test('pause freezes play and resume does not catch up paused time', () => {
  const g = loadGame(); g.command({type: 'pause'}); const head = JSON.stringify(g.s.snake);
  g.advance(5000); assert.equal(g.s.seconds, 180); assert.equal(JSON.stringify(g.s.snake), head);
  g.command({type: 'pause'}); g.advance(1000); assert.equal(g.s.seconds, 179);
});

test('round timer counts elapsed active time after a delayed browser frame', () => {
  const g = loadGame(); g.jump(5000); assert.equal(g.s.seconds, 175);
});

test('resuming after suspended paused frames does not charge paused time', () => {
  const g = loadGame(); g.command({type:'pause'}); g.stall(60000);
  g.command({type:'pause'}); g.jump(20); assert.equal(g.s.seconds, 180);
});

test('a new round after game over does not inherit a suspended frame delay', () => {
  const g = loadGame(); g.crash(); g.jump(5000);
  assert.equal(g.s.seconds, 180);
});

test('pause during game over remains under creator control until resumed', () => {
  const g = loadGame(); g.crash(); g.command({type:'pause'}); g.jump(2000);
  assert.equal(g.s.paused, true);
  g.command({type:'pause'}); g.jump(20);
  assert.equal(g.s.paused, false); assert.equal(g.s.gameOverUntil, 0); assert.equal(g.s.seconds, 180);
});

test('party overlay expires using the same clock as the effect deadline', () => {
  const g = loadGame(); g.command({type: 'gift', giftName: 'Galaxy'});
  g.expire(10001); g.draw(10001, .02);
  assert.ok(!g.drawing.some(p => String(p.color).startsWith('rgba(156,84,244')));
});

test('shield rescue never leaves an apple under the respawned snake', () => {
  const g = loadGame(); g.s.shields = 1; g.s.apples.push({x:1,y:1}); g.crash();
  assert.equal(g.s.shields, 0); assert.ok(!g.s.apples.some(p => p.x === 1 && p.y === 1));
});

test('transport connection is labelled as relay, never as verified LIVE', () => {
  const g = loadGame(); g.sockets[0].onopen();
  assert.match(g.elements.get('connection').textContent, /RELAY/);
  g.command({type: 'gift', giftName: 'Rose'});
  assert.match(g.elements.get('last-event').textContent, /PRUEBA/);
});

test('controls recreate a terminal SSE connection and can receive commands again', () => {
  const g = loadGame(), stream = g.streams[0];
  // HTTP 503 leaves EventSource CLOSED; network loss in CONNECTING retries natively.
  stream.readyState = 2; stream.onerror?.(); stream.onerror?.();
  assert.equal(g.timers.size, 1);
  const [id, timer] = [...g.timers][0]; g.timers.delete(id); timer.callback();
  assert.equal(g.streams.length, 2);
  g.command({type:'gift', giftName:'Heart'}); assert.equal(g.s.shields, 1);
});

test('native SSE reconnects are not replaced with additional streams', () => {
  const g = loadGame(); g.streams[0].onerror?.();
  assert.equal(g.timers.size, 0); assert.equal(g.streams.length, 1);
});

test('autopilot grows only on each fourth apple, levels up and recovers from collision', () => {
  const g = loadGame();
  // A hand-built corridor isolates movement from random maze layout.
  g.s.walls.fill(1); for (let x = 1; x <= 10; x++) g.s.walls[25 + x] = 0;
  g.s.floor = Array.from({length:10}, (_, i) => ({x:i+1,y:1}));
  g.s.apples = Array.from({length:9}, (_, i) => ({x:i+2,y:1}));
  for (let i = 0; i < 4; i++) g.step();
  assert.equal(g.s.score, 4); assert.equal(g.s.snake.length, 2);
  g.s.score = 11; g.step(); assert.equal(g.s.level, 2); assert.equal(g.s.snake.length, 1);
  g.s.walls.fill(1); g.step(); assert.ok(g.s.gameOverUntil > 0);
  g.advance(1800); assert.equal(g.s.gameOverUntil, 0); assert.ok(g.s.floor.length > 0);
});

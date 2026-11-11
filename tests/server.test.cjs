'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

async function start(t) {
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['server.js'], {cwd: path.join(__dirname, '..'), env: {...process.env, PORT: String(port)}, stdio: ['ignore', 'pipe', 'pipe']});
  t.after(() => new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); child.kill(); }));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timeout')), 5000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    child.stdout.on('data', data => { if (String(data).includes('Juego:')) { clearTimeout(timer); resolve(); } });
  });
  const base = `http://127.0.0.1:${port}`;
  function request(route, {method = 'GET', headers = {}, body} = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request(base + route, {method, headers: {...headers, Connection: 'close'}}, res => {
        let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; });
        res.on('end', () => resolve({status: res.statusCode, headers: res.headers, text}));
      });
      req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Request timeout')));
      req.end(body);
    });
  }
  const post = (event, headers = {}) => request('/api/command', {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(event)});
  return {request, post, base, port};
}

test('HTTP relay serves local pages and broadcasts explicitly simulated events', async t => {
  const s = await start(t);
  for (const route of ['/', '/control', '/game.js', '/styles.css']) assert.equal((await s.request(route)).status, 200);
  assert.equal((await s.request('/AGENTS.md')).status, 404);
  const controller = new AbortController(); t.after(() => controller.abort());
  const stream = await fetch(s.base + '/api/stream', {signal: controller.signal});
  const reader = stream.body.getReader(); await reader.read();
  assert.equal(JSON.parse((await s.request('/api/status')).text).gameWindows, 1);
  assert.equal((await s.post({type: 'gift', giftName: 'Rosa', count: 2})).status, 200);
  const {value} = await reader.read();
  const event = JSON.parse(new TextDecoder().decode(value).match(/data: (.*)/)[1]);
  assert.equal(event.type, 'gift'); assert.equal(event.count, 2); assert.equal(event.source, 'simulation');
  await reader.cancel(); controller.abort();
  for (let n = 0; n < 20; n++) {
    const state = JSON.parse((await s.request('/api/status')).text);
    if (!state.gameWindows) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(JSON.parse((await s.request('/api/status')).text).gameWindows, 0);
});

test('control rejects foreign origins, DNS rebinding hosts and cross-site requests', async t => {
  const s = await start(t);
  assert.equal((await s.post({type:'reset'}, {Origin:'https://example.com'})).status, 403);
  assert.equal((await s.post({type:'reset'}, {Host:`evil.example:${s.port}`})).status, 403);
  assert.equal((await s.post({type:'reset'}, {'Sec-Fetch-Site':'cross-site'})).status, 403);
  assert.equal((await s.post({type:'pause'}, {Origin:s.base})).status, 200);
  assert.equal((await s.post({type:'pause'}, {Origin:`http://localhost:${s.port}`})).status, 200);
});

test('opening the game from an external link allows navigation but not cross-site control', async t => {
  const s = await start(t);
  const headers = {'Sec-Fetch-Site':'cross-site', 'Sec-Fetch-Mode':'navigate', 'Sec-Fetch-Dest':'document'};
  assert.equal((await s.request('/', {headers})).status, 200);
  assert.equal((await s.request('/control', {headers})).status, 200);
  assert.equal((await s.request('/api/stream', {headers})).status, 403);
});

test('control enforces JSON types, finite counts and byte limits with usable errors', async t => {
  const s = await start(t);
  assert.equal((await s.post({type:'reset'}, {'Content-Type':'text/plain'})).status, 415);
  for (const event of [null, [], {type:'unknown'}, {type:'gift', count:{}}, {type:'gift', count:1.5}, {type:'gift', count:0}, {type:'like', name:{}}]) {
    assert.equal((await s.post(event)).status, 400);
  }
  const oversized = await s.post({type:'chat', text:'ñ'.repeat(2100)});
  assert.equal(oversized.status, 413);
  assert.equal((await s.post({type:'follow', name:'Prueba'})).status, 200);
});

test('control rate limiting rejects a burst without stopping status requests', async t => {
  const s = await start(t); const statuses = [];
  for (let i = 0; i < 40; i++) statuses.push((await s.post({type:'like'})).status);
  assert.ok(statuses.includes(200)); assert.ok(statuses.includes(429));
  assert.equal((await s.request('/api/status')).status, 200);
});

test('SSE connections have a cap and released slots can reconnect', async t => {
  const s = await start(t), controllers = [];
  t.after(() => controllers.forEach(c => c.abort()));
  for (let i = 0; i < 16; i++) {
    const controller = new AbortController(); controllers.push(controller);
    const stream = await fetch(s.base + '/api/stream', {signal: controller.signal});
    assert.equal(stream.status, 200); await stream.body.getReader().read();
  }
  assert.equal((await s.request('/api/stream')).status, 503);
  controllers[0].abort();
  for (let i = 0; i < 20; i++) {
    if (JSON.parse((await s.request('/api/status')).text).gameWindows === 15) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const c = new AbortController(); controllers.push(c);
  const reconnected = await fetch(s.base + '/api/stream', {signal:c.signal});
  assert.equal(reconnected.status, 200);
});

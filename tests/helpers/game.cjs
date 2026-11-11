'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the actual browser script with deterministic time/randomness. Only DOM,
// Canvas and transports are doubles; maze, movement and event rules stay real.
function loadGame(seed = 1) {
  let wallTime = 1700000000000, frameTime = 0, frame;
  const timers = new Map(), sockets = [], streams = [], elements = new Map();
  const drawing = [];
  const context2d = new Proxy({}, {get(target, name) {
    if (name in target) return target[name];
    return target[name] = (...args) => { if (name === 'fillRect') drawing.push({color: target.fillStyle, args}); };
  }});
  function element(id) {
    if (!elements.has(id)) elements.set(id, {textContent: '', width: 600, height: 744,
      classList: {add() {}, remove() {}}, getContext: () => context2d});
    return elements.get(id);
  }
  const math = Object.create(Math);
  math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  class Clock extends Date { static now() { return wallTime; } }
  class Socket {
    constructor() { sockets.push(this); }
    close() { this.onclose?.(); }
  }
  class Stream {
    static CLOSED = 2;
    constructor() { this.readyState = 0; streams.push(this); }
    close() { this.readyState = 2; }
  }
  const sandbox = {document: {getElementById: element}, Date: Clock, Math: math,
    performance: {now: () => frameTime}, WebSocket: Socket, EventSource: Stream,
    requestAnimationFrame: callback => { frame = callback; },
    setTimeout: (callback, delay) => { const id = {}; timers.set(id, {callback, delay}); return id; },
    clearTimeout: id => timers.delete(id), console};
  const source = fs.readFileSync(path.join(__dirname, '../../game.js'), 'utf8');
  // Test-only access to the IIFE; no debugging globals are shipped to OBS.
  const code = source.replace(/\}\)\(\);\s*$/, 'globalThis.inspect = {s, freeCooldown, newRound, levelUp, step, findStep, crash, spawnApples, spawnBurst, draw};\n})();');
  const context = vm.createContext(sandbox);
  for (const filename of ['integrations/events.js','integrations/transport.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../..',filename),'utf8'), context, {filename});
  }
  vm.runInContext(code, context, {filename: 'game.js'});
  return { ...sandbox.inspect, elements, sockets, streams, timers, drawing,
    live(event, data) { sockets.at(-1).onmessage({data: JSON.stringify({event, data})}); },
    command(data) { streams.at(-1).onmessage({data: JSON.stringify(data)}); },
    advance(ms, quantum = 20) {
      while (ms > 0) { const delta = Math.min(quantum, ms); wallTime += delta; frameTime += delta; frame(frameTime); drawing.length = 0; ms -= delta; }
    },
    jump(ms) { wallTime += ms; frameTime += ms; frame(frameTime); drawing.length = 0; },
    stall(ms) { wallTime += ms; frameTime += ms; },
    expire(ms) { wallTime += ms; },
  };
}
module.exports = {loadGame};

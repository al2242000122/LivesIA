'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAudio } = require('../games/block-wars/audio.js');
const Config = require('../games/block-wars/config.js');

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function harness(options = {}) {
  let time = 0, timerId = 0;
  const timers = new Map(), requests = [], media = [], oscillators = [], revoked = [], urls = [];
  const clock = {
    now: () => time,
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { at: time + Math.max(0, delay), fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async advance(ms) {
      const target = time + ms;
      for (let guard = 0; guard < 10000; guard++) {
        const next = [...timers].filter(([, job]) => job.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) { time = target; await flush(); return; }
        time = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
      }
      throw Error('timer loop');
    }
  };
  const param = () => ({ value: 0, setValueAtTime(value) { this.value = value; }, exponentialRampToValueAtTime(value) { this.end = value; } });
  class Context {
    constructor() { this.state = 'suspended'; this.destination = {}; }
    get currentTime() { return time / 1000; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createOscillator() {
      let stopTimer;
      const osc = { frequency: param(), connect() {}, disconnect() { this.disconnected = true; }, start() {},
        stop(at) { clock.clearTimeout(stopTimer); if (at === undefined) return; stopTimer = clock.setTimeout(() => { if (this.onended) this.onended(); }, (at - time / 1000) * 1000); } };
      oscillators.push(osc); return osc;
    }
  }
  class Audio {
    constructor() { media.push(this); this.paused = false; }
    async play() { this.played = true; }
    pause() { this.paused = true; }
    load() {}
    end() { if (this.onended) this.onended(); }
  }
  const env = { AudioContext: Context, Audio, AbortController, Blob,
    URL: { createObjectURL(blob) { const url = 'blob:local-' + urls.length; urls.push({ url, blob }); return url; }, revokeObjectURL(url) { revoked.push(url); } } };
  const requestSpeech = options.requestSpeech || (async (event, { signal }) => { requests.push({ event, signal }); return new Blob(['mp3'], { type: 'audio/mpeg' }); });
  const audio = createAudio({ env, ...clock, minSpeechGapMs: 0, ...options, requestSpeech });
  const event = (id, kind = 'mine', extra = {}) => ({ id:'testlive:' + id, kind, source: 'simulator', actorName: 'Diego', team: 'dark', ...extra });
  return { audio, clock, timers, requests, media, oscillators, revoked, urls, event, env };
}

test('audio requires operator enable, accepts only known actions and deduplicates source IDs', async () => {
  const h = harness();
  assert.equal(h.audio.notify(h.event('early')), false);
  assert.equal(await h.audio.enable(), true);
  assert.equal(h.audio.notify(h.event('x', 'subscription')), false);
  assert.equal(h.audio.notify(h.event('x', 'mine', { source: 'remote' })), false);
  assert.equal(h.audio.notify(h.event('x')), true);
  assert.equal(h.audio.notify(h.event('x')), false);
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.audio.state.playing, true);
  h.audio.stop();
});

test('one narration at a time, two pending maximum, NUKE replaces lower priority pending', async () => {
  const h = harness(); await h.audio.enable();
  h.audio.notify(h.event('a')); await flush();
  h.audio.notify(h.event('b')); h.audio.notify(h.event('c')); h.audio.notify(h.event('n', 'nuke'));
  assert.equal(h.audio.state.queue, 2);
  assert.equal(h.requests.length, 1);
  h.media[0].end(); await flush();
  assert.equal(h.requests[1].event.kind, 'nuke');
  h.media[1].end(); await flush();
  assert.equal(h.requests[2].event.id, h.event('c').id);
  assert.equal(h.audio.state.dropped, 1);
  h.audio.stop();
});

test('pending narrations expire after eight seconds rather than describing old actions', async () => {
  const h = harness(); await h.audio.enable();
  h.audio.notify(h.event('a')); await flush(); h.audio.notify(h.event('b'));
  await h.clock.advance(8100); h.media[0].end(); await flush();
  assert.equal(h.requests.length, 1); assert.equal(h.audio.state.queue, 0); assert.equal(h.audio.state.dropped, 1);
  h.audio.stop();
});

test('mute aborts in-flight TTS and a late result never creates audio', async () => {
  let resolve, signal;
  const h = harness({ requestSpeech(event, options) { signal = options.signal; return new Promise(done => { resolve = done; }); } });
  await h.audio.enable(); h.audio.notify(h.event('a')); await flush();
  h.audio.mute(true); assert.equal(signal.aborted, true);
  resolve(new Blob(['late'], { type: 'audio/mpeg' })); await flush();
  assert.equal(h.urls.length, 0); assert.equal(h.audio.state.playing, false);
  h.audio.mute(false); h.audio.stop(); assert.equal(await h.audio.enable(), false); assert.equal(h.timers.size, 0);
});

test('pause releases media URLs and pending queue, resume never replays cancelled actions', async () => {
  const h = harness(); await h.audio.enable(); h.audio.notify(h.event('a')); await flush(); h.audio.notify(h.event('b'));
  h.audio.pause(true); assert.equal(h.media[0].paused, true); assert.deepEqual(h.revoked, ['blob:local-0']);
  assert.equal(h.audio.state.queue, 0); h.audio.pause(false); await flush(); assert.equal(h.requests.length, 1);
  h.audio.notify(h.event('c')); await flush(); assert.equal(h.requests.length, 2);
  h.audio.stop(); assert.equal(h.revoked.length, 2); assert.equal(h.audio.state.playing, false);
});

test('normal speech spacing drops stale queue, NUKE can bypass spacing while idle', async () => {
  const h = harness({ minSpeechGapMs: 10000 }); await h.audio.enable(); h.audio.notify(h.event('a')); await flush(); h.media[0].end();
  h.audio.notify(h.event('b')); await h.clock.advance(8001);
  assert.equal(h.requests.length, 1); assert.equal(h.audio.state.queue, 0);
  h.audio.notify(h.event('n', 'nuke')); await flush(); assert.equal(h.requests.length, 2);
  h.audio.stop(); assert.equal(h.timers.size, 0);
});

test('provider failures back off requests for 30 seconds while action sounds remain available', async () => {
  let calls = 0;
  const h = harness({ requestSpeech: async () => { calls++; throw Error('provider private detail'); } });
  await h.audio.enable(); h.audio.notify(h.event('a')); await flush();
  h.audio.notify(h.event('b')); await flush(); assert.equal(calls, 1); assert.equal(h.audio.state.errors, 1); assert.equal(h.audio.state.fxPlayed, 2);
  await h.clock.advance(30001); h.audio.notify(h.event('c')); await flush(); assert.equal(calls, 2);
  assert.equal(JSON.stringify(h.audio.state).includes('private detail'), false); h.audio.stop();
});

test('voice request timeout aborts and never leaves the queue stuck', async () => {
  let signal;
  const h = harness({ requestSpeech: (event, options) => { signal = options.signal; return new Promise(() => {}); } });
  await h.audio.enable(); h.audio.notify(h.event('a')); await flush(); await h.clock.advance(5001);
  assert.equal(signal.aborted, true); assert.equal(h.audio.state.playing, false); assert.equal(h.audio.state.errors, 1); h.audio.stop();
});

test('volume zero cancels speech, narration can be disabled independently of FX', async () => {
  const h = harness(); await h.audio.enable(); h.audio.notify(h.event('a')); await flush();
  assert.equal(h.audio.setVolume(0.25), true); assert.equal(h.media[0].volume, 0.25);
  assert.equal(h.audio.setVolume(NaN), false); assert.equal(h.audio.setVolume(2), false);
  h.audio.setVolume(0); assert.equal(h.audio.state.playing, false); assert.equal(h.audio.notify(h.event('silent')), false);
  h.audio.setVolume(0.5); h.audio.setNarration(false); h.audio.notify(h.event('b')); await flush();
  assert.equal(h.requests.length, 1); assert.equal(h.audio.state.fxPlayed, 2); h.audio.stop();
});

test('all catalog event sounds work offline with distinct TNT, NUKE and comment signatures and bounded nodes', async () => {
  const h = harness({ narrationEnabled: false }); await h.audio.enable();
  const signatures = {};
  for (const kind of ['mine', 'tnt', 'nuke', ...Object.keys(Config.EVENTS)]) {
    const before = h.oscillators.length; assert.equal(h.audio.notify(h.event(String(before) + kind, kind)), true);
    signatures[kind] = h.oscillators.slice(before).map(node => [node.type, node.frequency.value, node.frequency.end]);
    await h.clock.advance(1000);
  }
  assert.notDeepEqual(signatures.mine, signatures.tnt); assert.notDeepEqual(signatures.tnt, signatures.nuke);
  for (let i = 0; i < 1000; i++) h.audio.notify(h.event('burst' + i, 'nuke'));
  assert.ok(h.audio.state.nodes <= 8); assert.ok(h.audio.state.dedupe <= 256); h.audio.stop(); assert.equal(h.audio.state.nodes, 0);
});

test('storm and creeper have separate activation sounds and impact FX never request narration', async () => {
  const h = harness({ narrationEnabled: false }); await h.audio.enable();
  const signatures = [];
  for (const kind of ['rain', 'thunder', 'storm', 'creeper']) {
    const before = h.oscillators.length;
    assert.equal(h.audio.notify(h.event('new-' + kind, kind)), true);
    signatures.push(JSON.stringify(h.oscillators.slice(before).map(node => [node.type, node.frequency.value, node.frequency.end])));
    await h.clock.advance(1100);
  }
  assert.equal(new Set(signatures).size, 4);
  h.audio.setNarration(true);
  assert.equal(h.audio.impact('creeper'), true);
  assert.equal(h.audio.impact('creeper'), false, 'rapid same-kind impacts are grouped');
  assert.equal(h.audio.impact('unknown'), false);
  await flush(); assert.equal(h.requests.length, 0, 'impact cues cannot bill TTS');
  h.audio.mute(true); assert.equal(h.audio.impact('tnt'), false);
  h.audio.stop(); assert.equal(h.audio.state.nodes, 0);
});

test('front-end payload contains bounded moderated names and automatic events have no invented actor', async () => {
  const h = harness(); await h.audio.enable(); h.audio.notify(h.event('a', 'nuke', { actorName: '<script>Diego\n😀' })); await flush();
  assert.equal(h.requests[0].event.actorName.includes('<'), false); assert.ok(h.requests[0].event.actorName.length <= 24);
  h.media[0].end(); h.audio.notify(h.event('b', 'nuke', { source: 'automatic', actorName: 'Fiction' })); await flush();
  assert.equal(h.requests[1].event.actorName, ''); assert.equal(h.requests[1].event.source, 'automatic'); h.audio.stop();
});

test('default speech transport sends only local typed data and releases object URLs after playback', async () => {
  const h = harness(); const calls = [];
  h.env.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, headers: { get: () => null }, blob: async () => new Blob(['mp3'], { type: 'audio/mpeg' }) }; };
  const audio = createAudio({ env: h.env, ...h.clock, minSpeechGapMs: 0 }); await audio.enable();
  audio.notify(h.event('a')); await flush();
  assert.equal(calls[0].url, '/api/block-wars/speech'); assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)).sort(), ['actionId', 'actorName', 'kind', 'source', 'team']);
  assert.equal(JSON.parse(calls[0].options.body).actionId, h.event('a').id); h.media[0].end(); assert.deepEqual(h.revoked, ['blob:local-0']); audio.stop();
});

test('failed audio initialization can be retried after the browser supplies AudioContext', async () => {
  const h = harness(); const Context = h.env.AudioContext; delete h.env.AudioContext;
  assert.equal(await h.audio.enable(), false); h.env.AudioContext = Context;
  assert.equal(await h.audio.enable(), true); h.audio.stop();
});

test('blocked media playback releases its URL and long playback cannot hold narration forever', async () => {
  const h = harness(); h.env.Audio.prototype.play = async function () { throw Error('blocked'); };
  await h.audio.enable(); h.audio.notify(h.event('a')); await flush();
  assert.equal(h.audio.state.errors, 1); assert.deepEqual(h.revoked, ['blob:local-0']); assert.equal(h.audio.state.playing, false);
  await h.clock.advance(30001); h.env.Audio.prototype.play = async function () { this.played = true; };
  h.audio.notify(h.event('b')); await flush(); await h.clock.advance(20001);
  assert.equal(h.audio.state.playing, false); assert.equal(h.revoked.length, 2); h.audio.stop();
});

test('dedupe separates event sources and expires after two minutes', async () => {
  const h = harness({ narrationEnabled: false }); await h.audio.enable();
  assert.equal(h.audio.notify(h.event('same')), true);
  assert.equal(h.audio.notify(h.event('same', 'mine', { source: 'tikfinity' })), true);
  assert.equal(h.audio.notify(h.event('same')), false);
  await h.clock.advance(120000); assert.equal(h.audio.notify(h.event('same')), true); h.audio.stop();
});

test('oversized streaming speech is cancelled before creating playable media', async () => {
  const h = harness(); let cancelled = false, reads = 0;
  h.env.fetch = async () => ({ ok: true, headers: { get: () => null }, body: { getReader: () => ({
    async read() { reads++; return { value: new Uint8Array(1024 * 1024 + 1), done: false }; },
    async cancel() { cancelled = true; }, releaseLock() {}
  }) } });
  const audio = createAudio({ env: h.env, ...h.clock }); await audio.enable(); audio.notify(h.event('a')); await flush();
  assert.equal(cancelled, true); assert.equal(reads, 2); assert.equal(h.urls.length, 0); assert.equal(audio.state.errors, 1); audio.stop();
});

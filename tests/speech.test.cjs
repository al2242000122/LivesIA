'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSpeech } = require('../lib/speech.js');
const { EVENTS } = require('../games/block-wars/config.js');

const configured = { ELEVENLABS_API_KEY: 'fixture_key_not_real_123456', ELEVENLABS_VOICE_ID: 'FixtureVoice123456789' };
const payload = (n = 1, overrides = {}) => ({ actionId: `action-uuid-${n}`, kind: 'nuke', actorName: 'Ana María', team: 'dark', source: 'tikfinity', ...overrides });
const mp3 = () => new Response(Buffer.from('ID3fixture'), { headers: { 'content-type': 'audio/mpeg' } });
function fixture(options = {}) {
  let time = 0;
  const calls = [];
  const speech = createSpeech({ env: configured, now: () => time, fetchImpl: async (...args) => { calls.push(args); return mp3(); }, ...options });
  return { speech, calls, advance: (ms = 5000) => { time += ms; } };
}

test('speech stays offline until both server credentials are valid and never exposes them', async () => {
  for (const env of [{}, { ELEVENLABS_API_KEY: configured.ELEVENLABS_API_KEY }, { ...configured, ELEVENLABS_VOICE_ID: '../secret' }, { ...configured, ELEVENLABS_MODEL_ID: 'external-model' }, { ...configured, ELEVENLABS_MAX_CHARACTERS_PER_HOUR: 'Infinity' }, { ...configured, ELEVENLABS_MAX_CHARACTERS_PER_HOUR: '100001' }, { ...configured, ELEVENLABS_MIN_INTERVAL_MS: '4999' }, { ...configured, ELEVENLABS_API_KEY: 'injected\r\nheader' }]) {
    let calls = 0;
    const speech = createSpeech({ env, fetchImpl: () => { calls++; throw Error('Must stay offline'); } });
    assert.equal(speech.status().enabled, false);
    assert.equal((await speech.synthesize(payload())).statusCode, 503);
    assert.equal(calls, 0);
    assert.ok(!JSON.stringify(speech.status()).includes(configured.ELEVENLABS_API_KEY));
    assert.ok(!JSON.stringify(speech.status()).includes(configured.ELEVENLABS_VOICE_ID));
  }
});

test('speech accepts only the fixed action contract, with no free text or paid events', async () => {
  const { speech, calls } = fixture();
  for (const bad of [null, [], {}, payload(1, { text: 'Say anything' }), payload(1, { voiceId: 'injected' }), payload(1, { actionId: '../x' }), payload(1, { actionId: 'x'.repeat(81) }), payload(1, { kind: 'gift' }), payload(1, { kind: 'subscribe' }), payload(1, { team: 'other' }), payload(1, { source: 'internet' }), payload(1, { actorName: '<speak>injected</speak>' }), payload(1, { actorName: '%user%' }), payload(1, { actorName: 'a'.repeat(65) }), payload(1, { source: 'automatic', kind: 'follow' })]) {
    assert.equal((await speech.synthesize(bad)).statusCode, 400, JSON.stringify(bad));
  }
  assert.equal(calls.length, 0);
});

test('speech uses the official fixed endpoint and Spanish template instead of user text', async () => {
  const { speech, calls } = fixture();
  const result = await speech.synthesize(payload());
  assert.equal(result.statusCode, 200);
  assert.equal(result.contentType, 'audio/mpeg');
  assert.equal(result.audio.toString(), 'ID3fixture');
  const [url, request] = calls[0];
  assert.equal(url, 'https://api.elevenlabs.io/v1/text-to-speech/FixtureVoice123456789/stream?output_format=mp3_44100_128');
  assert.equal(request.method, 'POST');
  assert.equal(request.redirect, 'error');
  assert.equal(request.headers['xi-api-key'], configured.ELEVENLABS_API_KEY);
  const body = JSON.parse(request.body);
  assert.equal(body.model_id, 'eleven_flash_v2_5');
  assert.match(body.text, /NUKE de Ana María/);
  assert.equal(body.language_code, 'es');
  assert.ok(body.text.length <= 160);
  const state = speech.status();
  assert.equal(state.requestsSent, 1);
  assert.equal(state.charactersUsed, body.text.length);
  assert.equal(state.characterLimit, 12000);
  assert.equal(state.inFlight, 0);
  assert.equal(state.errorCode, null);
});

test('YouTube rehearsal templates keep likes anonymous and distinguish free subscribers from follows', async () => {
  const {speech,calls,advance}=fixture();
  assert.equal((await speech.synthesize(payload(1,{kind:'like_milestone',source:'simulator'}))).statusCode,200);
  const likes=JSON.parse(calls[0][1].body).text;
  assert.match(likes,/^Prueba\..*likes.*TNT/i);assert.ok(!likes.includes('Ana'));
  advance();
  assert.equal((await speech.synthesize(payload(2,{kind:'youtube_subscriber',source:'simulator'}))).statusCode,200);
  assert.match(JSON.parse(calls[1][1].body).text,/^Prueba\..*Ana María.*suscribirte.*canal/i);
  for(const source of ['automatic','tikfinity'])for(const kind of ['like_milestone','youtube_subscriber']){
    assert.equal((await speech.synthesize(payload(3,{kind,source}))).statusCode,400);
  }
  assert.equal(calls.length,2);
});

test('all existing events, rewarded mine and follow have bounded templates and honest attribution', async () => {
  const { speech, calls, advance } = fixture();
  const kinds = [...Object.keys(EVENTS), 'mine', 'follow', 'turbo', 'descomunal'];
  for (let i = 0; i < kinds.length; i++) {
    assert.equal((await speech.synthesize(payload(i + 1, { kind: kinds[i] }))).statusCode, 200);
    const body = JSON.parse(calls[i][1].body);
    assert.ok(body.text.length <= 160);
    assert.ok(!body.text.includes('%user%'));
    assert.ok(!body.text.includes('undefined'));
    advance();
  }
  await speech.synthesize(payload(100, { source: 'simulator', kind: 'follow' }));
  assert.match(JSON.parse(calls.at(-1)[1].body).text, /^Prueba\./);
  advance();
  await speech.synthesize(payload(101, { source: 'automatic' }));
  assert.ok(!JSON.parse(calls.at(-1)[1].body).text.includes('Ana'));
  advance();
  await speech.synthesize(payload(102, { actorName: '' }));
  assert.match(JSON.parse(calls.at(-1)[1].body).text, /comunidad/);
  advance();
  await speech.synthesize(payload(103, { actorName: 'pendejo', kind: 'mine' }));
  assert.ok(!JSON.parse(calls.at(-1)[1].body).text.includes('pendejo'));
});

test('the optional multilingual model receives Spanish text without an unsupported language override', async () => {
  const { speech, calls } = fixture({ env: { ...configured, ELEVENLABS_MODEL_ID: 'eleven_multilingual_v2' } });
  assert.equal((await speech.synthesize(payload())).statusCode, 200);
  const body = JSON.parse(calls[0][1].body);
  assert.equal(body.model_id, 'eleven_multilingual_v2');
  assert.equal(Object.hasOwn(body, 'language_code'), false);
  assert.match(body.text, /NUKE de Ana María/);
});

test('action identifiers cannot be billed twice, including after a provider failure', async () => {
  let sent = 0;
  const { speech, advance } = fixture({ fetchImpl: async () => { sent++; return new Response('secret provider body', { status: 401 }); } });
  const first = await speech.synthesize(payload());
  assert.equal(first.statusCode, 503);
  assert.equal(first.error.code, 'provider_auth');
  const used = speech.status().charactersUsed;
  advance();
  assert.equal((await speech.synthesize(payload(1, { source: 'simulator' }))).statusCode, 409);
  assert.equal(sent, 1);
  assert.equal(speech.status().charactersUsed, used);
  advance(120000);
  await speech.synthesize(payload());
  assert.equal(sent, 2);
});

test('rate, character budget and hourly reset prevent runaway provider spending', async () => {
  const { speech, calls, advance } = fixture({ env: { ...configured, ELEVENLABS_MAX_CHARACTERS_PER_HOUR: '100' } });
  assert.equal((await speech.synthesize(payload(1, { actorName: 'a'.repeat(64) }))).statusCode, 200);
  assert.equal((await speech.synthesize(payload(2))).error.code, 'rate_limit');
  advance();
  assert.equal((await speech.synthesize(payload(2, { actorName: 'a'.repeat(64) }))).statusCode, 200);
  advance();
  assert.equal((await speech.synthesize(payload(3, { actorName: 'a'.repeat(64) }))).error.code, 'character_budget');
  assert.equal(calls.length, 2);
  advance(3600000);
  assert.equal((await speech.synthesize(payload(3))).statusCode, 200);
  assert.equal(speech.status().requestsSent, 3);
});

test('at most two provider requests can remain active and cancellation releases slots', async () => {
  const { speech, advance } = fixture({ fetchImpl: () => new Promise(() => {}) });
  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = speech.synthesize(payload(1), { signal: firstController.signal });
  advance();
  const second = speech.synthesize(payload(2), { signal: secondController.signal });
  advance();
  assert.equal((await speech.synthesize(payload(3))).error.code, 'concurrency_limit');
  assert.equal(speech.status().inFlight, 2);
  firstController.abort();
  secondController.abort();
  assert.equal((await first).statusCode, 499);
  assert.equal((await second).statusCode, 499);
  assert.equal(speech.status().inFlight, 0);
  assert.ok(speech.status().charactersUsed > 0);
});

test('already cancelled actions never reach provider or consume budget', async () => {
  const { speech, calls } = fixture();
  const controller = new AbortController();
  controller.abort();
  assert.equal((await speech.synthesize(payload(), { signal: controller.signal })).statusCode, 499);
  assert.equal(calls.length, 0);
  assert.equal(speech.status().charactersUsed, 0);
});

test('deadline ends requests even if a provider ignores AbortSignal', async () => {
  let fire;
  let cleared = false;
  const { speech } = fixture({ fetchImpl: () => new Promise(() => {}), timers: { setTimeout(callback, ms) { assert.equal(ms, 8000); fire = callback; return 7; }, clearTimeout(id) { assert.equal(id, 7); cleared = true; } } });
  const pending = speech.synthesize(payload());
  fire();
  assert.equal((await pending).error.code, 'provider_timeout');
  assert.equal(speech.status().inFlight, 0);
  assert.equal(cleared, true);
});

test('deadline covers audio download after headers, not only connecting to provider', async () => {
  let fire;
  let cancelled = false;
  const { speech } = fixture({
    fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'audio/mpeg' } }),
    timers: { setTimeout(callback) { fire = callback; return 1; }, clearTimeout() {} }
  });
  const pending = speech.synthesize(payload());
  await new Promise(resolve => setImmediate(resolve));
  fire();
  assert.equal((await pending).statusCode, 504);
  assert.equal(cancelled, true);
  assert.equal(speech.status().inFlight, 0);
});

test('late provider responses are cancelled after the client has disconnected', async () => {
  let respond;
  let cancelled = false;
  const { speech } = fixture({ fetchImpl: () => new Promise(resolve => { respond = resolve; }) });
  const controller = new AbortController();
  const pending = speech.synthesize(payload(), { signal: controller.signal });
  controller.abort();
  assert.equal((await pending).statusCode, 499);
  respond(new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'audio/mpeg' } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cancelled, true);
});

test('provider errors never leak upstream bodies or exception messages', async () => {
  for (const [status, expected] of [[401, 503], [403, 503], [429, 429], [500, 502]]) {
    const { speech } = fixture({ fetchImpl: async () => new Response(configured.ELEVENLABS_API_KEY, { status }) });
    const result = await speech.synthesize(payload());
    assert.equal(result.statusCode, expected);
    assert.ok(!JSON.stringify(result).includes(configured.ELEVENLABS_API_KEY));
  }
  const { speech } = fixture({ fetchImpl: async () => { throw Error(configured.ELEVENLABS_API_KEY); } });
  assert.equal((await speech.synthesize(payload())).statusCode, 502);
  assert.ok(!JSON.stringify(speech.status()).includes(configured.ELEVENLABS_API_KEY));
});

test('audio is bounded by actual bytes as well as Content-Length and must be nonempty MP3', async () => {
  const cases = [
    () => new Response('html', { headers: { 'content-type': 'text/html' } }),
    () => new Response('', { headers: { 'content-type': 'audio/mpeg' } }),
    () => new Response('ID3', { headers: { 'content-type': 'audio/mpeg', 'content-length': '2097153' } }),
    () => new Response(Buffer.alloc(2097153), { headers: { 'content-type': 'audio/mpeg' } }),
    () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(10)); controller.error(Error('upstream private body')); } }), { headers: { 'content-type': 'audio/mpeg' } })
  ];
  for (const response of cases) {
    const { speech } = fixture({ fetchImpl: async () => response() });
    const result = await speech.synthesize(payload());
    assert.equal(result.statusCode, 502);
    assert.equal(result.audio, undefined);
    assert.equal(speech.status().inFlight, 0);
  }
});

'use strict';

const { EVENTS } = require('../games/block-wars/config.js');

const FIELDS = ['actionId', 'kind', 'actorName', 'team', 'source'];
const KINDS = new Set([...Object.keys(EVENTS), 'mine', 'follow', 'turbo', 'descomunal', 'like_milestone', 'youtube_subscriber']);
const REHEARSAL_REWARDS = new Set(['like_milestone', 'youtube_subscriber']);
const MODELS = new Set(['eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_multilingual_v2']);
const LABELS = Object.freeze({
  tnt: 'TNT', rainbow: 'rainbow', mega: 'MEGA TNT', arrow: 'arrows',
  butterfly: 'butterfly', nuke: 'ULTRANUKE', tnt_rain: 'TNT rain',
  thunder: 'thunderstorm', storm: 'ice storm', creeper: 'Creeper', fire: 'Nether fire', rain: 'pickaxe rain', tsunami: 'tsunami',
  black_hole: 'black hole', jackpot: 'golden TNT', demon: 'demon',
  meteor: 'meteor', spin: 'spin', fast: 'speed boost', big: 'giant pickaxe',
  turbo: 'turbo', descomunal: 'colossal pickaxe'
});
const HOUR_MS = 3600000;
const DEDUPE_MS = 120000;
const MAX_SEEN = 256;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const DEADLINE_MS = 8000;

function validatePayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== FIELDS.length || !FIELDS.every(key => Object.hasOwn(value, key))) return null;
  if (typeof value.actionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,79}$/.test(value.actionId)) return null;
  if (!KINDS.has(value.kind) || ['sixty_seven','messi','siuuu'].includes(value.kind) || !['dark', 'light', 'neutral'].includes(value.team)) return null;
  if (!['simulator', 'tikfinity', 'automatic','youtube'].includes(value.source)) return null;
  if (value.source==='youtube'&&!REHEARSAL_REWARDS.has(value.kind)) return null;
  if (value.source === 'automatic' && value.kind === 'follow') return null;
  // These reward types currently exist only as local rehearsals, never as relay/paid events.
  if (REHEARSAL_REWARDS.has(value.kind) && !['simulator','youtube'].includes(value.source)) return null;
  if (typeof value.actorName !== 'string' || value.actorName.length > 64 || !/^[\p{L}\p{M}\p{N} _-]*$/u.test(value.actorName)) return null;
  return Object.fromEntries(FIELDS.map(key => [key, value[key]]));
}

function spokenName(value) {
  const name = value.normalize('NFKC').replace(/[_-]/g, ' ').replace(/ +/g, ' ').trim();
  const words = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  // A small local filter, not complete moderation. The operator can mute narration.
  if (/\b(pendej[oa]s?|put[oa]s?|cabron(?:es)?|culer[oa]s?|mierda|fuck|shit)\b/.test(words)) return '';
  return Array.from(name).slice(0, 32).join('');
}

function narration(payload) {
  const actor = spokenName(payload.actorName);
  let text;
  if (payload.kind === 'like_milestone') {
    text = payload.source==='youtube'?'New like! Three ULTRANUKE charges in the mine!':'Like goal reached! The community activated TNT.';
  } else if (payload.kind === 'youtube_subscriber') {
    text = actor ? `Thank you, ${actor}, for subscribing to the channel for free!` : 'A new free subscriber has joined the channel!';
    if(payload.source==='youtube')text+=' Ten ULTRANUKE charges!';
  } else if (payload.kind === 'mine') {
    const team = payload.team === 'neutral' ? 'the mine' : payload.team.toUpperCase();
    text = `${actor || 'The community'} boosts ${team}.`;
  } else if (payload.kind === 'follow') {
    text = actor ? `Welcome, ${actor}! Thanks for following the mine.` : 'A new follower has joined the mine!';
  } else if (payload.source === 'automatic') {
    text = `Mine event: ${LABELS[payload.kind]}.`;
  } else {
    text = actor ? `${LABELS[payload.kind]} from ${actor}!` : `The community activated ${LABELS[payload.kind]}!`;
  }
  // Automatic events must not claim a participant, even for rewarded-mine templates.
  if (payload.source === 'automatic' && payload.kind === 'mine') text = 'The mine gets a boost.';
  return `${payload.source === 'simulator' ? 'Test. ' : ''}${text}`.slice(0, 160);
}

function configuredInteger(value, fallback, min, max) {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function configuration(env) {
  const key = env.ELEVENLABS_API_KEY;
  const voice = env.ELEVENLABS_VOICE_ID;
  const model = env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5';
  const budget = configuredInteger(env.ELEVENLABS_MAX_CHARACTERS_PER_HOUR, 12000, 100, 100000);
  const interval = configuredInteger(env.ELEVENLABS_MIN_INTERVAL_MS, 5000, 5000, 60000);
  let errorCode = null;
  if (!key || !voice) errorCode = 'not_configured';
  else if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,256}$/.test(key)) errorCode = 'invalid_key_configuration';
  else if (typeof voice !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(voice)) errorCode = 'invalid_voice_configuration';
  else if (!MODELS.has(model)) errorCode = 'invalid_model_configuration';
  else if (budget === null || interval === null) errorCode = 'invalid_limit_configuration';
  return { key, voice, model, budget, interval, errorCode,
    keyConfigured: typeof key === 'string' && key.length > 0,
    voiceConfigured: typeof voice === 'string' && voice.length > 0 };
}

const failure = (statusCode, code, message) => ({ statusCode, error: { code, message } });

async function readAudio(response, signal) {
  const mime = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (mime !== 'audio/mpeg' || Number(response.headers.get('content-length')) > MAX_AUDIO_BYTES || !response.body) {
    response.body?.cancel().catch(() => {});
    return failure(502, 'invalid_audio', 'The provider did not return valid audio.');
  }
  const reader = response.body.getReader();
  const cancel = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_AUDIO_BYTES) {
        cancel();
        return failure(502, 'audio_too_large', 'The audio exceeded the size limit.');
      }
      chunks.push(Buffer.from(value));
    }
    return length ? { statusCode: 200, contentType: 'audio/mpeg', audio: Buffer.concat(chunks, length) }
      : failure(502, 'invalid_audio', 'The provider returned empty audio.');
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

function createSpeech({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now, timers = { setTimeout, clearTimeout } } = {}) {
  const config = configuration(env);
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${config.voice}/stream?output_format=mp3_44100_128`;
  // Offline games need neither SDK initialization nor provider access.
  const ElevenLabsClient = config.errorCode ? null : require('@elevenlabs/elevenlabs-js').ElevenLabsClient;
  const client = config.errorCode ? null : new ElevenLabsClient({
    apiKey:config.key,baseUrl:'https://api.elevenlabs.io',maxRetries:0,timeoutInSeconds:8,logging:{silent:true},
    // Keep SDK serialization and streaming, while retaining our stricter transport boundary.
    async fetch(url,options){
      if(String(url)!==endpoint || options.method!=='POST')throw new Error('invalid_provider_endpoint');
      const signal=options.signal;
      if(signal.aborted)return new Response(null,{status:499});
      let onAbort;
      const aborted=new Promise(resolve=>{onAbort=()=>resolve(new Response(null,{status:499}));signal.addEventListener('abort',onAbort,{once:true});});
      const request=Promise.resolve().then(()=>fetchImpl(url,{...options,redirect:'error',headers:Object.fromEntries(new Headers(options.headers))})).then(response=>{
        if(signal.aborted || !response.ok){
          // The SDK otherwise parses arbitrary error bodies before returning their status.
          response.body?.cancel().catch(()=>{});
          return new Response(null,{status:signal.aborted?499:response.status>=400?response.status:502});
        }
        return response;
      },()=>new Response(null,{status:502}));
      try{return await Promise.race([request,aborted]);}
      finally{signal.removeEventListener('abort',onAbort);}
    }
  });
  const seen = new Map();
  let windowStart = now();
  let charactersUsed = 0;
  let requestsSent = 0;
  let inFlight = 0;
  let lastStarted = null;
  let lastError = null;

  function maintain(time) {
    if (time - windowStart >= HOUR_MS) { windowStart = time; charactersUsed = 0; }
    for (const [id, started] of seen) if (time - started >= DEDUPE_MS) seen.delete(id);
  }

  function status() {
    maintain(now());
    return { enabled: !config.errorCode, keyConfigured: config.keyConfigured, voiceConfigured: config.voiceConfigured,
      errorCode: config.errorCode || lastError, charactersUsed, characterLimit: config.budget ?? 12000,
      requestsSent, inFlight };
  }

  async function synthesize(input, { signal } = {}) {
    const payload = validatePayload(input);
    if (!payload) return failure(400, 'invalid_payload', 'Invalid narration action.');
    if (config.errorCode) return failure(503, config.errorCode, 'Configure narration on the local server.');
    if (signal?.aborted) return failure(499, 'cancelled', 'Narration cancelled.');
    const time = now();
    maintain(time);
    if (seen.has(payload.actionId)) return failure(409, 'duplicate_action', 'This action already requested narration.');
    if (inFlight >= 2) return failure(429, 'concurrency_limit', 'Narration is busy.');
    if (lastStarted !== null && time - lastStarted < config.interval) return failure(429, 'rate_limit', 'Wait before requesting more narration.');
    const text = narration(payload);
    if (charactersUsed + text.length > config.budget) return failure(429, 'character_budget', 'The hourly narration limit has been reached.');
    if (seen.size >= MAX_SEEN) return failure(429, 'dedupe_capacity', 'Narration is busy.');

    const controller = new AbortController();
    let abortCode = 'cancelled';
    const onAbort = () => controller.abort();
    const stopped = new Promise(resolve => controller.signal.addEventListener('abort', () => resolve(
      abortCode === 'provider_timeout'
        ? failure(504, 'provider_timeout', 'The narration provider took too long.')
        : failure(499, 'cancelled', 'Narration cancelled.')
    ), { once: true }));
    signal?.addEventListener('abort', onAbort, { once: true });
    const timeout = timers.setTimeout(() => { abortCode = 'provider_timeout'; controller.abort(); }, DEADLINE_MS);
    seen.set(payload.actionId, time);
    lastStarted = time;
    charactersUsed += text.length;
    requestsSent++;
    inFlight++;
    try {
      const request = (async () => {
        try {
          const {data,rawResponse}=await client.textToSpeech.stream(config.voice,{
            text,modelId:config.model,outputFormat:'mp3_44100_128',
            ...(config.model==='eleven_multilingual_v2'?{}:{languageCode:'en'})
          },{abortSignal:controller.signal,maxRetries:0,timeoutInSeconds:8}).withRawResponse();
          if(controller.signal.aborted){data?.cancel?.().catch(()=>{});controller.signal.throwIfAborted();}
          return readAudio({headers:rawResponse.headers,body:data},controller.signal);
        } catch(error) {
          if(error.statusCode===401||error.statusCode===403)return failure(503,'provider_auth','Check narration access in ElevenLabs.');
          if(error.statusCode===429)return failure(429,'provider_rate_limit','ElevenLabs limited the requests.');
          return failure(502,'provider_error','ElevenLabs could not generate the narration.');
        }
      })();
      const result = await Promise.race([request, stopped]);
      lastError = result.error?.code || null;
      return result;
    } catch {
      lastError = 'provider_error';
      return failure(502, 'provider_error', 'Could not retrieve narration from the provider.');
    } finally {
      timers.clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      controller.abort();
      inFlight--;
    }
  }

  return { status, synthesize };
}

module.exports = { createSpeech, validatePayload };

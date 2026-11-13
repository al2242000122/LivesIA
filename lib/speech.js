'use strict';

const { EVENTS } = require('../games/block-wars/config.js');

const FIELDS = ['actionId', 'kind', 'actorName', 'team', 'source'];
const KINDS = new Set([...Object.keys(EVENTS), 'mine', 'follow', 'turbo', 'descomunal']);
const MODELS = new Set(['eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_multilingual_v2']);
const LABELS = Object.freeze({
  tnt: 'TNT', rainbow: 'arcoíris', mega: 'MEGA TNT', arrow: 'flechas',
  butterfly: 'mariposa', nuke: 'NUKE', tnt_rain: 'lluvia de TNT',
  thunder: 'tormenta eléctrica', storm: 'tormenta de hielo', creeper: 'Creeper', fire: 'fuego del Nether', rain: 'lluvia de TNT', tsunami: 'tsunami',
  black_hole: 'agujero negro', jackpot: 'TNT dorada', demon: 'demonio',
  meteor: 'meteorito', spin: 'giro', fast: 'velocidad', big: 'pico gigante',
  turbo: 'turbo', descomunal: 'pico descomunal'
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
  if (!KINDS.has(value.kind) || !['dark', 'light', 'neutral'].includes(value.team)) return null;
  if (!['simulator', 'tikfinity', 'automatic'].includes(value.source)) return null;
  if (value.source === 'automatic' && value.kind === 'follow') return null;
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
  if (payload.kind === 'mine') {
    const team = payload.team === 'neutral' ? 'la mina' : payload.team.toUpperCase();
    text = `${actor || 'La comunidad'} refuerza a ${team}.`;
  } else if (payload.kind === 'follow') {
    text = actor ? `¡Bienvenido, ${actor}! Gracias por seguir la mina.` : '¡Nuevo seguidor en la mina!';
  } else if (payload.source === 'automatic') {
    text = `Evento de la mina: ${LABELS[payload.kind]}.`;
  } else {
    text = actor ? `¡${LABELS[payload.kind]} de ${actor}!` : `¡La comunidad activó ${LABELS[payload.kind]}!`;
  }
  // Automatic events must not claim a participant, even for rewarded-mine templates.
  if (payload.source === 'automatic' && payload.kind === 'mine') text = 'La mina recibe un refuerzo.';
  return `${payload.source === 'simulator' ? 'Prueba. ' : ''}${text}`.slice(0, 160);
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
    return failure(502, 'invalid_audio', 'El proveedor no devolvió audio válido.');
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
        return failure(502, 'audio_too_large', 'El audio excedió el límite permitido.');
      }
      chunks.push(Buffer.from(value));
    }
    return length ? { statusCode: 200, contentType: 'audio/mpeg', audio: Buffer.concat(chunks, length) }
      : failure(502, 'invalid_audio', 'El proveedor devolvió audio vacío.');
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

function createSpeech({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now, timers = { setTimeout, clearTimeout } } = {}) {
  const config = configuration(env);
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
    if (!payload) return failure(400, 'invalid_payload', 'Acción de voz no válida.');
    if (config.errorCode) return failure(503, config.errorCode, 'Configura la voz en el servidor local.');
    if (signal?.aborted) return failure(499, 'cancelled', 'Narración cancelada.');
    const time = now();
    maintain(time);
    if (seen.has(payload.actionId)) return failure(409, 'duplicate_action', 'La acción ya solicitó narración.');
    if (inFlight >= 2) return failure(429, 'concurrency_limit', 'La narración está ocupada.');
    if (lastStarted !== null && time - lastStarted < config.interval) return failure(429, 'rate_limit', 'Espera antes de otra narración.');
    const text = narration(payload);
    if (charactersUsed + text.length > config.budget) return failure(429, 'character_budget', 'Se alcanzó el límite horario de voz.');
    if (seen.size >= MAX_SEEN) return failure(429, 'dedupe_capacity', 'La narración está ocupada.');

    const controller = new AbortController();
    let abortCode = 'cancelled';
    const onAbort = () => controller.abort();
    const stopped = new Promise(resolve => controller.signal.addEventListener('abort', () => resolve(
      abortCode === 'provider_timeout'
        ? failure(504, 'provider_timeout', 'El proveedor de voz tardó demasiado.')
        : failure(499, 'cancelled', 'Narración cancelada.')
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
        const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${config.voice}/stream?output_format=mp3_44100_128`, {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { 'xi-api-key': config.key, 'content-type': 'application/json', accept: 'audio/mpeg' },
          body: JSON.stringify({ text, model_id: config.model,
            ...(config.model === 'eleven_multilingual_v2' ? {} : { language_code: 'es' }) })
        });
        if (controller.signal.aborted) { response.body?.cancel().catch(() => {}); controller.signal.throwIfAborted(); }
        if (!response.ok) {
          response.body?.cancel().catch(() => {});
          if (response.status === 401 || response.status === 403) return failure(503, 'provider_auth', 'Revisa el acceso a la voz en ElevenLabs.');
          if (response.status === 429) return failure(429, 'provider_rate_limit', 'ElevenLabs limitó las solicitudes.');
          return failure(502, 'provider_error', 'ElevenLabs no pudo generar la narración.');
        }
        return readAudio(response, controller.signal);
      })();
      const result = await Promise.race([request, stopped]);
      lastError = result.error?.code || null;
      return result;
    } catch {
      lastError = 'provider_error';
      return failure(502, 'provider_error', 'No se pudo obtener la voz del proveedor.');
    } finally {
      timers.clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      inFlight--;
    }
  }

  return { status, synthesize };
}

module.exports = { createSpeech, validatePayload };

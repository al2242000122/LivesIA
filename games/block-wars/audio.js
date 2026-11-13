(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config.js'), root);
  else root.BlockWarsAudio = factory(root.BlockWarsConfig, root);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Config, root) {
  'use strict';
  // Original synthesized cues. No Minecraft sound files or third-party assets.
  const CUES = Object.freeze({
    mine:[['square',900,550,0.055]], follow:[['sine',660,990,0.18]],
    tnt:[['square',480,300,0.18]], nuke:[['square',220,220,0.15],['square',165,165,0.22,0.25],['triangle',110,55,0.45,0.55]],
    mega:[['triangle',180,50,0.38]], arrow:[['sine',1100,200,0.1]],
    rainbow:[['sine',880,1320,0.2]], butterfly:[['sine',1050,1550,0.16]],
    tnt_rain:[['square',300,90,0.25]], thunder:[['sawtooth',70,28,0.32]],
    fire:[['sawtooth',1300,450,0.25]], rain:[['square',620,300,0.13],['square',520,250,0.13,0.18],['square',420,200,0.13,0.36]],
    storm:[['sawtooth',280,80,0.65],['triangle',1200,320,0.15,0.2]],
    creeper:[['sawtooth',2700,1800,0.65],['square',3400,2400,0.35,0.15]],
    tsunami:[['triangle',120,60,0.5]], black_hole:[['sine',180,25,0.65]],
    jackpot:[['sine',660,1320,0.35],['sine',880,1760,0.35]],
    demon:[['sawtooth',140,55,0.3]], meteor:[['triangle',260,40,0.5]],
    spin:[['sine',350,1400,0.25]], fast:[['square',700,1200,0.1]],
    big:[['triangle',150,80,0.3]], turbo:[['triangle',800,1400,0.15]],
    descomunal:[['sawtooth',140,40,0.45]]
  });
  const IMPACTS = Object.freeze({
    tnt:[['triangle',120,28,0.35]], rain:[['triangle',150,40,0.25]], tnt_rain:[['triangle',150,40,0.25]],
    mega:[['sawtooth',100,25,0.6]], nuke:[['sawtooth',80,22,0.85],['triangle',130,30,0.65]],
    creeper:[['square',160,30,0.3],['triangle',90,25,0.4]], thunder:[['sawtooth',100,25,0.55]],
    storm:[['triangle',1400,350,0.09]], meteor:[['sawtooth',180,25,0.55]],
    fire:[['sawtooth',650,180,0.2]], arrow:[['square',1700,500,0.07]], tsunami:[['triangle',200,55,0.35]]
  });
  const MAX_PENDING = 2, MAX_NODES = 8, MAX_AUDIO_BYTES = 2 * 1024 * 1024;
  const EVENT_TTL = 8000, DEDUPE_TTL = 120000, MAX_SEEN = 256, ERROR_BACKOFF = 30000;
  const SOURCES = new Set(['simulator','tikfinity','automatic']);
  const KINDS = new Set([...Object.keys(Config.EVENTS), ...Object.keys(Config.BUFFS), 'mine', 'follow']);
  const SPEECH_REWARDS = Object.freeze({like_milestone:'tnt',youtube_subscriber:'follow'});

  function normalize(input, at) {
    if (!input || typeof input !== 'object' || typeof input.id !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,79}$/.test(input.id) || !KINDS.has(input.kind) || !SOURCES.has(input.source)) return null;
    if (input.actorName !== undefined && typeof input.actorName !== 'string') return null;
    if (input.team !== undefined && !['dark','light','neutral'].includes(input.team)) return null;
    if (input.narrate !== undefined && typeof input.narrate !== 'boolean') return null;
    if (input.speechKind !== undefined && (input.source !== 'simulator' ||
      !Object.hasOwn(SPEECH_REWARDS,input.speechKind) || SPEECH_REWARDS[input.speechKind] !== input.kind)) return null;
    // Names are data, never narration instructions. The server repeats moderation.
    const actorName = input.source === 'automatic' || input.speechKind === 'like_milestone' ? '' : (input.actorName || '').slice(0,80).normalize('NFKC')
      .replace(/[^\p{L}\p{M}\p{N} _-]/gu,'').replace(/\s+/g,' ').trim().slice(0,24);
    const priority = input.kind === 'nuke' ? 3 : ['mega','jackpot','meteor','black_hole'].includes(input.kind) ? 2 : input.kind === 'follow' ? 1 : 0;
    return {id:input.id,kind:input.kind,actorName,team:input.team || 'neutral',source:input.source,at,priority,
      narrate:input.narrate !== false,speechKind:input.speechKind || input.kind};
  }

  function createAudio(options = {}) {
    const env = options.env || root;
    const now = options.now || (() => env.performance ? env.performance.now() : Date.now());
    const later = options.setTimeout || ((fn, delay) => env.setTimeout(fn, delay));
    const cancelTimer = options.clearTimeout || (id => env.clearTimeout(id));
    const gap = Number.isFinite(options.minSpeechGapMs) && options.minSpeechGapMs >= 0 ? options.minSpeechGapMs : 10000;
    const queue = [], seen = new Map(), nodes = new Set(), lastImpact = new Map();
    let context, master, active = null, pumpTimer = null, stopped = false, enabling = null;
    let lastStarted = -Infinity, voiceBlockedUntil = 0;
    const state = {enabled:false,muted:false,paused:false,volume:0.6,narrationEnabled:options.narrationEnabled !== false,
      queue:0,playing:false,phase:'idle',lastStatus:'disabled',dropped:0,errors:0,fxPlayed:0,fxDropped:0,
      requested:0,started:0,finished:0,nodes:0,dedupe:0};

    function status(code) {
      state.queue = queue.length; state.playing = active !== null; state.nodes = nodes.size; state.dedupe = seen.size;
      if (code) state.lastStatus = code;
      if (typeof options.onStatus === 'function') {
        try { options.onStatus({...state}); } catch (_) { /* An operator UI failure must not affect gameplay. */ }
      }
    }
    const audible = () => state.enabled && !state.muted && !state.paused && !stopped && state.volume > 0;
    function clearPump() { if (pumpTimer !== null) cancelTimer(pumpTimer); pumpTimer = null; }
    function releaseNode(item, stop) {
      if (!nodes.delete(item)) return;
      item.osc.onended = null;
      if (stop) { try { item.osc.stop(); } catch (_) { /* Already ended. */ } }
      try { item.osc.disconnect(); item.gain.disconnect(); } catch (_) { /* Already disconnected. */ }
      state.nodes = nodes.size;
    }
    function clearFX() { for (const item of [...nodes]) releaseNode(item,true); }
    function cue(notes) {
      if (!notes || !context || context.state !== 'running' || nodes.size + notes.length > MAX_NODES) { state.fxDropped++; return false; }
      try {
        for (const [type, start, end, duration, delay = 0] of notes) {
          const osc = context.createOscillator(), gain = context.createGain(), item = {osc,gain};
          const at = context.currentTime + delay;
          nodes.add(item); osc.type = type; osc.frequency.setValueAtTime(start,at);
          osc.frequency.exponentialRampToValueAtTime(end,at + duration);
          gain.gain.setValueAtTime(0.035,at);
          gain.gain.exponentialRampToValueAtTime(0.0001,at + duration);
          osc.connect(gain); gain.connect(master); osc.onended = () => releaseNode(item,false);
          osc.start(at); osc.stop(at + duration);
        }
        state.fxPlayed++; return true;
      } catch (_) { state.fxDropped++; clearFX(); return false; }
    }
    function impact(kind) {
      if (!audible() || !Object.prototype.hasOwnProperty.call(IMPACTS,kind)) return false;
      const time = now();
      if (time - (lastImpact.get(kind) ?? -Infinity) < 150) return false;
      if (!cue(IMPACTS[kind])) return false;
      lastImpact.set(kind,time); return true;
    }
    function cleanupRun(run) {
      cancelTimer(run.timer);
      run.controller.abort();
      if (run.media) {
        run.media.onended = null; run.media.onerror = null;
        try { run.media.pause(); run.media.src = ''; run.media.load(); } catch (_) { /* Browser may already have released media. */ }
      }
      if (run.url) { env.URL.revokeObjectURL(run.url); run.url = null; }
    }
    function clearVoice() {
      clearPump(); state.dropped += queue.length; queue.length = 0;
      if (active) { const run = active; active = null; cleanupRun(run); state.dropped++; }
      state.phase = stopped ? 'stopped' : 'idle';
    }
    function complete(run, errorCode) {
      if (active !== run) return;
      active = null; cleanupRun(run); state.phase = 'idle';
      if (errorCode) {
        state.errors++; voiceBlockedUntil = now() + ERROR_BACKOFF;
        state.dropped += queue.length; queue.length = 0;
      } else state.finished++;
      status(errorCode || 'voice_finished'); pump();
    }
    function purge() {
      const time = now();
      for (let i = queue.length - 1; i >= 0; i--) if (time - queue[i].at >= EVENT_TTL) { queue.splice(i,1); state.dropped++; }
      for (const [key, at] of seen) { if (time - at >= DEDUPE_TTL) seen.delete(key); }
    }
    async function defaultSpeech(event, {signal}) {
      const response = await env.fetch('/api/block-wars/speech', {method:'POST',headers:{'Content-Type':'application/json'},signal,
        body:JSON.stringify({actionId:event.id,kind:event.kind,actorName:event.actorName,team:event.team,source:event.source})});
      if (!response.ok) throw Error('speech_http_error');
      const size = Number(response.headers.get('content-length'));
      if (size > MAX_AUDIO_BYTES) throw Error('speech_too_large');
      // Bound streaming responses too; Content-Length is not a trustworthy limit.
      if (response.body && response.body.getReader) {
        const reader = response.body.getReader(), chunks = []; let length = 0;
        try {
          while (true) {
            const {value,done} = await reader.read(); if (done) break;
            length += value.byteLength;
            if (length > MAX_AUDIO_BYTES) { await reader.cancel(); throw Error('speech_too_large'); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        return new env.Blob(chunks,{type:response.headers.get('content-type') || 'audio/mpeg'});
      }
      return response.blob();
    }
    const requestSpeech = options.requestSpeech || defaultSpeech;
    async function speak(event) {
      const run = {event,controller:new env.AbortController(),timer:null,media:null,url:null};
      active = run; state.phase = 'requesting'; state.requested++; status('voice_requesting');
      run.timer = later(() => complete(run,'voice_timeout'),Math.min(5000,EVENT_TTL - (now() - event.at)));
      try {
        const blob = await requestSpeech({id:event.id,kind:event.speechKind,actorName:event.actorName,team:event.team,source:event.source},{signal:run.controller.signal});
        if (active !== run) return;
        if (!audible() || !state.narrationEnabled || now() - event.at >= EVENT_TTL) { active = null; cleanupRun(run); state.dropped++; state.phase = 'idle'; status('voice_expired'); pump(); return; }
        if (!blob || !Number.isFinite(blob.size) || blob.size <= 0 || blob.size > MAX_AUDIO_BYTES || (blob.type && !blob.type.startsWith('audio/'))) throw Error('invalid_audio');
        cancelTimer(run.timer); run.url = env.URL.createObjectURL(blob); run.media = new env.Audio();
        run.media.preload = 'auto'; run.media.src = run.url; run.media.volume = state.volume;
        run.media.onended = () => complete(run); run.media.onerror = () => complete(run,'voice_error');
        run.timer = later(() => complete(run,'voice_timeout'),20000);
        await run.media.play();
        if (active !== run) return;
        lastStarted = now(); state.started++; state.phase = 'speaking'; status('voice_started');
      } catch (_) { if (active === run) complete(run,'voice_error'); }
    }
    function pump() {
      clearPump(); purge();
      if (active || !audible() || !state.narrationEnabled || !queue.length) { status(); return; }
      let index = 0;
      for (let i = 1; i < queue.length; i++) if (queue[i].priority > queue[index].priority) index = i;
      const event = queue[index], time = now();
      const wait = Math.max(0,voiceBlockedUntil - time,event.priority === 3 ? 0 : lastStarted + gap - time);
      if (wait > 0) {
        const expiry = Math.min(...queue.map(item => item.at + EVENT_TTL - time));
        pumpTimer = later(pump,Math.min(wait,expiry)); status(); return;
      }
      queue.splice(index,1); void speak(event);
    }
    async function enable() {
      if (stopped) return false;
      if (enabling) return enabling;
      enabling = (async () => {
        try {
          const AudioContext = env.AudioContext || env.webkitAudioContext;
          if (!context) { context = new AudioContext(); master = context.createGain(); master.connect(context.destination); master.gain.value = state.volume; }
          await context.resume();
          if (stopped) return false;
          state.enabled = context.state === 'running'; status(state.enabled ? 'ready' : 'audio_unavailable'); return state.enabled;
        } catch (_) { state.enabled = false; status(stopped ? 'stopped' : 'audio_unavailable'); return false; }
      })();
      try { return await enabling; }
      finally { enabling = null; }
    }
    function notify(input) {
      if (!audible()) return false;
      const event = normalize(input,now()); if (!event) return false;
      purge(); const key = event.source + ':' + event.id;
      if (seen.has(key)) return false;
      seen.set(key,event.at); while (seen.size > MAX_SEEN) seen.delete(seen.keys().next().value);
      cue(CUES[event.kind]);
      if (!event.narrate || !state.narrationEnabled || now() < voiceBlockedUntil) { status('fx_only'); return true; }
      if (queue.length >= MAX_PENDING) {
        let lowest = 0; for (let i = 1; i < queue.length; i++) if (queue[i].priority < queue[lowest].priority) lowest = i;
        if (event.priority < queue[lowest].priority) { state.dropped++; status('voice_queue_full'); return true; }
        queue.splice(lowest,1); state.dropped++;
      }
      queue.push(event); pump(); return true;
    }
    function mute(value) { state.muted = Boolean(value); if (state.muted) { clearVoice(); clearFX(); } status(state.muted ? 'muted' : 'ready'); }
    function pause(value) { state.paused = Boolean(value); if (state.paused) { clearVoice(); clearFX(); } status(state.paused ? 'paused' : 'ready'); }
    function setVolume(value) {
      if (!Number.isFinite(value) || value < 0 || value > 1) return false;
      state.volume = value; if (master) master.gain.value = value; if (active && active.media) active.media.volume = value;
      if (value === 0) { clearVoice(); clearFX(); } status('volume_changed'); return true;
    }
    function setNarration(value) { state.narrationEnabled = Boolean(value); if (!state.narrationEnabled) clearVoice(); status(state.narrationEnabled ? 'narration_enabled' : 'narration_disabled'); }
    function stop() {
      if (stopped) return; stopped = true; state.enabled = false; clearVoice(); clearFX(); seen.clear(); lastImpact.clear();
      if (master) { try { master.disconnect(); } catch (_) { /* Already disconnected. */ } }
      if (context) { try { const closed = context.close(); if (closed && closed.catch) closed.catch(() => {}); } catch (_) { /* Context already closed. */ } }
      status('stopped');
    }
    return {enable,mute,pause,notify,impact,setVolume,setNarration,stop,state};
  }
  return Object.freeze({createAudio});
}));

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config.js'), root, require('./audio-assets.js'));
  else root.BlockWarsAudio = factory(root.BlockWarsConfig, root, root.BlockWarsAudioAssets);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Config, root, Assets) {
  'use strict';
  const CUES = Assets.CUES, IMPACTS = Assets.IMPACTS;
  const MAX_PENDING = 2, MAX_NODES = 8, MAX_AUDIO_BYTES = 2 * 1024 * 1024;
  const MAX_SAMPLE_MS = 12000;
  const EVENT_TTL = 8000, DEDUPE_TTL = 120000, MAX_SEEN = 256, ERROR_BACKOFF = 30000;
  const SOURCES = new Set(['simulator','tikfinity','youtube','automatic']);
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
      narrate:input.source !== 'youtube' && input.narrate !== false,speechKind:input.speechKind || input.kind};
  }

  function createAudio(options = {}) {
    const env = options.env || root;
    const now = options.now || (() => env.performance ? env.performance.now() : Date.now());
    const later = options.setTimeout || ((fn, delay) => env.setTimeout(fn, delay));
    const cancelTimer = options.clearTimeout || (id => env.clearTimeout(id));
    const gap = Number.isFinite(options.minSpeechGapMs) && options.minSpeechGapMs >= 0 ? options.minSpeechGapMs : 10000;
    const queue = [], seen = new Map(), nodes = new Set(), lastImpact = new Map();
    let context, active = null, pumpTimer = null, stopped = false, enabling = null;
    let lastStarted = -Infinity, voiceBlockedUntil = 0, music = null;
    const state = {enabled:false,muted:false,paused:false,volume:0.6,narrationEnabled:options.narrationEnabled !== false,
      queue:0,playing:false,phase:'idle',lastStatus:'disabled',dropped:0,errors:0,fxPlayed:0,fxDropped:0,
      requested:0,started:0,finished:0,nodes:0,dedupe:0,fxAssetStatus:'pending',musicStatus:'disabled',
      musicEnabled:options.musicEnabled !== false,musicVolume:.18,fxVolume:.8,voiceVolume:1};

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
      cancelTimer(item.timer); item.media.onended = null; item.media.onerror = null;
      if (stop) { try { item.media.pause(); } catch (_) { /* Already stopped. */ } }
      try { item.media.src = ''; item.media.load(); } catch (_) { /* Released media. */ }
      state.nodes = nodes.size;
    }
    function clearFX() { for (const item of [...nodes]) releaseNode(item,true); }
    function sampleVolume() { return state.volume * state.fxVolume * .65; }
    function cue(samples) {
      if (!samples || !context || context.state !== 'running' || state.fxVolume === 0 || nodes.size + samples.length > MAX_NODES) { state.fxDropped++; return false; }
      try {
        for (const key of samples) {
          if (!Object.hasOwn(Assets.SOUNDS,key)) continue;
          const media = new env.Audio(), item = {media,timer:null};
          media.preload='auto'; media.src='/assets-local/minecraft-sounds/'+key+'.ogg';
          media.volume=sampleVolume(); nodes.add(item);
          media.onended=()=>releaseNode(item,false);
          const fail=()=>{if(!nodes.has(item))return;releaseNode(item,true);state.fxAssetStatus='unavailable';state.fxDropped++;status('minecraft_sounds_unavailable');};
          media.onerror=fail;
          item.timer=later(()=>releaseNode(item,true),MAX_SAMPLE_MS);
          const played=media.play();
          if(played&&played.then)played.then(()=>{if(nodes.has(item)){state.fxAssetStatus='minecraft';status();}},fail);
          else state.fxAssetStatus='minecraft';
        }
        state.fxPlayed++; state.nodes=nodes.size; return true;
      } catch (_) { state.fxDropped++; state.fxAssetStatus='unavailable'; clearFX(); return false; }
    }
    function stopMusic() {
      if(!music)return;
      const previous=music;music=null;previous.onerror=null;
      try{previous.pause();previous.src='';previous.load();}catch(_){/* Already released. */}
      state.musicStatus='stopped';
    }
    function syncMusic() {
      if(!audible()||!state.musicEnabled||state.musicVolume===0){stopMusic();return;}
      if(music){music.volume=state.volume*state.musicVolume;return;}
      try{
        const media=new env.Audio();music=media;media.preload='auto';media.src=Assets.MUSIC_URL;
        media.loop=true;media.volume=state.volume*state.musicVolume;
        const fail=()=>{if(music!==media)return;stopMusic();state.musicStatus='unavailable';status('music_unavailable');};
        media.onerror=fail;const played=media.play();state.musicStatus='playing';
        if(played&&played.catch)played.catch(fail);
      }catch(_){stopMusic();state.musicStatus='unavailable';}
    }
    function impact(kind) {
      if (!audible() || !Object.prototype.hasOwnProperty.call(IMPACTS,kind)) return false;
      const time = now();
      if (time - (lastImpact.get(kind) ?? -Infinity) < (kind==='mine'?100:150)) return false;
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
        run.media.preload = 'auto'; run.media.src = run.url; run.media.volume = state.volume * state.voiceVolume;
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
          if (!context) context = new AudioContext();
          await context.resume();
          if (stopped) return false;
          state.enabled = context.state === 'running'; syncMusic(); status(state.enabled ? 'ready' : 'audio_unavailable'); return state.enabled;
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
    function mute(value) { state.muted = Boolean(value); if (state.muted) { clearVoice(); clearFX(); } syncMusic(); status(state.muted ? 'muted' : 'ready'); }
    function pause(value) { state.paused = Boolean(value); if (state.paused) { clearVoice(); clearFX(); } syncMusic(); status(state.paused ? 'paused' : 'ready'); }
    function setVolume(value) {
      if (!Number.isFinite(value) || value < 0 || value > 1) return false;
      state.volume = value; if (active && active.media) active.media.volume = value * state.voiceVolume;
      for(const item of nodes)item.media.volume=sampleVolume(); syncMusic();
      if (value === 0) { clearVoice(); clearFX(); } status('volume_changed'); return true;
    }
    function setMix(patch) {
      if(!patch||typeof patch!=='object'||Array.isArray(patch))return false;
      const keys=Object.keys(patch);
      if(keys.some(key=>!['musicEnabled','musicVolume','fxVolume','voiceVolume'].includes(key)))return false;
      if(keys.some(key=>key==='musicEnabled'?typeof patch[key]!=='boolean':!Number.isFinite(patch[key])||patch[key]<0||patch[key]>1))return false;
      Object.assign(state,patch);
      for(const item of nodes)item.media.volume=sampleVolume();
      if(state.fxVolume===0)clearFX();
      if(active?.media)active.media.volume=state.volume*state.voiceVolume;
      syncMusic();status('mix_changed');return true;
    }
    function setNarration(value) { state.narrationEnabled = Boolean(value); if (!state.narrationEnabled) clearVoice(); status(state.narrationEnabled ? 'narration_enabled' : 'narration_disabled'); }
    function stop() {
      if (stopped) return; stopped = true; state.enabled = false; clearVoice(); clearFX(); stopMusic(); seen.clear(); lastImpact.clear();
      if (context) { try { const closed = context.close(); if (closed && closed.catch) closed.catch(() => {}); } catch (_) { /* Context already closed. */ } }
      status('stopped');
    }
    return {enable,mute,pause,notify,impact,setVolume,setMix,setNarration,stop,state};
  }
  return Object.freeze({createAudio});
}));

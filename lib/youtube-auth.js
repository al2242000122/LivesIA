'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const LIMIT = 32768;
const safeError = code => Object.assign(new Error(code), {code});
function boundedString(value, max = 8192) { return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x20\x7f]/.test(value); }
function validateConfig(value) {
 if (!value || value.version !== 1 || value.scope !== SCOPE || !boundedString(value.client_id, 512) || !boundedString(value.client_secret, 512) || !boundedString(value.refresh_token)) throw safeError('youtube_auth_config');
 return value;
}
function within(root, target) { const rel = path.relative(root,target); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); }
async function privatePath(filename, checkoutRoot = path.resolve(__dirname, '..')) {
 if (!filename || !path.isAbsolute(filename)) throw safeError('youtube_auth_config');
 const parent = await fs.realpath(path.dirname(filename));
 const target = path.join(parent,path.basename(filename));
 for(let ancestor=parent;;ancestor=path.dirname(ancestor)) {
  try {await fs.lstat(path.join(ancestor,'.git'));throw safeError('youtube_auth_config');} catch(e) {if(e.code !== 'ENOENT') throw e;}
  if(path.dirname(ancestor) === ancestor) break;
 }
 if (within(await fs.realpath(checkoutRoot),target)) throw safeError('youtube_auth_config');
 try { if ((await fs.lstat(target)).isSymbolicLink()) throw safeError('youtube_auth_config'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
 return target;
}
async function readConfig(filename, checkoutRoot) {
 const target = await privatePath(filename,checkoutRoot);
 const handle = await fs.open(target,'r');
 try {
  const stat = await handle.stat();
  if (!stat.isFile() || stat.size > LIMIT || (process.platform !== 'win32' && (stat.mode & 0o077))) throw safeError('youtube_auth_config');
  return validateConfig(JSON.parse(await handle.readFile('utf8')));
 } finally { await handle.close(); }
}
async function tokenRequestInner(params, {fetchImpl = fetch, signal, timeoutMs = 8000} = {}) {
 const abort = new AbortController();
 const cancel = () => abort.abort();
 signal?.addEventListener('abort',cancel,{once:true});
 if (signal?.aborted) cancel();
 const timer = setTimeout(cancel,timeoutMs);
 try {
  const response = await fetchImpl(TOKEN_URL,{method:'POST',redirect:'error',signal:abort.signal,headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  if (abort.signal.aborted || !response.ok || response.redirected) { response.body?.cancel().catch(()=>{}); throw safeError('youtube_auth_denied'); }
  if (Number(response.headers.get('content-length')) > LIMIT) { response.body?.cancel().catch(()=>{}); throw safeError('youtube_auth_response'); }
  const reader = response.body.getReader(); let bytes = 0; const chunks = [];
  try { for (;;) { const {done,value} = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > LIMIT) throw safeError('youtube_auth_response'); chunks.push(Buffer.from(value)); } } finally { reader.cancel().catch(()=>{}); }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!boundedString(value.access_token) || value.token_type?.toLowerCase() !== 'bearer' || !Number.isInteger(value.expires_in) || value.expires_in < 60 || value.expires_in > 86400) throw safeError('youtube_auth_response');
  if (value.scope !== undefined && value.scope !== SCOPE) throw safeError('youtube_auth_scope');
  return value;
 } catch (e) { throw safeError(['youtube_auth_denied','youtube_auth_response','youtube_auth_scope'].includes(e.code) ? e.code : 'youtube_auth_request'); }
 finally { clearTimeout(timer); signal?.removeEventListener('abort',cancel); }
}
async function tokenRequest(params, {fetchImpl = fetch,signal,timeoutMs = 8000} = {}) {
 const controller = new AbortController(); let timer; let abort;
 const deadline = new Promise((_,reject)=> {
  abort=()=>{controller.abort();reject(safeError('youtube_auth_request'));};
  timer=setTimeout(abort,timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted) abort();
 });
 try {return await Promise.race([deadline,tokenRequestInner(params,{fetchImpl,signal:controller.signal,timeoutMs})]);}
 finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
function createYouTubeAuth({env = process.env, fetchImpl = fetch, now = Date.now, checkoutRoot} = {}) {
  const filename = env.YOUTUBE_AUTH_FILE;
  let token = null;
  let expires = 0;
  let pending = null;
  let error = null;

  async function refresh() {
    try {
      const config = await readConfig(filename, checkoutRoot);
      const result = await tokenRequest({
        grant_type: 'refresh_token', client_id: config.client_id,
        client_secret: config.client_secret, refresh_token: config.refresh_token
      }, {fetchImpl});
      token = result.access_token;
      expires = now() + result.expires_in * 1000;
      error = null;
      return token;
    } catch (cause) {
      token = null;
      expires = 0;
      error = /^youtube_auth_/.test(cause.code || '') ? cause.code : 'youtube_auth_config';
      throw safeError(error);
    }
  }

  return {
    status: () => ({
      configured: Boolean(filename),
      authenticated: Boolean(token && expires > now() + 30000),
      error
    }),
    async getAccessToken({signal} = {}) {
      if (!filename) throw safeError('youtube_auth_disabled');
      if (signal?.aborted) throw safeError('youtube_auth_aborted');
      let work;
      if (token && expires > now() + 30000) {
        work = Promise.resolve(token);
      } else {
        pending ||= refresh().finally(() => { pending = null; });
        work = pending;
      }
      if (!signal) return work;
      return new Promise((resolve, reject) => {
        const abort = () => {
          signal.removeEventListener('abort', abort);
          reject(safeError('youtube_auth_aborted'));
        };
        signal.addEventListener('abort', abort, {once: true});
        work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
      });
    }
  };
}module.exports = {createYouTubeAuth,SCOPE,TOKEN_URL,AUTH_URL,tokenRequest,privatePath,validateConfig,safeError,boundedString};




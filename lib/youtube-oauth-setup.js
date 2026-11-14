'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {SCOPE,AUTH_URL,TOKEN_URL,tokenRequest,privatePath,safeError,boundedString} = require('./youtube-auth');
async function startYouTubeAuthorization({clientFile,authFile,overwrite=false,fetchImpl=fetch,timeoutMs=120000,checkoutRoot} = {}) {
 const target = await privatePath(authFile,checkoutRoot);
 try { await fs.lstat(target); if (!overwrite) throw safeError('youtube_auth_exists'); } catch(e) { if (e.code !== 'ENOENT') throw e; }
 const stat = await fs.stat(clientFile); if (!stat.isFile() || stat.size > 32768) throw safeError('youtube_auth_client');
 const client = JSON.parse(await fs.readFile(clientFile,'utf8')).installed;
 if (!client || !boundedString(client.client_id,512) || !boundedString(client.client_secret,512) || client.auth_uri !== AUTH_URL || client.token_uri !== TOKEN_URL || !Array.isArray(client.redirect_uris) || !client.redirect_uris.some(uri=>uri==='http://localhost' || uri==='http://127.0.0.1')) throw safeError('youtube_auth_client');
 const state = crypto.randomBytes(32).toString('base64url');
 const verifier = crypto.randomBytes(48).toString('base64url');
 let used = false; let stopped = false; let timer; let finish; let fail; const controller = new AbortController();
 const done = new Promise((resolve,reject)=>{finish=resolve;fail=reject;});
 // Ensure an owner CLI can attach its handler after the listening promise resolves.
 done.catch(()=>{});
 const server = http.createServer(async(req,res)=> {
  res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
  const host = `127.0.0.1:${server.address()?.port}`;
  if (req.headers.host !== host || req.method !== 'GET' || !req.url || req.url.length > 12000) {res.writeHead(400).end('Solicitud rechazada');return;}
  let url; try {url=new URL(req.url,`http://${host}`);} catch {res.writeHead(400).end('Solicitud rechazada');return;}
  if (url.origin !== `http://${host}`) {res.writeHead(400).end('Solicitud rechazada');return;}
  if(url.pathname === '/' && !used) {res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<a href="${authorizationUrl.replaceAll('&','&amp;')}">Autorizar lectura del chat de YouTube</a>`);return;}
  if(url.pathname !== '/oauth2/callback' || used || url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== state) {res.writeHead(400).end('Solicitud rechazada');return;}
  const code = url.searchParams.get('code');
  if (url.searchParams.has('error')) {used=true;res.writeHead(400).end('Autorización denegada');stop(safeError('youtube_auth_denied'));return;}
  if(url.searchParams.getAll('code').length !== 1 || !boundedString(code,4096)) {res.writeHead(400).end('Solicitud rechazada');return;}
  used=true;
  try {
   const result=await tokenRequest({grant_type:'authorization_code',client_id:client.client_id,client_secret:client.client_secret,redirect_uri:redirectUri,code,code_verifier:verifier},{fetchImpl,signal:controller.signal});
   if(result.scope !== SCOPE || !boundedString(result.refresh_token)) throw safeError('youtube_auth_scope');
   if(stopped) throw safeError('youtube_auth_timeout');
   const config={version:1,client_id:client.client_id,client_secret:client.client_secret,refresh_token:result.refresh_token,scope:SCOPE};
   const temp=path.join(path.dirname(target),`.youtube-auth-${crypto.randomBytes(16).toString('hex')}.tmp`);
   try {
    await fs.writeFile(temp,JSON.stringify(config)+'\n',{flag:'wx',mode:0o600});
    if(overwrite) await fs.rename(temp,target); else {await fs.link(temp,target);await fs.unlink(temp);}
   } finally {await fs.unlink(temp).catch(()=>{});}
   res.end('Autorización guardada. Puedes cerrar esta ventana.'); stop();
  } catch {res.writeHead(400).end('No se pudo guardar la autorización');stop(safeError('youtube_auth_setup'));}
 });
 function stop(error) {if(stopped) return;stopped=true;controller.abort();clearTimeout(timer);server.close();if(error) fail(error);else finish();}
 server.on('error',()=>stop(safeError('youtube_auth_listener')));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const localUrl=`http://127.0.0.1:${server.address().port}/`;
 const redirectUri=`${localUrl}oauth2/callback`;
 const authorizationUrl=AUTH_URL+'?'+new URLSearchParams({client_id:client.client_id,redirect_uri:redirectUri,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
 timer=setTimeout(()=>stop(safeError('youtube_auth_timeout')),timeoutMs);
 return {localUrl,done,close:()=>stop(safeError('youtube_auth_cancelled'))};
}
module.exports={startYouTubeAuthorization};


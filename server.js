'use strict';
/** Local-only relay/static server. Install locked server-side speech SDK with npm ci. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {validateCommand,validateTelemetry}=require('./lib/contracts.js');
const {createSpeech,validatePayload}=require('./lib/speech.js');
const speech=createSpeech();
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 4173;
const MAX_BODY_BYTES = 4096, MAX_CLIENTS = 16, COMMANDS_PER_SECOND = 30;
const clients = new Set();
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/control': ['control.html', 'text/html; charset=utf-8'],
  '/game.js': ['game.js', 'text/javascript; charset=utf-8'],
  '/control.js': ['control.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/integrations/events.js': ['integrations/events.js', 'text/javascript; charset=utf-8'],
  '/integrations/transport.js': ['integrations/transport.js', 'text/javascript; charset=utf-8'],
  '/block-wars': ['games/block-wars/index.html', 'text/html; charset=utf-8'],
  '/block-wars/control': ['games/block-wars/control.html', 'text/html; charset=utf-8'],
  '/block-wars/style.css': ['games/block-wars/style.css', 'text/css; charset=utf-8'],
};
for(const filename of ['config','physics','engine','rules','textures','effects-render','render','audio','experience','app','control'])files[`/block-wars/${filename}.js`]=[`games/block-wars/${filename}.js`,'text/javascript; charset=utf-8'];
// Only these fixed local PNG names are served. The downloaded client and provenance remain private.
const {ORIGINAL_NAMES,EFFECT_NAMES}=require('./games/block-wars/textures.js');
for(const name of [...ORIGINAL_NAMES,...Object.keys(EFFECT_NAMES)])files[`/block-wars/assets/${name}.png`]=[`assets-local/minecraft/${name}.png`,'image/png'];
let commandWindow = 0, commandCount = 0;
let telemetry=null;
function send(res, status, payload) {
  if(res.destroyed||res.writableEnded)return;
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(payload));
}
function writeEvent(client, output) {
  // A suspended browser must not retain an unbounded queue in the relay.
  try { if (!client.destroyed && client.write(output)) return true; } catch { /* close below */ }
  clients.delete(client);
  client.destroy();
  return false;
}
function broadcast(message) {
  const output = `data: ${JSON.stringify(message)}\n\n`;
  let receivers=0;
  for (const client of clients) if(client.gameTarget===message.target&&writeEvent(client, output))receivers++;
  return receivers;
}
function receiveJson(req, res, validator, accept, reply=result=>send(res,200,result)) {
  if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
    req.resume(); return send(res, 415, {error: 'Se requiere application/json'});
  }
  const now = performance.now();
  if (now - commandWindow >= 1000) { commandWindow = now; commandCount = 0; }
  if (++commandCount > COMMANDS_PER_SECOND) {
    req.resume(); res.setHeader('Retry-After', '1'); return send(res, 429, {error: 'Demasiados comandos; espera un segundo'});
  }
  let bytes = 0, finished = false;
  const chunks = [];
  req.setTimeout(5000, () => {
    if (!finished) { finished = true; send(res, 408, {error: 'Tiempo de envío agotado'}); req.destroy(); }
  });
  req.on('data', chunk => {
    if (finished) return;
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      finished = true; chunks.length = 0;
      send(res, 413, {error: 'Mensaje demasiado grande (máximo 4096 bytes)'}); return;
    }
    chunks.push(chunk);
  });
  req.on('error', () => { finished = true; chunks.length = 0; });
  req.on('end', () => {
    req.setTimeout(0);
    if (finished) return;
    finished = true;
    let event;
    try { event = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { return send(res, 400, {error: 'JSON inválido'}); }
    const valid = validator(event);
    if (!valid) return send(res, 400, {error: 'Comando inválido: revisa type, textos y count entero positivo'});
    Promise.resolve().then(()=>accept(valid)).then(result=>{
      if(!res.destroyed&&!res.writableEnded)reply(result);
    }).catch(()=>send(res,500,{error:'Operación local no disponible'}));
  });
}
const server = http.createServer((req, res) => {
  let route,location;
  try { location = new URL(req.url, `http://${HOST}:${PORT}`);route=location.pathname; }
  catch { return send(res, 400, {error: 'URL inválida'}); }
  const allowedHosts = new Set([`${HOST}:${PORT}`, `localhost:${PORT}`]);
  const origin = req.headers.origin;
  const pageNavigation = req.method === 'GET' && Object.hasOwn(files, route) &&
    req.headers['sec-fetch-mode'] === 'navigate' && req.headers['sec-fetch-dest'] === 'document';
  if (!allowedHosts.has(req.headers.host) ||
      (origin && ![...allowedHosts].some(host => origin === `http://${host}`)) ||
      (req.headers['sec-fetch-site'] === 'cross-site' && !pageNavigation)) {
    req.resume(); return send(res, 403, {error: 'Acceso sólo desde el origen local'});
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws://127.0.0.1:21213; media-src 'self' blob:; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if (req.method === 'GET' && route === '/api/stream') {
    const target=location.searchParams.get('target')||'snake';
    if(!['snake','block-wars'].includes(target))return send(res,400,{error:'Destino inválido'});
    if (clients.size >= MAX_CLIENTS) return send(res, 503, {error: 'Demasiadas ventanas del juego'});
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no'
    });
    clients.add(res);
    res.gameTarget=target;
    res.on('close', () => clients.delete(res));
    res.on('error', () => clients.delete(res));
    writeEvent(res, ': connected\n\n');
    return;
  }
  if (req.method === 'GET' && route === '/api/status') return send(res, 200, {gameWindows: clients.size});
  if (req.method === 'POST' && route === '/api/command') return receiveJson(req,res,validateCommand,event=>({ok:true,receivers:broadcast(event)}));
  if(req.method==='GET'&&route==='/api/block-wars/speech/status')return send(res,200,speech.status());
  if(req.method==='POST'&&route==='/api/block-wars/speech'){
    const controller=new AbortController();res.once('close',()=>controller.abort());
    return receiveJson(req,res,validatePayload,payload=>speech.synthesize(payload,{signal:controller.signal}),result=>{
      if(result.audio){res.writeHead(result.statusCode,{'Content-Type':result.contentType,'Cache-Control':'no-store'});res.end(result.audio);}
      else send(res,result.statusCode,result.error);
    });
  }
  if(route==='/api/block-wars/telemetry'){
    if(req.method==='POST')return receiveJson(req,res,validateTelemetry,snapshot=>{telemetry={...snapshot,receivedAt:Date.now()};return {ok:true};});
    if(req.method==='GET')return send(res,200,telemetry?{available:Date.now()-telemetry.receivedAt<=15000,...telemetry,ageMs:Date.now()-telemetry.receivedAt}:{available:false});
  }
  if (req.method === 'GET' && Object.hasOwn(files, route)) {
    const [filename, mime] = files[route];
    fs.readFile(path.join(__dirname, filename), (error, content) => {
      if (res.destroyed) return;
      if (error) {
        if(mime==='image/png')return send(res,404,{error:'Textura local no instalada'});
        console.error('No se pudo leer un archivo de la interfaz:', filename);return send(res,500,{error:'Interfaz no disponible'});
      }
      res.writeHead(200, {'Content-Type': mime, 'Cache-Control': 'no-cache'}); res.end(content);
    });
    return;
  }
  send(res, 404, {error: 'No encontrado'});
});
server.headersTimeout = 10000;
server.requestTimeout = 15000;
server.maxConnections = 64;
const heartbeat = setInterval(() => {
  for (const client of clients) writeEvent(client, ': heartbeat\n\n');
}, 25000);
server.on('close', () => clearInterval(heartbeat));
server.on('error', error => { clearInterval(heartbeat); console.error(`No se pudo iniciar el servidor (${error.code}).`); process.exitCode = 1; });
server.listen(PORT, HOST, () => {
  console.log(`\nLivesIA · Ensayo local\nJuego:   http://${HOST}:${PORT}/\nControl: http://${HOST}:${PORT}/control\nBlock Wars: http://${HOST}:${PORT}/block-wars\nPanel Block Wars: http://${HOST}:${PORT}/block-wars/control\nDetener: Ctrl+C\n`);
});

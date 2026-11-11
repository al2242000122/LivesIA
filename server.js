'use strict';
/** Local-only event relay + static server. Node >= 20; no npm packages required. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
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
};
const actions = new Set(['gift', 'like', 'follow', 'subscribe', 'chat', 'pause', 'reset', 'frenzy']);
let commandWindow = 0, commandCount = 0;
function send(res, status, payload) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(payload));
}
function writeEvent(client, output) {
  // A suspended browser must not retain an unbounded queue in the relay.
  try { if (!client.destroyed && client.write(output)) return; } catch { /* close below */ }
  clients.delete(client);
  client.destroy();
}
function broadcast(message) {
  const output = `data: ${JSON.stringify(message)}\n\n`;
  for (const client of clients) writeEvent(client, output);
}
function cleanText(value, fallback, length) {
  return (value ?? fallback).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, length);
}
function validateCommand(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) || !actions.has(event.type)) return null;
  for (const field of ['name', 'giftName', 'text']) {
    if (event[field] !== undefined && typeof event[field] !== 'string') return null;
  }
  if (event.count !== undefined && (!Number.isSafeInteger(event.count) || event.count < 1)) return null;
  return {type: event.type, source: 'simulation',
    name: cleanText(event.name, 'Prueba', 44), giftName: cleanText(event.giftName, 'Rosa', 44),
    count: Math.min(20, event.count ?? 1), text: cleanText(event.text, '!manzana', 100)};
}
function receiveCommand(req, res) {
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
    const valid = validateCommand(event);
    if (!valid) return send(res, 400, {error: 'Comando inválido: revisa type, textos y count entero positivo'});
    broadcast(valid);
    send(res, 200, {ok: true, receivers: clients.size});
  });
}
const server = http.createServer((req, res) => {
  let route;
  try { route = new URL(req.url, `http://${HOST}:${PORT}`).pathname; }
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
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws://127.0.0.1:21213; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if (req.method === 'GET' && route === '/api/stream') {
    if (clients.size >= MAX_CLIENTS) return send(res, 503, {error: 'Demasiadas ventanas del juego'});
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no'
    });
    clients.add(res);
    res.on('close', () => clients.delete(res));
    res.on('error', () => clients.delete(res));
    writeEvent(res, ': connected\n\n');
    return;
  }
  if (req.method === 'GET' && route === '/api/status') return send(res, 200, {gameWindows: clients.size});
  if (req.method === 'POST' && route === '/api/command') return receiveCommand(req, res);
  if (req.method === 'GET' && Object.hasOwn(files, route)) {
    const [filename, mime] = files[route];
    fs.readFile(path.join(__dirname, filename), (error, content) => {
      if (res.destroyed) return;
      if (error) { console.error('No se pudo leer un archivo de la interfaz:', filename); return send(res, 500, {error: 'Interfaz no disponible'}); }
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
  console.log(`\n🐍 Serpiente Infinita LIVE\nJuego:   http://${HOST}:${PORT}/\nControl: http://${HOST}:${PORT}/control\nDetener: Ctrl+C\n`);
});

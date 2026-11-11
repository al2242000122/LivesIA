'use strict';
/** Local-only event relay + static server. Node >= 20; no npm packages required. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 4173;
const clients = new Set();
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/control': ['control.html', 'text/html; charset=utf-8'],
  '/game.js': ['game.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
};
const actions = new Set(['gift', 'like', 'follow', 'subscribe', 'chat', 'pause', 'reset', 'frenzy']);
function send(res, status, payload) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(payload));
}
function broadcast(message) {
  const output = `data: ${JSON.stringify(message)}\n\n`;
  for (const client of [...clients]) {
    try { client.write(output); }
    catch { clients.delete(client); }
  }
}
const server = http.createServer((req, res) => {
  const location = new URL(req.url, `http://${HOST}:${PORT}`);
  const route = location.pathname;
  if (req.method === 'GET' && route === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (req.method === 'GET' && route === '/api/status') {
    return send(res, 200, {gameWindows: clients.size});
  }
  if (req.method === 'POST' && route === '/api/command') {
    const origin = req.headers.origin;
    if (origin && origin !== `http://${HOST}:${PORT}` && origin !== `http://localhost:${PORT}`) {
      return send(res, 403, {error: 'Origen no autorizado'});
    }
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        if (!event || !actions.has(event.type)) return send(res, 400, {error: 'Acción desconocida'});
        const valid = {
          type: event.type,
          name: String(event.name || 'Prueba').slice(0, 44),
          giftName: String(event.giftName || 'Rosa').slice(0, 44),
          count: Math.min(20, Math.max(1, Math.round(Number(event.count) || 1))),
          text: String(event.text || '!manzana').slice(0, 100)
        };
        broadcast(valid);
        send(res, 200, {ok: true, receivers: clients.size});
      } catch { send(res, 400, {error: 'JSON inválido'}); }
    });
    return;
  }
  if (req.method === 'GET' && files[route]) {
    const [filename, mime] = files[route];
    res.writeHead(200, {'Content-Type': mime, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'});
    fs.createReadStream(path.join(__dirname, filename)).pipe(res);
    return;
  }
  send(res, 404, {error: 'No encontrado'});
});
const heartbeat = setInterval(() => {
  for (const client of [...clients]) {
    try { client.write(': heartbeat\n\n'); } catch { clients.delete(client); }
  }
}, 25000);
server.on('close', () => clearInterval(heartbeat));
server.listen(PORT, HOST, () => {
  console.log(`\n🐍 Serpiente Infinita LIVE\nJuego:   http://${HOST}:${PORT}/\nControl: http://${HOST}:${PORT}/control\nDetener: Ctrl+C\n`);
});

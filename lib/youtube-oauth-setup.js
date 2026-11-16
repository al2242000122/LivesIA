'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {
  SCOPE, AUTH_URL, TOKEN_URL, tokenRequest, privatePath, safeError, boundedString
} = require('./youtube-auth');

async function startYouTubeAuthorization({
  clientFile, authFile, overwrite = false, fetchImpl = fetch,
  timeoutMs = 120000, checkoutRoot, writeFileImpl = fs.writeFile
} = {}) {
  let target;
  try {
    target = await privatePath(authFile, checkoutRoot);
  } catch {
    throw safeError('youtube_auth_path');
  }
  try {
    await fs.lstat(target);
    if (!overwrite) throw safeError('youtube_auth_exists');
  } catch (error) {
    if (error.code !== 'ENOENT') throw safeError(error.code === 'youtube_auth_exists' ? 'youtube_auth_exists' : 'youtube_auth_path');
  }
  let client;
  try {
    const stat = await fs.stat(clientFile);
    if (!stat.isFile() || stat.size > 32768) throw safeError('youtube_auth_client');
    client = JSON.parse(await fs.readFile(clientFile, 'utf8')).installed;
  } catch {
    throw safeError('youtube_auth_client');
  }
  if (!client || !boundedString(client.client_id, 512) ||
      !boundedString(client.client_secret, 512) || ![AUTH_URL, 'https://accounts.google.com/o/oauth2/auth'].includes(client.auth_uri) ||
      client.token_uri !== TOKEN_URL || !Array.isArray(client.redirect_uris) ||
      !client.redirect_uris.some(uri => uri === 'http://localhost' || uri === 'http://127.0.0.1')) {
    throw safeError('youtube_auth_client');
  }

  const state = crypto.randomBytes(32).toString('base64url');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const controller = new AbortController();
  const sockets = new Set();
  let used = false;
  let stopped = false;
  let timer;
  let finish;
  let fail;
  const done = new Promise((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  // The CLI attaches its own handler after the listening promise resolves.
  done.catch(() => {});

  function rejectRequest(res) {
    res.writeHead(400).end('Solicitud rechazada');
  }

  async function persistCredentials(config) {
    const temp = path.join(path.dirname(target), `.youtube-auth-${crypto.randomBytes(16).toString('hex')}.tmp`);
    try {
      await writeFileImpl(temp, JSON.stringify(config) + '\n', {flag: 'wx', mode: 0o600});
      // The setup deadline may have elapsed while private storage was being written.
      // Do not install a credential file after shutdown has reported a failure.
      if (stopped) throw safeError('youtube_auth_timeout');
      if (overwrite) {
        await fs.rename(temp, target);
      } else {
        await fs.link(temp, target);
        await fs.unlink(temp);
      }
    } finally {
      await fs.unlink(temp).catch(() => {});
    }
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
    const host = `127.0.0.1:${server.address()?.port}`;
    if (stopped || req.headers.host !== host || req.method !== 'GET' || !req.url || req.url.length > 12000) {
      rejectRequest(res);
      return;
    }
    let url;
    try {
      url = new URL(req.url, `http://${host}`);
    } catch {
      rejectRequest(res);
      return;
    }
    if (url.origin !== `http://${host}`) {
      rejectRequest(res);
      return;
    }
    if (url.pathname === '/' && !used) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<a href="${authorizationUrl.replaceAll('&', '&amp;')}">Autorizar lectura del chat de YouTube</a>`);
      return;
    }
    if (url.pathname !== '/oauth2/callback' || used ||
        url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== state) {
      rejectRequest(res);
      return;
    }
    const code = url.searchParams.get('code');
    if (url.searchParams.has('error')) {
      used = true;
      res.writeHead(400).end('Authorization denied', () => stop(safeError('youtube_auth_denied')));
      return;
    }
    if (url.searchParams.getAll('code').length !== 1 || !boundedString(code, 4096)) {
      rejectRequest(res);
      return;
    }
    // Claim the callback before the asynchronous exchange, preventing concurrent reuse.
    used = true;
    try {
      const result = await tokenRequest({
        grant_type: 'authorization_code', client_id: client.client_id,
        client_secret: client.client_secret, redirect_uri: redirectUri,
        code, code_verifier: verifier
      }, {fetchImpl, signal: controller.signal});
      if (result.scope !== SCOPE || !boundedString(result.refresh_token)) {
        throw safeError('youtube_auth_scope');
      }
      if (stopped) throw safeError('youtube_auth_timeout');
      await persistCredentials({
        version: 1, client_id: client.client_id, client_secret: client.client_secret,
        refresh_token: result.refresh_token, scope: SCOPE
      });
      // Flush the success response before shutdown destroys active connections.
      res.end('Authorization saved. You can close this window.', () => stop());
    } catch {
      if (!stopped) {
        res.writeHead(400).end('Could not save authorization', () => stop(safeError('youtube_auth_setup')));
      }
    }
  });

  function stop(error) {
    if (stopped) return;
    stopped = true;
    controller.abort();
    clearTimeout(timer);
    server.close();
    // close() alone does not terminate partial HTTP requests or active callbacks.
    for (const socket of sockets) socket.destroy();
    if (error) fail(error);
    else finish();
  }
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  server.on('error', () => stop(safeError('youtube_auth_listener')));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const localUrl = `http://127.0.0.1:${server.address().port}/`;
  const redirectUri = `${localUrl}oauth2/callback`;
  const authorizationUrl = AUTH_URL + '?' + new URLSearchParams({
    client_id: client.client_id, redirect_uri: redirectUri, response_type: 'code',
    scope: SCOPE, access_type: 'offline', prompt: 'consent', state,
    code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256'
  });
  timer = setTimeout(() => stop(safeError('youtube_auth_timeout')), timeoutMs);
  return {localUrl, done, close: () => stop(safeError('youtube_auth_cancelled'))};
}
module.exports = {startYouTubeAuthorization};



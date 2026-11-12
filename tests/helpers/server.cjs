'use strict';
const {spawn}=require('node:child_process');
const http=require('node:http');
const net=require('node:net');
const path=require('node:path');
async function start(t,env={}) {
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['server.js'], {cwd: path.join(__dirname, '../..'), env: {...process.env,...env, PORT: String(port)}, stdio: ['ignore', 'pipe', 'pipe']});
  t.after(() => new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); child.kill(); }));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timeout')), 5000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    child.stdout.on('data', data => { if (String(data).includes('Juego:')) { clearTimeout(timer); resolve(); } });
  });
  const base = `http://127.0.0.1:${port}`;
  function request(route, {method = 'GET', headers = {}, body} = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request(base + route, {method, headers: {...headers, Connection: 'close'}}, res => {
        let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; });
        res.on('end', () => resolve({status: res.statusCode, headers: res.headers, text}));
      });
      req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Request timeout')));
      req.end(body);
    });
  }
  const post = (event, headers = {}) => request('/api/command', {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(event)});
  return {request, post, base, port};
}

module.exports={start};

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

function fixture(t, envText, inheritedKey) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'livesia-startup-'));
  t.after(() => {
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('livesia-startup-'));
    fs.rmSync(resolved, {recursive:true,force:true});
  });
  fs.mkdirSync(path.join(directory,'scripts'));
  fs.copyFileSync(path.join(__dirname,'../scripts/start.cjs'),path.join(directory,'scripts/start.cjs'));
  fs.writeFileSync(path.join(directory,'server.js'),
    "console.log(JSON.stringify({fileKey:process.env.ELEVENLABS_API_KEY==='fixture_file_key',inheritedKey:process.env.ELEVENLABS_API_KEY==='fixture_inherited_key',hasKey:Boolean(process.env.ELEVENLABS_API_KEY)}));");
  if (envText !== undefined) fs.writeFileSync(path.join(directory,'.env.local'),envText);
  const env = {...process.env};
  delete env.ELEVENLABS_API_KEY;
  if (inheritedKey) env.ELEVENLABS_API_KEY = inheritedKey;
  return {directory,env};
}
function run(f, prefix = []) {
  return spawnSync(process.execPath,[...prefix,path.join(f.directory,'scripts/start.cjs')],
    {cwd:os.tmpdir(),env:f.env,encoding:'utf8',timeout:10000});
}
test('startup works without a local env file and does not create one', t => {
  const f = fixture(t);
  const result = run(f);
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).hasKey,false);
  assert.equal(fs.existsSync(path.join(f.directory,'.env.local')),false);
});
test('startup loads the project env file independently of cwd and preserves explicit environment', t => {
  const f = fixture(t,'ELEVENLABS_API_KEY=fixture_file_key\n');
  const fromFile = run(f);
  assert.equal(fromFile.status,0,fromFile.stderr);
  assert.equal(JSON.parse(fromFile.stdout).fileKey,true);
  assert.ok(!fromFile.stdout.includes('fixture_file_key'));
  f.env.ELEVENLABS_API_KEY='fixture_inherited_key';
  const inherited = run(f);
  assert.equal(inherited.status,0,inherited.stderr);
  assert.equal(JSON.parse(inherited.stdout).inheritedKey,true);
});
test('startup rejects an unsupported local env loader without exposing credentials or booting the server', t => {
  const f = fixture(t,'ELEVENLABS_API_KEY=fixture_file_key\n');
  const preload = path.join(f.directory,'old-runtime.cjs');
  fs.writeFileSync(preload,'process.loadEnvFile = undefined;');
  const result = run(f,['--require',preload]);
  assert.equal(result.status,1);
  assert.equal(result.stdout,'');
  assert.match(result.stderr,/Node\.js 20\.12/);
  assert.ok(!result.stderr.includes('fixture_file_key'));
});

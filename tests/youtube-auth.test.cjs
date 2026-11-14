const test = require('node:test');
const assert = require('node:assert/strict');
const { createYouTubeAuth } = require('../lib/youtube-auth');
test('missing config is disabled and errors are safe', async () => {
 const auth = createYouTubeAuth({env:{}});
 assert.deepEqual(auth.status(), {configured:false,authenticated:false,error:null});
 await assert.rejects(auth.getAccessToken(), {message:'youtube_auth_disabled'});
});
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {SCOPE,AUTH_URL,TOKEN_URL} = require('../lib/youtube-auth');
const {startYouTubeAuthorization} = require('../lib/youtube-oauth-setup');
async function fixture(t) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'livesia-auth-test-'));
 t.after(async()=>{const absolute=path.resolve(root);const parent=path.resolve(os.tmpdir());assert.ok(path.dirname(absolute)===parent && path.basename(absolute).startsWith('livesia-auth-test-'));await fs.rm(absolute,{recursive:true,force:true});});
 const authFile=path.join(root,'auth.json');
 await fs.writeFile(authFile,JSON.stringify({version:1,client_id:'fixture-id',client_secret:'fixture-secret',refresh_token:'fixture-refresh',scope:SCOPE}),{mode:0o600});
 return {root,authFile};
}
const response = (extra={})=>new Response(JSON.stringify({access_token:'fixture-access',token_type:'Bearer',expires_in:3600,scope:SCOPE,...extra}),{status:200});
test('refresh is coalesced, cached and renewed before expiry',async t=>{
 const {authFile}=await fixture(t);let calls=0;let time=0;
 const auth=createYouTubeAuth({env:{YOUTUBE_AUTH_FILE:authFile},now:()=>time,fetchImpl:async(url,options)=>{calls++;assert.equal(url,TOKEN_URL);assert.equal(options.redirect,'error');assert.equal(options.body.get('grant_type'),'refresh_token');return response();}});
 assert.deepEqual(await Promise.all([auth.getAccessToken(),auth.getAccessToken()]),['fixture-access','fixture-access']);assert.equal(calls,1);await auth.getAccessToken();assert.equal(calls,1);time=3590000;await auth.getAccessToken();assert.equal(calls,2);assert.equal(auth.status().authenticated,true);
});
for(const kind of ['denied','scope','redirect','network','large']) test(`safe ${kind} failure`,async t=>{
 const {authFile}=await fixture(t);
 const auth=createYouTubeAuth({env:{YOUTUBE_AUTH_FILE:authFile},fetchImpl:async()=>{
  if(kind==='network') throw new Error('fixture-secret fixture-refresh');
  if(kind==='denied') return new Response('fixture-secret',{status:400});
  if(kind==='scope') return response({scope:'other'});
  if(kind==='redirect') return new Response('',{status:302,headers:{location:'https://evil.invalid'}});
  return new Response('a'.repeat(32769));
 }});
 await assert.rejects(auth.getAccessToken(),e=>/^youtube_auth_/.test(e.message)&&!e.message.includes('fixture'));assert.equal(auth.status().authenticated,false);assert.ok(!JSON.stringify(auth.status()).includes('fixture'));
});
test('rejects file within checkout and malformed config',async t=>{
 const {authFile}=await fixture(t);await fs.writeFile(authFile,'{}');const auth=createYouTubeAuth({env:{YOUTUBE_AUTH_FILE:authFile}});await assert.rejects(auth.getAccessToken(),{message:'youtube_auth_config'});
 const inside=createYouTubeAuth({env:{YOUTUBE_AUTH_FILE:path.resolve('package.json')}});await assert.rejects(inside.getAccessToken(),{message:'youtube_auth_config'});
});
test('forged callbacks cannot exchange code or overwrite credentials; real callback exchanges only once',async t=>{
 const {root,authFile}=await fixture(t);const clientFile=path.join(root,'desktop.json');await fs.writeFile(clientFile,JSON.stringify({installed:{client_id:'fixture-id',client_secret:'fixture-secret',auth_uri:AUTH_URL,token_uri:TOKEN_URL,redirect_uris:['http://localhost']}}));let calls=0;
 await assert.rejects(startYouTubeAuthorization({clientFile,authFile}),{message:'youtube_auth_exists'});
 const original=await fs.readFile(authFile,'utf8');
 const flow=await startYouTubeAuthorization({clientFile,authFile,overwrite:true,fetchImpl:async(url,opt)=>{calls++;assert.ok(opt.body.get('code_verifier').length>=43);assert.equal(opt.body.get('code'),'fixture-code');return response({refresh_token:'new-refresh'});}});t.after(()=>flow.close());
 const page=await (await fetch(flow.localUrl)).text();const authorization=new URL(page.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&'));assert.equal(authorization.origin,'https://accounts.google.com');assert.equal(authorization.searchParams.get('scope'),SCOPE);assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
 const callback=new URL(authorization.searchParams.get('redirect_uri'));callback.searchParams.set('code','fixture-code');callback.searchParams.set('state','forged');assert.equal((await fetch(callback)).status,400);
 callback.searchParams.set('state',authorization.searchParams.get('state'));
 assert.equal((await fetch(callback,{method:'POST'})).status,400);
 assert.equal(await new Promise((resolve,reject)=>{require('node:http').get(callback,{headers:{host:'evil.invalid'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);}),400);
 assert.equal(calls,0);assert.equal(await fs.readFile(authFile,'utf8'),original);
 assert.equal((await fetch(callback)).status,200);await flow.done;assert.equal(calls,1);assert.equal(JSON.parse(await fs.readFile(authFile,'utf8')).refresh_token,'new-refresh');
});
test('setup times out without an exchange',async t=>{
 const {root}=await fixture(t);const clientFile=path.join(root,'desktop.json');await fs.writeFile(clientFile,JSON.stringify({installed:{client_id:'id',client_secret:'secret',auth_uri:AUTH_URL,token_uri:TOKEN_URL,redirect_uris:['http://localhost']}}));const flow=await startYouTubeAuthorization({clientFile,authFile:path.join(root,'new.json'),timeoutMs:25,fetchImpl:()=>{throw new Error('must not exchange');}});await assert.rejects(flow.done,{message:'youtube_auth_timeout'});
});

test('overall request deadlines bound stalled fetch and stalled body',async()=>{
 const {tokenRequest}=require('../lib/youtube-auth');
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>({ok:true,headers:new Headers(),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{})})}})]) {
  const start=Date.now();await assert.rejects(tokenRequest({}, {fetchImpl,timeoutMs:25}),{message:'youtube_auth_request'});assert.ok(Date.now()-start<1000);
 }
});
async function desktopFixture(root) {
 const clientFile=path.join(root,'desktop.json');
 await fs.writeFile(clientFile,JSON.stringify({installed:{client_id:'id',client_secret:'secret',auth_uri:AUTH_URL,token_uri:TOKEN_URL,redirect_uris:['http://localhost']}}));
 return clientFile;
}
test('setup deadline destroys a partial HTTP request connection',async t=>{
 const {root}=await fixture(t);
 const clientFile=await desktopFixture(root);
 const flow=await startYouTubeAuthorization({clientFile,authFile:path.join(root,'new.json'),timeoutMs:150});
 const location=new URL(flow.localUrl);
 const socket=require('node:net').connect(Number(location.port),'127.0.0.1');
 t.after(()=>socket.destroy());
 socket.on('error',()=>{});
 const closed=new Promise(resolve=>socket.once('close',resolve));
 await new Promise(resolve=>socket.once('connect',resolve));
 socket.write(`GET / HTTP/1.1\r\nHost: ${location.host}\r\nX-Partial: `);
 await assert.rejects(flow.done,{message:'youtube_auth_timeout'});
 await Promise.race([closed,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('partial socket remained open')),1000);timer.unref();})]);
});
for(const overwrite of [false,true]) test(`timeout during private write prevents installation (overwrite=${overwrite})`,async t=>{
 const {root,authFile}=await fixture(t);
 const target=overwrite ? authFile : path.join(root,'new.json');
 const original=overwrite ? await fs.readFile(target,'utf8') : null;
 const clientFile=await desktopFixture(root);
 let releaseWrite;
 let enteredWrite;
 let writeReturned;
 const entered=new Promise(resolve=>{enteredWrite=resolve;});
 const release=new Promise(resolve=>{releaseWrite=resolve;});
 const returned=new Promise(resolve=>{writeReturned=resolve;});
 const flow=await startYouTubeAuthorization({clientFile,authFile:target,overwrite,timeoutMs:200,fetchImpl:async()=>response({refresh_token:'new-refresh'}),writeFileImpl:async(...args)=>{
  await fs.writeFile(...args);enteredWrite();await release;writeReturned();
 }});
 const page=await (await fetch(flow.localUrl)).text();
 const auth=new URL(page.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&'));
 const callback=new URL(auth.searchParams.get('redirect_uri'));
 callback.searchParams.set('state',auth.searchParams.get('state'));callback.searchParams.set('code','fixture-code');
 const request=fetch(callback).catch(()=>null);
 await entered;
 await assert.rejects(flow.done,{message:'youtube_auth_timeout'});
 releaseWrite();await returned;await request;
 // Wait until the callback has removed its temporary file, proving persistence unwound.
 for(let attempt=0;attempt<100;attempt++) {
  if(!(await fs.readdir(root)).some(name=>name.endsWith('.tmp'))) break;
  await new Promise(resolve=>setTimeout(resolve,5));
 }
 assert.equal((await fs.readdir(root)).some(name=>name.endsWith('.tmp')),false);
 if(overwrite) assert.equal(await fs.readFile(target,'utf8'),original);
 else await assert.rejects(fs.stat(target),{code:'ENOENT'});
});

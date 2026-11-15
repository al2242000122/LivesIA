'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const Textures=require('../games/block-wars/textures.js'),{createPainter}=require('../games/block-wars/effects-render.js');
function recorder(){const calls=[],styles=[];const ctx=new Proxy({measureText:text=>({width:text.length*8})},{get:(o,k)=>o[k]||(o[k]=(...args)=>calls.push([k,...args])),set(o,k,v){styles.push([k,v]);o[k]=v;return true;}});return {calls,styles,painter:createPainter(ctx,(...args)=>calls.push(['paint',...args]),720,1280)};}
function particleSource(_kind,name){const dimensions=Textures.PARTICLE_NAMES[name];return dimensions?{url:'/block-wars/assets/'+name+'.png',width:dimensions[0],height:dimensions[1]}:null;}
test('TNT and NUKE explosions draw the original32px explosion and8px smoke frames in sequence',()=>{
 const previous=Textures.source;Textures.source=particleSource;
 try{for(const kind of ['tnt','nuke']){
  const effect={kind,x:3,y:8,age:.05,duration:2.5},f=recorder();
  f.painter.explosion(effect,90,90,0,false);
  const first=f.calls.filter(c=>c[0]==='drawImage');assert.ok(first.some(c=>c[1].url.endsWith('/particle_explosion_1.png')&&c[4]===32&&c[5]===32));
  assert.ok(first.some(c=>c[1].url.endsWith('/particle_smoke_0.png')&&c[4]===8&&c[5]===8));
  f.calls.length=0;effect.age=.4;f.painter.beginFrame();f.painter.explosion(effect,90,90,0,false);
  assert.ok(f.calls.some(c=>c[0]==='drawImage'&&c[1].url.endsWith('/particle_explosion_8.png')));
  assert.ok(!f.calls.some(c=>c[0]==='fillRect'&&c[1]===0&&c[2]===0&&c[3]===720&&c[4]===1280));
 }}finally{Textures.source=previous;}
});
test('Minecraft particle drawing has a shared96-draw frame budget and reduced motion never changes gameplay',()=>{
 const previous=Textures.source;Textures.source=particleSource;
 try{const effect={kind:'nuke',rewardVariant:'subscriber',x:3,y:8,age:.2,duration:9,blastRadius:11},before=JSON.stringify(effect),full=recorder(),reduced=recorder();
  full.painter.beginFrame();for(let i=0;i<100;i++)full.painter.explosion(effect,90,90,0,false);
  assert.equal(full.calls.filter(c=>c[0]==='drawImage').length,96);
  full.calls.length=0;full.painter.beginFrame();full.painter.explosion(effect,90,90,0,false);assert.equal(full.calls.filter(c=>c[0]==='drawImage').length,24);
  full.calls.length=0;full.painter.beginFrame();for(let i=0;i<100;i++)full.painter.explosion({...effect,y:-100},90,90,0,false);
  full.painter.explosion(effect,90,90,0,false);assert.equal(full.calls.filter(c=>c[0]==='drawImage').length,24,'offscreen impacts must not consume the visible particle budget');
  reduced.painter.explosion(effect,90,90,0,true);assert.equal(reduced.calls.filter(c=>c[0]==='drawImage').length,2);
  assert.equal(JSON.stringify(effect),before);
 }finally{Textures.source=previous;}
});
test('all three TNT charges have distinct read-only color filters while missing particles retain their fallback',()=>{
 const filters=[];for(let variantIndex=0;variantIndex<3;variantIndex++){const f=recorder();f.painter.projectile({kind:'tnt',variantIndex,x:3,y:8,stage:'fall',size:1},90,90,0,false);filters.push(JSON.stringify(f.styles.filter(([key])=>key==='filter')));}
 assert.equal(new Set(filters).size,3);
 const previous=Textures.source;Textures.source=()=>null;
 try{const f=recorder();f.painter.explosion({kind:'tnt',x:3,y:8,age:.1,duration:1.2},90,90,0,false);assert.ok(f.calls.some(c=>c[0]==='fillRect'));}finally{Textures.source=previous;}
});
test('particle importer validates the fixed24PNG whitelist, archive integrity and existing files without network',()=>{
 const script=String.raw`
import hashlib,importlib.util,json,pathlib,struct,tempfile,unittest,zipfile,zlib
from unittest import mock
spec=importlib.util.spec_from_file_location('particles','scripts/import_minecraft_particles.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
def png(w,h):return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\xff\0\0\xff'*w)*h))+chunk(b'IEND',b'')
class Tests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=pathlib.Path(self.temp.name);self.archive=self.root/'client.jar';self.dest=self.root/'particles'
  with zipfile.ZipFile(self.archive,'w') as z:
   for name,path in m.TEXTURES.items():z.writestr(path,png(*m.DIMENSIONS[name]))
   z.writestr('../do-not-extract.txt',b'no');z.writestr('main.class',b'no execution')
  self.pin=mock.patch.dict(m.MC.PINNED,{'clientSha1':hashlib.sha1(self.archive.read_bytes()).hexdigest(),'clientSize':self.archive.stat().st_size});self.pin.start();self.addCleanup(self.pin.stop)
 def test_pinned_whitelist_and_unmodified_dimensions(self):
  self.assertEqual(len(m.TEXTURES),24);self.assertEqual(m.DIMENSIONS['particle_explosion_0'],(32,32));self.assertEqual(m.DIMENSIONS['particle_smoke_0'],(8,8))
  self.assertTrue(m.TEXTURES['particle_smoke_0'].endswith('/generic_7.png'));self.assertTrue(m.TEXTURES['particle_smoke_7'].endswith('/generic_0.png'))
  self.assertEqual(m.install_archive(self.archive,self.dest)['textures'],24)
  self.assertEqual({p.name for p in self.dest.iterdir()},{n+'.png' for n in m.TEXTURES}|{'provenance.json'})
  self.assertFalse((self.root/'do-not-extract.txt').exists());self.assertEqual(m.verify_local(self.dest)['status'],'local-checksums-verified')
 def test_hash_mismatch_has_no_partial_install(self):
  self.archive.write_bytes(self.archive.read_bytes()+b'bad')
  with self.assertRaises(ValueError):m.install_archive(self.archive,self.dest)
  self.assertFalse(self.dest.exists())
 def test_tampered_existing_assets_are_not_overwritten(self):
  m.install_archive(self.archive,self.dest);p=self.dest/'particle_smoke_0.png';p.write_bytes(b'owner data')
  with self.assertRaises(ValueError):m.install_archive(self.archive,self.dest)
  self.assertEqual(p.read_bytes(),b'owner data')
 def test_wrong_dimension_is_rejected_even_after_crc_and_archive_hash_match(self):
  with zipfile.ZipFile(self.archive,'w') as z:
   for name,path in m.TEXTURES.items():z.writestr(path,png(16,16))
  with mock.patch.dict(m.MC.PINNED,{'clientSha1':hashlib.sha1(self.archive.read_bytes()).hexdigest(),'clientSize':self.archive.stat().st_size}):
   with self.assertRaises(ValueError):m.install_archive(self.archive,self.dest)
  self.assertFalse(self.dest.exists())
unittest.main()
`;
 const result=spawnSync('python',['-c',script],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stdout+result.stderr);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('nuclear texture import pins sources, validates PNGs and preserves existing files offline',()=>{
 const script=String.raw`
import hashlib,importlib.util,io,json,pathlib,struct,tempfile,unittest,zipfile,zlib
from unittest import mock
spec=importlib.util.spec_from_file_location('nuke_import','scripts/import_nuke_textures.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
def png(w=16):return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,16,8,6,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\xff\0\0\xff'*w)*16))+chunk(b'IEND',b'')
class Tests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.dest=pathlib.Path(self.temp.name)/'nukes';self.image=png();out=io.BytesIO()
  with zipfile.ZipFile(out,'w') as z:
   z.writestr('assets/nuke/textures/block/nuke_side.png',self.image)
   z.writestr('../not-extracted.txt',b'no');z.writestr('mod.jar',b'never execute')
  self.pack=out.getvalue();self.sha=hashlib.sha256(self.image).hexdigest()
  self.patch=mock.patch.multiple(m,PACK_HASH=hashlib.sha256(self.pack).hexdigest(),PINS={'nuke_like':self.sha,'nuke_subscriber':self.sha});self.patch.start();self.addCleanup(self.patch.stop)
 def fetch(self,url):return self.pack if url==m.PACK_URL else self.image
 def test_only_two_images_and_provenance_are_installed(self):
  self.assertEqual(m.install(self.dest,self.fetch)['status'],'installed')
  self.assertEqual({p.name for p in self.dest.iterdir()},{'nuke_like.png','nuke_subscriber.png','provenance.json','NOTICE.txt'})
  self.assertFalse((self.dest.parent/'not-extracted.txt').exists())
  self.assertEqual(m.install(self.dest,lambda _:self.fail('no repeat download'))['status'],'local-checksums-verified')
 def test_tampering_and_partial_install_are_rejected_without_replacing_owner_data(self):
  with self.assertRaises(ValueError):m.decode_resources(self.pack+b'x',self.image)
  with self.assertRaises(ValueError):m.install(self.dest,lambda url:self.pack if url==m.PACK_URL else b'bad')
  self.assertFalse(self.dest.exists());m.install(self.dest,self.fetch)
  (self.dest/'nuke_like.png').write_bytes(b'owner data')
  with self.assertRaises(ValueError):m.install(self.dest,self.fetch)
  self.assertEqual((self.dest/'nuke_like.png').read_bytes(),b'owner data')
 def test_dimensions_crc_and_url_allowlist_fail_closed(self):
  for data in [png(32),self.image[:-1]+b'x']:
   with mock.patch.dict(m.PINS,{'nuke_like':hashlib.sha256(data).hexdigest()}):
    with self.assertRaises(ValueError):m.validate_image('nuke_like',data)
  with self.assertRaises(ValueError):m.download('https://example.com/mod.jar')
  with self.assertRaises(ValueError):m.NoRedirect().redirect_request(None,None,302,'',{},'https://example.com/')
unittest.main()
`;
 const r=spawnSync('python',['-c',script],{encoding:'utf8',timeout:20000});assert.equal(r.status,0,r.stdout+r.stderr);
});

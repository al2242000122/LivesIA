
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('sound importer verifies exact resource pins, Ogg headers and atomic offline installation',()=>{
 const code=String.raw`
import importlib.util,hashlib,json,pathlib,tempfile,unittest,sys
sys.dont_write_bytecode=True
from unittest import mock
spec=importlib.util.spec_from_file_location('s','scripts/import_minecraft_sounds.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Check(unittest.TestCase):
 def test_pins(self):
  config=json.loads(pathlib.Path('configs/minecraft-sounds.json').read_text())
  self.assertEqual(m.validate_config(config),config)
  for key in ['manifestUrl','assetIndexUrl','assetIndexSha1']:
   with self.assertRaises(ValueError):m.validate_config({**config,key:'invalid'})
  with self.assertRaises(ValueError):m.validate_config({**config,'sounds':{'escape':'../file'}})
 def test_ogg_and_hash(self):
  data=b'OggS'+bytes(12)+b'vorbis'+bytes(8)
  digest=hashlib.sha1(data).hexdigest()
  self.assertEqual(m.validate_sound(data,digest,len(data)),None)
  for body,sha,size in [(b'bad',digest,len(data)),(data,'0'*40,len(data)),(data,digest,2),(data+b'x',digest,len(data))]:
   with self.assertRaises(ValueError):m.validate_sound(body,sha,size)
 def test_untrusted_urls_rejected_before_network(self):
  for url in ['file:///etc/passwd','https://example.com/x','https://resources.download.minecraft.net/ff/'+('0'*40)]:
   with self.assertRaises(ValueError):m.fetch(url,'0'*40,100)
 def test_verified_import_is_atomic_and_repeat_preserves_bytes(self):
  data=b'OggS'+bytes(12)+b'vorbis'+bytes(8);digest=hashlib.sha1(data).hexdigest()
  manifest={'assetIndex':{'url':m.PINNED['assetIndexUrl'],'sha1':m.PINNED['assetIndexSha1'],'size':m.PINNED['assetIndexSize']}}
  index={'objects':{source:{'hash':digest,'size':len(data)} for source in m.SOUNDS.values()}}
  def fetch(url,*args):
   if url==m.PINNED['manifestUrl']:return json.dumps(manifest).encode()
   if url==m.PINNED['assetIndexUrl']:return json.dumps(index).encode()
   return data
  with tempfile.TemporaryDirectory() as directory:
   target=pathlib.Path(directory)/'sounds'
   with mock.patch.object(m,'fetch',side_effect=fetch):result=m.install(target)
   self.assertEqual(len(result['sounds']),22)
   self.assertEqual(len(list(target.glob('*.ogg'))),22)
   with mock.patch.object(m,'fetch',side_effect=AssertionError('repeat must not download')):
    self.assertEqual(m.install(target),result)
   (target/'mine.ogg').write_bytes(b'tampered')
   with self.assertRaises(ValueError):m.verify_installed(target,m.CONFIG)
  with tempfile.TemporaryDirectory() as directory:
   target=pathlib.Path(directory)/'sounds'
   with mock.patch.object(m,'fetch',side_effect=lambda url,*args:fetch(url,*args) if url in [m.PINNED['manifestUrl'],m.PINNED['assetIndexUrl']] else b'bad'):
    with self.assertRaises(ValueError):m.install(target)
   self.assertFalse(target.exists())
 def test_existing_files_verified_not_replaced(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d)/'sounds';root.mkdir();(root/'mine.ogg').write_bytes(b'tampered')
   with self.assertRaises((ValueError,FileNotFoundError)):m.verify_installed(root,m.CONFIG)
unittest.main()
`;
 const r=spawnSync('python',['-c',code],{encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stdout+r.stderr);
});

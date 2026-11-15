'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');

test('meme audio imports only pinned short media, verifies duration/tampering and preserves existing Minecraft sounds offline',()=>{
 const code=String.raw`
import copy,hashlib,importlib.util,json,pathlib,struct,sys,tempfile,unittest
from unittest import mock
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('m','scripts/import_meme_audio.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
packet=b'\x01vorbis'+struct.pack('<I',0)+b'\x01'+struct.pack('<I',48000)+bytes(14)
ogg=b'OggS\x00\x04'+struct.pack('<Q',96000)+bytes(12)+bytes([1,len(packet)])+packet
mp3=(b'\xff\xfb\x94\xc0'+bytes(380))*77
fixtures={'meme_67':ogg,'meme_siuuu':mp3}
pins=copy.deepcopy(m.SOURCES)
for name,body in fixtures.items():
 pins[name].update(size=len(body),sha256=hashlib.sha256(body).hexdigest(),duration=2 if name=='meme_67' else 1.848)
class Check(unittest.TestCase):
 def test_fixed_sources_and_licenses_are_honest(self):
  self.assertEqual(set(m.SOURCES),{'meme_67','meme_siuuu'})
  self.assertTrue(m.SOURCES['meme_67']['licenseVerified'])
  self.assertFalse(m.SOURCES['meme_siuuu']['licenseVerified'])
  self.assertTrue(m.SOURCES['meme_siuuu']['file'].endswith('.mp3'))
  with mock.patch.object(m.urllib.request,'build_opener',side_effect=AssertionError('must not reach network')):
   with self.assertRaises(ValueError):m.fetch('https://example.com/anything')
 def test_structural_parsers_require_complete_frames(self):
  self.assertAlmostEqual(m.ogg_duration(ogg),2)
  self.assertAlmostEqual(m.mp3_duration(mp3),1.848)
  for body in [ogg[:-1],b'OggS',ogg[:27]+b'\xff'+ogg[28:]]:
   with self.assertRaises(ValueError):m.ogg_duration(body)
  for body in [mp3[:-1],b'ID3'+mp3,bytes(500),b'\xff\xfb\x9c\xc0'+bytes(380)]:
   with self.assertRaises(ValueError):m.mp3_duration(body)
 def test_hash_size_and_duration_cannot_be_bypassed(self):
  with mock.patch.object(m,'SOURCES',pins):
   self.assertAlmostEqual(m.validate_audio('meme_siuuu',mp3),1.848)
   for body in [mp3[:-1],mp3+b'x',bytes(len(mp3)),bytes(m.MAX_BYTES+1)]:
    with self.assertRaises(ValueError):m.validate_audio('meme_siuuu',body)
   changed=copy.deepcopy(pins);changed['meme_siuuu']['duration']=9
   with mock.patch.object(m,'SOURCES',changed):
    with self.assertRaises(ValueError):m.validate_audio('meme_siuuu',mp3)
   long_mp3=mp3*3;changed['meme_siuuu'].update(size=len(long_mp3),sha256=hashlib.sha256(long_mp3).hexdigest(),duration=5.544)
   with mock.patch.object(m,'SOURCES',changed):
    with self.assertRaises(ValueError):m.validate_audio('meme_siuuu',long_mp3)
 def test_verified_pair_is_idempotent_and_existing_sounds_untouched(self):
  with tempfile.TemporaryDirectory() as folder,mock.patch.object(m,'SOURCES',pins):
   target=pathlib.Path(folder)/'sounds';target.mkdir();(target/'mine.ogg').write_bytes(b'existing Minecraft sound')
   with mock.patch.object(m,'fetch',side_effect=lambda name:fixtures[name]):self.assertEqual(m.install(target),pins)
   self.assertEqual((target/'mine.ogg').read_bytes(),b'existing Minecraft sound')
   with mock.patch.object(m,'fetch',side_effect=AssertionError('repeat must stay offline')):self.assertEqual(m.install(target),pins)
   (target/'meme_siuuu.mp3').write_bytes(b'tampered')
   with self.assertRaises(ValueError):m.install(target)
 def test_one_invalid_download_never_installs_half_the_pair(self):
  with tempfile.TemporaryDirectory() as folder,mock.patch.object(m,'SOURCES',pins):
   target=pathlib.Path(folder)/'sounds'
   with mock.patch.object(m,'fetch',side_effect=lambda name:ogg if name=='meme_67' else b'bad'):
    with self.assertRaises(ValueError):m.install(target)
   self.assertEqual(list(target.iterdir()),[])
 def test_partial_existing_pair_is_rejected_without_replacing_it(self):
  with tempfile.TemporaryDirectory() as folder:
   target=pathlib.Path(folder);(target/'meme_67.ogg').write_bytes(b'unknown local file')
   with mock.patch.object(m,'fetch',side_effect=AssertionError('must preserve unknown file')):
    with self.assertRaises(FileNotFoundError):m.install(target)
   self.assertEqual((target/'meme_67.ogg').read_bytes(),b'unknown local file')
unittest.main()
`;
 const result=spawnSync('python',['-c',code],{encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});

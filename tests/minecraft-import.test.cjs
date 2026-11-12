'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('Minecraft importer verifies pins, PNGs, ZIP integrity, whitelist and local provenance without network',()=>{
  const code=String.raw`
import hashlib, importlib.util, json, pathlib, struct, tempfile, unittest, warnings, zipfile, zlib
spec=importlib.util.spec_from_file_location('minecraft_import','scripts/import_minecraft.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def chunk(kind,data):
 return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
def png(w=16,h=16):
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\xff\x00\x00\xff'*w)*h))+chunk(b'IEND',b'')
class ImportTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name);self.addCleanup(self.temp.cleanup)
  self.config=json.loads(pathlib.Path('configs/minecraft-assets.json').read_text());self.archive=self.root/'fixture.jar'
 def archive_config(self,missing=None,duplicate=False,extra=True):
  with warnings.catch_warnings():
   warnings.simplefilter('ignore',UserWarning)
   with zipfile.ZipFile(self.archive,'w',compression=zipfile.ZIP_STORED) as out:
    for key,name in self.config['textures'].items():
     if key!=missing:out.writestr(name,png())
    if duplicate:out.writestr(self.config['textures']['stone'],png())
    if extra:out.writestr('../escaped.png',png());out.writestr('main.class',b'never execute')
  config={**self.config,'clientSha1':hashlib.sha1(self.archive.read_bytes()).hexdigest(),'clientSize':self.archive.stat().st_size}
  return config
 def test_config_has_exact_pinned_official_sources_and_whitelist(self):
  self.assertEqual(len(m.validate_config(self.config)['textures']),24)
  for key,value in [('version','latest'),('clientUrl','https://evil.example/client.jar'),('manifestUrl','file:///tmp/x'),('clientSha1','0'*40),('clientSize',1)]:
   with self.subTest(key=key),self.assertRaises(ValueError):m.validate_config({**self.config,key:value})
  with self.assertRaises(ValueError):m.validate_config({**self.config,'textures':{**self.config['textures'],'script':'../x'}})
 def test_verified_archive_installs_only_24_pngs_and_records_actual_hashes(self):
  config=self.archive_config();destination=self.root/'minecraft';result=m.install_archive(self.archive,config,destination)
  self.assertEqual(set(p.name for p in destination.iterdir()),{key+'.png' for key in config['textures']}|{'provenance.json'})
  self.assertEqual(result['clientSha1'],config['clientSha1']);self.assertEqual(result['version'],'26.3');self.assertEqual(len(result['textures']),24)
  for key,entry in result['textures'].items():
   data=(destination/(key+'.png')).read_bytes();self.assertEqual(entry['sha256'],hashlib.sha256(data).hexdigest());self.assertEqual(entry['archivePath'],config['textures'][key]);self.assertEqual(entry['width'],16);self.assertEqual(entry['height'],16)
  self.assertEqual(m.verify_installed(destination,config),result)
  (destination/'stone.png').write_bytes(b'tampered')
  with self.assertRaises(ValueError):m.verify_installed(destination,config)
 def test_hash_size_missing_and_duplicate_reject_without_partial_output(self):
  for case in ['hash','size','missing','duplicate']:
   with self.subTest(case=case):
    config=self.archive_config(missing='netherite_pickaxe' if case=='missing' else None,duplicate=case=='duplicate')
    if case=='hash':config['clientSha1']='0'*40
    if case=='size':config['clientSize']+=1
    destination=self.root/case
    with self.assertRaises((ValueError,zipfile.BadZipFile)):m.install_archive(self.archive,config,destination)
    self.assertFalse(destination.exists())
 def test_zip_crc_failure_rejects_even_when_outer_fixture_hash_matches(self):
  config=self.archive_config()
  with zipfile.ZipFile(self.archive) as archive:info=archive.getinfo(config['textures']['stone'])
  data=bytearray(self.archive.read_bytes());offset=info.header_offset+30+len(info.filename.encode())+len(info.extra)+12;data[offset]^=1;self.archive.write_bytes(data)
  config['clientSha1']=hashlib.sha1(data).hexdigest()
  with self.assertRaises((ValueError,zipfile.BadZipFile)):m.install_archive(self.archive,config,self.root/'bad-crc')
  self.assertFalse((self.root/'bad-crc').exists())
 def test_png_bounds_and_chunk_crc(self):
  for image in [b'not png',bytes(bytearray(png()[:20])+b'X'+png()[21:]),png(32),png(16,17),png(16,1040),png()[:-1],b'x'*(1024*1024+1)]:
   with self.subTest(length=len(image)),self.assertRaises(ValueError):m.validate_png(image)
  self.assertEqual(m.validate_png(png(16,32)),(16,32))
 def test_zip_symlinks_and_oversized_assets_reject_atomically(self):
  for case in ['symlink','oversized']:
   with self.subTest(case=case):
    with zipfile.ZipFile(self.archive,'w') as archive:
     for key,name in self.config['textures'].items():
      info=zipfile.ZipInfo(name)
      if key=='stone' and case=='symlink':info.create_system=3;info.external_attr=(0o120777)<<16
      archive.writestr(info,png()+b'x'*(1024*1024) if key=='stone' and case=='oversized' else png())
    config={**self.config,'clientSha1':hashlib.sha1(self.archive.read_bytes()).hexdigest(),'clientSize':self.archive.stat().st_size}
    with self.assertRaises(ValueError):m.install_archive(self.archive,config,self.root/case)
    self.assertFalse((self.root/case).exists())
 def test_non_official_download_is_rejected_before_any_network(self):
  with self.assertRaises(ValueError):m.download_file('https://example.com/client.jar',self.root/'bad',self.config['clientSha1'])
  self.assertFalse((self.root/'bad').exists())
 def test_existing_destination_is_preserved(self):
  config=self.archive_config();destination=self.root/'existing';destination.mkdir();(destination/'keep.txt').write_text('keep')
  with self.assertRaises((ValueError,FileExistsError)):m.install_archive(self.archive,config,destination)
  self.assertEqual((destination/'keep.txt').read_text(),'keep')
unittest.main(verbosity=1)
`;
  const result=spawnSync(process.platform==='win32'?'python':'python3',['-B','-c',code],{encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,(result.stdout||'')+(result.stderr||''));
});

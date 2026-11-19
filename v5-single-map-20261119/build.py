#!/usr/bin/env python3
"""New independent Safari QA for PR53's same-instance route, optional AMap POI.
Strict byte proof: base is the previously passed full PR53, never root Pages.
"""
from pathlib import Path
import hashlib,json,shutil,subprocess
root=Path('_site')
old=root/'v5-one-poi-card-full-product-20261119'
new=root/'v5-single-map-full-product-20261119'
source=Path('__prototype/v5-single-map-20261119')
manifest=json.loads((source/'private-product-blobs.json').read_text())
expected=manifest['files']
delta=(
 'index.html','src/interaction/one-route-entry.js','sw.js',
 'src/route/route-single-map-v1.js','src/visual/v5-single-map-route.css',
 'src/map/amap-poi-overlay-v1.js'
)
def blob(path):
 b=path.read_bytes()
 return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
assert old.is_dir() and not new.exists(),'Previous QA product missing or output already exists'
before={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest()
 for p in root.rglob('*') if p.is_file()}
for p in delta:
 assert (source/p).is_file() and blob(source/p)==expected[p],f'PR53 source mismatch {p}'
shutil.copytree(old,new)
for p in delta:
 f=new/p;f.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(source/p,f)
for page,previous in (('index.html','atlas-v4-map-a-integration-20261118-'),
 ('journey.html','atlas-v5-single-poi-20261119-')):
 f=new/page;s=f.read_text(encoding='utf-8')
 assert s.count(previous)==1,(page,previous)
 f.write_text(s.replace(previous,'atlas-v5-shared-map-20261119-'),encoding='utf-8')
# Everything else must be the exact private branch asset, not stale public files.
stale=[]
for path,sha in expected.items():
 f=new/path
 if not f.is_file():stale.append((path,'missing'))
 elif path not in ('index.html','journey.html') and blob(f)!=sha:stale.append((path,'wrong SHA'))
assert not stale,'PRIVATE_PRODUCT_DRIFT '+str(stale)
for p in old.rglob('*'):
 if not p.is_file():continue
 rel=str(p.relative_to(old))
 if rel not in delta and rel!='journey.html':assert p.read_bytes()==(new/rel).read_bytes(),f'Unexpected base product modification: {rel}'
for p,h in before.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h,'Previous Pages modified '+p
assert 'route-single-map-v1.js' in (new/'index.html').read_text()
assert 'amap-poi-overlay-v1.js' in (new/'index.html').read_text()
assert 'v5-single-map-route.css' in (new/'index.html').read_text()
assert 'const openRoute=()=>{if(window.FootprintUnifiedRoute?.open)' in (new/'src/interaction/one-route-entry.js').read_text()
assert 'new maplibregl.Map(' not in (new/'src/route/route-single-map-v1.js').read_text()
assert 'new M.Map(' not in (new/'src/route/route-single-map-v1.js').read_text()
assert (new/'src/interaction/v4-approved-collection-sheet-v2.js').is_file()
assert (new/'src/interaction/paired-dock-motion-v2.js').is_file()
assert 'duration=350' in (new/'footprint-home.js').read_text()
for p in ('v4-map-runtime.js','footprint-home.js','src/interaction/one-route-entry.js',
 'src/map/amap-poi-overlay-v1.js','src/route/route-single-map-v1.js',
 'src/route/route-v5-runtime.js','src/interaction/v4-approved-collection-sheet-v2.js',
 'src/interaction/paired-dock-motion-v2.js'):
 subprocess.run(['node','--check',str(new/p)],check=True)
(new/'integration-manifest.json').write_text(json.dumps({
 'source_private_commit':manifest['private_commit'],
 'source_product_tree':manifest['product_tree'],'product_file_count':len(expected),
 'product_blob_mismatches':stale,'source_parity':'zero unexpected differences; isolated HTML namespace',
 'single_map_flow':'same #atlasVectorMap MapLibre instance; no second route canvas',
 'amap':'secure Worker source + front-end conditional adapter; actual AMap Key/backend NOT configured',
 'physical_iphone_safari':'not yet tested'
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PASS: PR53 single-map: '+str(len(expected))+' exact private asset SHAs, original site paths byte-identical')

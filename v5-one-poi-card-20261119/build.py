#!/usr/bin/env python3
"""Build complete real PR53 product on top of verified 4-subsystem PR52.
Only new isolated Pages directory; no production or accepted preview mutation."""
from pathlib import Path
import hashlib,json,shutil,subprocess
root=Path('_site')
source=Path('__prototype/v5-one-poi-card-20261119')
base=root/'v5-quality-full-product-20261119'
dest=root/'v5-one-poi-card-full-product-20261119'
assert base.is_dir() and not dest.exists()
existing={str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest()
 for f in root.rglob('*') if f.is_file()}
manifest=json.loads((source/'private-product-blobs.json').read_text(encoding='utf-8'))
expect=manifest['files']
delta={
 'index.html','journey.html','v4-map-runtime.js','src/route/route-v5-runtime.js',
 'src/visual/v5-card-reference.css','sw.js'
}
def blob(p):
 data=p.read_bytes()
 return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
for p in delta:
 assert (source/p).is_file(),p
 assert blob(source/p)==expect[p],f'PR53 SHA mismatch {p}'
shutil.copytree(base,dest)
for p in delta:
 dst=dest/p;dst.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(source/p,dst)
old='atlas-v4-map-a-integration-20261118-'
new='atlas-v5-single-poi-20261119-'
for p in ('index.html','journey.html'):
 file=dest/p
 s=file.read_text(encoding='utf-8')
 assert s.count(old)==1,p
 file.write_text(s.replace(old,new),encoding='utf-8')
assert 'footprint-v5-one-poi-card-20261119' in (dest/'sw.js').read_text()
assert (dest/'src/visual/v5-card-reference.css').is_file()
assert 'atlas:saved-stars-changed' in (dest/'index.html').read_text()
assert 'window.__atlasSavedPOIAnchors' in (dest/'v4-map-runtime.js').read_text()
assert 'saved-list' in (dest/'journey.html').read_text()
assert 'syncPreviewStyle' in (dest/'src/route/route-v5-runtime.js').read_text()
for f in base.rglob('*'):
 if not f.is_file():continue
 rel=f.relative_to(base)
 if str(rel) not in delta:assert f.read_bytes()==(dest/rel).read_bytes(),f'unapproved change {rel}'
stale=[]
for rel,sha in expect.items():
 p=dest/rel
 if not p.exists():stale.append((rel,'missing'))
 elif rel not in ('index.html','journey.html') and blob(p)!=sha:stale.append((rel,'wrong-blob'))
assert not stale, f'PRIVATE_PR53_PRODUCT_BLOB_DRIFT {stale}'
print('PASS 164/164 private source Git blobs, except isolated HTML storage namespace.')
assert all(hashlib.sha256((root/rel).read_bytes()).hexdigest()==sha for rel,sha in existing.items()),'existing Pages file changed'
for p in ('v4-map-runtime.js','src/route/route-v5-runtime.js','footprint-home.js',
 'src/interaction/poi-svg-motion-v4.js','src/interaction/v4-approved-collection-sheet-v2.js',
 'src/interaction/paired-dock-motion-v2.js','src/visual/v12-route-place.js'):
 subprocess.run(['node','--check',str(dest/p)],check=True)
assert not (dest/'src/interaction/v4-approved-collection-sheet.js').exists()
assert not (dest/'journey.js').exists()
assert not (dest/'src/route/route-step-flow-v4.js').exists()
assert 'duration=350' in (dest/'footprint-home.js').read_text()
(dest/'integration-manifest.json').write_text(json.dumps({
 'code_commit':manifest['private_commit'],
 'real_product_tree':manifest['product_tree'],
 'files':len(expect),'source_parity':'all blobs identical except isolated html namespace',
 'status':'four-system UI candidate; real iPhone Safari acceptance pending',
 'not_yet_done':['single physical MapLibre instance across home/route','live AMap POI data, secure backend/key required']
},indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print('PASS PR53 full V5 real product; no old route controller, gallery or B Dock regressions.')

#!/usr/bin/env python3
"""Build real private PR #52 changes on the passed four-system V5 product.
Only an isolated preview folder is created; no source or official site overwritten.
"""
from pathlib import Path
import hashlib,json,shutil,subprocess
root=Path('_site')
base=root/'v5-v12-unified-full-product-20261118'
dest=root/'v5-quality-full-product-20261119'
source=Path('__prototype/v5-quality-review-20261119')
assert base.is_dir() and not dest.exists(), 'V12 base must exist, fresh output only'
before={str(x.relative_to(root)):hashlib.sha256(x.read_bytes()).hexdigest() for x in root.rglob('*') if x.is_file()}
expected={
'index.html':'72ac3a9627911041727eab3ce4e7df3e580168dc',
'journey.html':'d4dba2e8a227cc3d4cfa82cd16e41ef1728226bb',
'v4-map-runtime.js':'f6d2b8b9210dd57267fa545a232f63b67f8828fb',
'map-home-bluegray-v18.js':'aa9f382d4efc5f582af0e1cab1d01b8dab393fad',
'src/route/route-v5-runtime.js':'92bffc4e7886abe93d3a6a0945a6b9fd1b993193',
'src/interaction/poi-svg-motion-v4.js':'658e644942329e01deaf5aef1dbd832c4f82effe',
'map-visual-parity.css':'5723c2c64f24111047fad9adb439049afe53dd1c',
'src/visual/v12-route-place.js':'9f12f78da6928751dfa957a1337a11921ad85234',
'src/visual/v5-map-quality-pass.css':'cd6e71216ab14840d2b132bfbcf2fb59299d1bb1',
'sw.js':'1e5a39a61c29937c3cd007c33d71feb83a7f33d2'
}
def blob(p):
    b=p.read_bytes()
    return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
for rel,h in expected.items():assert blob(source/rel)==h,rel
shutil.copytree(base,dest)
for rel in expected:
 p=dest/rel;p.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(source/rel,p)
new_ns='atlas-v5-quality-20261119-'
old_ns='atlas-v4-map-a-integration-20261118-'
for name in ('index.html','journey.html'):
 p=dest/name
 text=p.read_text(encoding='utf-8')
 assert text.count(old_ns)==1,(name,'namespace')
 text=text.replace(old_ns,new_ns)
 p.write_text(text,encoding='utf-8')
assert len([p for p in dest.rglob('*') if p.is_file()])==len([p for p in base.rglob('*') if p.is_file()])+2
for p in base.rglob('*'):
 if not p.is_file():continue
 rel=str(p.relative_to(base))
 assert (dest/rel).is_file(),rel
 if rel not in expected:assert p.read_bytes()==(dest/rel).read_bytes(),f'Unexpected regression: {rel}'
for rel,h in before.items():
 assert hashlib.sha256((root/rel).read_bytes()).hexdigest()==h,f'Original site modified: {rel}'
home=(dest/'index.html').read_text(encoding='utf-8')
journey=(dest/'journey.html').read_text(encoding='utf-8')
map=(dest/'v4-map-runtime.js').read_text(encoding='utf-8')
route=(dest/'src/route/route-v5-runtime.js').read_text(encoding='utf-8')
palette=(dest/'map-home-bluegray-v18.js').read_text(encoding='utf-8')
assert home.count('map-safari-acceptance-8')==2
assert 'map-safari-preload-8' not in home
assert home.count('v5-map-quality-pass.css')==1
assert journey.count('v5-map-quality-pass.css')==1
assert journey.count('map-home-bluegray-v18.js')==1
assert 'maplibre-gl@4.7.1' not in journey+route
assert 'maplibre-gl@5.12.0' in journey+route
assert '<svg class="city-map"' not in journey
assert 'const recolor=()=>{if(current===map)apply(map)};' in palette
assert 'atlasPoiOverlay' in map and 'Do not erase every POI while the map pans' in map
assert 'fp-route-saved-pin' in route and 'focusPin' in route
assert 'duration=350' in (dest/'footprint-home.js').read_text(encoding='utf-8')
assert (dest/'src/interaction/v4-approved-collection-sheet-v2.js').is_file()
assert (dest/'src/interaction/paired-dock-motion-v2.js').is_file()
assert not (dest/'src/interaction/v4-approved-collection-sheet.js').exists()
assert not (dest/'journey.js').exists()
assert not (dest/'src/route/route-step-flow-v4.js').exists()
for file in ('v4-map-runtime.js','footprint-home.js','map-home-bluegray-v18.js',
 'src/route/route-v5-runtime.js','src/visual/v12-route-place.js',
 'src/interaction/v4-approved-collection-sheet-v2.js','src/interaction/paired-dock-motion-v2.js'):
 subprocess.run(['node','--check',str(dest/file)],check=True)
# Audit *every* real private product asset, not only files in this overlay.
# The old public V5 build may contain an older Map A script despite passing
# unrelated gallery/route tests; identify every missing/stale asset by Git SHA.
canonical=json.loads(Path('__prototype/v5-quality-review-20261119/private-product-blobs.json').read_text())
stale=[]
for rel,expected_sha in canonical['files'].items():
    f=dest/rel
    if not f.is_file(): stale.append({'path':rel,'status':'missing'})
    elif rel not in ('index.html','journey.html') and blob(f)!=expected_sha:
        stale.append({'path':rel,'status':'blob-mismatch','expected':expected_sha,'actual':blob(f)})
print('PRIVATE_PRODUCT_AUDIT '+json.dumps(stale,ensure_ascii=False))
(dest/'product-asset-audit.json').write_text(json.dumps({
 'private_commit':canonical['private_commit'],
 'total_files':len(canonical['files']),
 'mismatches':stale,'excluded_preview_namespaces':['index.html','journey.html']
},ensure_ascii=False,indent=2)+'\n')
manifest={'kind':'Private PR #52 strict product overlay',
'private_branch':'integration/v5-quality-unification-20261119',
'changed_source_blobs':expected,'storage_namespace':new_ns,'original_site_unmodified':True,
'map_shared_palette':'bluegray-v18','maplibre_version':'5.12.0','deferred':'real iPhone Safari hardware acceptance'}
(dest/'integration-quality-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PASS: real V5+four subsystems+quality patch, exact private blobs and all other product files unchanged')

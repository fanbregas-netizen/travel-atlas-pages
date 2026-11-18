#!/usr/bin/env python3
"""Apply V12 verified visual/UI adapter to the *actual* V5+MediaV9 build only.

Never copies an old V12 HTML page, never overwrites production / V5 source,
and never adds a second map, card spring or Gallery.
"""
from pathlib import Path
import hashlib
import shutil
import subprocess
import json
root=Path('_site')
existing=root/'v5-bv2-media-v9-full-product-20261118'
output=root/'v5-v12-unified-full-product-20261118'
source=Path('__prototype/v5-v12-integrated-20261118')
assert existing.is_dir() and not output.exists()
original={str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest() for f in root.rglob('*') if f.is_file()}
def blob(p):
 b=p.read_bytes()
 return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
visual={
'v12-v5-parity.css':'52b9612fe5844449def9955b50703a901c09a2c9',
'v12-route-place.js':'1cede2ee1207a960440ed49de59c5b8404b3f0e6',
}
for file,expected in visual.items():assert blob(source/file)==expected,file
shutil.copytree(existing,output)
for file in visual:
 dst=output/'src/visual'/file;dst.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(source/file,dst)
css='<link rel="stylesheet" href="./src/visual/v12-v5-parity.css?v=v12-accepted-20261118">'
script='<script defer src="./src/visual/v12-route-place.js?v=v12-route-13"></script>'
old_ns='atlas-v5-bv2-media-v9-20261118-'
new_ns='atlas-v5-v12-visual-20261118-'
for p in ('index.html','journey.html'):
 item=output/p
 data=item.read_text(encoding='utf-8')
 assert data.count('</head>')==1,(p,'head')
 assert old_ns in data,(p,'storage namespace')
 data=data.replace(old_ns,new_ns).replace('</head>',css+'\n</head>')
 if p=='journey.html':
  assert data.count('</body>')==1
  data=data.replace('</body>',script+'\n</body>')
 else:
  assert 'paired-dock-motion-v2.js' in data
  assert 'v4-approved-collection-sheet-v2.js' in data
 item.write_text(data,encoding='utf-8')
item=output/'sw.js'
data=item.read_text(encoding='utf-8')
cache_a='footprint-v4-review-20261116-v5-bv2-media-v9-20261118'
cache_b='footprint-v4-review-20261116-v5-v12-visual-20261118'
assert data.count(cache_a)==1
data=data.replace(cache_a,cache_b)
asset="'./src/interaction/paired-dock-motion-v2.js'"
assert asset in data
data=data.replace(asset,asset+",'./src/visual/v12-v5-parity.css','./src/visual/v12-route-place.js'")
item.write_text(data,encoding='utf-8')
assert len([p for p in output.rglob('*') if p.is_file()])==len([p for p in existing.rglob('*') if p.is_file()])+2
exceptions={'index.html','journey.html','sw.js'}
for b in existing.rglob('*'):
 if not b.is_file():continue
 rel=str(b.relative_to(existing))
 assert (output/rel).exists()
 if rel not in exceptions:assert b.read_bytes()==(output/rel).read_bytes(),f'unapproved V5 modification: {rel}'
assert 'duration=350' in (output/'footprint-home.js').read_text()
assert 'bluegray-19' in (output/'index.html').read_text()
assert 'v5-only-route-entry' in (output/'index.html').read_text()
assert 'route-v5-runtime.js' in (output/'journey.html').read_text()
assert not (output/'src/interaction/v4-approved-collection-sheet.js').exists()
assert '#rvParity' not in (output/'src/visual/v12-route-place.js').read_text()
assert 'new maplibregl.Map' not in (output/'src/visual/v12-route-place.js').read_text()
for rel in ('src/visual/v12-route-place.js','footprint-home.js','src/interaction/v4-approved-collection-sheet-v2.js','src/interaction/paired-dock-motion-v2.js'):
 subprocess.run(['node','--check',str(output/rel)],check=True)
assert all(hashlib.sha256((root/key).read_bytes()).hexdigest()==sha for key,sha in original.items()),'Previously built Pages files changed'
(output/'v12-manifest.json').write_text(json.dumps({
  'original':'full V5 + map A + B v2 + media V9',
  'v12_original_css_blob':'01f90f8019388dcf65d0ce30a4fc0604a2d121ff',
  'integrated_private_commit':'2c2b148dd7537f068f7bdd893906a966cc195889',
  'integrated_artifacts':visual,
  'changed_originals':sorted(exceptions),
  'added_assets':sorted(visual),
  'source_unchanged':True,
  'native_iPhone_Safari':'pending'},
 ensure_ascii=False,indent=2)+'\n')
print('PASS: actual V5 + B V2 + Media V9 + V12 CSS and shared route-place adapter.')
print('All existing Pages content unchanged, exactly 3 existing V5 files differ plus 2 added assets.')

#!/usr/bin/env python3
"""Build ONE separate, real complete V5 product containing B v2 and Media V9.

This file is invoked only in the Pages review deployment. The normal main
repository's official output is built first and verified byte-for-byte unchanged.
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess

root=Path('_site')
original={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest()
          for p in root.rglob('*') if p.is_file()}
base=root/'v5-unified-full-product-20261118'
assert base.is_dir() and (base/'journey.html').is_file(), 'Actual V5 complete product missing'
name='v5-bv2-media-v9-full-product-20261118'
dest=root/name
assert not dest.exists(), 'Review output must be new; never overwrite V5'
def blob(path):
    data=path.read_bytes()
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
b5=base/'src/interaction/v4-approved-collection-sheet-v2.js'
paired=base/'src/interaction/paired-dock-motion-v2.js'
assert blob(b5)=='7d72c5abb01e0f74674cca78c4344273e51af33c'
assert blob(paired)=='fda72a548700bb549c64030612600557c02e72a4'
assert not (base/'src/interaction/v4-approved-collection-sheet.js').exists()
home=(base/'index.html').read_text(encoding='utf-8')
assert 'v4-approved-collection-sheet-v2.js?v=safari-exit-20261117' in home
assert 'paired-dock-motion-v2.js?v=paired-20261117' in home
assert 'v5-only-route-entry' in home
assert 'map-home-bluegray-v18.js?v=bluegray-19' in home
assert 'window.__atlasCollectionSheet?.requestClose?.()' in (base/'v4-map-runtime.js').read_text()
assert 'src/route/route-v5-runtime.js' in (base/'journey.html').read_text()
assert not (base/'journey.js').exists() and not (base/'journey-v5.html').exists()
assert not (base/'src/route/route-step-flow-v4.js').exists()
shutil.copytree(base,dest)
media=Path('__prototype/v4-system-review/media-v9-final-footprint-home.js')
assert blob(media)=='c387d12180ee8c1201925cf55d21170ae6f7e1c6'
shutil.copyfile(media,dest/'footprint-home.js')
namespace='atlas-v4-map-a-integration-20261118-'
new_namespace='atlas-v5-bv2-media-v9-20261118-'
for page in ('index.html','journey.html','route-view.html'):
    path=dest/page
    txt=path.read_text(encoding='utf-8')
    assert namespace in txt,page
    txt=txt.replace(namespace,new_namespace)
    if page=='index.html':
        assert txt.count('./footprint-home.js?v=search-physical-19')==1
        txt=txt.replace('./footprint-home.js?v=search-physical-19',
                        './footprint-home.js?v=media-v9-bv2-20261118')
    path.write_text(txt,encoding='utf-8')
sw=dest/'sw.js'
sw_text=sw.read_text(encoding='utf-8')
old_cache='footprint-v4-review-20261116-v5-collection-dock-v2-20261118'
new_cache='footprint-v4-review-20261116-v5-bv2-media-v9-20261118'
assert sw_text.count(old_cache)==1
sw.write_text(sw_text.replace(old_cache,new_cache),encoding='utf-8')
allowed={'index.html','journey.html','route-view.html','sw.js','footprint-home.js'}
count=0
for source in base.rglob('*'):
    if not source.is_file():continue
    rel=str(source.relative_to(base))
    assert (dest/rel).is_file(),rel
    if rel not in allowed:
        assert source.read_bytes()==(dest/rel).read_bytes(),f'Unapproved alteration: {rel}'
    else: count+=1
assert count==len(allowed)
assert not (dest/'src/interaction/v4-approved-collection-sheet.js').exists()
text=(dest/'footprint-home.js').read_text(encoding='utf-8')
assert text.count('const iphoneGallery=')==1
assert 'duration=350' in text
assert 'function tileShouldPlay(v)' in text
assert "getState:()=>current" in text
assert 'map-home-bluegray-v18.js?v=bluegray-19' in (dest/'index.html').read_text()
for rel in ('footprint-home.js','v4-map-runtime.js',
            'src/interaction/paired-dock-motion-v2.js',
            'src/interaction/v4-approved-collection-sheet-v2.js',
            'src/route/route-v5-runtime.js'):
    subprocess.run(['node','--check',str(dest/rel)],check=True)
assert all(hashlib.sha256((root/rel).read_bytes()).hexdigest()==h
           for rel,h in original.items()), 'Existing Pages site changed'
manifest={'label':'V5 full product Map A bluegray19 + Collection/Docks V2 + Media V9 + one 3-step route',
          'reference_branch':'travel-atlas/integration/v4-map-a-bluegray19-20261118',
          'reference_merged_PR':49,
          'media_PR':43,'media_blob':blob(dest/'footprint-home.js'),
          'V2_collection_blob':blob(dest/'src/interaction/v4-approved-collection-sheet-v2.js'),
          'V2_docks_blob':blob(dest/'src/interaction/paired-dock-motion-v2.js'),
          'original_file_count':len(original),
          'new_path':name,'preview_distinct':True,'old_root_unchanged':True}
(dest/'integration-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PASS V5 complete product: B V2 + Map A + only V5 route + Media V9.')
print('Other V5 files unchanged; all original published files byte-identical.')

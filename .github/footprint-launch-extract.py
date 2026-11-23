#!/usr/bin/env python3
"""Publish the approved Footprint launch page as separate media assets."""
from pathlib import Path
from hashlib import sha256
from base64 import b64decode
import re

src=Path('.github/footprint-launch-source')
parts=sorted(src.glob('part_*.txt'))
assert len(parts)==19, f'Expected 19 parts, got {len(parts)}'
raw=''.join(p.read_text(encoding='utf-8') for p in parts)
assert sha256(raw.encode('utf-8')).hexdigest()=='cb1729b6ae6684000cb74cfa776caaf0b413ffd26b202d130a656513488d298e'
root=Path('_site/footprint-launch-20261123')
assets=root/'assets'
assets.mkdir(parents=True,exist_ok=True)
ext={'image/png':'png','image/webp':'webp','image/jpeg':'jpg','image/svg+xml':'svg','video/mp4':'mp4'}
seen=set()
pat=re.compile(r'data:(image/(?:png|webp|jpeg|svg\+xml)|video/mp4);base64,([A-Za-z0-9+/=]+)')
def replace(m):
    kind,payload=m.groups()
    blob=b64decode(payload,validate=True)
    name=sha256(blob).hexdigest()[:16]+'.'+ext[kind]
    if name not in seen:
        (assets/name).write_bytes(blob)
        seen.add(name)
    return 'assets/'+name
html=pat.sub(replace,raw)
assert 'base64,' not in html
assert '<video' in html and '<source src="assets/' in html
(root/'index.html').write_text(html,encoding='utf-8')
assert len(html.encode('utf-8'))<100_000
assert any(p.suffix=='.mp4' and p.stat().st_size>5_000_000 for p in assets.iterdir())
print('PASS: independent Footprint launch site',len(seen),'assets')

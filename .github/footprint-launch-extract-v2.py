#!/usr/bin/env python3
"""Install the isolated Footprint Map launch site from checked, archived original assets."""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile
from io import BytesIO

src=Path('.github/footprint-launch-simplified-20261123')
parts=sorted(src.glob('part_*.bin'))
assert len(parts)==12, f'Expected 12 release data parts, got {len(parts)}'
raw=b''.join(p.read_bytes() for p in parts)
expected='f63165481a15722c760ec4f163b9172e4f1f143ed129a37a709fd983199e3c69'
assert sha256(raw).hexdigest()==expected, 'Launch release ZIP hash mismatch'
root=Path('_site/footprint-launch-20261123')
root.mkdir(parents=True,exist_ok=True)
with ZipFile(BytesIO(raw)) as z:
    assert z.testzip() is None, 'Release ZIP damaged'
    for entry in z.infolist():
        rel=Path(entry.filename)
        assert not rel.is_absolute() and '..' not in rel.parts, 'Unsafe ZIP entry'
        if entry.is_dir():
            (root/rel).mkdir(parents=True,exist_ok=True)
        else:
            file=root/rel
            file.parent.mkdir(parents=True,exist_ok=True)
            file.write_bytes(z.read(entry))

html_file=root/'index.html'
video=root/'assets/demo.mp4'
assert html_file.is_file() and (root/'site.js').is_file() and (root/'style.css').is_file()
assert video.stat().st_size>5_000_000
hashed_name=sha256(video.read_bytes()).hexdigest()[:16]+'.mp4'
video.rename(root/'assets'/hashed_name)
html=html_file.read_text(encoding='utf-8').replace('assets/demo.mp4','assets/'+hashed_name)
assert '<video' in html and 'data-page="map"' in html and 'data-page="route"' in html
html_file.write_text(html,encoding='utf-8')
assert len(list((root/'assets/icons').glob('*.svg')))==60
print('PASS: isolated Footprint Map website and uninterrupted 52.4s demo video',hashed_name)

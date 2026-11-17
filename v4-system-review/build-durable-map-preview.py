#!/usr/bin/env python3
"""Append isolated V4 map review to GitHub Pages without touching existing pages.
Source is exact pinned full V4; feature patches stay in independent review branch.
"""
from pathlib import Path
import hashlib, shutil, subprocess, sys

if len(sys.argv)!=4:
    raise SystemExit("usage: build-durable-map-preview.py BASE PATCH_DIR OUTPUT")
base, patchdir, target=map(Path,sys.argv[1:])
assert base.name=="v4-review-20261116" and base.is_dir()
assert patchdir.name=="v4-system-review" and patchdir.is_dir()
assert target.name=="v4-map-system-review-20261117"
assert not target.exists(),str(target)
originals={str(f.relative_to(base)):hashlib.sha256(f.read_bytes()).digest()
           for f in base.rglob("*") if f.is_file()}
assert len(originals)==164,("unexpected full V4 source",len(originals))
target.parent.mkdir(parents=True,exist_ok=True)
shutil.copytree(base,target)

def patch(name,asset):
    subprocess.run(["python3",str(patchdir/name),str(target/asset)],check=True)
patch("map-runtime-repairs.py","v4-map-runtime.js")
patch("map-shared-style-repairs.py","src/map/shared-v4-map.js")
patch("map-poi-smooth.py","v4-map-runtime.js")
patch("map-poi-smooth.py","index.html")
patch("map-poi-icon-pop.py","src/interaction/poi-svg-motion-v4.js")
patch("map-route-smooth.py","src/interaction/route-cards-v5-live.js")
for asset in ("v4-map-runtime.js","src/map/shared-v4-map.js","src/interaction/route-cards-v5-live.js","src/interaction/poi-svg-motion-v4.js"):
    subprocess.run(["node","--check",str(target/asset)],check=True)
for asset in ("scope-review.js","scope-review.css","map-visual-parity.css"):
    shutil.copyfile(patchdir/asset,target/asset)
for page in ("index.html","journey.html","route-view.html"):
    file=target/page
    html=file.read_text(encoding="utf-8")
    old="atlas-v4-review-20261116-"
    assert old in html and "</head>" in html and "</body>" in html,page
    html=html.replace(old,"atlas-v4-map-system-review-20261117-")
    for version in ("c4","route-precision-1","4-unified"):
        html=html.replace("shared-v4-map.js?v="+version,"shared-v4-map.js?v=map-parity-2")
    if page=="index.html":
        html=html.replace("v4-map-runtime.js?v=real-handoff-19","v4-map-runtime.js?v=map-safari-acceptance-3")
        html=html.replace("v4-map-runtime.js?v=parity-11","v4-map-runtime.js?v=map-safari-preload-3")
        html=html.replace("poi-svg-motion-v4.js?v=cv5-18","poi-svg-motion-v4.js?v=poi-pop-4")
        assert "poi-pop-4" in html
        assert "map-safari-acceptance-3" in html
        assert "The selected icon already animates in place" in html
    if page=="journey.html":
        old_script='<script defer src="./src/interaction/route-cards-v5-live.js?v=fluid-3"></script>'
        assert old_script in html
        shared='<script defer src="./atlas-map-design.js"></script>\n<script defer src="./atlas-route-buildings.js"></script>'
        html=html.replace(old_script,shared+"\n"+old_script.replace("fluid-3","map-route-smooth-2"),1)
    if page in ("journey.html","route-view.html"):
        warm='<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>\n<link rel="preconnect" href="https://tiles.openfreemap.org" crossorigin>\n<link rel="preload" as="script" href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js">'
        html=html.replace("</head>",warm+"\n</head>",1)
    style='<link rel="stylesheet" href="./map-visual-parity.css?v=map-only-2">\n<link rel="stylesheet" href="./scope-review.css?v=scope-1">'
    script='<script src="./scope-review.js?v=scope-1" data-scope="map"></script>'
    html=html.replace("</head>",style+"\n</head>",1)
    html=html.replace("</body>",script+"\n</body>",1)
    file.write_text(html,encoding="utf-8")
allowed={"index.html","journey.html","route-view.html","v4-map-runtime.js","src/map/shared-v4-map.js","src/interaction/route-cards-v5-live.js","src/interaction/poi-svg-motion-v4.js"}
for rel,digest in originals.items():
    copied=target/rel
    assert copied.is_file(),rel
    if rel not in allowed:
        assert hashlib.sha256(copied.read_bytes()).digest()==digest,rel
assert sum(1 for f in target.rglob("*") if f.is_file())==167
assert "window.AtlasPOIMotion=Object.freeze({play,popSelected" in (target/"src/interaction/poi-svg-motion-v4.js").read_text()
assert "function liveRenderCamera(rebuild=true)" in (target/"src/interaction/route-cards-v5-live.js").read_text()
assert "return 'https://tiles.openfreemap.org/styles/bright';" in (target/"src/map/shared-v4-map.js").read_text()
print("PASS persistent isolated map preview: 167 assets, 7 scoped modified source files, official files unaffected")

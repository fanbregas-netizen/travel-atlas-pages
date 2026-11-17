#!/usr/bin/env python3
"""Map-only cross-surface basemap parity for independent V4 Safari review.
Preserves all C V5 route selection, gestures, data, cards and media source.
"""
from pathlib import Path
import sys
file=Path(sys.argv[1])
assert file.name=='shared-v4-map.js'
src=file.read_text(encoding='utf-8')
a=src.index(' function routeFigureStyle(){')
b=src.index('\n function lastCamera(){',a)
old=src[a:b]
assert "footprint-buildings-black" in old and "raster-opacity" in old
# The homepage actively uses the OpenFreeMap bright vector renderer on Safari.
# Returning this exact style from the shared MAP adapter makes the route picker
# reuse the approved basemap instead of 26%-opacity OSM + dark overlay footprints.
new=""" function routeFigureStyle(){
  return 'https://tiles.openfreemap.org/styles/bright';
 }
"""
src=src[:a]+new.rstrip()+src[b:]
assert src.count("return 'https://tiles.openfreemap.org/styles/bright';")==1
assert 'figureStyle()' in src
assert 'lastCamera()' in src
file.write_text(src,encoding='utf-8')
print('Map-only shared basemap parity applied:',file)

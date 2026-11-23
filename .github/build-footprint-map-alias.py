#!/usr/bin/env python3
"""Build /footprint-map/ as a safe, fully functional alias of the approved V5 root.

Do not replace the original GitHub Pages root or change its IndexedDB namespace.
The alias stays on the same origin, preserving browser-owned user data.
"""
from pathlib import Path, PurePosixPath
import hashlib
import shutil

root = Path("_site")
alias = root / "footprint-map"
manifest = Path(".github/V5_PRODUCTION_FILES_20261122.txt")

assert manifest.is_file(), "Approved V5 release manifest missing"
assert root.is_dir() and (root / "index.html").is_file(), "Build the V5 root first"
assert not alias.exists(), "Refusing to overwrite a pre-existing branded alias"
paths = [line.strip() for line in manifest.read_text(encoding="utf-8").splitlines() if line.strip()]
assert 140 <= len(paths) <= 220, "Unexpected approved V5 release manifest size"
for text in paths:
    rel = PurePosixPath(text)
    assert not rel.is_absolute() and ".." not in rel.parts and str(rel) == text, f"Unsafe path {text}"
    src = root / text
    assert src.is_file() and src.stat().st_size > 0, f"Missing V5 asset {text}"
    dst = alias / text
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    assert hashlib.sha256(dst.read_bytes()).digest() == hashlib.sha256(src.read_bytes()).digest()

original = (root / "sw.js").read_text(encoding="utf-8")
alias_sw = alias / "sw.js"
old = "const CACHE='footprint-v5-production-20261122-v2';"
assert old in original, "Unexpected canonical SW version; review cache isolation before releasing"
digest = hashlib.sha256((root / "index.html").read_bytes() + original.encode()).hexdigest()[:12]
new = "const CACHE='footprint-map-branded-" + digest + "';"
updated = original.replace(old, new, 1)
# Old branded caches are removed ONLY within the alias's own worker scope.
old_filter = "k==='atlas-v4-shell-stage6-integrated-v51'||"
assert old_filter in updated
updated = updated.replace(old_filter, "k.startsWith('footprint-map-branded-')||" + old_filter, 1)
alias_sw.write_text(updated, encoding="utf-8")

index = (alias / "index.html").read_text(encoding="utf-8")
assert "<title>Footprint Map</title>" in index
assert "window.__fpStorageNamespace=" not in index
assert "window.__atlasPreviewNamespace=" not in index
assert "./sw.js" in index
assert "Footprint Map" in (alias / "manifest.webmanifest").read_text(encoding="utf-8")
assert "private-travel-footprints-v1" in (alias / "src/media/media-core.js").read_text(encoding="utf-8")
assert (alias / "index.html").read_bytes() == (root / "index.html").read_bytes()
assert (root / "sw.js").read_text(encoding="utf-8") == original
print(f"PASS /footprint-map/ — {len(paths)} approved assets, canonical app identical, branded SW cache isolated")

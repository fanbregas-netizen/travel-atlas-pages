# Footprint Map × Travel Atlas — V5.1 stage-six acceptance

Build: `V5.1.Stage6.20261103.stability`  
Map baseline: `V4.Review.20261103.architectural-b-v46` (preserved)

## Automated checks

GitHub Pages workflow must execute the six versioned regression suites before publishing:

- Architectural B: one canvas map at building scale, no old raster tile ghost, overhead massing
- Route picking: user-chosen order, D1–Dn dates, save/restore and iPhone fallback
- Route viewer: real-road preview only after an explicit user request, no fabricated travel times
- Visit/archive: EXIF-nearest suggestions, user-confirmed media, same bookmark database, no silent quota fallback
- Full backup: ZIP CRC, exact video bytes, >9 photos, visits and saved journeys, non-overwriting restore
- Integrated stability: late-loaded backup UI, six-video limit, preservation of recently edited Brief, diagnostic privacy

The source tree also runs JavaScript syntax checks for all deployed module files.

## Physical iPhone Safari acceptance — NOT YET VERIFIED

These steps require a real iPhone. **Do not clear Safari's website data** when testing, because doing so may erase private bookmarks and media.

1. Open the deployed public site from Safari, then open **我的收藏 → 运行检查**. Confirm application version V5.1 and inspect architectural coverage when zoomed into city/street scale.
2. Confirm the old gray street map does not appear behind the 2D architectural map while pinching between city and building zooms. A white rooftop with subtle building relief should be seen at street scale, with no map tilt.
3. Search a destination, add the upright yellow star, edit Brief, close on map blank area, reopen the same star, and verify that note is preserved.
4. From a saved place, manually select photos and videos. Verify all content stays attached to the correct star, six videos is the limit, and unsupported/oversized files do not make the entire place disappear.
5. Mark visited, revoke visit, confirm neither action deletes media or Brief. Import an album selection with and without JPEG EXIF; confirm the user, not EXIF alone, chooses the destination star.
6. Plan three bookmarks across D1–D3, reorder them, save the route, reopen via **我的路线**, and check latest media/Brief are read from the same local collection.
7. In the full-screen route, open **每日行程** and attempt an opt-in road preview. Check failure leaves schematic order intact and no real-time traffic or fabricated ETA is claimed.
8. Export **完整档案 ZIP**, retain it securely in Files/iCloud Drive, and use **安全恢复档案** to preview the same ZIP. Verify that existing IDs are skipped. For a destructive or full-import test use a **separate clean Safari profile/test device**, never the only copy of a user's real collection.
9. Copy the **运行检查** report if a problem remains. It intentionally includes only version, module status and aggregate counts; it excludes exact coordinates, photos, videos and Brief text.

## Known limitations

- iOS Safari cannot automatically index a user's entire Photos library in the background. Media import requires explicit file selection.
- Public OSRM demo routing is best-effort and provides no live traffic; AMap leg links remain the navigation handoff.
- GitHub connector confirms source commits, **not** the GitHub Pages deployment or real iPhone visual behavior.
- No cloud synchronization; user data remains in the browser, so ZIP export is essential before switching devices or deleting browser data.
- ZIP archives are not encrypted. Store exported files securely.

## Release scope

This final stage makes no intentional changes to Architectural B's map palette or perspective, bookmark shapes, route schema or users' existing data. The runtime diagnostics tool performs read-only checks and never requests device location.

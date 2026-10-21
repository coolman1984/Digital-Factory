# three.js (vendored)

`three.iife.min.js` is three.js r170 (MIT, see LICENSE) bundled once with esbuild so the site needs no build step and works offline.
It exposes `window.THREE` with all of three.js plus the add-ons listed in `entry.js` (OrbitControls, PointerLockControls, mergeGeometries, RoundedBoxGeometry, RoomEnvironment, EffectComposer with RenderPass, OutputPass, UnrealBloomPass, GTAOPass, SMAAPass, OutlinePass, ShaderPass).

Rebuild after changing `entry.js`:

```bash
npm i three@0.170.0 esbuild@0.24.0
npx esbuild entry.js --bundle --minify --format=iife --global-name=THREE --legal-comments=none --outfile=three.iife.min.js
```

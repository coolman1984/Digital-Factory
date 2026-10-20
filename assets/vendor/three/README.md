# three.js (vendored)

`three.iife.min.js` is three.js r170 (MIT, see LICENSE) bundled once with esbuild so the site needs no build step and works offline.
It exposes `window.THREE` with the names listed in `entry.js`, plus `THREE.OrbitControls` and `THREE.mergeGeometries`.

Rebuild after changing `entry.js`:

```bash
npm i three@0.170.0 esbuild@0.24.0
npx esbuild entry.js --bundle --minify --format=iife --global-name=THREE --legal-comments=none --outfile=three.iife.min.js
```

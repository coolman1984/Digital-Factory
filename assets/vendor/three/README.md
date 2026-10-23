# three.js (vendored)

`three.iife.min.js` is three.js r170 (MIT, see LICENSE) bundled once with esbuild so the site needs no build step and works offline.
It exposes `window.THREE` with all of three.js plus the add-ons listed in `entry.js` (OrbitControls, PointerLockControls, mergeGeometries, RoundedBoxGeometry, RoomEnvironment, EffectComposer with RenderPass, OutputPass, UnrealBloomPass, GTAOPass, SMAAPass, OutlinePass, ShaderPass).

Rebuild after changing `entry.js`:

```bash
npm i three@0.170.0 esbuild@0.24.0
npx esbuild entry.js --bundle --minify --format=iife --global-name=THREE --legal-comments=none --outfile=three.iife.min.js
```

## Add-on bundles (loaded on demand, attached to `window.THREE.X`)

- `three-extras.iife.min.js`: GLTFLoader, MeshoptDecoder, BokehPass and the blur shaders from three.js r170 (MIT).
- `three-pathtracer.iife.min.js`: three-gpu-pathtracer 0.0.23 (MIT, `LICENSE-three-gpu-pathtracer`) with three-mesh-bvh 0.9.1
  (MIT, `LICENSE-three-mesh-bvh`). 0.0.23 is the last release that runs on WebGL 2 and three r151 or later. 0.0.24 and later need three
  r180 or later and WebGPU, so they need the core upgrade described in `docs/VISUAL-FACTORY.md`.

Both bundles resolve `import 'three'` to the page's `window.THREE` (`three-shim.js`), so there is only ever one copy of three.js.
Rebuild them: `npm i three@0.170.0 esbuild@0.24.0 three-gpu-pathtracer@0.0.23 three-mesh-bvh@0.9.1`, then `node build.mjs`.

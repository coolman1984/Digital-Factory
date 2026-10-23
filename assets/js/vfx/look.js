/* DFLook: the factory-wide look system for three.js pages (r170, WebGL 2). One file, no build step.
   - Rendering profiles: data only (grade, vignette, letterbox, depth of field, art direction), shared by every page.
   - gradePass: the last pass of a frame. A display-referred grade in linear light (gain, lift, white balance,
     contrast around mid-grey, saturation), then the natural cos⁴ vignette, letterbox bars and a ±1 LSB TPDF dither
     (PCG hash from DFShaders, ported from gokayfem/shader-skills).
   - Art directions: realistic (default), toon / anime (cel bands on the physically based result, with a rim light), and
     outlined (a screen-space edge pass from depth and normals). They are switches on the same materials, not copies.
   - dof: depth of field (BokehPass from the on-demand add-on bundle). load: one cached script loader.
   Order of a frame: RenderPass → (GTAO) → (EdgePass) → (Bokeh) → Bloom → OutputPass (tone map + sRGB) → gradePass. */
(function () {
  const PROFILES = {
    // the default: honest colour, light framing
    realistic: { exposure: 1.0, label: 'Realistic', contrast: 1.0, saturation: 1.0, warmth: 0, tint: 0, lift: [0, 0, 0], gain: [1, 1, 1], vignette: 0.45, bars: 0, art: 'realistic', dof: false },
    // product shots: a touch of contrast, clean whites
    product: { exposure: 1.0, label: 'Product', contrast: 1.05, saturation: 1.02, warmth: -0.01, tint: 0, lift: [0, 0, 0], gain: [1.01, 1.01, 1.0], vignette: 0.35, bars: 0, art: 'realistic', dof: true },
    // cinematic: cooler shadows, warmer highlights, a 2.39:1 letterbox, depth of field
    cinematic: { exposure: 0.82, label: 'Cinematic', contrast: 1.1, saturation: 0.9, warmth: 0.05, tint: -0.01, lift: [0.004, 0.008, 0.016], gain: [1.03, 1.0, 0.96], vignette: 0.75, bars: 1, art: 'realistic', dof: true },
    // toon: flat bands, clear edges, a little more colour
    toon: { exposure: 1.0, label: 'Toon', contrast: 1.05, saturation: 1.15, warmth: 0.02, tint: 0, lift: [0, 0, 0], gain: [1, 1, 1], vignette: 0.2, bars: 0, art: 'toon', bands: 4, rim: 0.0, outline: true, dof: false },
    // anime-inspired: three bands, a bright rim, saturated and warm, ink outlines
    anime: { exposure: 1.05, label: 'Anime', contrast: 1.08, saturation: 1.28, warmth: 0.04, tint: 0.01, lift: [0.01, 0.008, 0.02], gain: [1.02, 1.0, 1.0], vignette: 0.25, bars: 0, art: 'toon', bands: 3, rim: 0.45, outline: true, dof: false },
    // outlined: realistic shading with technical-drawing edges
    outlined: { exposure: 1.0, label: 'Outlined', contrast: 1.0, saturation: 0.85, warmth: 0, tint: 0, lift: [0, 0, 0], gain: [1, 1, 1], vignette: 0.2, bars: 0, art: 'realistic', outline: true, dof: false }
  };

  /* ---------- the grade and finish pass ---------- */
  function gradePass(T, o = {}) {
    const LIB = (window.DFShaders && DFShaders.LIB) || '';
    const p = new T.ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, amount: { value: o.vignette ?? 0.45 }, focal: { value: 3.5 }, aspect: { value: 1.6 }, frame: { value: 0 },
        contrast: { value: 1 }, saturation: { value: 1 }, warmth: { value: 0 }, tint: { value: 0 },
        lift: { value: new T.Vector3() }, gain: { value: new T.Vector3(1, 1, 1) }, bars: { value: 0 }, barAspect: { value: 2.39 }
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float amount, focal, aspect, frame, contrast, saturation, warmth, tint, bars, barAspect; uniform vec3 lift, gain; varying vec2 vUv;
${LIB}
vec3 dfToLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 dfToSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec4 src = texture2D(tDiffuse, vUv);
  vec3 c = dfToLin(clamp(src.rgb, 0.0, 1.0));
  // gain and lift (lift raises the shadows toward its colour, leaves white alone)
  c = c * gain + lift * (1.0 - c);
  // white balance: warm/cool along blue-amber, tint along green-magenta, keeping luminance
  float l0 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c *= vec3(1.0 + warmth, 1.0 + tint, 1.0 - warmth);
  c *= l0 / max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-5);
  // contrast around mid-grey in log space, then saturation
  c = 0.18 * pow(max(c, 0.0) / 0.18, vec3(contrast));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, saturation), 0.0);
  // natural vignette for the camera's focal length
  vec2 uv = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);
  float f2 = focal * focal, k = f2 / (f2 + dot(uv, uv)); k *= k;
  c *= mix(1.0, k, amount);
  vec3 s = dfToSrgb(clamp(c, 0.0, 1.0));
  // letterbox to barAspect when the frame is wider than it is tall enough
  if (bars > 0.5) { float h = clamp(aspect / barAspect, 0.0, 1.0); if (abs(vUv.y * 2.0 - 1.0) > h) s = vec3(0.0); }
  vec2 r = dfHash22(floor(gl_FragCoord.xy) + 7919.0 * mod(frame, 1024.0));
  // opaque: the frame is final, and a copy of the canvas (a snapshot, a hand-over) must not inherit holes in alpha
  gl_FragColor = vec4(s + (r.x + r.y - 1.0) / 255.0, 1.0);
}`
    });
    p.isGrade = true;
    return p;
  }
  function applyGrade(pass, prof) {
    const u = pass.uniforms, P = typeof prof === 'string' ? PROFILES[prof] : prof;
    if (!P) return;
    u.contrast.value = P.contrast; u.saturation.value = P.saturation; u.warmth.value = P.warmth; u.tint.value = P.tint;
    u.lift.value.fromArray(P.lift); u.gain.value.fromArray(P.gain); u.amount.value = P.vignette; u.bars.value = P.bars ? 1 : 0;
  }
  // keep the vignette's focal length and aspect with the camera, and the dither moving
  function frameGrade(pass, camera, frame) {
    const u = pass.uniforms; u.frame.value = frame; u.aspect.value = camera.aspect; u.focal.value = 1 / Math.tan(camera.fov * Math.PI / 360);
  }

  /* ---------- cel shading: a define on the same physically based materials ---------- */
  let installed = false;
  function install(T) {
    if (installed) return; installed = true;
    T.ShaderChunk.opaque_fragment = `
#if defined( DF_TOON ) && defined( STANDARD )
{
  // bands on the reflected light only: emissive surfaces (screens, lamps) keep their picture
  vec3 dfLit = max(outgoingLight - totalEmissiveRadiance, 0.0);
  float dfL = dot(dfLit, vec3(0.2126, 0.7152, 0.0722));
  float dfX = dfL * float(DF_TOON_BANDS);
  float dfQ = (floor(dfX) + smoothstep(0.42, 0.58, fract(dfX))) / float(DF_TOON_BANDS);
  outgoingLight = dfLit * (max(dfQ, dfL * 0.55) / max(dfL, 1e-4)) + totalEmissiveRadiance;
  #ifdef DF_RIM
  float dfR = 1.0 - saturate(dot(normal, geometryViewDir));
  outgoingLight += DF_RIM * smoothstep(0.62, 0.7, dfR) * diffuseColor.rgb;
  #endif
}
#endif
` + T.ShaderChunk.opaque_fragment;
  }
  function setToon(T, root, on, o = {}) {
    install(T);
    const seen = new Set();
    root.traverse(obj => {
      const ms = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      for (const m of ms) {
        if (!m || seen.has(m) || !(m.isMeshStandardMaterial)) continue; seen.add(m);
        m.defines = m.defines || {};
        const had = 'DF_TOON' in m.defines, rim = m.defines.DF_RIM, bands = m.defines.DF_TOON_BANDS;
        if (on) { m.defines.DF_TOON = ''; m.defines.DF_TOON_BANDS = String(o.bands || 3); if (o.rim) m.defines.DF_RIM = o.rim.toFixed(3); else delete m.defines.DF_RIM; }
        else { delete m.defines.DF_TOON; delete m.defines.DF_TOON_BANDS; delete m.defines.DF_RIM; }
        if (had !== on || rim !== m.defines.DF_RIM || bands !== m.defines.DF_TOON_BANDS) m.needsUpdate = true;
      }
    });
    return seen.size;
  }

  /* ---------- outlines: edges from depth and normals, one extra scene pass ---------- */
  function edgePass(T, scene, camera, w, h, o = {}) {
    const p = new T.ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, tNormal: { value: null }, tDepth: { value: null }, resolution: { value: new T.Vector2(w, h) },
        cameraNear: { value: camera.near }, cameraFar: { value: camera.far }, color: { value: new T.Color(o.color ?? 0x15181d) },
        strength: { value: o.strength ?? 0.85 }, debug: { value: 0 }, thickness: { value: o.thickness ?? 1.0 }, depthK: { value: o.depthK ?? 0.012 }, normalK: { value: o.normalK ?? 0.35 }
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `#include <packing>
uniform sampler2D tDiffuse, tNormal, tDepth; uniform vec2 resolution; uniform float cameraNear, cameraFar, strength, thickness, depthK, normalK, debug; uniform vec3 color; varying vec2 vUv;
float vz(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  vec2 px = thickness / resolution;
  float z = vz(vUv); vec3 n = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
  float de = 0.0, ne = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = i == 0 ? vec2(px.x, 0.0) : i == 1 ? vec2(-px.x, 0.0) : i == 2 ? vec2(0.0, px.y) : vec2(0.0, -px.y);
    float zi = vz(vUv + o); de = max(de, abs(zi - z) / max(z, 1e-3));
    vec3 ni = texture2D(tNormal, vUv + o).xyz * 2.0 - 1.0; ne = max(ne, 1.0 - dot(n, ni));
  }
  float e = max(smoothstep(depthK, depthK * 2.5, de), smoothstep(normalK, normalK * 1.8, ne));
  // fade edges into the far distance so the overview does not turn to hatching
  e *= 1.0 - smoothstep(cameraFar * 0.25, cameraFar * 0.6, z);
  gl_FragColor = debug > 1.5 ? vec4(vec3(z / 10.0), 1.0) : debug > 0.5 ? vec4(vec3(e), 1.0) : vec4(mix(c.rgb, color, e * strength), c.a);
}`
    });
    const rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType });
    rt.depthTexture = new T.DepthTexture(w, h); rt.depthTexture.type = T.UnsignedIntType;
    const normalMat = new T.MeshNormalMaterial(), clear = new T.Color();
    const baseRender = p.render.bind(p);
    p.render = function (renderer, writeBuffer, readBuffer, dt, mask) {
      const ov = scene.overrideMaterial, bg = scene.background, a = renderer.getClearAlpha(); renderer.getClearColor(clear);
      const old = renderer.getRenderTarget();
      scene.overrideMaterial = normalMat; scene.background = null;
      renderer.setRenderTarget(rt); renderer.setClearColor(0x8080ff, 1); renderer.clear(); renderer.render(scene, camera);
      scene.overrideMaterial = ov; scene.background = bg; renderer.setClearColor(clear, a); renderer.setRenderTarget(old);
      const u = p.uniforms; u.tNormal.value = rt.texture; u.tDepth.value = rt.depthTexture; u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
      baseRender(renderer, writeBuffer, readBuffer, dt, mask);
    };
    p.setSize = (w2, h2) => { rt.setSize(w2, h2); p.uniforms.resolution.value.set(w2, h2); };
    const baseDispose = p.dispose ? p.dispose.bind(p) : () => {};
    p.dispose = () => { rt.dispose(); if (rt.depthTexture) rt.depthTexture.dispose(); normalMat.dispose(); baseDispose(); };
    p.isEdge = true;
    return p;
  }

  /* ---------- on-demand scripts and depth of field ---------- */
  const loaded = new Map();
  function load(src) {
    if (!loaded.has(src)) loaded.set(src, new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => { loaded.delete(src); rej(new Error('could not load ' + src)); }; document.head.appendChild(s); }));
    return loaded.get(src);
  }
  const base = (() => { const s = document.currentScript && document.currentScript.src; return s ? s.replace(/assets\/js\/vfx\/look\.js.*$/, '') : ''; })();
  const extras = () => load(base + 'assets/vendor/three/three-extras.iife.min.js');
  async function dof(T, scene, camera, o = {}) {
    await extras();
    const b = new T.X.BokehPass(scene, camera, { focus: o.focus ?? 30, aperture: o.aperture ?? 0.00012, maxblur: o.maxblur ?? 0.006 });
    b.isDof = true;
    return b;
  }
  // dispose every pass and its targets (EffectComposer.dispose frees only its own two targets)
  function disposeComposer(c) { if (!c) return; for (const p of c.passes) try { p.dispose && p.dispose(); } catch (e) { /* a pass without dispose */ } c.dispose && c.dispose(); }

  window.DFLook = { PROFILES, gradePass, applyGrade, frameGrade, install, setToon, edgePass, dof, load, extras, base, disposeComposer };
})();

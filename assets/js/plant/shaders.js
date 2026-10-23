/* Shader building blocks for the live plant.
   Ported from the verified GLSL library in gokayfem/shader-skills (MIT, https://github.com/gokayfem/shader-skills):
   the PCG integer hash (Jarzynski and Olano, JCGT 2020), quintic gradient noise and fBm, the box-filtered grid
   (after Inigo Quilez, "filterable procedurals"), the natural cos⁴ vignette and the triangular-PDF dither.
   Used in two places:
   - the epoxy floor and the concrete deck: world-space mottling, trowel marks, saw-cut joints filtered over the
     pixel footprint (no tiling, no moiré in the distance) and gloss that varies with wear;
   - the last pass of the frame: the vignette in linear light, then a ±1 LSB dither that removes banding from the
     smooth floor, the fog and the dark theme. */
(function () {
  const LIB = `
uint dfPcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float dfU(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }
// integer-valued inputs only: cell ids and pixel coordinates (no sine hash, so every GPU draws the same floor)
vec2 dfHash22(vec2 p) { ivec2 i = ivec2(floor(p)); uint a = dfPcg(uint(i.x) ^ dfPcg(uint(i.y))); return vec2(dfU(a), dfU(dfPcg(a))); }
float dfGrad(vec2 i, vec2 f) { vec2 g = dfHash22(i) * 2.0 - 1.0; return dot(g, f); }
float dfNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(dfGrad(i, f), dfGrad(i + vec2(1, 0), f - vec2(1, 0)), u.x), mix(dfGrad(i + vec2(0, 1), f - vec2(0, 1)), dfGrad(i + vec2(1, 1), f - vec2(1, 1)), u.x), u.y);
}
float dfFbm(vec2 p) {
  const mat2 R = mat2(0.8, 0.6, -0.6, 0.8);
  float s = 0.0, a = 1.0, n = 0.0;
  for (int i = 0; i < 4; i++) { s += a * dfNoise(p); n += a; a *= 0.5; p = 2.01 * (R * p) + vec2(17.13, -3.71); }
  return 1.4 * s / n;
}
// box-filtered grid lines: 1 on a line, 0 inside a cell; line width = 1/n of a cell; w = fwidth(p)
float dfGrid(vec2 p, vec2 w, float n) {
  w = max(w, 1e-4); vec2 a = p + 0.5 * w, b = p - 0.5 * w;
  vec2 i = (floor(a) + min(fract(a) * n, 1.0) - floor(b) - min(fract(b) * n, 1.0)) / (n * w);
  return 1.0 - (1.0 - i.x) * (1.0 - i.y);
}`;

  // epoxy floor and concrete deck: patch a MeshStandard/Physical material in place
  function floor(mat, o = {}) {
    const joint = o.joint || 6, line = o.line || 0.025, pool = o.pools;
    // pools of light under the high-bay fixtures (a 12 × 10.5 m grid): the floor reads lit from above, as in a hall
    if (pool) mat.userData.pool = { value: 0.2 };
    mat.onBeforeCompile = sh => {
      if (pool) sh.uniforms.dfPool = mat.userData.pool;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDfW;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvDfW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDfW;' + (pool ? 'uniform float dfPool;' : '') + LIB)
        .replace('#include <map_fragment>', `#include <map_fragment>
  vec2 dfP = vDfW.xz;
  // broad mottling (about 12 m), trowel passes (about 1 m), each fading before it aliases
  float dfPx = length(fwidth(dfP));
  float dfN1 = dfFbm(dfP * 0.085);
  float dfN2 = dfNoise(dfP * vec2(1.1, 0.35)) * (1.0 - smoothstep(0.25, 0.9, dfPx));
  vec2 dfQ = dfP / ${joint.toFixed(1)};
  float dfJ = dfGrid(dfQ + 0.5, fwidth(dfQ), ${(joint / line).toFixed(1)});
  diffuseColor.rgb *= (1.0 + 0.1 * dfN1 + 0.04 * dfN2) * (1.0 - 0.3 * dfJ);
  ${pool ? `vec2 dfL = dfP - vec2(max(12.0, floor(dfP.x / 12.0 + 0.5) * 12.0), max(10.5, floor(dfP.y / 10.5 + 0.5) * 10.5));
  float dfPoolK = exp(-dot(dfL * vec2(0.55, 0.8), dfL * vec2(0.55, 0.8)) * 0.22);
  diffuseColor.rgb *= 1.0 + dfPool * dfPoolK;` : ''}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  // worn where the mottling is light, glossy where the resin pooled; the saw cuts are matt
  roughnessFactor = clamp(roughnessFactor * (1.0 + 0.3 * dfN1 - 0.12 * dfN2) + 0.35 * dfJ, 0.3, 0.95);`);
    };
    mat.customProgramCacheKey = () => 'df-floor-' + joint + '-' + line + (pool ? '-p' : '');
    mat.needsUpdate = true;
    return mat;
  }

  // the last pass: natural vignette applied in linear light, encoded back, then a triangular-PDF dither of ±1 LSB
  function finishPass(T, amount) {
    return new T.ShaderPass({
      uniforms: { tDiffuse: { value: null }, amount: { value: amount }, focal: { value: 3.5 }, aspect: { value: 1.6 }, frame: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float amount, focal, aspect, frame; varying vec2 vUv;
${LIB}
vec3 dfToLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 dfToSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  vec2 uv = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);
  float f2 = focal * focal, k = f2 / (f2 + dot(uv, uv)); k *= k;
  vec3 s = dfToSrgb(dfToLin(clamp(c.rgb, 0.0, 1.0)) * mix(1.0, k, amount));
  vec2 r = dfHash22(floor(gl_FragCoord.xy) + 7919.0 * mod(frame, 1024.0));
  gl_FragColor = vec4(s + (r.x + r.y - 1.0) / 255.0, c.a);
}`
    });
  }


  // hazard paint: yellow and black bands at 45° in world space, box-filtered so they stay clean in the distance
  function hazard(mat) {
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDfW;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvDfW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vDfW;')
        .replace('#include <map_fragment>', `#include <map_fragment>
  // x + z + y: diagonal on the floor and on the column guards' sides alike
  float dfU = (vDfW.x + vDfW.z + vDfW.y) / 0.84;
  float dfW = fwidth(dfU);
  // box-filtered square wave: the share of the pixel that falls in a yellow band
  float dfA = dfU + 0.5 * dfW, dfB = dfU - 0.5 * dfW;
  float dfY = (floor(dfA) * 0.5 + max(fract(dfA) - 0.5, 0.0) - floor(dfB) * 0.5 - max(fract(dfB) - 0.5, 0.0)) / max(dfW, 1e-4);
  diffuseColor.rgb *= mix(vec3(0.95, 0.68, 0.02), vec3(0.03, 0.03, 0.035), clamp(dfY, 0.0, 1.0));`);
    };
    mat.customProgramCacheKey = () => 'df-hazard'; mat.needsUpdate = true; return mat;
  }

  // insulated sandwich-panel cladding: trapezoidal ribs every 25 cm (normal-perturbed, faded before they alias),
  // horizontal panel joints every 1.2 m, a slight tint per panel, and a dark clerestory band of glazing
  function cladding(mat) {
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDfW;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvDfW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vDfW;' + LIB)
        .replace('#include <map_fragment>', `#include <map_fragment>
  float dfU = (vDfW.x + vDfW.z) / 0.25, dfFw = fwidth(dfU);
  float dfS = fract(dfU), dfFade = 1.0 - smoothstep(0.25, 0.6, dfFw);
  float dfJ = 1.0 - smoothstep(0.0, max(fwidth(vDfW.y) * 1.5, 0.01), abs(fract(vDfW.y / 1.2 + 0.5) - 0.5) * 1.2);
  vec2 dfCell = floor(vec2((vDfW.x + vDfW.z) / 1.1, vDfW.y / 1.2));
  float dfTint = dfHash22(dfCell + 31.0).x;
  float dfWin = step(8.2, vDfW.y) * step(vDfW.y, 9.6);
  diffuseColor.rgb *= (0.96 + 0.06 * dfTint) * (1.0 - 0.25 * dfJ * dfFade);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.09, 0.13), dfWin);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    float dfSl = (dfS < 0.12 ? 1.0 : dfS < 0.24 ? -1.0 : 0.0) * dfFade * (1.0 - dfWin);
    vec3 dfUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    vec3 dfT = normalize(cross(dfUp, normal));
    normal = normalize(normal + dfT * dfSl * 0.55);
  }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.08, dfWin);`);
    };
    mat.customProgramCacheKey = () => 'df-cladding'; mat.needsUpdate = true; return mat;
  }

  /* machine and steel finishes, the way the showroom TV has them (there as baked normal and roughness maps, here in code,
     in world space, so merged and instanced geometry needs no UVs):
     - powder: powder-coat paint, a fine orange-peel stipple in the normal, gloss that drifts from panel to panel,
       handling marks around waist height;
     - brushed: brushed steel and aluminium, long grain along the part (the dominant horizontal axis of each face);
     - cast: cast iron and machined bases, a coarse dull grain;
     - rubber: belts, tyres and mats, a dull stipple.
     Every finish also gets grime and a contact shade where it meets a floor (the ground, the deck at FL or a
     mezzanine): the last 30 cm darken and go matt, which is what grounds a machine on the floor in a photograph.
     Each detail fades with the pixel footprint before it can alias. */
  const SURF = { powder: [0.004, 0.14, 0.05], brushed: [0.0, 0.0, 0.22], cast: [0.012, 0.2, 0.08], rubber: [0.006, 0.12, 0.04] };
  function surface(mat, kind = 'powder', o = {}) {
    const [bump, rough, grain] = SURF[kind] || SURF.powder, fl = (o.fl || 5.4).toFixed(2), grime = (o.grime ?? 1).toFixed(2);
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDfW;')
        .replace('#include <fog_vertex>', `#include <fog_vertex>
  #ifdef USE_INSTANCING
    vDfW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  #else
    vDfW = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vDfW;' + LIB + `
// the face's plane from its world normal: the two axes that lie along the face, the first one horizontal
vec2 dfPlane(vec3 p, vec3 n) { vec3 a = abs(n); return a.y > max(a.x, a.z) ? p.xz : a.x > a.z ? p.zy : p.xy; }
// height above the nearest floor below: the ground, the upper deck or a mezzanine (all at ${fl} m)
float dfAbove(float y) { float h = y > ${fl} - 0.02 ? y - ${fl} : y; return h < -0.05 ? 9.0 : max(h, 0.0); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 dfN = normalize((vec4(vNormal, 0.0) * viewMatrix).xyz);
  vec2 dfP = dfPlane(vDfW, dfN);
  float dfPx = length(fwidth(vDfW));
  // broad drift from panel to panel (about 0.8 m) and handling marks around waist height
  float dfB = 0.7 * dfNoise(dfP * 1.3 + vDfW.y * 0.7) + 0.3 * dfNoise(dfP * 3.7 - 5.0);
  float dfH = dfAbove(vDfW.y);
  float dfHand = smoothstep(0.7, 1.0, dfH) * (1.0 - smoothstep(1.2, 1.5, dfH)) * smoothstep(0.1, 0.6, dfNoise(dfP * 3.1));
  // contact shade and grime in the last 30 cm above a floor, on the sides (not on tops)
  float dfG = (1.0 - smoothstep(0.0, 0.32, dfH)) * (1.0 - abs(dfN.y)) * ${grime};
  diffuseColor.rgb *= (1.0 + 0.05 * dfB) * (1.0 - 0.42 * dfG) * (1.0 - 0.05 * dfHand);
  ${o.glass ? 'diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + 2.2 * dfG + 0.9 * smoothstep(0.2, 0.8, dfNoise(dfP * 1.7 + 3.0))));' : ''}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  {
    float dfFadeF = 1.0 - smoothstep(0.003, 0.01, dfPx);
    // brushed grain: long along the face's horizontal axis, short across it
    float dfGr = ${grain.toFixed(3)} > 0.0 ? dfNoise(vec2(dfP.x * 5.0, dfP.y * 120.0)) * (1.0 - smoothstep(0.001, 0.003, dfPx)) : 0.0;
    roughnessFactor = clamp(roughnessFactor * (1.0 + ${rough.toFixed(3)} * dfB + 0.25 * dfHand + 0.6 * dfG) + ${grain.toFixed(3)} * dfGr + 0.04 * dfFadeF * dfNoise(dfP * 40.0), 0.04, 1.0);
  }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (${bump.toFixed(4)} > 0.0) {
    // a stipple height field, bump-mapped from its screen derivatives (Mikkelsen 2010), faded with distance
    float dfFade = 1.0 - smoothstep(0.0015, 0.005, dfPx);
    float dfHt = (dfNoise(dfP * 38.0) + 0.5 * dfNoise(dfP * 83.0 + 7.0)) * ${bump.toFixed(4)} * dfFade;
    vec3 dfSp = -vViewPosition, dX = dFdx(dfSp), dY = dFdy(dfSp);
    vec3 r1 = cross(dY, normal), r2 = cross(normal, dX); float det = dot(dX, r1);
    vec3 grad = sign(det) * (dFdx(dfHt) * r1 + dFdy(dfHt) * r2);
    normal = normalize(abs(det) * normal - grad * 10.0);
  }`);
    };
    const key = 'df-surf-' + kind + '-' + fl + '-' + grime + (o.glass ? '-g' : '');
    mat.customProgramCacheKey = () => key; mat.needsUpdate = true; return mat;
  }

  // welded wire mesh for machine guarding (a 50 mm grid of 4 mm wire): the share of each pixel the wire covers becomes the
  // alpha, box-filtered, so the mesh reads as a fine grid up close and as a light tint from across the hall
  function mesh(mat, cell = 0.05, wire = 0.004) {
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDfW;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvDfW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vDfW;' + LIB)
        .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 dfN = normalize((vec4(vNormal, 0.0) * viewMatrix).xyz);
  vec2 dfP = (abs(dfN.x) > abs(dfN.z) ? vDfW.zy : vDfW.xy) / ${cell.toFixed(3)};
  float dfC = dfGrid(dfP, fwidth(dfP), ${(cell / wire).toFixed(1)});
  diffuseColor.a *= clamp(dfC, 0.0, 1.0);`);
    };
    mat.customProgramCacheKey = () => 'df-mesh-' + cell; mat.needsUpdate = true; return mat;
  }

  window.DFShaders = { LIB, floor, finishPass, hazard, cladding, surface, mesh };
})();

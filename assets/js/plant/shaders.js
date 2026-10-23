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
    const joint = o.joint || 6, line = o.line || 0.025;
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDfW;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvDfW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDfW;' + LIB)
        .replace('#include <map_fragment>', `#include <map_fragment>
  vec2 dfP = vDfW.xz;
  // broad mottling (about 12 m), trowel passes (about 1 m), each fading before it aliases
  float dfPx = length(fwidth(dfP));
  float dfN1 = dfFbm(dfP * 0.085);
  float dfN2 = dfNoise(dfP * vec2(1.1, 0.35)) * (1.0 - smoothstep(0.25, 0.9, dfPx));
  vec2 dfQ = dfP / ${joint.toFixed(1)};
  float dfJ = dfGrid(dfQ + 0.5, fwidth(dfQ), ${(joint / line).toFixed(1)});
  diffuseColor.rgb *= (1.0 + 0.1 * dfN1 + 0.04 * dfN2) * (1.0 - 0.3 * dfJ);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  // worn where the mottling is light, glossy where the resin pooled; the saw cuts are matt
  roughnessFactor = clamp(roughnessFactor * (1.0 + 0.3 * dfN1 - 0.12 * dfN2) + 0.35 * dfJ, 0.3, 0.95);`);
    };
    mat.customProgramCacheKey = () => 'df-floor-' + joint + '-' + line;
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

  window.DFShaders = { LIB, floor, finishPass };
})();

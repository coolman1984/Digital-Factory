/* Digital Factory — seeded PRNG (mulberry32) for reproducible plant simulation and UI demos. */
(function (g) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSalt(name) {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function parseSeed() {
    try {
      if (typeof location !== 'undefined' && location.search) {
        const m = location.search.match(/[?&]seed=(\d+)/);
        if (m) return parseInt(m[1], 10) >>> 0;
      }
    } catch (e) { /* no location in node */ }
    return 20261019;
  }

  function createRng(seed, salt) {
    const next = mulberry32((seed ^ salt) >>> 0);
    return {
      next,
      float: () => next(),
      chance: p => next() < p,
      range: (a, b) => a + next() * (b - a),
      int: n => (n <= 0 ? 0 : Math.floor(next() * n))
    };
  }

  const seed = parseSeed();
  const root = createRng(seed, 0);

  const api = {
    seed,
    parseSeed,
    create: createRng,
    stream: name => createRng(seed, hashSalt(name)),
    next: () => root.next(),
    float: () => root.float(),
    chance: p => root.chance(p),
    range: (a, b) => root.range(a, b),
    int: n => root.int(n)
  };

  g.DFRng = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);

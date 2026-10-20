/* Digital Factory — what-if runner for the Plant EG-01 twin.
   Plays options forward on copies of the live plant: every option (plus "nobody acts") runs in several futures that share
   the present and differ only in their random draws, so a recommendation carries a range, not a single number.
   Pure functions over PlantEngine; used by the background worker (twin-worker.js) and by tests. Simulated data. */
(function (root) {
  'use strict';

  const pct = (arr, q) => { if (!arr.length) return 0; const a = arr.slice().sort((x, y) => x - y); const i = (a.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
  const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  /* one future: copy the world, re-seed, schedule the option's commands, run, measure */
  function future(PE, snap, opt, seed, req) {
    const E = PE.restore(typeof structuredClone === 'function' ? structuredClone(snap) : snap);
    if (seed) E.reseed(seed);
    const P = E.P, t0 = P.t, m0 = E.metrics();
    const ev = { faults: [], late: [], starved: {}, floods: 0, nearMiss: 0 };
    E.on((type, d) => {
      if (type === 'fault') ev.faults.push({ id: d.id, name: d.name, t: P.t - t0, why: d.why });
      else if (type === 'order' && d.state === 'late') ev.late.push({ id: d.id, by: d.shippedAt - d.due });
    });
    for (const c of opt.cmds || []) {
      const cmd = Object.assign({ who: req.who || 'What-if' }, c);
      delete cmd.at;
      if (c.at > 0) E.exec({ type: 'at', at: t0 + c.at, cmd, who: cmd.who }); else E.exec(cmd);
    }
    const dt = req.dt || 0.5, sample = req.sample || 120;
    const series = { t: [], packed: [], oee: [], kw: [], late: [] };
    let nextS = 0;
    const end = t0 + req.horizon;
    const watch = req.watch || [];
    const watched = {};
    while (P.t < end) {
      E.step(dt);
      if (P.t - t0 >= nextS) {
        nextS += sample;
        const L = E.lateness();
        series.t.push(Math.round(P.t - t0)); series.packed.push(P.made.packedTv + P.made.packedPhone - m0.packedTv - m0.packedPhone);
        series.oee.push(+(P.kpi.oee || 0).toFixed(3)); series.kw.push(Math.round(P.kpi.kw || 0)); series.late.push(Math.round((L.sec - m0.lateSec) / 60));
        for (const id of watch) {
          const s = P.byId[id]; if (!s) continue;
          (watched[id] = watched[id] || []).push(s.state === 'starved' ? 1 : 0);
        }
      }
    }
    for (const s of P.stations) if (s.counters.starved > 0) ev.starved[s.id] = Math.round(s.counters.starved);
    const m1 = E.metrics();
    const d = k => m1[k] - m0[k];
    return {
      seed, value: E.value(m0, m1),
      packed: d('packedTv') + d('packedPhone'), packedTv: d('packedTv'), packedPhone: d('packedPhone'),
      lateMin: d('lateSec') / 60, lateOrders: d('lateOrders'), failures: d('failures'), downMin: Object.keys(m1.downSec).reduce((a, k) => a + m1.downSec[k] - m0.downSec[k], 0) / 60,
      starvedMin: d('starvedSec') / 60, kwh: d('kwh'), energyCost: d('energyCost'), demandCost: d('demandCost'), scrapCost: d('scrapCost'), repairCost: d('repairCost'), extraCost: d('extraCost'),
      oos: d('oos'), smtRepairs: d('smtRepairs'), rework: d('rework'), nearMiss: d('nearMiss'), stockouts: d('stockouts'), kwPeak: m1.kwPeak, fpy: m1.fpy, risk: m1.risk,
      faults: ev.faults, lateShipped: ev.late, series
    };
  }

  /* summarise the futures of one option */
  function summary(futures) {
    const pick = k => futures.map(f => f[k]);
    const S = {};
    for (const k of ['value', 'packed', 'packedTv', 'packedPhone', 'lateMin', 'lateOrders', 'failures', 'downMin', 'starvedMin', 'kwh', 'energyCost', 'demandCost', 'scrapCost', 'repairCost', 'extraCost', 'rework', 'nearMiss', 'stockouts', 'kwPeak', 'risk', 'fpy', 'oos', 'smtRepairs']) {
      const v = pick(k); S[k] = { mean: mean(v), p10: pct(v, 0.1), p50: pct(v, 0.5), p90: pct(v, 0.9) };
    }
    // probability that each station faults inside the horizon, and when
    const faults = {};
    futures.forEach(f => { const seen = new Set(); f.faults.forEach(x => { if (seen.has(x.id)) return; seen.add(x.id); (faults[x.id] = faults[x.id] || { name: x.name, n: 0, t: [] }).n++; faults[x.id].t.push(x.t); }); });
    for (const id in faults) { faults[id].p = faults[id].n / futures.length; faults[id].tMean = mean(faults[id].t); }
    // mean series (for the comparison chart)
    const n = Math.min(...futures.map(f => f.series.t.length));
    const series = { t: futures[0].series.t.slice(0, n) };
    for (const k of ['packed', 'oee', 'kw', 'late']) {
      series[k] = []; series[k + 'Lo'] = []; series[k + 'Hi'] = [];
      for (let i = 0; i < n; i++) { const col = futures.map(f => f.series[k][i]); series[k].push(mean(col)); series[k + 'Lo'].push(pct(col, 0.1)); series[k + 'Hi'].push(pct(col, 0.9)); }
    }
    return { n: futures.length, S, faults, series };
  }

  /* the whole request; parts lets several workers share the futures (part = list of [optionIndex, seed]) */
  function runParts(PE, snap, req, parts) {
    return parts.map(([oi, seed]) => ({ oi, seed, r: future(PE, snap, req.options[oi], seed, req) }));
  }
  function plan(req) {
    const parts = [];
    req.options.forEach((o, oi) => { for (let s = 0; s < (req.seeds || 3); s++) parts.push([oi, s]); });
    return parts;
  }
  function combine(req, results) {
    const by = req.options.map(() => []);
    for (const x of results) by[x.oi].push(x.r);
    const out = req.options.map((o, i) => Object.assign({ id: o.id, label: o.label }, summary(by[i])));
    const base = out.find(o => o.id === 'none') || out[0];
    for (const o of out) {
      o.delta = {};
      for (const k in o.S) o.delta[k] = o.S[k].mean - base.S[k].mean;
      // how often this option beats doing nothing across the shared futures
      const mine = by[out.indexOf(o)], theirs = by[out.indexOf(base)];
      let wins = 0; const ds = [];
      mine.forEach((f, i) => { if (!theirs[i]) return; const d = f.value - theirs[i].value; ds.push(d); wins += d > 500 ? 1 : d < -500 ? 0 : 0.5; });
      o.winRate = mine.length ? wins / mine.length : 0;
      // paired difference against doing nothing in the same futures: mean, spread and a one-sided lower bound
      const dm = mean(ds), sd = ds.length > 1 ? Math.sqrt(ds.reduce((a, d) => a + (d - dm) ** 2, 0) / (ds.length - 1)) : 0;
      o.paired = { mean: dm, sd, lo: dm - sd / Math.sqrt(Math.max(1, ds.length)), n: ds.length };
    }
    const best = out.filter(o => o.id !== 'none').sort((a, b) => b.S.value.mean - a.S.value.mean)[0] || null;
    return { id: req.id, horizon: req.horizon, seeds: req.seeds || 3, options: out, best: best && best.id, baseline: base.id };
  }
  function run(PE, snap, req) { return combine(req, runParts(PE, snap, req, plan(req))); }

  const WhatIf = { run, plan, runParts, combine, summary, future };
  if (typeof module !== 'undefined' && module.exports) module.exports = WhatIf;
  else root.WhatIf = WhatIf;
})(typeof window !== 'undefined' ? window : globalThis);

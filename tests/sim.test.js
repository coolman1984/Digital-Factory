#!/usr/bin/env node
'use strict';

require('../assets/js/rng.js');
require('../assets/js/sim.js');

const Sim = global.Sim || globalThis.Sim;

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function approx(a, b, eps) {
  eps = eps == null ? 1e-5 : eps;
  if (Math.abs(a - b) > eps) throw new Error(`${a} !≈ ${b} (eps ${eps})`);
}

function ledgerStateSum(L) {
  return L.run + L.plannedStop + L.starved + L.blocked + L.setup + L.down.breakdown + L.down.other;
}

function availWallTime(L) {
  const ls = L.losses;
  return L.run + ls.breakdown + ls.setupAdjust + ls.starvation + ls.operatorStop;
}

function checkOeeLine(l) {
  const L = l.ledger;
  const c = Sim.oeeFromLedger(L);
  assert(c.A >= 0 && c.A <= 1, 'A in range');
  assert(c.P >= 0 && c.P <= 1, 'P in range');
  assert(c.Q >= 0 && c.Q <= 1, 'Q in range');
  assert(c.oee >= 0 && c.oee <= 1, 'OEE in range');
  approx(c.oee, c.A * c.P * c.Q, 1e-4);
  approx(ledgerStateSum(L), L.elapsed, Math.max(1e-6, L.elapsed * 1e-6));

  approx(L.losses.minorStop + L.losses.reducedSpeed, L.slow, Math.max(1e-4, L.slow * 1e-4));

  const rejSec = (L.total - L.good) * L.idealCycle;
  approx(L.losses.productionRejects + L.losses.startupRejects, rejSec, Math.max(1e-4, rejSec * 1e-4));

  const plannedProd = Math.max(0, L.planned - L.plannedStop);
  approx(plannedProd * c.A, L.run, Math.max(1e-6, L.run * 1e-6));

  approx(availWallTime(L), plannedProd, Math.max(1e-4, plannedProd * 1e-4));
}

const t0 = Date.now();
const runA = Sim.runShiftSimulation({ hours: 2, seedSalt: 42, maxSteps: 900 });
const runB = Sim.runShiftSimulation({ hours: 2, seedSalt: 42, maxSteps: 900 });
assert(runA.out === runB.out, 'same seed salt => identical output');
assert(runA.lines[0].good === runB.lines[0].good, 'same seed salt => identical line good');

const runC = Sim.runShiftSimulation({ hours: 2, seedSalt: 43, maxSteps: 900 });
assert(runA.out !== runC.out || runA.scrap !== runC.scrap, 'different seed salt => different output');

runA.lines.forEach(checkOeeLine);

const pdm = Sim.runShiftSimulation({ hours: 15, seedSalt: 99, maxSteps: 4200, pdm: true, vision: false, energy: false });
const base = Sim.runShiftSimulation({ hours: 15, seedSalt: 99, maxSteps: 4200, pdm: false, vision: false, energy: false });
assert(pdm.oee > base.oee + 0.002, 'PdM should lift OEE meaningfully');

const minorRun = Sim.runShiftSimulation({
  hours: 180 / 3600,
  seedSalt: 77,
  maxSteps: 80,
  forceMinor: { lineId: 'L1', plantSeconds: 200 }
});
const minorL1 = minorRun.lines.find(l => l.id === 'L1');
assert(minorL1.ledger.losses.minorStop > 0, 'forced minor stop books loss time');
assert(minorL1.good === 0 && minorL1.produced === 0, 'forced minor stop yields no production');
assert(minorL1.ledger.run >= minorL1.ledger.losses.minorStop, 'minor stop time stays in performance run clock');
const minorOee = Sim.oeeFromLedger(minorL1.ledger);
assert(minorOee.A > 0.5, 'minor stop reduces performance, not availability');

const overlapSlices = Sim.lineStopSlices(2, [[0, 1]], [[0, 1]]);
assert(overlapSlices.run === 1 && overlapSlices.breakdown === 1 && overlapSlices.minor === 0, 'overlapping down+minor union: one breakdown second, one run second');
assert(Sim.intervalUnionLength([[0, 1], [0, 1]]) === 1, 'union of identical stop intervals');
const overlapProd = 2 - Sim.intervalUnionLength([[0, 1], [0, 1]]);
assert(overlapProd === 1, 'production window uses stop union not double subtract');

assert(Sim.controlPreviewCacheKey('L1', 1.11, 1.1) !== Sim.controlPreviewCacheKey('L1', 1.11, 1.11), 'preview cache keys include baseline speed');

const deb = Sim.createPerLineDebounce(() => {});
deb.schedule('L1', 50);
deb.schedule('L2', 50);
assert(deb.pendingCount() === 2, 'per-line debounce keeps both line timers');

const cacheOpt = { hours: 1, maxSteps: 200, seedSalt: 12345 };
const c1 = Sim.runShiftSimulationCached(cacheOpt);
const c2 = Sim.runShiftSimulationCached(cacheOpt);
assert(c1.out === c2.out, 'shift simulation cache returns identical results');
assert(Sim.shiftSimCacheKey(cacheOpt) === Sim.shiftSimCacheKey(Object.assign({}, cacheOpt)), 'shift cache key stable for same params');

const l3Headless = Sim.runShiftSimulation({ hours: 15, seedSalt: 11, maxSteps: 4200 });
const l3 = l3Headless.lines.find(l => l.id === 'L3');
assert(l3.ledger.losses.starvation < 12000, 'headless run keeps L3 fed (AGV callbacks)');
assert(l3.good > 800, 'headless L3 still produces');

const reqA = Sim.dailyRequirement('L1', 100);
const reqB = Sim.dailyRequirement('L1', 100);
assert(reqA === reqB, 'daily requirement stable');
approx(reqA, 180 * Sim.PLAN_DAY_HOURS * Sim.LINE_REQ.L1, 1e-6);
const cap1 = Sim.runShiftSimulation({ hours: 7.5, seedSalt: 5, maxSteps: 2000 }).out;
const cap3 = Sim.runShiftSimulation({ hours: 22.5, seedSalt: 5, maxSteps: 4200 }).out;
assert(cap3 > cap1, 'more shift hours increases capacity');
assert(reqA === Sim.dailyRequirement('L1', 100), 'demand independent of shift count');

pdm.lines.forEach(checkOeeLine);

const elapsed = Date.now() - t0;
assert(elapsed < 12000, 'headless runs complete in reasonable time (' + elapsed + ' ms)');

console.log('sim.test.js: all checks passed (' + elapsed + ' ms)');

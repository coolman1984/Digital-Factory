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
  return L.run + L.plannedStop + L.starved + L.blocked + L.slow + L.down.breakdown + L.down.other;
}

function checkOeeLine(l) {
  const L = l.ledger;
  const c = Sim.oeeFromLedger(L);
  assert(c.A >= 0 && c.A <= 1, 'A in range');
  assert(c.P >= 0 && c.P <= 1, 'P in range');
  assert(c.Q >= 0 && c.Q <= 1, 'Q in range');
  assert(c.oee >= 0 && c.oee <= 1, 'OEE in range');
  approx(c.oee, c.A * c.P * c.Q, 1e-4);
  approx(ledgerStateSum(L), L.elapsed, Math.max(0.5, L.elapsed * 0.02));
}

const t0 = Date.now();
const runA = Sim.runShiftSimulation({ hours: 2, seedSalt: 42, maxSteps: 900 });
const runB = Sim.runShiftSimulation({ hours: 2, seedSalt: 42, maxSteps: 900 });
assert(runA.out === runB.out, 'same seed salt => identical output');
assert(runA.lines[0].good === runB.lines[0].good, 'same seed salt => identical line good');

const runC = Sim.runShiftSimulation({ hours: 2, seedSalt: 43, maxSteps: 900 });
assert(runA.out !== runC.out || runA.scrap !== runC.scrap, 'different seed salt => different output');

runA.lines.forEach(checkOeeLine);

const elapsed = Date.now() - t0;
assert(elapsed < 8000, 'headless runs complete in reasonable time (' + elapsed + ' ms)');

console.log('sim.test.js: all checks passed (' + elapsed + ' ms)');

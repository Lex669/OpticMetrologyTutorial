import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceScan, AXIAL_FWHM_AIR, AXIAL_FWHM_SAMPLE, beginScan, interfacePositions, makeTrace, OPTICS, signalAt } from '../src/physics.ts';

test('three physical interfaces map to refractive-index-scaled mirror positions', () => {
  assert.deepEqual(interfacePositions(0), [50, 106, 162]);
  const shifted = interfacePositions(12);
  assert.deepEqual(shifted, [62, 118, 174]);
  assert.equal(shifted[2] - shifted[1], OPTICS.index * 40);
  for (const sample of [-20, 20]) {
    const positions = interfacePositions(sample);
    assert.ok(positions[0] > 0 && positions[2] < 200);
  }
});

test('moving the mirror by one micron changes roundtrip OPD by two microns', () => {
  const first = signalAt(50, 0).contributions[0];
  const mirrorMoved = signalAt(51, 0).contributions[0];
  const sampleMoved = signalAt(50, 1).contributions[0];
  assert.equal(first.opd, 0);
  assert.equal(mirrorMoved.opd, 2);
  assert.equal(sampleMoved.opd, -2);
});

test('coherence gate FWHM and carrier are consistent with the Gaussian spectrum', () => {
  const center = interfacePositions(0)[0];
  assert.ok(Math.abs(signalAt(center, 0).envelope - 1) < 1e-10);
  assert.ok(Math.abs(signalAt(center + AXIAL_FWHM_AIR / 2, 0).envelope - 0.5) < 1e-10);
  const quarterFringe = signalAt(center + OPTICS.wavelength / 8, 0);
  assert.ok(Math.abs(quarterFringe.raw) < 1e-10);
  assert.ok(Math.abs(AXIAL_FWHM_SAMPLE - 4.5545) < 0.01);
});

test('all three envelope peaks are recovered at their expected depth coordinates', () => {
  const trace = makeTrace(7);
  interfacePositions(7).forEach((center, index) => {
    const nearby = trace.filter(point => Math.abs(point.x - center) < 12);
    const peak = nearby.reduce((best, point) => point.envelope > best.envelope ? point : best);
    assert.ok(Math.abs(peak.x - center) < 0.05);
    assert.ok(Math.abs(peak.envelope - OPTICS.amplitudes[index]) < 0.001);
  });
  trace.forEach(point => assert.ok(Math.abs(point.raw) <= point.envelope + 1e-12));
});

test('scanning preserves contiguous acquisitions, pauses, stops and restarts correctly', () => {
  const first = beginScan(0, null);
  const midway = advanceScan(first, 2, 20);
  assert.deepEqual(midway, { reference: 40, range: { from: 0, to: 40 }, running: true });
  const paused = { ...midway, running: false };
  assert.deepEqual(advanceScan(paused, 100, 20), paused);
  assert.deepEqual(beginScan(paused.reference, paused.range).range, paused.range);
  const manualJump = beginScan(100, paused.range);
  assert.deepEqual(manualJump.range, { from: 100, to: 100 });
  const end = advanceScan(manualJump, 10, 20);
  assert.deepEqual(end, { reference: 200, range: { from: 100, to: 200 }, running: false });
  assert.deepEqual(beginScan(end.reference, end.range), first);
});

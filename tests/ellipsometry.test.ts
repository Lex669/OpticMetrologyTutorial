import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzerIntensity, DEFAULT_ELLIPSOMETRY, FILM, filmReflection, fresnelInterface, magnitudeSquared, simulateEllipsometry } from '../src/ellipsometryPhysics.ts';

test('zero film thickness reduces exactly to the air-substrate Fresnel interface', () => {
  for (const angle of [0, 45, 65, 80]) {
    const effective = filmReflection(0, angle);
    const bare = fresnelInterface(1, FILM.substrateIndex, Math.sin(angle * Math.PI / 180));
    assert.ok(Math.abs(effective.rp.re - bare.p) < 1e-12);
    assert.ok(Math.abs(effective.rs.re - bare.s) < 1e-12);
    assert.ok(Math.abs(effective.rp.im) < 1e-12 && Math.abs(effective.rs.im) < 1e-12);
  }
});

test('quarter-wave index-matched coating eliminates normal-incidence reflection', () => {
  const index = Math.sqrt(FILM.substrateIndex);
  const reflection = filmReflection(FILM.wavelength / (4 * index), 0, FILM.wavelength, index);
  assert.ok(magnitudeSquared(reflection.rp) < 1e-25);
  assert.ok(magnitudeSquared(reflection.rs) < 1e-25);
});

test('lossless film reflection is passive and periodic in optical film thickness', () => {
  const cosFilm = Math.sqrt(1 - (Math.sin(65 * Math.PI / 180) / FILM.filmIndex) ** 2);
  const period = FILM.wavelength / (2 * FILM.filmIndex * cosFilm);
  const first = filmReflection(120, 65), repeated = filmReflection(120 + period, 65);
  for (const name of ['rp', 'rs'] as const) { assert.ok(Math.abs(first[name].re - repeated[name].re) < 1e-12); assert.ok(Math.abs(first[name].im - repeated[name].im) < 1e-12); }
  for (const d of [0, 50, 120, 300, 500]) for (const angle of [45, 65, 80]) { const r = filmReflection(d, angle); assert.ok(magnitudeSquared(r.rp) <= 1); assert.ok(magnitudeSquared(r.rs) <= 1); }
});

test('linear analyzer projections conserve orthogonal intensity and repeat every 180 degrees', () => {
  const { rp, rs } = filmReflection(120, 65);
  const reflected = (magnitudeSquared(rp) + magnitudeSquared(rs)) / 2;
  assert.ok(Math.abs(analyzerIntensity(rp, rs, 0) - magnitudeSquared(rp) / 2) < 1e-12);
  assert.ok(Math.abs(analyzerIntensity(rp, rs, 90) - magnitudeSquared(rs) / 2) < 1e-12);
  for (const angle of [0, 15, 45, 80, 120]) {
    const intensity = analyzerIntensity(rp, rs, angle);
    assert.ok(Math.abs(intensity - analyzerIntensity(rp, rs, angle + 180)) < 1e-12);
    assert.ok(Math.abs(intensity + analyzerIntensity(rp, rs, angle + 90) - reflected) < 1e-12);
    assert.ok(intensity >= 0 && intensity <= reflected);
  }
});

test('rotating the analyzer leaves Psi and Delta unchanged and cannot resolve the phase sign', () => {
  const result = simulateEllipsometry(DEFAULT_ELLIPSOMETRY);
  const rotated = simulateEllipsometry({ ...DEFAULT_ELLIPSOMETRY, analyzer: 143 });
  assert.equal(result.psi, rotated.psi); assert.equal(result.delta, rotated.delta);
  const pConjugate = { re: result.rp.re, im: -result.rp.im }, sConjugate = { re: result.rs.re, im: -result.rs.im };
  for (const angle of [0, 45, 90, 160]) assert.ok(Math.abs(analyzerIntensity(result.rp, result.rs, angle) - analyzerIntensity(pConjugate, sConjugate, angle)) < 1e-12);
});

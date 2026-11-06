export type Complex = { re: number; im: number };
export const complex = (re: number, im = 0): Complex => ({ re, im });
export const add = (a: Complex, b: Complex): Complex => complex(a.re + b.re, a.im + b.im);
export const multiply = (a: Complex, b: Complex): Complex => complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const magnitudeSquared = (a: Complex): number => a.re ** 2 + a.im ** 2;
export const divide = (a: Complex, b: Complex): Complex => {
  const denominator = magnitudeSquared(b);
  return complex((a.re * b.re + a.im * b.im) / denominator, (a.im * b.re - a.re * b.im) / denominator);
};
export const FILM = { wavelength: 632.8, ambientIndex: 1, filmIndex: 1.46, substrateIndex: 3.88, polarizerAngle: 45 } as const;
export type EllipsometrySettings = { thickness: number; incidence: number; analyzer: number };
export const DEFAULT_ELLIPSOMETRY: EllipsometrySettings = { thickness: 120, incidence: 65, analyzer: 45 };
const radians = (degrees: number) => degrees * Math.PI / 180;

export function fresnelInterface(nIn: number, nOut: number, conservedSine: number) {
  const ci = Math.sqrt(1 - (conservedSine / nIn) ** 2);
  const ct = Math.sqrt(1 - (conservedSine / nOut) ** 2);
  return { s: (nIn * ci - nOut * ct) / (nIn * ci + nOut * ct), p: (nOut * ci - nIn * ct) / (nOut * ci + nIn * ct) };
}

/** Single isotropic, lossless film. Time convention exp(-iωt), propagation exp(+ikz). */
export function filmReflection(thickness: number, incidence: number, wavelength: number = FILM.wavelength, nFilm: number = FILM.filmIndex, nSubstrate: number = FILM.substrateIndex) {
  const q = FILM.ambientIndex * Math.sin(radians(incidence));
  const first = fresnelInterface(FILM.ambientIndex, nFilm, q);
  const second = fresnelInterface(nFilm, nSubstrate, q);
  const cosFilm = Math.sqrt(1 - (q / nFilm) ** 2);
  const beta = 2 * Math.PI * nFilm * thickness * cosFilm / wavelength;
  const propagation = complex(Math.cos(2 * beta), Math.sin(2 * beta));
  const effective = (r01: number, r12: number) => divide(add(complex(r01), multiply(complex(r12), propagation)), add(complex(1), multiply(complex(r01 * r12), propagation)));
  return { rp: effective(first.p, second.p), rs: effective(first.s, second.s), beta };
}

export function analyzerIntensity(rp: Complex, rs: Complex, analyzer: number) {
  const c = Math.cos(radians(analyzer)), s = Math.sin(radians(analyzer));
  // The fixed 45° polarizer gives incident p/s amplitudes 1/sqrt(2).
  return magnitudeSquared(complex((c * rp.re + s * rs.re) / Math.SQRT2, (c * rp.im + s * rs.im) / Math.SQRT2));
}

export function simulateEllipsometry(settings: EllipsometrySettings) {
  const { rp, rs, beta } = filmReflection(settings.thickness, settings.incidence);
  const p = Math.sqrt(magnitudeSquared(rp)), s = Math.sqrt(magnitudeSquared(rs));
  const psi = Math.atan2(p, s) * 180 / Math.PI;
  const delta = ((Math.atan2(rp.im, rp.re) - Math.atan2(rs.im, rs.re)) * 180 / Math.PI % 360 + 360) % 360;
  const phaseDefined = p * s > 1e-10;
  const norm = Math.max(p, s, 1e-10);
  const ellipse = Array.from({ length: 241 }, (_, i) => {
    const t = i / 240 * 2 * Math.PI;
    return { p: p / norm * Math.cos(t - radians(delta)), s: s / norm * Math.cos(t) };
  });
  const intensity = analyzerIntensity(rp, rs, settings.analyzer);
  const reflectedPower = (p ** 2 + s ** 2) / 2;
  const curve = Array.from({ length: 361 }, (_, i) => ({ angle: i / 2, intensity: analyzerIntensity(rp, rs, i / 2) }));
  const maximum = Math.max(...curve.map(point => point.intensity));
  return { settings: { ...settings }, rp, rs, beta, psi, delta, phaseDefined, ellipse, intensity, reflectedPower, maximum, curve, pAmplitude: p, sAmplitude: s };
}

export type EllipsometryResult = ReturnType<typeof simulateEllipsometry>;

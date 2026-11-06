/** All lengths are in µm. Reference position is displacement from a balanced baseline. */
export const OPTICS = {
  wavelength: 0.85,
  bandwidth: 0.05,
  index: 1.4,
  surfaceOffset: 50,
  minReference: 0,
  maxReference: 200,
  minSample: -20,
  maxSample: 20,
  depths: [0, 40, 80],
  amplitudes: [1, 0.7, 0.48],
} as const;

// Gaussian source: FWHM of the envelope in one-way air-depth coordinates.
export const AXIAL_FWHM_AIR = (2 * Math.log(2) / Math.PI) * OPTICS.wavelength ** 2 / OPTICS.bandwidth;
export const AXIAL_FWHM_SAMPLE = AXIAL_FWHM_AIR / OPTICS.index;
export const TRACE_COUNT = 4097;

export function interfacePositions(sample: number): number[] {
  return OPTICS.depths.map(depth => OPTICS.surfaceOffset + sample + OPTICS.index * depth);
}

export function signalAt(reference: number, sample: number) {
  let real = 0;
  let imaginary = 0;
  const contributions = interfacePositions(sample).map((center, i) => {
    const opd = 2 * (reference - center);
    const envelope = OPTICS.amplitudes[i] * Math.exp(-4 * Math.log(2) * (opd / (2 * AXIAL_FWHM_AIR)) ** 2);
    const phase = 2 * Math.PI * opd / OPTICS.wavelength;
    real += envelope * Math.cos(phase);
    imaginary += envelope * Math.sin(phase);
    return { opd, envelope };
  });
  return { raw: real, envelope: Math.hypot(real, imaginary), contributions };
}

export function nearestInterface(reference: number, sample: number) {
  const positions = interfacePositions(sample);
  return positions.reduce((best, position, i) => Math.abs(reference - position) < Math.abs(reference - positions[best]) ? i : best, 0);
}

export function makeTrace(sample: number) {
  return Array.from({ length: TRACE_COUNT }, (_, i) => {
    const x = i / (TRACE_COUNT - 1) * OPTICS.maxReference;
    return { x, ...signalAt(x, sample) };
  });
}

export type ScanRange = { from: number; to: number } | null;
export type ScanState = { reference: number; range: ScanRange; running: boolean };

export function beginScan(reference: number, range: ScanRange): ScanState {
  const start = reference >= OPTICS.maxReference ? OPTICS.minReference : reference;
  const nextRange = range && Math.abs(range.to - start) < 0.01 ? range : { from: start, to: start };
  return { reference: start, range: nextRange, running: true };
}

export function advanceScan(state: ScanState, elapsed: number, speed: number): ScanState {
  if (!state.running) return state;
  const reference = Math.min(OPTICS.maxReference, state.reference + Math.max(0, elapsed) * speed);
  return { reference, range: { from: state.range?.from ?? state.reference, to: reference }, running: reference < OPTICS.maxReference };
}

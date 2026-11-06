import { interfacePositions, OPTICS } from './physics';

export type SpectralSettings = { sample: number; bandwidth: number; pixels: number; hann: boolean };
export const DEFAULT_SPECTRAL: SpectralSettings = { sample: 0, bandwidth: 50, pixels: 1024, hann: false };
export const SPECTROMETER = { minWavelength: 750, maxWavelength: 950, center: 850, sampleField: 0.07 } as const;

/** In-place radix-2 FFT; forward transform uses exp(-2πijk/N). */
export function fft(real: Float64Array, imaginary: Float64Array) {
  const n = real.length;
  if (n < 2 || (n & (n - 1)) !== 0 || imaginary.length !== n) throw new Error('FFT requires equally sized power-of-two arrays');
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [real[i], real[j]] = [real[j], real[i]]; [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]]; }
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = -2 * Math.PI / size;
    const wr = Math.cos(angle), wi = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let ur = 1, ui = 0;
      for (let j = 0; j < size / 2; j++) {
        const even = start + j, odd = even + size / 2;
        const tr = ur * real[odd] - ui * imaginary[odd];
        const ti = ur * imaginary[odd] + ui * real[odd];
        real[odd] = real[even] - tr; imaginary[odd] = imaginary[even] - ti;
        real[even] += tr; imaginary[even] += ti;
        const nextReal = ur * wr - ui * wi;
        ui = ur * wi + ui * wr; ur = nextReal;
      }
    }
  }
}

export function simulateSpectralOCT(settings: SpectralSettings) {
  const { sample, bandwidth, pixels: n, hann } = settings;
  if (![512, 1024, 2048].includes(n)) throw new Error('Unsupported spectrometer pixel count');
  const centers = interfacePositions(sample);
  const field = SPECTROMETER.sampleField;
  const backgroundFactor = 1 + OPTICS.amplitudes.reduce((sum, amplitude) => sum + (field * amplitude) ** 2, 0);
  const spectrum = Array.from({ length: n }, (_, i) => {
    const wavelength = SPECTROMETER.minWavelength + i / (n - 1) * (SPECTROMETER.maxWavelength - SPECTROMETER.minWavelength);
    const k = 2 * Math.PI / (wavelength / 1000);
    const source = Math.exp(-4 * Math.log(2) * ((wavelength - SPECTROMETER.center) / bandwidth) ** 2);
    const crossTerm = centers.reduce((sum, center, j) => sum + OPTICS.amplitudes[j] * Math.cos(2 * k * center), 0);
    const background = source * backgroundFactor;
    // Strong-reference approximation: omit weak sample-sample interference, as in the TD model.
    const intensity = background + 2 * field * source * crossTerm;
    return { wavelength, k, source, intensity, background };
  });
  // Camera samples are uniform in wavelength; actually interpolate to uniform k before the FFT.
  const reversed = [...spectrum].reverse();
  const kMin = reversed[0].k, kMax = reversed[n - 1].k;
  const dk = (kMax - kMin) / (n - 1);
  const fftLength = 4 * n;
  const real = new Float64Array(fftLength), imaginary = new Float64Array(fftLength);
  const resampled = [] as { k: number; ac: number }[];
  let cursor = 0, coherentGain = 0;
  for (let i = 0; i < n; i++) {
    const k = kMin + i * dk;
    while (cursor < n - 2 && reversed[cursor + 1].k < k) cursor++;
    const first = reversed[cursor], second = reversed[cursor + 1];
    const fraction = Math.max(0, Math.min(1, (k - first.k) / (second.k - first.k)));
    const ac1 = (first.intensity - first.background) / (2 * field);
    const ac2 = (second.intensity - second.background) / (2 * field);
    const ac = ac1 + fraction * (ac2 - ac1);
    const source = first.source + fraction * (second.source - first.source);
    const window = hann ? 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)) : 1;
    real[i] = ac * window;
    coherentGain += source * window;
    resampled.push({ k, ac });
  }
  fft(real, imaginary);
  const depth = Array.from({ length: fftLength / 2 }, (_, i) => ({ x: Math.PI * i / (fftLength * dk), amplitude: 2 * Math.hypot(real[i], imaginary[i]) / coherentGain }));
  const peaks = centers.map((expected, i) => {
    const region = depth.filter(point => Math.abs(point.x - expected) < 18);
    const peak = region.reduce((best, point) => point.amplitude > best.amplitude ? point : best);
    const index = depth.indexOf(peak);
    // Local log-parabolic interpolation refines the sampled FFT maximum without injecting the known depth.
    const left = Math.log(Math.max(depth[index - 1]?.amplitude ?? peak.amplitude, 1e-15));
    const middle = Math.log(Math.max(peak.amplitude, 1e-15));
    const right = Math.log(Math.max(depth[index + 1]?.amplitude ?? peak.amplitude, 1e-15));
    const denominator = left - 2 * middle + right;
    const shift = Math.abs(denominator) > 1e-14 ? Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / denominator)) : 0;
    const measured = peak.x + shift * Math.PI / (fftLength * dk);
    return { interface: i, expected, measured, amplitude: peak.amplitude, sampleDepth: (measured - OPTICS.surfaceOffset - sample) / OPTICS.index };
  });
  const axialResolution = (2 * Math.log(2) / Math.PI) * 0.85 ** 2 / (bandwidth / 1000);
  return { spectrum, resampled, depth, peaks, centers, settings: { ...settings }, axialResolution, nyquistDepth: Math.PI / (2 * dk) };
}

export type SpectralResult = ReturnType<typeof simulateSpectralOCT>;

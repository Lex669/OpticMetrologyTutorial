import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SPECTRAL, fft, simulateSpectralOCT } from '../src/spectralPhysics.ts';

test('radix-2 FFT agrees with an independent direct DFT including complex input', () => {
  const inputReal = [2, -1, 0, 4, 3, 1, -2, 0.5], inputImaginary = [0, 1, -2, 0, 0.5, 0, 1, -1];
  const real = Float64Array.from(inputReal), imaginary = Float64Array.from(inputImaginary);
  fft(real, imaginary);
  for (let k = 0; k < 8; k++) {
    let re = 0, im = 0;
    for (let j = 0; j < 8; j++) { const phase = -2 * Math.PI * j * k / 8; re += inputReal[j] * Math.cos(phase) - inputImaginary[j] * Math.sin(phase); im += inputReal[j] * Math.sin(phase) + inputImaginary[j] * Math.cos(phase); }
    assert.ok(Math.abs(real[k] - re) < 1e-12); assert.ok(Math.abs(imaginary[k] - im) < 1e-12);
  }
});

test('FFT reconstructs three interfaces from sampled spectra over the full sample travel', () => {
  for (const sample of [-20, 0, 20]) {
    const result = simulateSpectralOCT({ ...DEFAULT_SPECTRAL, sample });
    assert.ok(result.spectrum.every(point => point.intensity >= 0));
    result.peaks.forEach((peak, i) => {
      assert.ok(Math.abs(peak.measured - (50 + sample + 1.4 * i * 40)) < 0.5);
      assert.ok(Math.abs(peak.sampleDepth - 40 * i) < 0.4);
    });
  }
});

test('spectrometer k resampling is uniform and more pixels increase the Nyquist depth', () => {
  const low = simulateSpectralOCT({ ...DEFAULT_SPECTRAL, pixels: 512 });
  const high = simulateSpectralOCT({ ...DEFAULT_SPECTRAL, pixels: 1024 });
  const step = low.resampled[1].k - low.resampled[0].k;
  low.resampled.slice(1).forEach((point, i) => assert.ok(Math.abs(point.k - low.resampled[i].k - step) < 1e-12));
  assert.ok(Math.abs(high.nyquistDepth / low.nyquistDepth - 2) < 0.01);
});

function firstPeakFwhm(result: ReturnType<typeof simulateSpectralOCT>) {
  const peak = result.peaks[0];
  const above = result.depth.filter(point => Math.abs(point.x - peak.measured) < 22 && point.amplitude >= peak.amplitude / 2);
  return above[above.length - 1].x - above[0].x;
}

test('broader source narrows the reconstructed axial response; Hann apodization broadens it', () => {
  const narrow = simulateSpectralOCT({ ...DEFAULT_SPECTRAL, bandwidth: 20 });
  const wide = simulateSpectralOCT({ ...DEFAULT_SPECTRAL, bandwidth: 80 });
  const windowed = simulateSpectralOCT({ ...DEFAULT_SPECTRAL, bandwidth: 80, hann: true });
  assert.ok(firstPeakFwhm(wide) < firstPeakFwhm(narrow) / 2);
  assert.ok(firstPeakFwhm(windowed) >= firstPeakFwhm(wide));
});

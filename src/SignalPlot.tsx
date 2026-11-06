import { useEffect, useMemo, useRef } from 'react';
import { interfacePositions, makeTrace, OPTICS, signalAt } from './physics';
import type { ScanRange } from './physics';

export default function SignalPlot({ reference, sample, range, zoom }: { reference: number; sample: number; range: ScanRange; zoom: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const trace = useMemo(() => makeTrace(sample), [sample]);
  useEffect(() => {
    const element = canvas.current!;
    const draw = () => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      element.width = rect.width * dpr;
      element.height = rect.height * dpr;
      const ctx = element.getContext('2d')!;
      ctx.scale(dpr, dpr);
      const w = rect.width, h = rect.height;
      const left = 32, top = 27, right = w - 12, bottom = h - 30;
      const low = zoom ? Math.max(0, Math.min(182, reference - 9)) : 0;
      const high = zoom ? low + 18 : OPTICS.maxReference;
      const x = (value: number) => left + (value - low) / (high - low) * (right - left);
      const y = (value: number) => top + (1.12 - value) / 2.24 * (bottom - top);
      ctx.clearRect(0, 0, w, h);
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      [1, 0.5, 0, -0.5, -1].forEach(value => {
        ctx.strokeStyle = value === 0 ? '#cdd7d5' : '#edf1f0';
        ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke();
        ctx.fillStyle = '#91a09b'; ctx.fillText(String(value), left - 8, y(value) + 3);
      });
      ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const value = low + i * (high - low) / 4;
        ctx.strokeStyle = '#edf1f0'; ctx.beginPath(); ctx.moveTo(x(value), top); ctx.lineTo(x(value), bottom); ctx.stroke();
        ctx.fillStyle = '#91a09b'; ctx.fillText(value.toFixed(zoom ? 1 : 0), x(value), bottom + 16);
      }
      const centers = interfacePositions(sample);
      const colors = ['#168579', '#5796b9', '#a68ac3'];
      centers.forEach((center, i) => {
        if (center < low || center > high) return;
        ctx.fillStyle = colors[i] + '09'; ctx.fillRect(x(center - 5), top, x(center + 5) - x(center - 5), bottom - top);
        ctx.setLineDash([3, 4]); ctx.strokeStyle = colors[i] + '80'; ctx.beginPath(); ctx.moveTo(x(center), top); ctx.lineTo(x(center), bottom); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = colors[i]; ctx.fillText(` ${['①', '②', '③'][i]} `, x(center), top - 9);
      });
      ctx.save(); ctx.beginPath(); ctx.rect(left, top - 1, right - left, bottom - top + 2); ctx.clip();
      if (range && range.to > range.from) {
        ctx.fillStyle = '#15857705'; ctx.fillRect(x(range.from), top, x(range.to) - x(range.from), bottom - top);
        const points = trace.filter(p => p.x >= range.from && p.x <= range.to && p.x >= low - 0.1 && p.x <= high + 0.1);
        const line = (value: 'raw' | 'envelope', color: string, width: number) => {
          ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
          points.forEach((point, i) => { if (i === 0) ctx.moveTo(x(point.x), y(point[value])); else ctx.lineTo(x(point.x), y(point[value])); });
          ctx.stroke();
        };
        line('raw', '#7098ad', zoom ? 1.1 : 0.8);
        line('envelope', '#147e70', 2);
      }
      ctx.strokeStyle = '#de9b4d'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x(reference), top); ctx.lineTo(x(reference), bottom); ctx.stroke(); ctx.setLineDash([]);
      const instantaneous = signalAt(reference, sample);
      ctx.fillStyle = '#7098ad'; ctx.beginPath(); ctx.arc(x(reference), y(instantaneous.raw), 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#147e70'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x(reference), y(instantaneous.envelope), 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#c98836'; ctx.beginPath(); ctx.moveTo(x(reference) - 4, bottom + 1); ctx.lineTo(x(reference) + 4, bottom + 1); ctx.lineTo(x(reference), bottom - 5); ctx.fill();
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [reference, sample, range, zoom, trace]);
  return <canvas ref={canvas} className="signal-canvas" role="img" aria-label={`干涉信号与包络，当前参考镜位置 ${reference.toFixed(1)} 微米。${range ? `已采集 ${range.from.toFixed(1)} 至 ${range.to.toFixed(1)} 微米。` : '等待开始扫描。'}三个预期界面位置 ${interfacePositions(sample).map(x => x.toFixed(1)).join('、')} 微米。`} />;
}

import { useEffect, useRef } from 'react';

export type PlotSeries = { label: string; color: string; points: readonly { x: number; y: number }[]; dashed?: boolean; fill?: boolean };
export default function ScientificPlot({ label, series, xRange, yRange, annotations = [], cursor, formatX = x => String(Math.round(x)), formatY = y => String(Number(y.toFixed(1))) }: {
  label: string; series: PlotSeries[]; xRange: [number, number]; yRange: [number, number]; annotations?: { x: number; label: string; color: string }[]; cursor?: { x: number; y: number }; formatX?: (value: number) => string; formatY?: (value: number) => string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current!;
    const draw = () => {
      const { width: w, height: h } = element.getBoundingClientRect();
      if (!w || !h) return;
      const dpr = Math.min(devicePixelRatio, 2);
      element.width = Math.round(w * dpr); element.height = Math.round(h * dpr);
      const ctx = element.getContext('2d')!; ctx.scale(dpr, dpr);
      const left = 32, right = w - 12, top = annotations.length ? 20 : 10, bottom = h - 21;
      const x = (v: number) => left + (v - xRange[0]) / (xRange[1] - xRange[0]) * (right - left);
      const y = (v: number) => bottom - (v - yRange[0]) / (yRange[1] - yRange[0]) * (bottom - top);
      ctx.clearRect(0, 0, w, h); ctx.font = '10px ui-monospace, monospace'; ctx.lineWidth = 1;
      for (let i = 0; i <= 2; i++) {
        const value = yRange[0] + (yRange[1] - yRange[0]) * i / 2;
        ctx.strokeStyle = '#eaf0eb'; ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke();
        ctx.textAlign = 'right'; ctx.fillStyle = '#91a09b'; ctx.fillText(formatY(value), left - 6, y(value) + 3);
      }
      for (let i = 0; i <= 4; i++) {
        const value = xRange[0] + (xRange[1] - xRange[0]) * i / 4;
        ctx.strokeStyle = '#f0f3ef'; ctx.beginPath(); ctx.moveTo(x(value), top); ctx.lineTo(x(value), bottom); ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillStyle = '#91a09b'; ctx.fillText(formatX(value), x(value), bottom + 15);
      }
      annotations.forEach(item => {
        if (item.x < xRange[0] || item.x > xRange[1]) return;
        ctx.setLineDash([3, 4]); ctx.strokeStyle = item.color + '70'; ctx.beginPath(); ctx.moveTo(x(item.x), top); ctx.lineTo(x(item.x), bottom); ctx.stroke(); ctx.setLineDash([]);
        ctx.textAlign = 'center'; ctx.fillStyle = item.color; ctx.fillText(item.label, x(item.x), top - 6);
      });
      ctx.save(); ctx.beginPath(); ctx.rect(left, top - 1, right - left, bottom - top + 2); ctx.clip();
      series.forEach(line => {
        ctx.beginPath(); ctx.strokeStyle = line.color; ctx.lineWidth = line.dashed ? 1 : 1.5; ctx.setLineDash(line.dashed ? [3, 4] : []);
        let first = true;
        line.points.forEach(point => { if (point.x < xRange[0] || point.x > xRange[1]) return; if (first) { ctx.moveTo(x(point.x), y(point.y)); first = false; } else ctx.lineTo(x(point.x), y(point.y)); });
        ctx.stroke(); ctx.setLineDash([]);
        if (line.fill && line.points.length) { const points = line.points.filter(p => p.x >= xRange[0] && p.x <= xRange[1]); if (points.length) { ctx.lineTo(x(points[points.length - 1].x), y(yRange[0])); ctx.lineTo(x(points[0].x), y(yRange[0])); ctx.closePath(); ctx.fillStyle = line.color + '0b'; ctx.fill(); } }
      });
      if (cursor) { ctx.strokeStyle = '#c98c46'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x(cursor.x), top); ctx.lineTo(x(cursor.x), bottom); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c98c46'; ctx.beginPath(); ctx.arc(x(cursor.x), y(cursor.y), 3.3, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(element);
    return () => observer.disconnect();
  }, [series, xRange, yRange, annotations, cursor, formatX, formatY]);
  return <canvas ref={canvas} className="scientific-canvas" role="img" aria-label={label} />;
}

import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, Box, Info, Lightbulb, Maximize2, MousePointer2, RotateCcw, X } from 'lucide-react';
import type { LessonStep } from './LabShell';

export function RangeControl({ id, label, symbol, value, min, max, step = 1, unit, hint, onChange }: { id: string; label: string; symbol?: string; value: number; min: number; max: number; step?: number; unit: string; hint: string; onChange: (value: number) => void }) {
  return <div className="slider-block sample-slider"><div className="slider-label"><label htmlFor={id}>{label} <span>{symbol}</span></label><output htmlFor={id}>{value.toFixed(step < 1 ? 1 : 0)} <small>{unit}</small></output></div><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as CSSProperties} /><div className="range-limits"><span>{min} {unit}</span><span>{hint}</span><span>{max} {unit}</span></div></div>;
}

export function LearningPanel({ steps, step, onStep }: { steps: readonly LessonStep[]; step: number; onStep: (step: number) => void }) {
  return <section className="learning-panel"><div className="learning-header"><span><Lightbulb size={16} /> 边做边理解</span><span>STEP 0{step + 1} / 03</span></div><div className="learning-body"><span className="large-step">0{step + 1}</span><div><h2>{steps[step].title}<small>{steps[step].subtitle}</small></h2><p>{steps[step].text}</p></div><button className="next-step" aria-label={step < 2 ? '下一教学步骤' : '回到第一步'} onClick={() => onStep((step + 1) % steps.length)}><ArrowRight size={19} /></button></div><div className="learning-progress">{steps.map((item, i) => <button key={item.title} className={i === step ? 'active' : ''} aria-label={`教学步骤 ${i + 1}：${item.title}`} aria-pressed={i === step} onClick={() => onStep(i)} />)}</div></section>;
}

export type SceneView = { topView: boolean; labels: boolean; resetKey: number };
export const DEFAULT_VIEW: SceneView = { topView: false, labels: true, resetKey: 0 };
export function SceneFrame({ children, view, onView, description, onClose, note = '光路与器件尺寸均为教学示意' }: { children: ReactNode; view: SceneView; onView: (value: SceneView) => void; description?: { title: string; en: string; description: string; tip: string } | null; onClose: () => void; note?: string }) {
  return <section className="scene-panel" aria-label="三维光学系统"><div className="scene-topline"><div><Box size={15} /><span>3D 光学实验台</span></div><span className="live-indicator"><span /> 实时模拟</span></div>{children}
    <div className="scene-toolbar"><button className={!view.topView ? 'chosen' : ''} aria-label="透视视角" title="透视视角" aria-pressed={!view.topView} onClick={() => onView({ ...view, topView: false })}><Box size={17} /></button><button className={view.topView ? 'chosen' : ''} aria-label="俯视光路" title="俯视光路" aria-pressed={view.topView} onClick={() => onView({ ...view, topView: true })}><Maximize2 size={16} /></button><span /><button className={view.labels ? 'chosen' : ''} aria-label="显示器件标签" title="显示器件标签" aria-pressed={view.labels} onClick={() => onView({ ...view, labels: !view.labels })}><Info size={17} /></button><button aria-label="恢复默认视角" title="恢复默认视角" onClick={() => onView({ ...view, topView: false, resetKey: view.resetKey + 1 })}><RotateCcw size={16} /></button></div>
    {description && <div className="component-popover"><button className="icon-button" aria-label="关闭器件说明" onClick={onClose}><X size={15} /></button><small>{description.en}</small><h3>{description.title}</h3><p>{description.description}</p><div>{description.tip}</div></div>}
    <div className="scene-bottomline"><span><MousePointer2 size={13} />拖动旋转 · 滚轮缩放 · 点击器件</span><span>{note}</span></div>
  </section>;
}

export function InfoModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const items = root.current?.querySelectorAll<HTMLElement>('button, a[href], input, select');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onClick={onClose}><div className="modal module-modal" ref={root} role="dialog" aria-modal="true" aria-labelledby="module-modal-title" onClick={event => event.stopPropagation()}><button className="icon-button modal-close" aria-label="关闭说明" onClick={onClose}><X size={19} /></button><span className="eyebrow">OPTICS EXPLORER · LEARNING NOTES</span><h2 id="module-modal-title">{title}</h2>{children}</div></div>;
}

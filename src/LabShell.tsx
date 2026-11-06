import type { ReactNode } from 'react';
import { ArrowRight, AudioWaveform, BookOpen, ChevronRight, Focus, GraduationCap, Move3D, ScanLine, Waves } from 'lucide-react';

export type Technique = 'td' | 'sd' | 'ellipsometry';
export type LessonStep = { title: string; subtitle: string; text: string };
export const TECHNIQUES = [
  { id: 'td', title: '时域 OCT', en: 'Time-domain OCT', icon: ScanLine },
  { id: 'sd', title: '频域 OCT', en: 'Spectral-domain OCT', icon: AudioWaveform },
  { id: 'ellipsometry', title: '椭偏检测', en: 'Thin-film ellipsometry', icon: Waves },
] as const;
export type NavigationProps = { onNavigate: (technique: Technique) => void };

export default function LabShell({ technique, onNavigate, steps, step, onStep, onGuide, children }: NavigationProps & {
  technique: Technique; steps: readonly LessonStep[]; step: number; onStep: (step: number) => void; onGuide: () => void; children: ReactNode;
}) {
  const index = TECHNIQUES.findIndex(item => item.id === technique);
  return <div className={`app-shell technique-${technique}`}>
    <aside className="sidebar">
      <button className="brand" onClick={() => onNavigate('td')} aria-label="光学探索首页"><span className="brand-mark"><Focus size={25} strokeWidth={1.6} /></span><span><strong>光学探索<span className="brand-dot">.</span></strong><small>OPTICS EXPLORER</small></span></button>
      <div className="sidebar-content"><div className="nav-heading">探索检测技术 <span>0{index + 1} / 03</span></div>
        <nav aria-label="检测技术导航">{TECHNIQUES.map(item => <button key={item.id} className={`nav-item ${technique === item.id ? 'active' : 'available'}`} aria-current={technique === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)} title={item.title}><item.icon size={19} /><span><strong>{item.title}</strong><small>{item.en}</small></span><ChevronRight size={15} /></button>)}</nav>
        <div className="sidebar-divider" /><div className="nav-heading">本次实验 <span>入门</span></div>
        <div className="lesson-nav">{steps.map((item, i) => <button key={item.title} onClick={() => onStep(i)} className={step === i ? 'current' : ''} aria-pressed={step === i}><span className="step-number">0{i + 1}</span><span>{item.title}</span>{step === i && <span className="current-dot" />}</button>)}</div>
        <div className="beginner-card"><span className="beginner-icon"><GraduationCap size={21} /></span><h3>{technique === 'ellipsometry' ? '偏振，也能测量厚度' : '从光路到测量信号'}</h3><p>动手调整实验，<br />让抽象原理变得可见。</p><button onClick={onGuide}>阅读实验指南 <ArrowRight size={14} /></button></div>
      </div>
      <div className="sidebar-bottom"><span className="online-dot" /><span>交互式光学教学实验室</span><small>v1.1</small></div>
    </aside>
    <main className="main-shell"><header className="topbar"><div className="breadcrumb"><span>光学检测</span><ChevronRight size={13} /><strong>{TECHNIQUES[index].title}</strong><span className="experiment-pill">交互实验</span></div><button className="text-button" onClick={onGuide}><BookOpen size={16} /><span>实验指南</span><span className="keyboard-hint">?</span></button></header><div className="lab-layout">{children}</div></main>
    <div className="small-screen-note"><Move3D size={20} /><p>把屏幕转为横向，探索完整光学实验台。</p><small>建议使用 1366 × 768 或更大的桌面窗口。</small></div>
  </div>;
}

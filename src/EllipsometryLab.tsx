import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Info, Pause, Play, RotateCcw, Settings2, SlidersHorizontal, Waves } from 'lucide-react';
import LabShell from './LabShell';
import type { LessonStep, NavigationProps } from './LabShell';
import { DEFAULT_VIEW, InfoModal, LearningPanel, RangeControl, SceneFrame } from './LabUI';
import EllipsometryScene, { ELLIPSE_COMPONENTS } from './EllipsometryScene';
import type { EllipseComponent } from './EllipsometryScene';
import { DEFAULT_ELLIPSOMETRY, FILM, simulateEllipsometry } from './ellipsometryPhysics';
import ScientificPlot from './ScientificPlot';

const STEPS: readonly LessonStep[] = [
  { title: '准备已知偏振', subtitle: 'p 与 s，等幅同相', text: '起偏器固定在 45°。p 电场在入射面内，s 电场垂直入射面；光到达样品前是线偏振。点击器件查看作用。' },
  { title: '薄膜改变偏振', subtitle: 'Ψ 管振幅比，Δ 管相位差', text: '调整膜厚或入射角，观察反射后的偏振椭圆与 Ψ、Δ。变化来自薄膜两界面的多次反射干涉，而非检偏器旋转。' },
  { title: '旋转检偏器', subtitle: '把偏振转成强度', text: '点击自动旋转，让检偏器把椭圆投影到不同方向。探测强度按 180° 周期变化；单条强度曲线无法独立确定完整 Δ。' },
];

export default function EllipsometryLab({ onNavigate }: NavigationProps) {
  const [settings, setSettings] = useState({ ...DEFAULT_ELLIPSOMETRY });
  const [rotating, setRotating] = useState(false);
  const [step, setStep] = useState(0);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [selected, setSelected] = useState<EllipseComponent | null>(null);
  const [modal, setModal] = useState<'guide' | 'parameters' | null>(null);
  const result = useMemo(() => simulateEllipsometry(settings), [settings]);
  useEffect(() => {
    if (!rotating) return;
    let raf = 0, previous = performance.now();
    const tick = (now: number) => { if (now - previous >= 30) { const dt = Math.min((now - previous) / 1000, 0.1); previous = now; setSettings(current => ({ ...current, analyzer: (current.analyzer + 30 * dt) % 180 })); } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const hidden = () => { if (document.hidden) setRotating(false); }; document.addEventListener('visibilitychange', hidden);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', hidden); };
  }, [rotating]);
  const update = (patch: Partial<typeof settings>) => setSettings(current => ({ ...current, ...patch }));
  const reset = () => { setSettings({ ...DEFAULT_ELLIPSOMETRY }); setRotating(false); setStep(0); setSelected(null); setView(current => ({ ...DEFAULT_VIEW, resetKey: current.resetKey + 1 })); };
  const ellipsePath = result.ellipse.map((point, i) => `${i ? 'L' : 'M'}${70 + point.p * 44},${65 - point.s * 44}`).join(' ');
  const scale = Math.max(0.05, Math.ceil(result.maximum * 1.15 / 0.05) * 0.05);

  return <><LabShell technique="ellipsometry" onNavigate={onNavigate} steps={STEPS} step={step} onStep={setStep} onGuide={() => setModal('guide')}>
    <section className="experiment-workspace" aria-label="薄膜椭偏实验工作区">
      <div className="experiment-heading"><div><div className="eyebrow"><span className="tiny-line" /> EXPERIMENT 03</div><h1>单层薄膜椭偏检测<span>ELLIPSOMETRY</span></h1><p>读取偏振的改变，探索纳米薄膜的光学响应。</p></div><span className="level-tag"><span /> 偏振光学</span></div>
      <SceneFrame view={view} onView={setView} description={selected ? ELLIPSE_COMPONENTS[selected] : null} onClose={() => setSelected(null)} note="膜厚与偏振波形均为放大示意">
        <EllipsometryScene result={result} selected={selected} onSelect={setSelected} {...view} />
        <div className="scene-mode-badge"><Waves size={13} /> 线偏振 → 反射偏振 → 线性投影</div>
      </SceneFrame>
      <div className="path-readout ellipse-readout"><span className="readout-icon"><Waves size={17} /></span><div><span>薄膜内往返相位 2β</span><strong>{(2 * result.beta * 180 / Math.PI).toFixed(1)} <small>°</small></strong></div><span className="match-status">ρ = rₚ / rₛ = tanΨ · eⁱΔ</span></div>
      <LearningPanel steps={STEPS} step={step} onStep={setStep} />
      <footer className="workspace-footer"><span><Check size={12} /> Fresnel 单层薄膜正向模型</span><button onClick={() => setModal('parameters')}>查看模型与参数 <ArrowRight size={12} /></button></footer>
    </section>
    <aside className="instrument-panel ellipse-instruments" aria-label="椭偏监视器和控制">
      <div className="instrument-title"><div><Waves size={17} /><h2>偏振与探测强度</h2></div><span className={`status-badge ${rotating ? 'running' : ''}`}><span />{rotating ? '检偏器旋转中' : '手动探索'}</span></div>
      <section className="ellipse-values" aria-label="椭偏模型值和即时强度"><div><span>Ψ <small>振幅比角</small></span><strong>{result.psi.toFixed(2)}<small>°</small></strong></div><div><span>Δ <small>相位差</small></span><strong>{result.phaseDefined ? result.delta.toFixed(2) : '—'}<small>°</small></strong></div><div><span>I / I₀ <small>检偏后</small></span><strong>{result.intensity.toFixed(4)}</strong></div></section>
      <section className="polarization-row" aria-label="检偏器前的反射偏振"><svg className="polarization-svg" viewBox="0 0 140 130" role="img" aria-label={`反射偏振椭圆，Psi ${result.psi.toFixed(2)} 度，Delta ${result.delta.toFixed(2)} 度。`}><defs><pattern id="ellipse-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#eaf0e9" strokeWidth="0.6" /></pattern></defs><rect x="16" y="11" width="108" height="108" fill="url(#ellipse-grid)" rx="8" /><path d="M14 65H128M70 10V120" stroke="#c7d7c9" strokeWidth="1" /><path d={ellipsePath} fill="#16857908" stroke="#168579" strokeWidth="2" /><text x="123" y="59">Eₚ</text><text x="75" y="14">Eₛ</text><circle cx={70 + result.ellipse[30].p * 44} cy={65 - result.ellipse[30].s * 44} r="2.7" fill="#d4a662" /></svg><div><h3>反射后的偏振椭圆</h3><p>位于检偏器之前<br />电场轨迹已归一化</p><span>|rₚ| / |rₛ| = {Math.tan(result.psi * Math.PI / 180).toFixed(3)}</span><small>Ψ、Δ 为模型计算值，<br />不由单条强度曲线直接反演。</small></div></section>
      <section className="ellipse-monitor"><div className="module-chart-heading"><span>检偏器角度与强度</span><small>I / I₀</small></div><div className="module-chart-canvas"><ScientificPlot label={`检偏器强度曲线，当前角度 ${settings.analyzer.toFixed(1)} 度，归一化强度 ${result.intensity.toFixed(4)}。`} series={[{ label: '探测强度', color: '#6b99ac', fill: true, points: result.curve.map(point => ({ x: point.angle, y: point.intensity })) }]} xRange={[0, 180]} yRange={[0, scale]} cursor={{ x: settings.analyzer, y: result.intensity }} formatY={y => y.toFixed(2)} /></div><div className="module-axis">检偏器角度 A / ° <span>橙色游标为当前角度</span></div></section>
      <section className="controls-section"><div className="control-title"><SlidersHorizontal size={16} /><h2>实验控制</h2><button className="icon-button" aria-label="查看椭偏模型参数" onClick={() => setModal('parameters')}><Settings2 size={15} /></button></div>
        <RangeControl id="film-thickness" label="薄膜厚度" symbol="d" value={settings.thickness} min={0} max={500} unit="nm" hint="0 nm 表示裸基底" onChange={thickness => { update({ thickness }); setStep(1); }} />
        <RangeControl id="film-incidence" label="入射角" symbol="θ" value={settings.incidence} min={45} max={80} step={0.1} unit="°" hint="相对样品表面法线" onChange={incidence => { update({ incidence }); setStep(1); }} />
        <RangeControl id="film-analyzer" label="检偏器角度" symbol="A" value={settings.analyzer} min={0} max={180} step={0.1} unit="°" hint="相对反射光的 p 方向" onChange={analyzer => { setRotating(false); update({ analyzer }); setStep(2); }} />
        <div className="scan-buttons"><button className="primary-button" onClick={() => { setRotating(current => !current); setStep(2); }}>{rotating ? <Pause size={15} /> : <Play size={15} />}{rotating ? '暂停旋转' : '自动旋转检偏器'}</button><button className="reset-button" onClick={reset}><RotateCcw size={15} /> 重置</button></div>
        <div className="module-status">固定起偏角 P = 45° · 旋转速度 30°/s</div>
      </section>
      <button className="parameter-footer" onClick={() => setModal('parameters')}><span>λ <b>{FILM.wavelength} nm</b><i /> n₁ <b>{FILM.filmIndex}</b></span><span>实验参数 <ChevronRight size={12} /></span></button>
    </aside>
  </LabShell>
  {modal && <InfoModal title={modal === 'guide' ? '偏振改变，揭示薄膜信息' : '椭偏：Fresnel 与偏振投影'} onClose={() => setModal(null)}>{modal === 'guide' ? <><p className="modal-intro">椭偏检测比较 p、s 两个分量反射后的振幅与相位。这里用已知膜厚做正向计算，帮助你建立“结构 → 偏振 → 强度”的联系。</p><div className="guide-steps">{STEPS.map((item, i) => <div key={item.title}><b>0{i + 1}</b><section><h3>{item.title}</h3><p>{item.text}</p></section></div>)}</div><div className="modal-note"><Info size={16} /><span>单波长 Ψ、Δ 对膜厚可能存在周期性多解。真实测量通常结合多波长、多角度与模型拟合；完整相位测量还需补偿器或偏振调制。</span></div></> : <><div className="parameter-grid"><div><span>固定波长与起偏角</span><strong>632.8 <small>nm · P = 45°</small></strong></div><div><span>理想无吸收折射率</span><strong>1 / 1.46 / 3.88</strong></div></div><div className="formula-block">β = 2π n₁ d cosθ₁ / λ<br />rⱼ = (r₀₁,ⱼ + r₁₂,ⱼ e²ⁱβ) / (1 + r₀₁,ⱼ r₁₂,ⱼ e²ⁱβ)<br />rₚ / rₛ = tanΨ · exp(iΔ)<br />I(A) / I₀ = |rₚ cosA + rₛ sinA|² / 2</div><p className="formula-description">j = p 或 s；折射角满足 Snell 定律。均匀、各向同性、无吸收单层薄膜在半无限基底上，考虑层内多次反射；忽略色散、粗糙度和退偏。常数为教学设定，不对应真实硅材料的精确光学常数。</p><p className="formula-description">采用 e⁻ⁱωᵗ 时间约定及随传播方向定义的 p/s 基；Δ 映射到 [0°, 360°)。图示椭圆使用归一化反射场。I₀ 为起偏器之后的入射光强；I / I₀ 为检偏后的归一化强度，未检偏的反射率为 (|rₚ|² + |rₛ|²) / 2。</p><div className="modal-note"><Info size={16} /><span>Ψ、Δ 来自模型复反射系数。旋转线性检偏器的强度只含 cosΔ，对 Δ 与 360°−Δ 相同；未加入补偿器，因此不进行完整 Δ 或膜厚反演。</span></div><a className="source-link" href="https://pypolar.readthedocs.io/en/latest/10a-Ellipsometry.html" target="_blank" rel="noreferrer">原理参考：Scott Prahl · Ellipsometer Basics <ArrowRight size={13} /></a></>}</InfoModal>}
  </>;
}

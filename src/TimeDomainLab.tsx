import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Box, Check, ChevronDown, ChevronRight, Crosshair, Info, Lightbulb, Maximize2, MousePointer2, Pause, Play, Radio, RotateCcw, Settings2, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import OpticalScene from './OpticalScene';
import LabShell from './LabShell';
import type { NavigationProps } from './LabShell';
import SignalPlot from './SignalPlot';
import { COMPONENTS } from './content';
import type { ComponentId } from './content';
import { advanceScan, AXIAL_FWHM_AIR, AXIAL_FWHM_SAMPLE, beginScan, interfacePositions, nearestInterface, OPTICS, signalAt } from './physics';
import type { ScanState } from './physics';

const INITIAL_SCAN: ScanState = { reference: 0, range: null, running: false };
const STEPS = [
  { title: '认识光路', subtitle: '从光源到探测器', text: '光在分束器处分成两路，分别到达参考镜和样品，再返回探测器。点击任一器件，了解它在实验中的作用。' },
  { title: '扫描参考镜', subtitle: '寻找光程匹配', text: '点击「开始扫描」，观察三个干涉信号包依次出现。只有两臂光程足够接近时，才会发生明显的低相干干涉。' },
  { title: '探索样品深度', subtitle: '让信号与界面对上号', text: '移动样品后重新扫描，三个信号包会一起平移。界面之间的峰间距保持不变，因为样品的内部结构没有改变。' },
];

function Modal({ kind, onClose }: { kind: 'guide' | 'parameters'; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>('button, a[href]');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialog} onClick={e => e.stopPropagation()}>
    <button className="icon-button modal-close" aria-label="关闭说明" onClick={onClose}><X size={19} /></button>
    <span className="eyebrow">{kind === 'guide' ? 'YOUR FIRST OPTICAL EXPERIMENT' : 'THE PHYSICS BEHIND THE SCENE'}</span>
    <h2 id="modal-title">{kind === 'guide' ? '从一束光，读懂样品内部' : '实验参数与计算模型'}</h2>
    {kind === 'guide' ? <>
      <p className="modal-intro">时域光学相干层析成像（TD-OCT）通过移动参考镜，逐个探测样品中不同深度的反射界面。</p>
      <div className="guide-steps">{STEPS.map((step, i) => <div key={step.title}><b>0{i + 1}</b><section><h3>{step.title}</h3><p>{step.text}</p></section></div>)}</div>
      <div className="modal-note"><MousePointer2 size={18} /><span>拖动旋转 · 滚轮缩放 · 点击器件查看说明<br />手动调整参考镜会暂停扫描；移动样品会清空已有记录。</span></div>
      <button className="primary-button modal-start" onClick={onClose}>开始探索 <ArrowRight size={16} /></button>
    </> : <>
      <div className="parameter-grid">
        <div><span>中心波长 λ₀</span><strong>850 <small>nm</small></strong></div><div><span>光谱带宽 Δλ（FWHM）</span><strong>50 <small>nm</small></strong></div>
        <div><span>样品折射率 n</span><strong>1.40</strong></div><div><span>样品中轴向分辨率</span><strong>{AXIAL_FWHM_SAMPLE.toFixed(2)} <small>μm</small></strong></div>
      </div>
      <div className="formula-block">xᵢ = 50 + s + n · zᵢ<br />Δᵢ = 2(xᵣ − xᵢ)<br />gᵢ = aᵢ exp[−4 ln 2 · (Δᵢ / 2δz)²]<br />I<sub>AC</sub> = Σ gᵢ cos(2πΔᵢ / λ₀)<br />E = |Σ gᵢ exp(i2πΔᵢ / λ₀)|</div>
      <p className="formula-description">长度统一为 μm；xᵣ 为参考镜位移，s 为样品平移量，zᵢ = 0 / 40 / 80 为样品内深度。50 μm 为基准光程偏置。δz = (2 ln 2 / π) λ₀² / Δλ ≈ {AXIAL_FWHM_AIR.toFixed(2)} μm，为空气中单程深度包络半高全宽。</p>
      <p className="formula-description">相对场振幅 aᵢ = 1 / 0.70 / 0.48。采用高斯光谱、固定折射率和单次反射，忽略色散、噪声及样品自相关项；显示去直流干涉项与解析包络。样品内分辨率为 δz / n。</p>
      <div className="modal-note"><Info size={17} /><span>3D 器件与臂长为示意尺寸，两臂位移采用同一显示增益；右侧数值始终使用真实单位。光路上的粒子仅表示传播方向。</span></div>
      <a className="source-link" href="https://imaging.cs.cmu.edu/interferometry-iccp-course/" target="_blank" rel="noreferrer">原理参考：CMU Interferometric Imaging <ArrowRight size={13} /></a>
    </>}
  </div></div>;
}

export default function TimeDomainLab({ onNavigate }: NavigationProps) {
  const [scan, setScan] = useState<ScanState>(INITIAL_SCAN);
  const [sample, setSample] = useState(0);
  const [speed, setSpeed] = useState(20);
  const [selected, setSelected] = useState<ComponentId | null>(null);
  const [step, setStep] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [topView, setTopView] = useState(false);
  const [labels, setLabels] = useState(true);
  const [modal, setModal] = useState<'guide' | 'parameters' | null>(null);

  useEffect(() => {
    if (!scan.running) return;
    let raf = 0, previous = performance.now();
    const tick = (now: number) => {
      const elapsed = now - previous;
      if (elapsed >= 30) { previous = now; setScan(current => advanceScan(current, Math.min(elapsed / 1000, 0.1), speed)); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const pauseHidden = () => { if (document.hidden) setScan(current => ({ ...current, running: false })); };
    document.addEventListener('visibilitychange', pauseHidden);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', pauseHidden); };
  }, [scan.running, speed]);

  const reference = scan.reference;
  const positions = interfacePositions(sample);
  const nearest = nearestInterface(reference, sample);
  const signal = signalAt(reference, sample);
  const matched = signal.envelope > 0.08;
  const complete = reference >= OPTICS.maxReference && (scan.range?.to ?? 0) >= OPTICS.maxReference;
  const coverage = scan.range ? (scan.range.to - scan.range.from) / OPTICS.maxReference * 100 : 0;
  const status = scan.running ? '正在扫描' : complete ? '扫描完成' : scan.range ? '扫描已暂停' : '准备就绪';
  const acquiredCount = positions.filter(center => scan.range && center >= scan.range.from && center <= scan.range.to).length;
  const selectedInfo = selected ? COMPONENTS[selected] : null;
  const reset = () => { setScan(INITIAL_SCAN); setSample(0); setSpeed(20); setSelected(null); setStep(0); setZoom(false); setTopView(false); setLabels(true); setResetKey(x => x + 1); };
  const moveReference = (value: number) => setScan(current => ({ ...current, reference: value, running: false }));
  const moveSample = (value: number) => { setSample(value); setScan(current => ({ ...current, running: false, range: null })); };
  const toggleScan = () => { setStep(1); setScan(current => current.running ? { ...current, running: false } : beginScan(current.reference, current.range)); };

  return <><LabShell technique="td" onNavigate={onNavigate} steps={STEPS} step={step} onStep={setStep} onGuide={() => setModal('guide')}>
        <section className="experiment-workspace" aria-label="光学实验工作区">
          <div className="experiment-heading"><div><div className="eyebrow"><span className="tiny-line" /> EXPERIMENT 01</div><h1>时域光学相干层析成像<span>TD-OCT</span></h1><p>移动一面镜子，让光带你看见样品内部。</p></div><span className="level-tag"><span /> 基础光学</span></div>

          <section className="scene-panel" aria-label="三维光学系统">
            <div className="scene-topline"><div><Box size={15} /><span>3D 光学实验台</span></div><span className="live-indicator"><span /> 实时模拟</span></div>
            <OpticalScene reference={reference} sample={sample} selected={selected} onSelect={setSelected} resetKey={resetKey} topView={topView} labels={labels} />
            <div className="scene-toolbar"><button className={!topView ? 'chosen' : ''} title="透视视角" aria-label="透视视角" aria-pressed={!topView} onClick={() => setTopView(false)}><Box size={17} /></button><button className={topView ? 'chosen' : ''} title="俯视光路" aria-label="俯视光路" aria-pressed={topView} onClick={() => setTopView(true)}><Maximize2 size={16} /></button><span /><button className={labels ? 'chosen' : ''} title="显示器件标签" aria-label="显示器件标签" aria-pressed={labels} onClick={() => setLabels(v => !v)}><Info size={17} /></button><button title="恢复默认视角" aria-label="恢复默认视角" onClick={() => { setTopView(false); setResetKey(v => v + 1); }}><RotateCcw size={16} /></button></div>
            {selectedInfo && <div className="component-popover"><button className="icon-button" aria-label="关闭器件说明" onClick={() => setSelected(null)}><X size={15} /></button><small>{selectedInfo.en}</small><h3>{selectedInfo.title}</h3><p>{selectedInfo.description}</p><div>{selectedInfo.tip}</div></div>}
            <div className="scene-bottomline"><span><MousePointer2 size={13} />拖动旋转 · 滚轮缩放 · 点击器件</span><span>器件与位移均为放大示意</span></div>
            <div className="axis-widget" aria-hidden="true"><svg viewBox="0 0 55 55"><path d="M25 32 46 39M25 32 9 43M25 32V8" fill="none" strokeWidth="1.5" stroke="#b6c4bf"/><text x="44" y="50">x</text><text x="1" y="53">z</text><text x="22" y="8">y</text><circle cx="25" cy="32" r="3" fill="#729a8b" /></svg></div>
          </section>

          <div className={`path-readout ${matched ? 'is-matched' : ''}`}><span className="readout-icon"><ArrowLeftRight size={17} /></span><div><span>相对界面 {['①', '②', '③'][nearest]} 的往返光程差</span><strong>{signal.contributions[nearest].opd > 0 ? '+' : ''}{signal.contributions[nearest].opd.toFixed(1)} <small>μm</small></strong></div><span className="match-status">{matched ? <><Sparkles size={13} /> 相干门内</> : <><span className="hollow-dot" /> 等待光程匹配</>}</span></div>

          <section className="learning-panel"><div className="learning-header"><span><Lightbulb size={16} /> 边做边理解</span><span>STEP 0{step + 1} / 03</span></div><div className="learning-body"><span className="large-step">0{step + 1}</span><div><h2>{STEPS[step].title}<small>{STEPS[step].subtitle}</small></h2><p>{STEPS[step].text}</p></div><button className="next-step" aria-label={step < 2 ? '下一教学步骤' : '回到第一步'} onClick={() => setStep(v => (v + 1) % 3)}><ArrowRight size={19} /></button></div><div className="learning-progress">{STEPS.map((item, i) => <button key={item.title} className={i === step ? 'active' : ''} aria-label={`教学步骤 ${i + 1}：${item.title}`} aria-pressed={i === step} onClick={() => setStep(i)} />)}</div></section>
          <footer className="workspace-footer"><span><Check size={12} /> 理想低相干干涉模型</span><button onClick={() => setModal('parameters')}>查看模型与参数 <ArrowRight size={12} /></button></footer>
        </section>

        <aside className="instrument-panel" aria-label="监视器和实验控制">
          <div className="instrument-title"><div><Radio size={17} /><h2>信号监视器</h2></div><span className={`status-badge ${scan.running ? 'running' : ''}`}><span />{status}</span></div>
          <section className="monitor-section"><div className="plot-heading"><span>干涉信号 / 包络</span><div className="segmented" aria-label="图表范围"><button className={!zoom ? 'selected' : ''} aria-pressed={!zoom} onClick={() => setZoom(false)}>全程</button><button className={zoom ? 'selected' : ''} aria-pressed={zoom} onClick={() => setZoom(true)}>局部</button></div></div><div className="plot-unit"><span>归一化幅值 / a.u.</span><span className="instant-reading">I {signal.raw.toFixed(2)} <i /> E {signal.envelope.toFixed(2)}</span></div><div className="plot-wrap"><SignalPlot reference={reference} sample={sample} range={scan.range} zoom={zoom} />{!scan.range && <span className="empty-plot-note">开始扫描，观察信号逐步出现</span>}</div><div className="plot-axis">参考镜位移 xᵣ / μm</div><div className="plot-legend"><span><i className="raw-line" /> 原始干涉信号<small>（去直流）</small></span><span><i className="envelope-line" /> 包络</span><span><i className="cursor-line" /> 当前位置</span></div></section>

          <section className="interfaces-section"><div className="section-label">反射界面 <span>样品内深度</span></div><div className="interface-cards">{OPTICS.depths.map((depth, i) => { const acquired = Boolean(scan.range && positions[i] >= scan.range.from && positions[i] <= scan.range.to); return <button key={depth} className={`interface-card interface-${i} ${matched && nearest === i ? 'highlighted' : ''}`} aria-label={`定位界面 ${i + 1}，深度 ${depth} 微米`} onClick={() => { moveReference(positions[i]); setSelected('sample'); }}><span>{['①', '②', '③'][i]}<small>{acquired ? <Check size={11} /> : '预期'}</small></span><strong>{depth} <small>μm</small></strong></button>; })}</div><div className="interfaces-caption"><span>已扫描 {acquiredCount} / 3 个界面</span><span>点击卡片定位 <Crosshair size={11} /></span></div></section>

          <section className="controls-section"><div className="control-title"><SlidersHorizontal size={16} /><h2>实验控制</h2><button className="icon-button" aria-label="查看固定物理参数" title="查看固定物理参数" onClick={() => setModal('parameters')}><Settings2 size={15} /></button></div>
            <div className="slider-block"><div className="slider-label"><label htmlFor="reference-position">参考镜位置 <span>xᵣ</span></label><output htmlFor="reference-position" className="reference-output">{reference.toFixed(1)} <small>μm</small></output></div><input id="reference-position" type="range" min="0" max="200" step="0.1" value={reference} onChange={e => moveReference(Number(e.target.value))} style={{ '--range-progress': `${reference / 2}%` } as React.CSSProperties} /><div className="range-limits"><span>0 μm</span><span>沿参考臂光轴移动</span><span>200 μm</span></div></div>
            <div className="slider-block sample-slider"><div className="slider-label"><label htmlFor="sample-position">样品位置 <span>s</span></label><output htmlFor="sample-position">{sample > 0 ? '+' : ''}{sample.toFixed(1)} <small>μm</small></output></div><input id="sample-position" type="range" min="-20" max="20" step="0.1" value={sample} onChange={e => moveSample(Number(e.target.value))} style={{ '--range-progress': `${(sample + 20) / 40 * 100}%` } as React.CSSProperties} /><div className="range-limits"><span>−20 μm</span><span>沿样品臂光轴移动</span><span>+20 μm</span></div></div>
            <div className="speed-control"><label htmlFor="scan-speed">扫描速度</label><div className="select-wrap"><select id="scan-speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value="10">慢速 · 10 μm/s</option><option value="20">标准 · 20 μm/s</option><option value="40">快速 · 40 μm/s</option></select><ChevronDown size={13} /></div></div>
            <div className="scan-buttons"><button className="primary-button" onClick={toggleScan}>{scan.running ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}{scan.running ? '暂停扫描' : complete ? '重新扫描' : scan.range ? '继续扫描' : '开始扫描'}</button><button className="reset-button" onClick={reset}><RotateCcw size={15} /> 重置</button></div>
            <div className="scan-progress" role="progressbar" aria-label="全程扫描覆盖率" aria-valuenow={Math.round(coverage)} aria-valuemin={0} aria-valuemax={100}><div><span style={{ width: `${coverage}%` }} /></div><span>{Math.round(coverage)}%</span></div>
          </section>
          <div className="instrument-note"><Info size={14} /><p>镜面移动 1 μm，往返光程改变 2 μm。<br />三个包络峰，分别来自三个反射界面。</p></div>
          <button className="parameter-footer" onClick={() => setModal('parameters')}><span>λ₀ <b>850 nm</b><i /> n <b>1.40</b></span><span>实验参数 <ChevronRight size={12} /></span></button>
        </aside>
  </LabShell>
    {modal && <Modal kind={modal} onClose={() => setModal(null)} />}
  </>;
}

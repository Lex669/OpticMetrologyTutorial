import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowRight, AudioWaveform, Check, ChevronDown, ChevronRight, Info, Pause, Play, RotateCcw, Settings2, SlidersHorizontal } from 'lucide-react';
import LabShell from './LabShell';
import type { LessonStep, NavigationProps } from './LabShell';
import { DEFAULT_VIEW, InfoModal, LearningPanel, RangeControl, SceneFrame } from './LabUI';
import OpticalScene from './OpticalScene';
import ScientificPlot from './ScientificPlot';
import { SPECTRAL_COMPONENTS } from './content';
import type { ComponentId } from './content';
import { DEFAULT_SPECTRAL, simulateSpectralOCT } from './spectralPhysics';

const STEPS: readonly LessonStep[] = [
  { title: '同时接收所有深度', subtitle: '参考镜保持固定', text: '宽带光同时照亮三个反射界面。返回光与参考光合束后进入光谱仪，一帧光谱就包含三个深度的信息。' },
  { title: '从光谱到深度', subtitle: 'k 重采样 → FFT', text: '不同深度带来不同疏密的光谱条纹。将光谱转换到等波数坐标并去除背景，再做 FFT，就能分离出三个深度峰。' },
  { title: '改变光谱带宽', subtitle: '宽光谱，窄深度峰', text: '拖动光谱带宽滑块：带宽越大，轴向分辨率通常越高。移动样品时三峰一起平移，而参考镜无需逐点扫描。' },
];
const COLORS = ['#168579', '#5796b9', '#a68ac3'];

export default function SpectralLab({ onNavigate }: NavigationProps) {
  const [settings, setSettings] = useState({ ...DEFAULT_SPECTRAL });
  const [captured, setCaptured] = useState({ ...DEFAULT_SPECTRAL });
  const [live, setLive] = useState(true);
  const [step, setStep] = useState(0);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [selected, setSelected] = useState<ComponentId | null>(null);
  const [focus, setFocus] = useState(0);
  const [spectrumZoom, setSpectrumZoom] = useState(false);
  const [modal, setModal] = useState<'guide' | 'parameters' | null>(null);
  const [parameterTab, setParameterTab] = useState<'model' | 'sampling'>('model');
  useEffect(() => { if (live) setCaptured(settings); }, [settings, live]);
  const result = useMemo(() => simulateSpectralOCT(captured), [captured]);
  const stale = Object.keys(settings).some(key => settings[key as keyof typeof settings] !== captured[key as keyof typeof captured]);
  const update = (patch: Partial<typeof settings>) => setSettings(current => ({ ...current, ...patch }));
  const reset = () => { setSettings({ ...DEFAULT_SPECTRAL }); setCaptured({ ...DEFAULT_SPECTRAL }); setLive(true); setStep(0); setFocus(0); setSpectrumZoom(false); setSelected(null); setView(current => ({ ...DEFAULT_VIEW, resetKey: current.resetKey + 1 })); };
  const openParameters = (tab: 'model' | 'sampling' = 'model') => { setParameterTab(tab); setModal('parameters'); };

  return <><LabShell technique="sd" onNavigate={onNavigate} steps={STEPS} step={step} onStep={setStep} onGuide={() => setModal('guide')}>
    <section className="experiment-workspace" aria-label="频域 OCT 实验工作区">
      <div className="experiment-heading"><div><div className="eyebrow"><span className="tiny-line" /> EXPERIMENT 02</div><h1>频域光学相干层析成像<span>SD-OCT</span></h1><p>把深度藏进光谱，再用傅里叶变换读出来。</p></div><span className="level-tag"><span /> 光谱域</span></div>
      <SceneFrame view={view} onView={setView} description={selected ? SPECTRAL_COMPONENTS[selected] : null} onClose={() => setSelected(null)} note="参考镜固定 · 位移与光谱色散为示意">
        <OpticalScene mode="sd" reference={0} sample={settings.sample} selected={selected} onSelect={setSelected} {...view} focusInterface={focus} />
        <div className="scene-mode-badge"><AudioWaveform size={13} /> 固定参考镜 · 同时探测三个界面</div>
      </SceneFrame>
      <div className="path-readout spectral-readout"><span className="readout-icon"><ArrowLeftRight size={17} /></span><div><span>界面 {['①', '②', '③'][focus]} · 重建等效空气深度</span><strong>{result.peaks[focus].measured.toFixed(1)} <small>μm</small></strong></div><span className="match-status">{stale ? '曲线为上一采集帧' : <><Check size={13} /> 数值 FFT</>}</span></div>
      <LearningPanel steps={STEPS} step={step} onStep={setStep} />
      <footer className="workspace-footer"><span><Check size={12} /> 光谱干涉与数值 FFT 模型</span><button onClick={() => openParameters()}>查看模型与参数 <ArrowRight size={12} /></button></footer>
    </section>
    <aside className="instrument-panel spectral-instruments" aria-label="频域 OCT 监视器和控制">
      <div className="instrument-title"><div><AudioWaveform size={17} /><h2>光谱与深度</h2></div><span className={`status-badge ${live ? 'running' : ''}`}><span />{live ? '实时采集' : '采集已暂停'}</span></div>
      <section className="dual-monitor" aria-label="光谱与 FFT 结果">
        <div className="chart-block"><div className="module-chart-heading"><span><b>01</b> 原始光谱</span><div className="segmented"><button className={!spectrumZoom ? 'selected' : ''} aria-pressed={!spectrumZoom} onClick={() => setSpectrumZoom(false)}>全谱</button><button className={spectrumZoom ? 'selected' : ''} aria-pressed={spectrumZoom} onClick={() => setSpectrumZoom(true)}>条纹局部</button></div></div><div className="module-chart-canvas"><ScientificPlot label={`原始光谱，${captured.pixels} 个像素，光谱带宽 ${captured.bandwidth} 纳米，含直流背景。${spectrumZoom ? '局部波长 825–875 纳米。' : ''}`} series={[{ label: '原始光谱', color: '#6e96a9', points: result.spectrum.map(p => ({ x: p.wavelength, y: p.intensity })) }, { label: '背景', color: '#aab9a5', dashed: true, points: result.spectrum.map(p => ({ x: p.wavelength, y: p.background })) }]} xRange={spectrumZoom ? [825, 875] : [750, 950]} yRange={[0, 1.4]} /></div><div className="module-axis">波长 λ / nm <span>蓝：干涉光谱 · 虚线：背景</span></div></div>
        <div className="processing-strip"><span>k 重采样</span><ArrowRight size={10} /><span>去背景{captured.hann ? ' + Hann 窗' : ''}</span><ArrowRight size={10} /><strong>FFT</strong></div>
        <div className="chart-block"><div className="module-chart-heading"><span><b>02</b> 深度重建</span><small>相对反射场幅值</small></div><div className="module-chart-canvas"><ScientificPlot label={`FFT 深度重建，三峰等效空气深度 ${result.peaks.map(p => p.measured.toFixed(1)).join('、')} 微米。`} series={[{ label: 'FFT 幅值', color: '#168579', fill: true, points: result.depth.map(p => ({ x: p.x, y: p.amplitude })) }]} xRange={[0, 220]} yRange={[0, 1.1]} annotations={result.centers.map((x, i) => ({ x, label: ['①', '②', '③'][i], color: COLORS[i] }))} /></div><div className="module-axis">等效空气深度 / μm <span>x = 50 + s + n·z</span></div></div>
      </section>
      <section className="interfaces-section"><div className="section-label">重建界面 <span>换算为样品内深度</span></div><div className="interface-cards">{result.peaks.map((peak, i) => <button className={`interface-card interface-${i} ${focus === i ? 'highlighted' : ''}`} key={i} onClick={() => { setFocus(i); setSelected('sample'); }} aria-label={`查看重建界面 ${i + 1}`}><span>{['①', '②', '③'][i]}<small>FFT</small></span><strong>{(Math.abs(peak.sampleDepth) < 0.05 ? 0 : peak.sampleDepth).toFixed(1)} <small>μm</small></strong></button>)}</div><div className="interfaces-caption"><span>标称深度 0 / 40 / 80 μm</span><span>三峰来自同一帧</span></div></section>
      <section className="controls-section"><div className="control-title"><SlidersHorizontal size={16} /><h2>实验控制</h2><button className="icon-button" aria-label="查看频域 OCT 参数" title="相机像素与加窗设置" onClick={() => openParameters('sampling')}><Settings2 size={15} /></button></div>
        <RangeControl id="sd-sample" label="样品位置" symbol="s" value={settings.sample} min={-20} max={20} step={0.1} unit="μm" hint="参考镜保持固定" onChange={sample => update({ sample })} />
        <RangeControl id="sd-bandwidth" label="光谱带宽" symbol="Δλ" value={settings.bandwidth} min={20} max={80} unit="nm" hint="观察深度峰宽变化" onChange={bandwidth => { update({ bandwidth }); setStep(2); }} />
        <div className="scan-buttons"><button className="primary-button" onClick={() => { setLive(value => !value); setStep(1); }}>{live ? <Pause size={15} /> : <Play size={15} />}{live ? '暂停采集' : '继续采集'}</button><button className="reset-button" onClick={reset}><RotateCcw size={15} /> 重置</button></div>
        <div className={`module-status ${stale ? 'needs-update' : ''}`} role="status">{stale ? '参数已改变，继续采集后更新曲线。' : `理论空气分辨率 ≈ ${result.axialResolution.toFixed(2)} μm（未加窗）`}</div>
      </section>
      <button className="parameter-footer" onClick={() => openParameters('sampling')}><span>λ₀ <b>850 nm</b><i /><b>{settings.pixels} px · {settings.hann ? 'Hann 窗' : '未加窗'}</b></span><span>采样设置 <ChevronRight size={12} /></span></button>
    </aside>
  </LabShell>
  {modal && <InfoModal title={modal === 'guide' ? '一帧光谱，同时读取三个深度' : 'SD-OCT：光谱、采样与 FFT'} onClose={() => setModal(null)}>
    {modal === 'guide' ? <>
      <p className="modal-intro">这是光谱域 OCT（SD-OCT）。光谱仪同时记录不同波长的干涉强度，因此不需要像时域 OCT 一样移动参考镜逐点探测。</p>
      <div className="guide-steps">{STEPS.map((item, i) => <div key={item.title}><b>0{i + 1}</b><section><h3>{item.title}</h3><p>{item.text}</p></section></div>)}</div>
      <div className="modal-note"><Info size={16} /><span>暂停会冻结上一帧；调整参数后可继续采集。切换技术会停止当前实验，并载入该技术的初始状态。</span></div>
    </> : <>
      <div className="segmented notes-tabs"><button className={parameterTab === 'model' ? 'selected' : ''} aria-pressed={parameterTab === 'model'} onClick={() => setParameterTab('model')}>物理模型</button><button className={parameterTab === 'sampling' ? 'selected' : ''} aria-pressed={parameterTab === 'sampling'} onClick={() => setParameterTab('sampling')}>采样设置</button></div>
      {parameterTab === 'sampling' ? <>
        <p className="modal-intro">光谱仪按波长采样，再插值到等 k 网格。像素数改变可用的无混叠深度，窗函数改变峰形。</p>
        <div className="speed-control sampling-select"><label htmlFor="sd-pixels">相机像素</label><div className="select-wrap"><select id="sd-pixels" value={settings.pixels} onChange={e => update({ pixels: Number(e.target.value) })}><option value="512">512 pixels</option><option value="1024">1024 pixels</option><option value="2048">2048 pixels</option></select><ChevronDown size={13} /></div></div>
        <label className="checkbox-control sampling-checkbox"><input type="checkbox" checked={settings.hann} onChange={e => update({ hann: e.target.checked })} /><span>Hann 加窗</span><small>抑制旁瓣，主峰会变宽</small></label>
        <div className="parameter-grid"><div><span>最近采集帧：Nyquist 单程深度</span><strong>{result.nyquistDepth.toFixed(0)} <small>μm（空气）</small></strong></div><div><span>最近采集帧：FFT 补零后长度</span><strong>{captured.pixels * 4}</strong></div></div>
        <div className="modal-note"><Info size={16} /><span>{stale ? '当前采集暂停，设置已改变，继续采集后更新。' : '设置会同步应用到实时采集。'} 四倍补零仅细化深度网格；它不会提高真实轴向分辨率。</span></div>
      </> : <>
        <div className="parameter-grid"><div><span>采集波长范围</span><strong>750–950 <small>nm</small></strong></div><div><span>固定参考镜</span><strong>0 <small>μm</small></strong></div></div>
        <div className="formula-block">k = 2π / λ · xᵢ = 50 + s + n·zᵢ<br />I(λ) = S(λ)[B + 2ε Σ aᵢ cos(2kxᵢ)]<br />等 λ 采样 → 等 k 插值 → 去已知背景 → FFT<br />xⱼ = πj / (M·δk) · Aⱼ = 2|FFTⱼ| / Σ(S·w)</div>
        <p className="formula-description">高斯光谱 S；B = 1 + ε²Σaᵢ²，弱样品场系数 ε = 0.07。忽略样品自相关、噪声、色散和光谱仪响应衰减。固定 n = 1.40、zᵢ = 0 / 40 / 80 μm。FFT 使用真实相机采样，四倍补零后对峰顶做局部对数抛物线插值，不注入标称峰位。</p>
        <p className="formula-description">深度图显示正半轴的等效空气深度；样品内深度需减去 50 μm 基准和样品平移量，再除以 n。实值光谱存在共轭镜像，当前样品始终位于正深度区间。</p>
        <div className="modal-note"><Info size={16} /><span>更多像素主要扩大无混叠深度范围；更宽光谱主要改善轴向分辨率。Hann 窗抑制旁瓣，也会展宽主峰。</span></div>
        <a className="source-link" href="https://www.ncbi.nlm.nih.gov/books/NBK554044/" target="_blank" rel="noreferrer">原理参考：OCT Principle and Technical Realization <ArrowRight size={13} /></a>
      </>}
    </>}
  </InfoModal>}
  </>;
}

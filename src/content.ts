export type ComponentId = 'source' | 'splitter' | 'reference' | 'sample' | 'detector';
export const COMPONENTS: Record<ComponentId, { title: string; en: string; description: string; tip: string }> = {
  source: { title: '低相干光源', en: 'SUPERLUMINESCENT DIODE', description: '宽光谱光源发出的光只在很小的光程差范围内保持相干。这让我们能够区分样品中不同深度的反射。', tip: '中心波长 850 nm · 光谱带宽 50 nm' },
  splitter: { title: '分束器', en: 'BEAM SPLITTER', description: '将入射光分配到参考臂和样品臂。两臂返回的光在这里重新合束，送向探测器。', tip: '理想 50 : 50 分光 · 忽略损耗与多次反射' },
  reference: { title: '参考镜', en: 'REFERENCE MIRROR', description: '沿参考臂移动镜面，连续改变参考光程。当它与某个反射界面的光程接近时，探测器会出现一个干涉信号包。', tip: '镜面移动 Δx → 往返光程改变 2Δx' },
  sample: { title: '三界面分层样品', en: 'LAYERED SAMPLE', description: '光从表面和内部两个界面反射返回。三个信号包分别对应 0、40、80 μm 深度；整体平移样品会让三个信号包一起移动。', tip: '折射率 n = 1.40 · 相对场振幅 1 / 0.70 / 0.48' },
  detector: { title: '光电探测器', en: 'PHOTODETECTOR', description: '接收两臂返回的合束光，将光强变化转换为电信号。右侧显示去除直流背景后的干涉项及其理论包络。', tip: '当前实验为单点深度扫描（A-scan）' },
};

export const SPECTRAL_COMPONENTS: typeof COMPONENTS = {
  ...COMPONENTS,
  reference: { title: '固定参考镜', en: 'FIXED REFERENCE MIRROR', description: '参考镜为所有波长提供共同的参考光程。SD-OCT 无需移动它逐点扫描：所有界面的深度信息同时编码在一帧光谱中。', tip: '本实验参考镜固定 · 不是扫频光源 OCT' },
  detector: { title: '光谱仪与线阵相机', en: 'GRATING + LINE CAMERA', description: '光栅把合束光分开成不同波长，再由线阵相机同时记录干涉光谱。计算机把波长坐标转换为等波数坐标，随后通过 FFT 重建深度。', tip: '色散角度为示意 · 750–950 nm · 512 / 1024 / 2048 pixels' },
  sample: { ...COMPONENTS.sample, description: '同一三界面样品的所有反射同时参与光谱干涉。三个不同的光程延迟形成不同频率的条纹，FFT 将它们分离为三个深度峰。' },
};

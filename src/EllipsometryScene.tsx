import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { EllipsometryResult } from './ellipsometryPhysics';
import type { SceneView } from './LabUI';

export type EllipseComponent = 'light' | 'polarizer' | 'film' | 'analyzer' | 'sensor';
export const ELLIPSE_COMPONENTS = {
  light: { title: '单色光源', en: 'MONOCHROMATIC SOURCE', description: '本实验使用固定 632.8 nm 波长。光源经起偏器后具有相等的 p、s 电场分量，为比较反射后的振幅比与相位差提供已知输入。', tip: '入射光强以起偏器之后的强度 I₀ 为基准' },
  polarizer: { title: '起偏器 P', en: 'POLARIZER · P = 45°', description: '透光轴相对 p 方向固定为 45°，产生等幅、同相的 p 与 s 分量。p 位于入射面内，s 垂直入射面。', tip: '入射 Jones 向量 (1, 1) / √2' },
  film: { title: '薄膜与基底', en: 'AMBIENT / FILM / SUBSTRATE', description: '光在薄膜上、下界面多次反射，叠加后的 p 与 s 复反射系数不同。膜厚与入射角会同时改变振幅比 Ψ 和相位差 Δ。', tip: '理想无吸收常数：n₀ = 1 · n₁ = 1.46 · n₂ = 3.88' },
  analyzer: { title: '检偏器 A', en: 'ROTATING LINEAR ANALYZER', description: '将反射的椭圆偏振光投影到一条透光轴上。转动检偏器会调制探测强度，但不会改变它之前的 Ψ、Δ 或偏振椭圆。', tip: '线性检偏器强度只含 cosΔ；单独使用无法确定完整相位符号' },
  sensor: { title: '光电探测器', en: 'INTENSITY DETECTOR', description: '记录检偏器后透过的光强。右侧曲线显示转动检偏器时的强度响应；游标对应当前检偏器角度。', tip: '显示 I / I₀；Ψ 和 Δ 是 Fresnel 模型真值，不是强度反演结果' },
} as const;

type Props = SceneView & { result: EllipsometryResult; selected: EllipseComponent | null; onSelect: (id: EllipseComponent) => void };
export default function EllipsometryScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const root = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#f5f8f7', 0); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('role', 'img'); renderer.domElement.setAttribute('aria-label', '可旋转缩放的三维薄膜椭偏仪：光源、起偏器、薄膜样品、检偏器和探测器'); root.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 8; controls.maxDistance = 25; controls.maxPolarAngle = Math.PI / 2.05;
    const restore = (top: boolean) => { camera.position.set(...(top ? [0.01, 18, 0.01] : [8.6, 8.0, 12.6]) as [number, number, number]); controls.target.set(0, 1.0, 0); controls.update(); };
    restore(latest.current.topView);
    scene.add(new THREE.HemisphereLight('#ffffff', '#95a99c', 2.1));
    const light = new THREE.DirectionalLight('#fff9ee', 2.6); light.position.set(-4, 12, 7); light.castShadow = true; light.shadow.mapSize.set(2048, 2048); Object.assign(light.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 30 }); light.shadow.normalBias = 0.04; scene.add(light);
    const fill = new THREE.DirectionalLight('#d9e9ff', 1.5); fill.position.set(7, 5, -5); scene.add(fill);
    const mat = (color: string, metalness = 0.2, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const dark = mat('#465956', 0.4), metal = mat('#b5c6c3', 0.65, 0.3), teal = mat('#378b80', 0.4, 0.35);
    const box = (parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number], material: THREE.Material) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
    const cylinder = (parent: THREE.Object3D, radius: number, length: number, pos: [number, number, number], material: THREE.Material, axis: 'y' | 'z' = 'y') => { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 48), material); mesh.position.set(...pos); if (axis === 'z') mesh.rotation.x = Math.PI / 2; mesh.castShadow = true; parent.add(mesh); return mesh; };
    box(scene, [12, 0.28, 7.6], [0, -0.22, 0], mat('#e3eae4', 0.1, 0.9));
    const grid = new THREE.GridHelper(11.5, 23, '#d3ded5', '#e0e7df'); grid.position.y = -0.065; grid.scale.z = 0.64; const gridMat = grid.material as THREE.Material; gridMat.transparent = true; gridMat.opacity = 0.5; scene.add(grid);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: 0.07 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.37; shadow.receiveShadow = true; scene.add(shadow);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 3.8), new THREE.MeshBasicMaterial({ color: '#b0cfc4', transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false })); plane.position.set(0, 2.0, -0.02); scene.add(plane);
    const groups = {} as Record<EllipseComponent, THREE.Group>;
    const labels: { button: HTMLButtonElement; group: THREE.Object3D; offset: THREE.Vector3 }[] = [];
    const poles = {} as Partial<Record<EllipseComponent, THREE.Mesh>>;
    const makeGroup = (id: EllipseComponent) => {
      const group = new THREE.Group(); group.userData.componentId = id; groups[id] = group; scene.add(group);
      const button = document.createElement('button'); button.className = 'scene-label'; button.textContent = ELLIPSE_COMPONENTS[id].title; button.setAttribute('aria-label', `了解${ELLIPSE_COMPONENTS[id].title}`); button.onclick = () => latest.current.onSelect(id); root.appendChild(button); labels.push({ button, group, offset: new THREE.Vector3(0, id === 'film' ? 0.2 : 0.8, id === 'film' ? 1.0 : 0) });
      if (id !== 'film') { poles[id] = cylinder(scene, 0.085, 1, [0, 0.5, -0.3], metal); cylinder(group, 0.46, 0.12, [0, -0.4, 0], dark); }
      return group;
    };
    const source = makeGroup('light'); box(source, [0.95, 0.85, 1.25], [0, 0, -0.2], teal); cylinder(source, 0.24, 0.35, [0, 0, 0.57], metal, 'z'); cylinder(source, 0.16, 0.02, [0, 0, 0.76], mat('#efc581'), 'z');
    for (let i = 0; i < 5; i++) box(source, [0.7, 0.03, 0.035], [0, 0.44, -0.6 + i * 0.18], dark);
    const makePolarizer = (id: 'polarizer' | 'analyzer') => {
      const group = makeGroup(id);
      cylinder(group, 0.49, 0.13, [0, 0, 0], dark, 'z');
      cylinder(group, 0.39, 0.14, [0, 0, 0], new THREE.MeshPhysicalMaterial({ color: id === 'polarizer' ? '#d4c292' : '#7fbcae', transparent: true, opacity: 0.48, roughness: 0.12, metalness: 0.1 }), 'z');
      const rotor = new THREE.Group(); group.add(rotor);
      for (let i = -2; i <= 2; i++) box(rotor, [0.64 - Math.abs(i) * 0.07, 0.016, 0.015], [0, i * 0.11, -0.09], mat(id === 'polarizer' ? '#ae9561' : '#4e9985'));
      box(rotor, [0.12, 0.04, 0.06], [0.52, 0, 0], metal);
      return { group, rotor };
    };
    const polarizer = makePolarizer('polarizer'); polarizer.rotor.rotation.z = Math.PI / 4;
    const film = makeGroup('film'); film.position.y = 1.2;
    box(film, [2.75, 0.17, 2.5], [0, -1.03, 0], dark); cylinder(film, 0.24, 0.45, [0, -0.72, 0], metal);
    const substrate = box(film, [2.15, 0.45, 1.85], [0, -0.4, 0], mat('#667d85', 0.5, 0.35));
    const coating = box(film, [2.15, 1, 1.85], [0, -0.1, 0], new THREE.MeshPhysicalMaterial({ color: '#84c7b2', transparent: true, opacity: 0.65, roughness: 0.12, metalness: 0.2 }));
    const analyzer = makePolarizer('analyzer');
    const sensor = makeGroup('sensor'); box(sensor, [0.95, 0.85, 0.95], [0, 0, 0.1], dark); cylinder(sensor, 0.27, 0.2, [0, 0, -0.5], metal, 'z'); cylinder(sensor, 0.18, 0.02, [0, 0, -0.61], mat('#214f49', 0.3, 0.2), 'z'); box(sensor, [0.58, 0.3, 0.03], [0, 0.05, 0.59], mat('#9fd8bd'));
    const normal = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.21, 0), new THREE.Vector3(0, 3.8, 0)]), new THREE.LineDashedMaterial({ color: '#a4b4a1', dashSize: 0.11, gapSize: 0.08 })); normal.computeLineDistances(); scene.add(normal);
    const angleLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#bd9a5e' })); scene.add(angleLine);
    const angleAnchor = new THREE.Object3D(); scene.add(angleAnchor);
    const angleLabel = document.createElement('button'); angleLabel.className = 'scene-label angle-label'; angleLabel.setAttribute('aria-label', '了解入射角'); angleLabel.onclick = () => latest.current.onSelect('film'); root.appendChild(angleLabel); labels.push({ button: angleLabel, group: angleAnchor, offset: new THREE.Vector3() });
    const beams = ['#d5ac6d', '#44a68e'].map(color => { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })); scene.add(mesh); return mesh; });
    const waves = ['#d5ac6d', '#2e9b89', '#7ca2b5'].map(color => { const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(241 * 3), 3)); const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.82 })); line.frustumCulled = false; scene.add(line); return line; });
    const clickables: THREE.Object3D[] = []; Object.values(groups).forEach(group => group.traverse(child => { if (child instanceof THREE.Mesh) clickables.push(child); }));
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let start = [0, 0];
    const pick = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera); let item: THREE.Object3D | undefined = raycaster.intersectObjects(clickables, false)[0]?.object; while (item && !item.userData.componentId) item = item.parent ?? undefined; return item?.userData.componentId as EllipseComponent | undefined; };
    const down = (e: PointerEvent) => { start = [e.clientX, e.clientY]; };
    const up = (e: PointerEvent) => { if (Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 5) { const id = pick(e); if (id) latest.current.onSelect(id); } };
    const move = (e: PointerEvent) => { renderer.domElement.style.cursor = pick(e) ? 'pointer' : 'grab'; };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointermove', move);
    const resize = () => { const { width, height } = root.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(root); resize();
    const sDirection = new THREE.Vector3(0, 0, 1), target = new THREE.Vector3(0, 1.2, 0), projected = new THREE.Vector3();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lastView = latest.current.resetKey, lastTop = latest.current.topView;
    renderer.setAnimationLoop(time => {
      const props = latest.current, result = props.result, { incidence, thickness, analyzer: a } = result.settings;
      if (lastView !== props.resetKey || lastTop !== props.topView) { restore(props.topView); lastView = props.resetKey; lastTop = props.topView; }
      const theta = incidence * Math.PI / 180, A = a * Math.PI / 180;
      const incoming = new THREE.Vector3(Math.sin(theta), -Math.cos(theta), 0), outgoing = new THREE.Vector3(Math.sin(theta), Math.cos(theta), 0);
      const pi = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0), pr = new THREE.Vector3(-Math.cos(theta), Math.sin(theta), 0);
      source.position.copy(target).addScaledVector(incoming, -4.2); polarizer.group.position.copy(target).addScaledVector(incoming, -2.65); analyzer.group.position.copy(target).addScaledVector(outgoing, 2.65); sensor.position.copy(target).addScaledVector(outgoing, 4.2);
      const qi = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(pi, sDirection, incoming));
      const qr = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(pr, sDirection, outgoing));
      source.quaternion.copy(qi); polarizer.group.quaternion.copy(qi); analyzer.group.quaternion.copy(qr); sensor.quaternion.copy(qr); analyzer.rotor.rotation.z = A;
      Object.entries(poles).forEach(([id, pole]) => { const pos = groups[id as EllipseComponent].position; pole!.position.set(pos.x, (pos.y - 0.35) / 2, -0.3); pole!.scale.y = Math.max(0.1, pos.y - 0.35); });
      const filmHeight = thickness / 500 * 0.32; coating.visible = thickness > 0; coating.scale.y = Math.max(0.001, filmHeight); coating.position.y = -filmHeight / 2; substrate.position.y = -filmHeight - 0.225;
      beams.forEach((beam, i) => { const end = i === 0 ? source.position.clone().addScaledVector(incoming, 0.76) : sensor.position.clone().addScaledVector(outgoing, -0.61); const direction = end.clone().sub(target); beam.position.copy(target).add(end).multiplyScalar(0.5); beam.scale.y = direction.length(); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); });
      const arc = Array.from({ length: 40 }, (_, i) => new THREE.Vector3(-0.9 * Math.sin(theta * i / 39), 1.2 + 0.9 * Math.cos(theta * i / 39), 0.025)); angleLine.geometry.setFromPoints(arc); angleAnchor.position.set(-1.06 * Math.sin(theta / 2), 1.2 + 1.06 * Math.cos(theta / 2), 0.06); angleLabel.textContent = `θ = ${incidence.toFixed(1)}°`;
      const phaseTime = reducedMotion ? 0 : time * 0.002, delta = result.delta * Math.PI / 180, norm = Math.max(result.pAmplitude, result.sAmplitude, 1e-9);
      waves.forEach((wave, waveIndex) => {
        const values = wave.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i <= 240; i++) {
          const t = i / 240, phase = 2 * Math.PI * 4 * t - phaseTime;
          const point = target.clone();
          if (waveIndex === 0) { point.addScaledVector(incoming, -2.45 + t * 2.15).addScaledVector(pi, 0.18 * Math.cos(phase)).addScaledVector(sDirection, 0.18 * Math.cos(phase)); }
          else if (waveIndex === 1) { point.addScaledVector(outgoing, 0.25 + t * 2.15).addScaledVector(pr, 0.28 * result.pAmplitude / norm * Math.cos(phase - delta)).addScaledVector(sDirection, 0.28 * result.sAmplitude / norm * Math.cos(phase)); }
          else { point.addScaledVector(outgoing, 2.85 + t * 0.65).addScaledVector(pr, 0.35 * Math.sqrt(result.intensity) * Math.cos(A) * Math.cos(phase)).addScaledVector(sDirection, 0.35 * Math.sqrt(result.intensity) * Math.sin(A) * Math.cos(phase)); }
          values.setXYZ(i, point.x, point.y, point.z);
        }
        values.needsUpdate = true;
      });
      controls.update(); renderer.render(scene, camera);
      const { width, height } = root.getBoundingClientRect();
      labels.forEach(({ button, group, offset }) => { projected.copy(group.position).add(offset).project(camera); const x = (projected.x + 1) / 2 * width, y = (1 - projected.y) / 2 * height; button.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`; button.style.display = props.labels && projected.z < 1 && x > 45 && x < width - 45 && y > 25 && y < height - 25 ? 'block' : 'none'; button.classList.toggle('selected', group.userData.componentId === props.selected); });
    });
    const lost = (event: Event) => { event.preventDefault(); setFailed(true); }; renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => { renderer.setAnimationLoop(null); observer.disconnect(); controls.dispose(); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('webglcontextlost', lost); scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose()); } }); renderer.dispose(); renderer.domElement.remove(); labels.forEach(label => label.button.remove()); };
  }, []);
  return <div className="scene-host" ref={host}>{failed && <div className="webgl-error"><strong>3D 视图暂不可用</strong><p>请在支持 WebGL 的浏览器中开启硬件加速。右侧偏振与强度实验仍可使用。</p></div>}</div>;
}

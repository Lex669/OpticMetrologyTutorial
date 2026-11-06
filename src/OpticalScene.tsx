import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COMPONENTS, SPECTRAL_COMPONENTS } from './content';
import type { ComponentId } from './content';
import { nearestInterface, signalAt } from './physics';

type Props = { mode?: 'td' | 'sd'; focusInterface?: number; reference: number; sample: number; selected: ComponentId | null; onSelect: (id: ComponentId) => void; resetKey: number; topView: boolean; labels: boolean };

export default function OpticalScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = host.current!;
    const spectral = latest.current.mode === 'sd';
    const components = spectral ? SPECTRAL_COMPONENTS : COMPONENTS;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor('#f5f8f7', 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', spectral ? '可旋转缩放的三维光谱域 OCT 系统，包含光栅与线阵相机' : '可旋转缩放的三维迈克耳孙光学系统');
    renderer.domElement.setAttribute('role', 'img');
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 26;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minPolarAngle = 0.01;
    const restore = (top: boolean) => {
      camera.position.set(...(top ? [0.01, 19, 0.01] : [10.5, 10.5, 12.8]) as [number, number, number]);
      controls.target.set(0, 0.3, -0.7);
      controls.update();
    };
    restore(false);
    scene.add(new THREE.HemisphereLight('#ffffff', '#8b9f94', 2.6));
    const sun = new THREE.DirectionalLight('#fff9ed', 3);
    sun.position.set(-4, 12, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 30 });
    sun.shadow.bias = -0.001; sun.shadow.normalBias = 0.04;
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#d7e9ff', 1.7); fill.position.set(7, 6, -6); scene.add(fill);

    const material = (color: string, metalness = 0.2, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const silver = material('#a8b9bd', 0.65, 0.32);
    const charcoal = material('#435456', 0.5, 0.4);
    const pale = material('#e0e7e5', 0.45, 0.38);
    const teal = material('#327f77', 0.45, 0.36);
    const box = (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const cylinder = (parent: THREE.Object3D, radius: number, height: number, position: [number, number, number], mat: THREE.Material, axis = 'y') => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 48), mat); mesh.position.set(...position);
      if (axis === 'x') mesh.rotation.z = Math.PI / 2;
      if (axis === 'z') mesh.rotation.x = Math.PI / 2;
      mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    box(scene, [12.2, 0.32, 10.2], [0, -0.23, -0.55], material('#dae3df', 0.1, 0.85));
    const boardCanvas = document.createElement('canvas'); boardCanvas.width = 128; boardCanvas.height = 128;
    const boardCtx = boardCanvas.getContext('2d')!;
    boardCtx.fillStyle = '#ecf0ed'; boardCtx.fillRect(0, 0, 128, 128);
    boardCtx.fillStyle = '#c5cfca'; boardCtx.beginPath(); boardCtx.arc(64, 64, 5, 0, Math.PI * 2); boardCtx.fill();
    const texture = new THREE.CanvasTexture(boardCanvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(24, 20);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(12.15, 10.15), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
    board.rotation.x = -Math.PI / 2; board.position.set(0, -0.06, -0.55); board.receiveShadow = true; scene.add(board);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.07 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.41; floor.receiveShadow = true; scene.add(floor);

    const groups = {} as Record<ComponentId, THREE.Group>;
    const clickables: THREE.Object3D[] = [];
    const rings = {} as Record<ComponentId, THREE.Mesh>;
    const labelItems: { button: HTMLButtonElement; id: ComponentId; offset: THREE.Vector3 }[] = [];
    const makeGroup = (id: ComponentId, x: number, z: number) => {
      const group = new THREE.Group(); group.position.set(x, 0, z); group.userData.componentId = id; groups[id] = group; scene.add(group);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.81, 64), new THREE.MeshBasicMaterial({ color: '#168579', transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; group.add(ring); rings[id] = ring;
      const button = document.createElement('button'); button.className = `scene-label label-${id}`; button.textContent = components[id].title;
      button.setAttribute('aria-label', `了解${components[id].title}`);
      button.onclick = () => latest.current.onSelect(id);
      element.appendChild(button);
      labelItems.push({ button, id, offset: new THREE.Vector3(id === 'sample' ? 0.6 : 0, id === 'sample' ? 2.65 : 2.25, 0) });
      return group;
    };
    const mount = (group: THREE.Group, height = 0.6) => {
      cylinder(group, 0.48, 0.12, [0, 0.08, 0], charcoal);
      cylinder(group, 0.12, height, [0, 0.15 + height / 2, 0], silver);
      cylinder(group, 0.18, 0.13, [0, 0.2, 0], silver);
    };
    const source = makeGroup('source', -4, 0); mount(source);
    box(source, [1.35, 1.05, 1.15], [0, 1.2, 0], teal);
    box(source, [0.08, 0.87, 0.98], [0.69, 1.2, 0], charcoal);
    cylinder(source, 0.3, 0.35, [0.85, 1.2, 0], silver, 'x');
    cylinder(source, 0.2, 0.04, [1.04, 1.2, 0], material('#ffcc75', 0.3, 0.18), 'x');
    for (let i = 0; i < 5; i++) box(source, [0.06, 0.025, 0.9], [-0.42 + i * 0.18, 1.735, 0], charcoal);
    cylinder(source, 0.045, 0.03, [-0.4, 1.38, 0.59], material('#b5ebca'), 'z');

    const splitter = makeGroup('splitter', 0, 0); mount(splitter, 0.45);
    box(splitter, [1.15, 0.13, 1.15], [0, 0.7, 0], charcoal);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#a4dbd4', transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    box(splitter, [0.95, 0.95, 0.95], [0, 1.2, 0], glass);
    const splitPlane = box(splitter, [0.025, 0.93, 1.3], [0, 1.2, 0], new THREE.MeshStandardMaterial({ color: '#75aca9', transparent: true, opacity: 0.6, metalness: 0.6, roughness: 0.15, side: THREE.DoubleSide })); splitPlane.rotation.y = Math.PI / 4;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.95, 0.95, 0.95)), new THREE.LineBasicMaterial({ color: '#739e98', transparent: true, opacity: 0.5 })); edge.position.y = 1.2; splitter.add(edge);

    if (!spectral) {
      box(scene, [1.5, 0.13, 3.1], [0, 0.02, -3.9], pale);
      box(scene, [0.2, 0.1, 3.0], [-0.55, 0.13, -3.9], silver); box(scene, [0.2, 0.1, 3.0], [0.55, 0.13, -3.9], silver);
    }
    const reference = makeGroup('reference', 0, -2.7);
    box(reference, [1.3, 0.22, 0.9], [0, 0.29, 0], charcoal); mount(reference, 0.55);
    cylinder(reference, 0.65, 0.2, [0, 1.2, 0], charcoal, 'z');
    cylinder(reference, 0.53, 0.04, [0, 1.2, 0.12], material('#d2e8ec', 0.92, 0.09), 'z');
    for (const x of [-0.6, 0.6]) cylinder(reference, 0.08, 0.25, [x, 1.2, 0], silver, 'z');

    const sample = makeGroup('sample', 3.15, 0);
    box(sample, [1.8, 0.2, 2], [0.35, 0.15, 0], charcoal);
    box(sample, [1.55, 0.15, 1.8], [0.35, 0.32, 0], silver);
    const layerColors = ['#48a496', '#80b4ce', '#b3a0cb'];
    const layers: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const layer = box(sample, [0.045, 1.48, 1.5], [i * 0.48, 1.2, 0], new THREE.MeshPhysicalMaterial({ color: layerColors[i], transparent: true, opacity: 0.65, roughness: 0.18, side: THREE.DoubleSide, metalness: 0.12, depthWrite: false })); layers.push(layer);
      const badge = document.createElement('button');
      badge.className = `scene-label scene-interface-label interface-badge-${i}`;
      badge.textContent = ['①', '②', '③'][i];
      badge.setAttribute('aria-label', `了解样品界面 ${i + 1}，深度 ${i * 40} 微米`);
      badge.onclick = () => latest.current.onSelect('sample');
      element.appendChild(badge);
      labelItems.push({ button: badge, id: 'sample', offset: new THREE.Vector3(i * 0.48, 1.1, 1.0) });
      if (i < 2) box(sample, [0.43, 1.45, 1.48], [i * 0.48 + 0.24, 1.2, 0], new THREE.MeshPhysicalMaterial({ color: layerColors[i], transparent: true, opacity: 0.09, roughness: 0.2, depthWrite: false }));
    }
    const detector = makeGroup('detector', 0, 3); mount(detector, 0.48);
    if (spectral) {
      box(detector, [2.15, 0.2, 2.1], [0, 0.8, 0.15], charcoal);
      box(detector, [0.12, 0.7, 2.1], [-1.02, 1.2, 0.15], pale);
      box(detector, [0.12, 0.7, 2.1], [1.02, 1.2, 0.15], pale);
      cylinder(detector, 0.22, 0.17, [0, 1.2, -0.9], silver, 'z');
      const grating = box(detector, [0.9, 0.55, 0.06], [0, 1.2, -0.1], material('#c7b68d', 0.7, 0.24)); grating.rotation.y = 0.35;
      for (let i = 0; i < 12; i++) { const groove = box(detector, [0.014, 0.5, 0.02], [-0.4 + i * 0.07, 1.2, -0.04], silver); groove.rotation.y = 0.35; }
      const spectrumColors = ['#bc91c7', '#849cce', '#78b9d5', '#64baac', '#a6bf78', '#d0b976', '#d5a085'];
      for (let i = 0; i < 7; i++) {
        const end = new THREE.Vector3(-0.7 + i * 0.235, 1.2, 0.92);
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.2, -0.05), end]);
        detector.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: spectrumColors[i], transparent: true, opacity: 0.9 })));
        box(detector, [0.17, 0.35, 0.06], [end.x, 1.2, 0.96], material(spectrumColors[i], 0.15, 0.4));
      }
      box(detector, [1.9, 0.55, 0.12], [0, 1.1, 1.08], charcoal);
      labelItems.find(item => item.id === 'detector')!.offset.set(0, 2.1, 1.0);
    } else {
      box(detector, [1.25, 1.08, 0.8], [0, 1.2, 0], charcoal);
      cylinder(detector, 0.34, 0.16, [0, 1.2, -0.48], silver, 'z');
      cylinder(detector, 0.24, 0.02, [0, 1.2, -0.57], material('#254e50', 0.5, 0.15), 'z');
      box(detector, [0.83, 0.4, 0.03], [0, 1.27, 0.42], material('#ace0c9', 0.1, 0.35));
    }
    const wirePoints = [new THREE.Vector3(0.6, 0.7, 3), new THREE.Vector3(1.2, 0.2, 3), new THREE.Vector3(1.7, 0.05, 2.4), new THREE.Vector3(2.6, 0.05, 2.6)];
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePoints), 32, 0.035, 8, false), charcoal));

    Object.values(groups).forEach(group => group.traverse(child => { if (child instanceof THREE.Mesh && !Object.values(rings).includes(child)) clickables.push(child); }));
    const beamGroup = new THREE.Group(); scene.add(beamGroup);
    const beamDefinitions = [
      { color: '#dfa449', from: new THREE.Vector3(-2.97, 1.2, 0), to: new THREE.Vector3(0, 1.2, 0) },
      { color: '#dfa449', from: new THREE.Vector3(0, 1.2, 0), to: new THREE.Vector3(0, 1.2, -2.57) },
      { color: '#2aaf94', from: new THREE.Vector3(0, 1.2, 0), to: new THREE.Vector3(4.1, 1.2, 0) },
      { color: '#42acaa', from: new THREE.Vector3(0, 1.2, 0), to: new THREE.Vector3(0, 1.2, 2.43) },
    ];
    const beams = beamDefinitions.map(def => {
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 12), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.88 }));
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1, 12), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.065, depthWrite: false }));
      beamGroup.add(core, glow);
      const particles = Array.from({ length: 4 }, () => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: def.color })); beamGroup.add(p); return p; });
      return { ...def, core, glow, particles };
    });
    const setSegment = (mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) => { const direction = to.clone().sub(from); mesh.position.copy(from).add(to).multiplyScalar(0.5); mesh.scale.y = direction.length(); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickables, false)[0];
      let target: THREE.Object3D | undefined = hit?.object;
      while (target && !target.userData.componentId) target = target.parent ?? undefined;
      return target?.userData.componentId as ComponentId | undefined;
    };
    let pointerStart = [0, 0];
    const down = (event: PointerEvent) => { pointerStart = [event.clientX, event.clientY]; };
    const up = (event: PointerEvent) => { if (Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) < 5) { const id = pick(event); if (id) latest.current.onSelect(id); } };
    const move = (event: PointerEvent) => { renderer.domElement.style.cursor = pick(event) ? 'pointer' : 'grab'; };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointermove', move);
    const resize = () => { const { width, height } = element.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    let lastReset = latest.current.resetKey, lastTop = latest.current.topView;
    const projected = new THREE.Vector3();
    renderer.setAnimationLoop((time) => {
      const p = latest.current;
      if (p.resetKey !== lastReset || p.topView !== lastTop) { restore(p.topView); lastReset = p.resetKey; lastTop = p.topView; }
      // A common 0.012 scene unit / µm gain for both translations; static arm geometry is schematic.
      reference.position.z = -2.7 - p.reference * 0.012;
      sample.position.x = 3.15 + p.sample * 0.012;
      beams[1].to.z = reference.position.z + 0.13; beams[2].to.x = sample.position.x + 0.96;
      const nearest = spectral ? (p.focusInterface ?? 0) : nearestInterface(p.reference, p.sample);
      const matched = spectral || signalAt(p.reference, p.sample).envelope > 0.08;
      layers.forEach((layer, i) => { const mat = layer.material as THREE.MeshPhysicalMaterial; mat.emissive.set(i === nearest && matched ? layerColors[i] : '#000000'); mat.emissiveIntensity = i === nearest && matched ? 0.5 : 0; });
      Object.entries(rings).forEach(([id, ring]) => { ring.visible = p.selected === id || (id === 'sample' && matched); });
      controls.update();
      beams.forEach(beam => {
        setSegment(beam.core, beam.from, beam.to); setSegment(beam.glow, beam.from, beam.to);
        beam.particles.forEach((particle, i) => { const t = (time * 0.00024 + i / 4) % 1; particle.position.lerpVectors(beam.from, beam.to, i % 2 === 0 ? t : 1 - t); });
      });
      renderer.render(scene, camera);
      const { width, height } = element.getBoundingClientRect();
      labelItems.forEach(item => {
        projected.copy(groups[item.id].position).add(item.offset).project(camera);
        const x = (projected.x * 0.5 + 0.5) * width, y = (-projected.y * 0.5 + 0.5) * height;
        item.button.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        item.button.style.display = p.labels && projected.z < 1 && x > 45 && x < width - 45 && y > 18 && y < height - 18 ? 'block' : 'none';
        item.button.classList.toggle('selected', p.selected === item.id);
      });
    });
    const contextLost = (event: Event) => { event.preventDefault(); setFailed(true); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    return () => {
      renderer.setAnimationLoop(null); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { object.geometry.dispose(); const mats = Array.isArray(object.material) ? object.material : [object.material]; mats.forEach(mat => mat.dispose()); } }); texture.dispose(); renderer.dispose();
      labelItems.forEach(item => item.button.remove()); renderer.domElement.remove();
    };
  }, [props.mode]);
  return <div className="scene-host" ref={host}>{failed && <div className="webgl-error"><strong>3D 视图暂不可用</strong><p>请在支持 WebGL 的浏览器中开启硬件加速后刷新。右侧扫描实验仍可使用。</p></div>}</div>;
}

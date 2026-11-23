import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Dimensions in the data are illustrative millimetres. No host styles or state are changed.
const TAU = Math.PI * 2;
const GROUP_COLORS = { red: '#ed655e', green: '#70aa77', yellow: '#e9b63e' };
const PRESETS = {
  silicon: { color: '#35475d', metalness: .6, roughness: .25 },
  sic: { color: '#182633', metalness: .55, roughness: .23 },
  quartz: { color: '#e7f7ff', metalness: 0, roughness: .08, transmission: .9, thickness: .16, ior: 1.46 },
  sapphire: { color: '#d8ebf5', metalness: .05, roughness: .16, transmission: .5, thickness: .08, ior: 1.76 },
  aln: { color: '#e5e5dc', metalness: .06, roughness: .42 },
  alumina: { color: '#f4f3ee', metalness: .03, roughness: .45 },
  peek: { color: '#d8b875', metalness: .05, roughness: .29 },
  pai: { color: '#bc874a', metalness: .06, roughness: .3 },
  aluminum: { color: '#bdcbd7', metalness: .82, roughness: .3 },
  'coated-al': { color: '#d9e1e6', metalness: .38, roughness: .35 },
  graphite: { color: '#263a50', metalness: .5, roughness: .28 },
  gasket: { color: '#d5a768', metalness: .02, roughness: .34 },
  wafer: { color: '#637eab', metalness: .85, roughness: .15, iridescence: 1, iridescenceIOR: 1.36, iridescenceThicknessRange: [160, 440], clearcoat: 1, clearcoatRoughness: .08 },
  plasma: { color: '#c8adff', metalness: 0, roughness: 1, emissive: '#a47bfa', emissiveIntensity: .45, opacity: .15, depthWrite: false }
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const out = t => 1 - (1 - t) ** 3;

function profilePoints(spec, scale) {
  const points = spec.profile || [
    [spec.rInner, spec.yBottom], [spec.rOuter, spec.yBottom],
    [spec.rOuter, spec.yTop], [spec.rInner, spec.yTop]
  ];
  const result = points.map(([r, y]) => new THREE.Vector2(r * scale, y * scale));
  if (!result[0].equals(result[result.length - 1])) result.push(result[0].clone());
  return result;
}

function surfaceMaterial(key, mobile, cap = false) {
  const props = { ...(PRESETS[key] || PRESETS.aluminum) };
  if (mobile && props.transmission) {
    props.transmission = 0;
    props.opacity = key === 'quartz' ? .3 : .6;
    props.depthWrite = false;
  }
  if (cap) {
    props.color = new THREE.Color(props.color).lerp(new THREE.Color('#ffffff'), .18);
    props.transmission = 0;
    props.opacity = key === 'quartz' ? .68 : key === 'plasma' ? .12 : 1;
  }
  const material = new THREE.MeshPhysicalMaterial({
    ...props, transparent: true, side: THREE.DoubleSide,
    envMapIntensity: key === 'wafer' ? 1.3 : .8
  });
  material.userData.rest = {
    color: material.color.clone(), opacity: material.opacity,
    emissive: material.emissive.clone(), intensity: material.emissiveIntensity
  };
  return material;
}

// LatheGeometry leaves its radial ends open; these two triangulated profiles seal them.
function revolved(spec, scale, segments, start, length, mobile, resources) {
  const group = new THREE.Group();
  const profile = profilePoints(spec, scale);
  const material = surfaceMaterial(spec.material, mobile);
  const skin = new THREE.Mesh(new THREE.LatheGeometry(profile, segments, start, length), material);
  group.add(skin);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#526779', transparent: true, opacity: .22, depthWrite: false });
  const addEdges = mesh => {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), edgeMaterial);
    edges.rotation.copy(mesh.rotation);
    group.add(edges);
  };
  addEdges(skin);
  if (length < TAU - .001) {
    const shape = new THREE.Shape(profile.slice(0, -1));
    const capMaterial = surfaceMaterial(spec.material, mobile, true);
    for (const [index, phi] of [start, start + length].entries()) {
      const geometry = new THREE.ShapeGeometry(shape);
      if (index === 1) {
        const indices = geometry.index;
        for (let i = 0; i < indices.count; i += 3) {
          const a = indices.getX(i);
          indices.setX(i, indices.getX(i + 2));
          indices.setX(i + 2, a);
        }
        geometry.computeVertexNormals();
      }
      const cap = new THREE.Mesh(geometry, capMaterial);
      cap.rotation.y = phi - Math.PI / 2;
      group.add(cap);
      addEdges(cap);
    }
  }
  resources.add(material);
  return group;
}

function isInSweep(phi, start, length) {
  return ((phi - start) % TAU + TAU) % TAU <= length + .00001;
}

function addPorts(group, spec, scale, start, length, mobile) {
  if (!spec.ports) return;
  const positions = [];
  for (const radius of spec.ports.rings) {
    const count = Math.max(8, Math.round(TAU * radius / spec.ports.spacing));
    for (let i = 0; i < count; i++) {
      const angle = i / count * TAU;
      if (isInSweep(angle, start, length)) positions.push([Math.sin(angle) * radius * scale, Math.cos(angle) * radius * scale]);
    }
  }
  const geometry = new THREE.CircleGeometry(spec.ports.radius * scale, mobile ? 6 : 10);
  const material = new THREE.MeshBasicMaterial({ color: '#223243', transparent: true, opacity: .72, side: THREE.DoubleSide });
  // Clean inset dots, on both faces, rather than thousands of boolean hole meshes.
  const holes = new THREE.InstancedMesh(geometry, material, positions.length * 2);
  const dummy = new THREE.Object3D();
  dummy.rotation.x = -Math.PI / 2;
  positions.forEach(([x, z], i) => {
    for (let face = 0; face < 2; face++) {
      dummy.position.set(x, (face ? spec.yBottom - .06 : spec.yTop + .06) * scale, z);
      dummy.updateMatrix();
      holes.setMatrixAt(i * 2 + face, dummy.matrix);
    }
  });
  group.add(holes);
}

function makeShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 63);
  gradient.addColorStop(0, 'rgba(35,55,76,.22)');
  gradient.addColorStop(.45, 'rgba(35,55,76,.11)');
  gradient.addColorStop(1, 'rgba(35,55,76,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, toneMapped: false
  }));
  shadow.rotation.x = -Math.PI / 2;
  return shadow;
}

const STYLE = `
.c3d-root{position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;isolation:isolate;color:#283e50;font:15px/1.4 system-ui,-apple-system,sans-serif;background:transparent}
.c3d-root canvas.c3d-canvas{display:block;width:100%;height:100%;outline:none;touch-action:pan-y}
.c3d-root canvas.c3d-canvas:focus-visible{outline:2px solid #078f97;outline-offset:-3px}
.c3d-root .c3d-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.c3d-root .c3d-label{position:absolute;left:0;top:0;display:flex;align-items:center;gap:0;pointer-events:none;will-change:transform}
.c3d-root .c3d-label[hidden]{display:none}
.c3d-root .c3d-leader{position:absolute;left:0;top:50%;height:1px;width:26px;background:#7fb4ff;opacity:.55;pointer-events:none;z-index:-1}
.c3d-root .c3d-label button{pointer-events:auto;cursor:pointer;white-space:nowrap;font:500 15px/1.3 system-ui,-apple-system,sans-serif;padding:6px 10px;border:1px solid rgba(140,180,255,.28);border-radius:30px;background:rgba(10,26,54,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#dbe7ff;box-shadow:0 4px 18px rgba(0,0,0,.25)}
.c3d-root .c3d-label[data-active=true] button{color:#fff;border-color:#22d3ee;background:rgba(34,211,238,.22);box-shadow:0 0 22px rgba(34,211,238,.35)}
.c3d-root .c3d-label[data-active=true] .c3d-leader{background:#22d3ee;opacity:1}
.c3d-root .c3d-hint{position:absolute;left:18px;bottom:14px;margin:0;font-size:12px;letter-spacing:.03em;color:#7f9cc8;pointer-events:none}
@media(max-width:600px){.c3d-root .c3d-leader{width:14px}.c3d-root .c3d-label button{padding:5px 8px}.c3d-root .c3d-hint{font-size:11px}}
`;

/**
 * Mount an isolated chamber explorer. Callbacks always use existing chambers.json IDs.
 * Either ID of a paired 2D ring selects the same mesh. Picking emits its first (canonical) ID.
 * select() is silent; only user actions invoke onSelect. Unknown IDs clear selection.
 */
export function mountChamber3D(container, { chamber, geo, materials = [], lang = 'ko' }, { onHover = () => {}, onSelect = () => {} } = {}) {
  if (!container || !chamber || !geo) throw new TypeError('mountChamber3D requires container, chamber and geo');
  const noopAPI = { select() {}, setExploded() {}, setView() {}, resize() {}, destroy() {} };
  const canvas = document.createElement('canvas');
  let renderer;
  try {
    const options = { alpha: true, antialias: true, powerPreference: 'high-performance' };
    const context = canvas.getContext('webgl2', options) || canvas.getContext('webgl', options);
    if (!context) throw new Error('WebGL unavailable');
    renderer = new THREE.WebGLRenderer({ canvas, context, ...options });
  } catch {
    container.setAttribute('data-webgl', 'off');
    return noopAPI;
  }
  container.removeAttribute('data-webgl');
  const mobileQuery = window.matchMedia('(max-width: 700px), (pointer: coarse)');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = mobileQuery.matches;
  let reduced = motionQuery.matches;
  const scale = geo.scale || .01;
  const segments = mobile ? 48 : 96;
  const start = geo.section?.phiStart ?? Math.PI / 2;
  const length = geo.section?.phiLength ?? Math.PI * 1.5;
  const root = document.createElement('div');
  root.className = 'c3d-root';
  const style = document.createElement('style');
  style.textContent = STYLE;
  root.append(style);
  canvas.className = 'c3d-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', lang === 'ko' ? '입체 챔버 구조. 끌어서 회전하고 부품을 선택하세요. 방향키로 회전, 더하기와 빼기로 확대, Escape로 선택 해제.' : '3D chamber. Drag to orbit, select a part. Arrow keys orbit, plus and minus zoom, Escape clears selection.');
  root.append(canvas);
  const overlay = document.createElement('div');
  overlay.className = 'c3d-labels';
  root.append(overlay);
  const hint = document.createElement('p');
  hint.className = 'c3d-hint';
  hint.textContent = lang === 'ko' ? '끌어서 회전 · 두 손가락으로 확대 · 부품을 눌러 탐색' : 'Drag to orbit · Pinch to zoom · Select a component';
  root.append(hint);
  container.append(root);

  renderer.setPixelRatio(mobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor('#000000', 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#eff8ff', '#b3b8c4', 2.1));
  const key = new THREE.DirectionalLight('#ffffff', 3.4);
  key.position.set(4, 7, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#7cc8ff', 3.2);
  rim.position.set(-5, 4, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#fff1dc', .9);
  fill.position.set(-3, 1, 5);
  scene.add(fill);
  let environmentTarget;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment(renderer);
  try {
    environmentTarget = pmrem.fromScene(room, .04);
    scene.environment = environmentTarget.texture;
  } finally {
    room.dispose();
    pmrem.dispose();
  }
  const model = new THREE.Group();
  scene.add(model);
  const shadow = makeShadow();
  if (shadow) scene.add(shadow);
  const camera = new THREE.PerspectiveCamera(34, 1, .05, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = !reduced;
  controls.dampingFactor = .09;
  controls.minPolarAngle = .28;
  controls.maxPolarAngle = Math.PI * .79;
  controls.minDistance = 4.4;
  controls.maxDistance = 24;
  controls.rotateSpeed = .65;
  controls.zoomSpeed = .7;
  // One finger scrolls the page; two fingers orbit and zoom on touch screens.
  controls.touches.ONE = null;
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  canvas.style.touchAction = 'pan-y';

  const resources = new Set();
  const entries = [];
  const idMap = new Map();
  const originals = new Map(chamber.parts.map(p => [p.id, p]));
  const materialMap = new Map(materials.map(m => [m.id, m]));
  const pickLists = { section: [], full: [] };
  let view = 'section';
  let selected = null;
  let hovered = null;
  let selectionId = null;
  let hoveredId = null;
  let destroyed = false;
  let contextLost = false;
  let visible = true;
  let sized = false;
  let width = 1;
  let height = 1;
  let raf = 0;
  let inFrame = false;
  let dirty = true;
  let lastTime = 0;
  let elapsed = 0;
  let exploded = false;
  let explodeAmount = 0;
  let explodeTween = null;
  let cameraTween = null;
  let interacting = false;
  let entranceDone = reduced;
  let down = null;
  let gestureMoved = false;
  const pointers = new Set();
  const parallax = new THREE.Vector2();
  const smoothParallax = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const projected = new THREE.Vector3();
  const world = new THREE.Vector3();
  const markerQuaternion = new THREE.Quaternion();
  const pulses = [];

  function invalidate() {
    dirty = true;
    if (!destroyed && !contextLost && visible && sized && !document.hidden && !raf && !inFrame) raf = requestAnimationFrame(frame);
  }

  function addMarkers(entry) {
    const groups = [...new Set(entry.original.materials.map(id => materialMap.get(id)?.color).filter(c => GROUP_COLORS[c]))];
    groups.forEach((color, i) => {
      const phi = start + .025 + i * .085;
      const marker = new THREE.Group();
      const radius = entry.spec.kind === 'pins' ? entry.spec.centersRadius + 8 : entry.spec.rOuter + 3;
      marker.position.set(Math.sin(phi) * radius * scale, (entry.spec.yTop + 3) * scale, Math.cos(phi) * radius * scale);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(.037, 12, 8), new THREE.MeshStandardMaterial({
        color: GROUP_COLORS[color], emissive: GROUP_COLORS[color], emissiveIntensity: .55, roughness: .3, metalness: .12
      }));
      marker.add(sphere);
      const ring = new THREE.Mesh(new THREE.RingGeometry(.045, .053, 24), new THREE.MeshBasicMaterial({
        color: GROUP_COLORS[color], transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide
      }));
      marker.add(ring);
      entry.group.add(marker);
      pulses.push({ marker, ring, phase: i * .28 + entries.length * .17 });
      for (const mode of ['section', 'full']) {
        sphere.userData.entry = entry;
        pickLists[mode].push(sphere);
      }
    });
  }

  function addEntry(spec, original = null) {
    const group = new THREE.Group();
    const entry = { spec, original, group, variants: {}, label: null, index: entries.length, materials: [] };
    for (const mode of ['section', 'full']) {
      const variant = new THREE.Group();
      const sweep = mode === 'section' ? length : TAU;
      if (spec.kind === 'pins') {
        for (const phi of spec.angles) {
          // Pins are complete small revolutions, omitted only when their centres are in the cut-out.
          if (mode === 'section' && !isInSweep(phi, start, length)) continue;
          const pin = revolved(spec, scale, mobile ? 12 : 20, 0, TAU, mobile, resources);
          pin.position.set(Math.sin(phi) * spec.centersRadius * scale, 0, Math.cos(phi) * spec.centersRadius * scale);
          variant.add(pin);
        }
      } else {
        variant.add(revolved(spec, scale, segments, start, sweep, mobile, resources));
        addPorts(variant, spec, scale, start, sweep, mobile);
      }
      if (spec.topCoat) {
        variant.add(revolved({ ...spec, profile: null, material: spec.topCoat, yBottom: spec.yTop + .04, yTop: spec.yTop + .5 }, scale, segments, start, sweep, mobile, resources));
      }
      variant.visible = mode === view;
      variant.traverse(object => {
        if (object.isMesh) {
          if (original) {
            object.userData.entry = entry;
            pickLists[mode].push(object);
          } else if (spec.material !== 'plasma') {
            // Walls and the wafer occlude picks; they never emit invented part IDs.
            object.userData.occluder = true;
            pickLists[mode].push(object);
          }
          if (object.material.userData.rest) entry.materials.push(object.material);
        }
      });
      entry.variants[mode] = variant;
      group.add(variant);
    }
    if (original) {
      idMap.set(spec.id, entry);
      for (const id of spec.aliases || []) idMap.set(id, entry);
      addMarkers(entry);
      const label = document.createElement('div');
      label.className = 'c3d-label';
      label.hidden = true;
      const leader = document.createElement('span');
      leader.className = 'c3d-leader';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = original.name;
      button.setAttribute('aria-label', `${original.name} — ${lang === 'ko' ? '부품 선택' : 'select component'}`);
      button.addEventListener('click', () => userSelect(spec.id));
      button.addEventListener('pointerenter', () => hover(entry));
      button.addEventListener('pointerleave', event => { if (event.relatedTarget !== canvas && !overlay.contains(event.relatedTarget)) parallax.set(0, 0); hover(null); });
      button.addEventListener('focus', () => hover(entry));
      button.addEventListener('blur', () => hover(null));
      label.append(leader, button);
      overlay.append(label);
      entry.label = label;
    }
    entries.push(entry);
    model.add(group);
  }
  for (const spec of geo.structure || []) addEntry(spec);
  for (const spec of geo.parts) {
    const original = originals.get(spec.id);
    if (!original) throw new Error(`Unknown chamber part ID: ${spec.id}`);
    addEntry(spec, original);
  }
  if (geo.wafer) addEntry({ ...geo.wafer, material: 'wafer' });
  if (geo.plasma) addEntry({ ...geo.plasma, material: 'plasma' });
  // Height order, rather than data order, controls the stacking entrance.
  const ranked = [...entries].sort((a, b) => b.spec.yTop - a.spec.yTop);
  ranked.forEach((entry, i) => { entry.delay = i * Math.min(.06, .85 / Math.max(1, ranked.length - 1)); });

  const modelBounds = new THREE.Box3().setFromObject(model);
  const homeTarget = modelBounds.getCenter(new THREE.Vector3());
  const modelSize = modelBounds.getSize(new THREE.Vector3());
  const modelRadius = Math.max(modelSize.x, modelSize.z) / 2;
  const baseFloor = modelBounds.min.y;
  if (shadow) shadow.position.y = baseFloor - .025;
  camera.position.copy(homeTarget).add(new THREE.Vector3(7.2, 5, 8));
  controls.target.copy(homeTarget);
  controls.update();

  function fitDistance(tall = false) {
    const vertical = modelSize.y + (tall ? 2.9 : 0);
    const halfHeight = vertical * .5 + modelRadius * .38;
    const halfWidth = modelRadius * 1.13;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov * .5));
    return clamp(Math.max(halfHeight / tan, halfWidth / (tan * camera.aspect)) * 1.16, 7.5, 23);
  }

  function focus(entry, duration = .8) {
    const target = homeTarget.clone();
    let distance = fitDistance(exploded);
    if (entry) {
      target.set(0, ((entry.spec.yBottom + entry.spec.yTop) / 2 + (entry.spec.explodeY || 0) * Number(exploded)) * scale, 0);
      model.localToWorld(target);
      const radius = (entry.spec.kind === 'pins' ? entry.spec.centersRadius : entry.spec.rOuter) * scale;
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      distance = clamp(radius * 1.25 / (tan * Math.min(1, camera.aspect)), 5, 21);
    } else if (exploded) {
      target.y += .24;
    }
    const direction = camera.position.clone().sub(controls.target).normalize();
    if (!direction.lengthSq()) direction.set(.55, .4, .7).normalize();
    const end = target.clone().addScaledVector(direction, distance);
    if (reduced) {
      controls.target.copy(target);
      camera.position.copy(end);
      camera.lookAt(target);
      cameraTween = null;
    } else {
      cameraTween = { start: elapsed, duration, from: camera.position.clone(), to: end, fromTarget: controls.target.clone(), toTarget: target };
    }
    invalidate();
  }

  function updateHighlight() {
    const active = hovered || selected;
    for (const entry of entries) {
      const lit = entry === hovered || entry === selected;
      const dim = Boolean(active && !lit);
      for (const material of entry.materials) {
        const rest = material.userData.rest;
        material.color.copy(rest.color);
        if (dim) material.color.lerp(new THREE.Color('#edf2f5'), .25);
        material.opacity = rest.opacity * (dim ? .76 : 1);
        material.emissive.copy(lit ? new THREE.Color('#13b5b1') : rest.emissive);
        material.emissiveIntensity = lit ? .35 : rest.intensity;
      }
      if (entry.label) {
        entry.label.dataset.active = String(lit);
        entry.label.querySelector('button').setAttribute('aria-pressed', String(entry === selected));
      }
    }
    canvas.style.cursor = hovered ? 'pointer' : interacting ? 'grabbing' : 'grab';
    invalidate();
  }

  function hover(entry) {
    if (entry === hovered) return;
    hovered = entry;
    hoveredId = entry?.spec.id || null;
    updateHighlight();
    onHover(hoveredId);
  }

  function select(id) {
    if (destroyed || contextLost) return;
    selected = id == null ? null : idMap.get(id) || null;
    selectionId = selected ? id : null;
    updateHighlight();
    focus(selected);
  }

  function userSelect(id) {
    select(id);
    onSelect(selectionId);
  }

  function setExploded(value) {
    if (destroyed || contextLost || exploded === Boolean(value)) return;
    exploded = Boolean(value);
    if (reduced) { explodeAmount = Number(exploded); explodeTween = null; }
    else explodeTween = { start: elapsed, from: explodeAmount, to: Number(exploded) };
    focus(selected, 1);
    invalidate();
  }

  function setView(next) {
    if (destroyed || contextLost || !['section', 'full'].includes(next) || next === view) return;
    view = next;
    for (const entry of entries) {
      entry.variants.section.visible = view === 'section';
      entry.variants.full.visible = view === 'full';
    }
    hover(null);
    invalidate();
  }

  function resize() {
    if (destroyed || contextLost) return;
    const rect = container.getBoundingClientRect();
    sized = rect.width > 0 && rect.height > 0;
    if (!sized) { stop(); return; }
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Refitting on resize keeps the 300 mm wafer inside narrow mobile viewports.
    focus(selected, .3);
    invalidate();
  }

  function hit(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const first = raycaster.intersectObjects(pickLists[view], false)[0];
    return first?.object.userData.entry || null;
  }

  function pointerMove(event) {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) gestureMoved = true;
    if (event.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    parallax.set(clamp((event.clientX - rect.left) / Math.max(1, rect.width) - .5, -.5, .5), clamp((event.clientY - rect.top) / Math.max(1, rect.height) - .5, -.5, .5));
    if (!interacting) hover(hit(event));
    invalidate();
  }
  function pointerDown(event) {
    pointers.add(event.pointerId);
    if (pointers.size > 1) gestureMoved = true;
    else {
      gestureMoved = false;
      down = { x: event.clientX, y: event.clientY, id: event.pointerId, time: performance.now(), button: event.button };
    }
    cameraTween = null;
  }
  function pointerUp(event) {
    const tap = down && down.id === event.pointerId && pointers.size === 1 && !gestureMoved && down.button === 0 && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 7 && performance.now() - down.time < 700;
    pointers.delete(event.pointerId);
    if (tap) userSelect(hit(event)?.spec.id || null);
    if (!pointers.size) { down = null; interacting = false; }
    invalidate();
  }
  function pointerCancel(event) {
    pointers.delete(event.pointerId);
    down = null;
    gestureMoved = true;
    interacting = false;
    invalidate();
  }
  // Moving onto a label pill is not leaving the chamber: keep the hover and tilt so the scene stays still.
  function pointerLeave(event) { if (overlay.contains(event.relatedTarget)) return; hover(null); parallax.set(0, 0); invalidate(); }
  function controlStart() { interacting = true; cameraTween = null; hover(null); invalidate(); }
  function controlEnd() { interacting = false; invalidate(); }
  function keyDown(event) {
    if (event.key === 'Escape') { userSelect(null); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) return;
    event.preventDefault();
    cameraTween = null;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= .12;
    if (event.key === 'ArrowRight') spherical.theta += .12;
    if (event.key === 'ArrowUp') spherical.phi -= .1;
    if (event.key === 'ArrowDown') spherical.phi += .1;
    if (event.key === '+' || event.key === '=') spherical.radius *= .9;
    if (event.key === '-') spherical.radius *= 1.1;
    spherical.phi = clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    spherical.radius = clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
    invalidate();
  }

  function updateLabels() {
    const candidates = [];
    for (const entry of entries) {
      if (!entry.label) continue;
      const active = entry === selected || entry === hovered;
      if (!active && !exploded) { entry.label.hidden = true; continue; }
      const phi = start + .01;
      const radius = (entry.spec.kind === 'pins' ? entry.spec.centersRadius : entry.spec.rOuter) * scale;
      world.set(Math.sin(phi) * radius, (entry.spec.yTop + 2) * scale, Math.cos(phi) * radius);
      entry.group.localToWorld(world);
      projected.copy(world).project(camera);
      if (projected.z > 1 || projected.z < -1 || Math.abs(projected.x) > 1.05 || Math.abs(projected.y) > 1.05) { entry.label.hidden = true; continue; }
      const x = (projected.x * .5 + .5) * width;
      const y = (-projected.y * .5 + .5) * height;
      candidates.push({ entry, active, pinned: entry === selected, x, y });
    }
    // Prioritise the selected part only; hover must not reshuffle the layout, or the pill slides out from under the cursor.
    candidates.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.y - b.y);
    const placed = [];
    for (const item of candidates) {
      const { entry, active, pinned } = item;
      const label = entry.label;
      const estimatedWidth = Math.max(100, entry.original.name.length * 7.8 + 50);
      const x = clamp(item.x + 26, 6, Math.max(6, width - estimatedWidth - 6));
      let y = clamp(item.y, 24, height - 44);
      let attempts = 0;
      const collides = candidate => placed.some(p => Math.abs(candidate - p.y) < 38 && x < p.x + p.w && x + estimatedWidth > p.x);
      while (collides(y) && attempts++ < 10) y += 39;
      if (y > height - 32) {
        y = clamp(item.y - 39, 22, height - 44);
        while (collides(y) && y > 45) y -= 39;
      }
      if (collides(y) && !pinned) { label.hidden = true; continue; }
      label.hidden = false;
      label.style.transform = `translate(${x.toFixed(1)}px,${(y - 16).toFixed(1)}px)`;
      label.style.zIndex = active ? '3' : '1';
      label.style.opacity = active ? '1' : '.8';
      placed.push({ x, y, w: estimatedWidth });
      // The leader points back to the projected part even when the pill is nudged.
      const leader = label.firstElementChild;
      const dx = item.x - x;
      const dy = item.y - y;
      leader.style.width = `${Math.hypot(dx, dy)}px`;
      leader.style.transformOrigin = 'left center';
      leader.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    }
  }

  function frame(time) {
    raf = 0;
    if (destroyed || contextLost || !visible || !sized || document.hidden) { lastTime = 0; return; }
    inFrame = true;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
    lastTime = time;
    elapsed += dt;
    dirty = false;
    if (explodeTween) {
      const t = clamp(elapsed - explodeTween.start, 0, 1);
      explodeAmount = THREE.MathUtils.lerp(explodeTween.from, explodeTween.to, ease(t));
      if (t === 1) explodeTween = null;
    }
    if (!entranceDone && elapsed > 1.4) entranceDone = true;
    for (const entry of entries) {
      const intro = entranceDone ? 0 : .85 * (1 - out(clamp((elapsed - entry.delay) / .48, 0, 1)));
      entry.group.position.y = (entry.spec.explodeY || 0) * scale * explodeAmount + intro;
    }
    const shadowFloor = baseFloor + Math.min(0, ...(geo.structure || []).map(s => (s.explodeY || 0) * scale * explodeAmount));
    if (shadow) { shadow.position.y = shadowFloor - .025; shadow.material.opacity = 1 - explodeAmount * .35; }
    const auto = !reduced && !interacting && !down && !selected && !hovered && !cameraTween;
    if (auto) model.rotation.y += .08 * dt;
    smoothParallax.lerp(reduced || interacting ? new THREE.Vector2() : parallax, 1 - Math.exp(-dt * 7));
    model.rotation.x = reduced ? 0 : smoothParallax.y * .035;
    model.rotation.z = reduced ? 0 : -smoothParallax.x * .025;
    if (cameraTween) {
      const t = clamp((elapsed - cameraTween.start) / cameraTween.duration, 0, 1);
      camera.position.lerpVectors(cameraTween.from, cameraTween.to, ease(t));
      controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, ease(t));
      camera.lookAt(controls.target);
      if (t === 1) cameraTween = null;
    }
    controls.update();
    for (const { marker, ring, phase } of pulses) {
      const t = reduced ? 0 : ((elapsed + phase) % 2) / 2;
      ring.scale.setScalar(reduced ? 1 : 1 + .6 * t);
      ring.material.opacity = reduced ? .6 : 1 - t;
      // Cancel the model's rotation so that the pulse always faces the camera.
      marker.getWorldQuaternion(markerQuaternion).invert().multiply(camera.quaternion);
      ring.quaternion.copy(markerQuaternion);
    }
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    updateLabels();
    renderer.render(scene, camera);
    inFrame = false;
    const moving = !reduced || !entranceDone || explodeTween || cameraTween || interacting;
    if (moving || dirty) invalidate();
  }

  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; lastTime = 0; }
  function visibilityChange() { if (document.hidden) stop(); else invalidate(); }
  function motionChange(event) {
    reduced = event.matches;
    controls.enableDamping = !reduced;
    if (reduced) {
      entranceDone = true;
      explodeAmount = Number(exploded);
      explodeTween = null;
      if (cameraTween) {
        camera.position.copy(cameraTween.to);
        controls.target.copy(cameraTween.toTarget);
        cameraTween = null;
      }
    }
    invalidate();
  }
  function loseContext(event) {
    event.preventDefault();
    contextLost = true;
    stop();
    root.hidden = true;
    container.setAttribute('data-webgl', 'off');
    container.dispatchEvent(new CustomEvent('chamber3d:webgl-off'));
  }
  function restoreContext() {
    if (destroyed) return;
    contextLost = false;
    root.hidden = false;
    container.removeAttribute('data-webgl');
    resize();
    container.dispatchEvent(new CustomEvent('chamber3d:webgl-restored'));
  }

  controls.addEventListener('change', invalidate);
  controls.addEventListener('start', controlStart);
  controls.addEventListener('end', controlEnd);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerleave', pointerLeave);
  canvas.addEventListener('keydown', keyDown);
  canvas.addEventListener('webglcontextlost', loseContext);
  canvas.addEventListener('webglcontextrestored', restoreContext);
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerCancel);
  document.addEventListener('visibilitychange', visibilityChange);
  motionQuery.addEventListener('change', motionChange);
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(container);
  if (!resizeObserver) window.addEventListener('resize', resize);
  const intersection = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(records => {
    visible = records[records.length - 1].isIntersecting;
    if (visible) invalidate(); else stop();
  }, { threshold: 0 }) : null;
  intersection?.observe(container);
  resize();

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stop();
    intersection?.disconnect();
    resizeObserver?.disconnect();
    controls.removeEventListener('change', invalidate);
    controls.removeEventListener('start', controlStart);
    controls.removeEventListener('end', controlEnd);
    controls.dispose();
    canvas.removeEventListener('pointermove', pointerMove);
    canvas.removeEventListener('pointerdown', pointerDown);
    canvas.removeEventListener('pointerleave', pointerLeave);
    canvas.removeEventListener('keydown', keyDown);
    canvas.removeEventListener('webglcontextlost', loseContext);
    canvas.removeEventListener('webglcontextrestored', restoreContext);
    window.removeEventListener('pointerup', pointerUp);
    window.removeEventListener('pointercancel', pointerCancel);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', visibilityChange);
    motionQuery.removeEventListener('change', motionChange);
    const geometries = new Set();
    const renderMaterials = new Set(resources);
    const textures = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of [].concat(object.material || [])) renderMaterials.add(material);
    });
    for (const material of renderMaterials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    geometries.forEach(geometry => geometry.dispose());
    textures.forEach(texture => texture.dispose());
    environmentTarget?.dispose();
    scene.environment = null;
    renderer.dispose();
    renderer.forceContextLoss();
    root.remove();
    entries.length = pulses.length = pickLists.section.length = pickLists.full.length = 0;
    idMap.clear();
  }
  return { select, setExploded, setView, resize, destroy };
}

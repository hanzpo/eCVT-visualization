import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Z, R, CARRIER_R, makeGear, makeRingGear, meshExternal, meshInternal } from './gears.js';

export const COLORS = {
  amber: 0xffb454,
  cyan: 0x4fd6e3,
  green: 0x74d67e,
};

const mat = {
  steel: new THREE.MeshStandardMaterial({ color: 0xb9bfc8, metalness: 0.85, roughness: 0.38 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x848b98, metalness: 0.85, roughness: 0.42 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.9, roughness: 0.3 }),
  cast: new THREE.MeshStandardMaterial({ color: 0x565d68, metalness: 0.6, roughness: 0.6 }),
  housing: new THREE.MeshStandardMaterial({ color: 0x757d89, metalness: 0.75, roughness: 0.5 }),
  block: new THREE.MeshStandardMaterial({ color: 0x3a4049, metalness: 0.5, roughness: 0.65 }),
  cover: new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.4, roughness: 0.5 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.9, roughness: 0.35 }),
  lamination: new THREE.MeshStandardMaterial({ color: 0x2e333b, metalness: 0.7, roughness: 0.45 }),
  ghost: new THREE.MeshStandardMaterial({
    color: 0x9fb2c8, metalness: 0.7, roughness: 0.3,
    transparent: true, opacity: 0.32, depthWrite: false,
  }),
  tire: new THREE.MeshStandardMaterial({ color: 0x15171b, metalness: 0.1, roughness: 0.95 }),
  rim: new THREE.MeshStandardMaterial({ color: 0x6e7681, metalness: 0.85, roughness: 0.35 }),
  cable: new THREE.MeshStandardMaterial({ color: 0xc4581a, metalness: 0.2, roughness: 0.6 }),
  battery: new THREE.MeshStandardMaterial({ color: 0x2b3340, metalness: 0.55, roughness: 0.5 }),
  marker: new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.3, roughness: 0.7 }),
};

const PLANETS = 4;
const AXLE_Y = -(R.ringOut + R.final);      // -4.83
export const GROUND_Y = AXLE_Y - 1.8;        // tire radius 1.8

const X = {
  engine: -6.6, pulley: -8.05, mg1: -3.5, planetary: -1.15, mg2: 1.15,
};

function cyl(r, len, material, seg = 40) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateZ(Math.PI / 2); // axis along X
  return new THREE.Mesh(g, material);
}

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

// Radial stripe markers so spinning cylinders read as spinning.
function addMarkers(parent, radius, halfLen, count = 3) {
  for (let i = 0; i < count; i++) {
    const m = box(halfLen * 2 * 0.96, 0.06, 0.05, mat.marker);
    const a = (i / count) * Math.PI * 2;
    m.position.set(0, Math.cos(a) * radius, Math.sin(a) * radius);
    m.rotation.x = -a;
    parent.add(m);
  }
}

function makeLabel(text, color, anchor, { rpm = false, lead = 26 } = {}) {
  const el = document.createElement('div');
  el.className = 'label3d';
  el.style.setProperty('--c', color);
  el.style.setProperty('--lead', lead + 'px');
  el.innerHTML = `<span class="label3d-name">${text}</span>` +
    (rpm ? `<span class="label3d-rpm">0 rpm</span>` : '');
  const obj = new CSS2DObject(el);
  obj.position.copy(anchor);
  obj.center.set(0.5, 1);
  return { obj, el, rpmEl: rpm ? el.querySelector('.label3d-rpm') : null };
}

function makeMotor({ x, statorR, statorLen, rotorR, group }) {
  const g = new THREE.Group();
  g.position.x = x;
  const stator = cyl(statorR, statorLen, mat.housing, 48);
  // cooling fins
  for (let i = 0; i < 10; i++) {
    const fin = cyl(statorR + 0.05, 0.05, mat.cover, 48);
    fin.position.x = -statorLen / 2 + (i + 0.5) * (statorLen / 10);
    g.add(fin);
  }
  const windL = new THREE.Mesh(new THREE.TorusGeometry(rotorR + 0.32, 0.16, 14, 40), mat.copper);
  windL.rotation.y = Math.PI / 2;
  windL.position.x = -statorLen / 2 - 0.06;
  const windR = windL.clone();
  windR.position.x = statorLen / 2 + 0.06;
  const rotor = new THREE.Group();
  const rotorBody = cyl(rotorR, statorLen + 0.5, mat.steel, 36);
  rotor.add(rotorBody);
  addMarkers(rotor, rotorR + 0.01, (statorLen + 0.5) / 2);
  g.add(stator, windL, windR, rotor);
  group.add(g);
  return rotor;
}

function makeGhostDisc(rOuter, rInner, thickness, holes = 6, holeR = 0.42, holeAt = 0.62) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOuter, 0, Math.PI * 2, false);
  const hub = new THREE.Path();
  hub.absarc(0, 0, rInner, 0, Math.PI * 2, true);
  shape.holes.push(hub);
  for (let i = 0; i < holes; i++) {
    const a = ((i + 0.5) / holes) * Math.PI * 2;
    const r = rInner + (rOuter - rInner) * holeAt;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * r, Math.sin(a) * r, holeR, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness / 2);
  return new THREE.Mesh(geo, mat.ghost);
}

export function buildMachine(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // Everything on the main shaft line lives in a group whose local +Z
  // points down world +X, so gear rotation is child.rotation.z.
  const axis = new THREE.Group();
  axis.rotation.y = Math.PI / 2;
  root.add(axis);

  /* ---------- ICE engine ---------- */
  const engine = new THREE.Group();
  engine.position.set(X.engine, 0.15, 0);
  const blockM = box(2.5, 2.1, 2.05, mat.block);
  const head = box(2.5, 0.55, 1.85, mat.cast); head.position.y = 1.3;
  const cover = box(2.35, 0.4, 1.7, mat.cover); cover.position.y = 1.75;
  for (let i = 0; i < 4; i++) {
    const coil = cyl(0.14, 0.3, mat.cover, 16);
    coil.rotation.z = 0; coil.geometry = new THREE.CylinderGeometry(0.14, 0.14, 0.3, 16);
    coil.position.set(-0.9 + i * 0.6, 2.05, 0);
    engine.add(coil);
    const rib = box(0.08, 0.42, 1.72, mat.cast);
    rib.position.set(-0.9 + i * 0.6 + 0.3, 1.75, 0);
    engine.add(rib);
  }
  const pan = box(2.1, 0.5, 1.6, mat.cover); pan.position.y = -1.25;
  engine.add(blockM, head, cover, pan);
  // exhaust manifold on the front face
  for (let i = 0; i < 4; i++) {
    const bend = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.09, 10, 14, Math.PI / 2),
      mat.darkSteel,
    );
    bend.position.set(-0.9 + i * 0.6, 0.72, 1.12);
    bend.rotation.y = Math.PI / 2;
    engine.add(bend);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 10), mat.darkSteel);
    pipe.position.set(-0.9 + i * 0.6, 0.42, 1.54);
    engine.add(pipe);
  }
  const collector = box(2.1, 0.24, 0.24, mat.darkSteel);
  collector.position.set(-0.05, 0.06, 1.54);
  engine.add(collector);
  root.add(engine);

  // bell housing joining engine to the transaxle
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.18, 0.95, 40), mat.housing);
  bell.geometry.rotateZ(Math.PI / 2);
  bell.position.set(-4.85, 0, 0);
  root.add(bell);

  // crank pulley + damper on the accessory end (spins with carrier speed)
  const pulley = new THREE.Group();
  pulley.position.z = X.pulley; // axis-local: z is world x
  const pDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.22, 40), mat.darkSteel);
  pDisc.rotation.x = Math.PI / 2;
  pulley.add(pDisc);
  const pMark = box(0.14, 1.5, 0.06, mat.marker);
  pMark.position.z = 0.09;
  pulley.add(pMark);
  axis.add(pulley);

  // input shaft engine → carrier
  const input = cyl(0.16, 3.7, mat.steel, 20);
  input.position.x = (X.pulley + X.planetary) / 2 + 0.1;
  root.add(input);

  /* ---------- MG1 / MG2 ---------- */
  const mg1Rotor = makeMotor({ x: X.mg1, statorR: 1.5, statorLen: 1.45, rotorR: 0.72, group: root });
  const mg2Rotor = makeMotor({ x: X.mg2, statorR: 1.85, statorLen: 1.7, rotorR: 0.95, group: root });

  // hollow sun shaft MG1 → sun gear
  const sunShaft = cyl(0.44, 1.65, mat.brass, 24);
  sunShaft.position.x = (X.mg1 + 0.75 + X.planetary) / 2;
  root.add(sunShaft);

  /* ---------- planetary gearset ---------- */
  const planetary = new THREE.Group();
  planetary.position.z = X.planetary;
  axis.add(planetary);

  const sun = makeGear({ z: Z.sun, thickness: 0.5, hole: 0.3, material: mat.brass });
  planetary.add(sun);

  const ring = makeRingGear({ thickness: 0.55, material: mat.darkSteel });
  planetary.add(ring);

  const carrier = new THREE.Group();
  const plate = makeGhostDisc(2.35, 0.55, 0.12, 4, 0.5, 0.55);
  plate.position.z = -0.45;
  carrier.add(plate);
  const hub = cyl(0.5, 0.35, mat.cast, 24);
  hub.rotation.z = 0; hub.geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 24);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = -0.55;
  carrier.add(hub);
  const planets = [];
  for (let k = 0; k < PLANETS; k++) {
    const a = (k / PLANETS) * Math.PI * 2;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.95, 16), mat.steel);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(Math.cos(a) * CARRIER_R, Math.sin(a) * CARRIER_R, -0.1);
    carrier.add(pin);
    const planet = makeGear({ z: Z.planet, thickness: 0.5, hole: 0.17, material: mat.steel });
    planet.position.set(Math.cos(a) * CARRIER_R, Math.sin(a) * CARRIER_R, 0);
    planetary.add(planet);
    planets.push(planet);
  }
  planetary.add(carrier);

  // MG2 → ring flange (ghosted so the gearset stays visible)
  const flange = makeGhostDisc(2.8, 1.0, 0.1, 6, 0.45, 0.6);
  flange.position.z = X.planetary + 0.5;
  axis.add(flange);
  const flangeTube = cyl(1.0, 1.1, mat.ghost, 32);
  flangeTube.position.x = X.planetary + 1.05;
  root.add(flangeTube);

  /* ---------- final drive + wheels ---------- */
  const finalAxis = new THREE.Group();
  finalAxis.position.y = AXLE_Y;
  finalAxis.rotation.y = Math.PI / 2;
  root.add(finalAxis);

  const finalGear = makeGear({ z: Z.final, thickness: 0.55, hole: 0.3, material: mat.darkSteel });
  finalGear.position.z = X.planetary;
  finalAxis.add(finalGear);

  const diff = cyl(0.75, 1.3, mat.cast, 28);
  diff.position.set(X.planetary + 0.95, AXLE_Y, 0);
  root.add(diff);

  const axle = cyl(0.14, 12.6, mat.darkSteel, 16);
  axle.position.y = AXLE_Y;
  root.add(axle);

  const wheels = [];
  for (const wx of [-6.3, 6.3]) {
    const w = new THREE.Group();
    w.position.set(wx, AXLE_Y, 0);
    const tire = cyl(1.8, 0.85, mat.tire, 48);
    const rim = cyl(1.02, 0.9, mat.rim, 36);
    for (let s = 0; s < 5; s++) {
      const spoke = box(0.92, 0.3, 1.7, mat.cover);
      spoke.rotation.x = (s / 5) * Math.PI * 2;
      w.add(spoke);
    }
    w.add(tire, rim);
    root.add(w);
    wheels.push(w);
  }

  /* ---------- battery + inverter + cables ---------- */
  const pcu = new THREE.Group();
  pcu.position.set(-2.6, 2.95, -2.3);
  const pcuBody = box(2.0, 0.95, 1.45, mat.housing);
  pcu.add(pcuBody);
  for (let i = 0; i < 6; i++) {
    const fin = box(1.9, 0.32, 0.07, mat.cover);
    fin.position.set(0, 0.62, -0.62 + i * 0.25);
    pcu.add(fin);
  }
  root.add(pcu);

  const battery = new THREE.Group();
  battery.position.set(3.8, -5.0, -3.6);
  const battBody = box(3.2, 1.3, 1.8, mat.battery);
  battery.add(battBody);
  for (let i = 0; i < 7; i++) {
    const rib = box(0.06, 1.2, 1.84, mat.cover);
    rib.position.x = -1.35 + i * 0.45;
    battery.add(rib);
  }
  const battGlowMat = new THREE.MeshStandardMaterial({
    color: 0x11141a, emissive: COLORS.amber, emissiveIntensity: 0.0,
    metalness: 0.3, roughness: 0.5,
  });
  const battGlow = box(3.0, 0.28, 0.06, battGlowMat);
  battGlow.position.set(0, 0.28, 0.93);
  battery.add(battGlow);
  for (const [fx, fz] of [[-1.3, -0.7], [-1.3, 0.7], [1.3, -0.7], [1.3, 0.7]]) {
    const foot = box(0.3, 1.05, 0.3, mat.cover);
    foot.position.set(fx, -1.15, fz);
    battery.add(foot);
  }
  root.add(battery);

  const cablePaths = {
    pcuMg1: [[-3.6, 2.8, -2.2], [-3.95, 2.4, -1.2], [-3.6, 1.8, -0.3], [-3.5, 1.45, 0]],
    pcuMg2: [[-1.55, 2.8, -2.2], [0.2, 2.6, -1.4], [1.15, 2.15, -0.35], [1.15, 1.8, 0]],
    battPcu: [[-2.2, 2.8, -3.0], [0.4, 2.3, -3.9], [2.6, -1.2, -4.3], [3.3, -3.8, -3.9], [3.3, -4.35, -3.3]],
  };
  const curves = {};
  for (const [key, pts] of Object.entries(cablePaths)) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    curves[key] = curve;
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.06, 10), mat.cable);
    root.add(tube);
  }

  /* ---------- flow particles ---------- */
  const dotTex = makeDotTexture();
  const flows = {};
  for (const [key, curve] of Object.entries(curves)) {
    const n = 12;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const material = new THREE.PointsMaterial({
      size: 0.34, map: dotTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: COLORS.amber, opacity: 0,
    });
    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    root.add(points);
    flows[key] = { curve, points, material, n, t: 0 };
  }

  /* ---------- shadows ---------- */
  root.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
  });

  /* ---------- labels ---------- */
  const labels = {
    engine: makeLabel('Engine', '#ffb454', new THREE.Vector3(X.engine, 2.75, 0), { rpm: true }),
    mg1: makeLabel('MG1', '#74d67e', new THREE.Vector3(X.mg1, 2.15, 0), { rpm: true }),
    planetary: makeLabel('Planetary gearset', '#e8e0d0', new THREE.Vector3(X.planetary, 3.85, 0), { lead: 20 }),
    mg2: makeLabel('MG2', '#4fd6e3', new THREE.Vector3(X.mg2, 2.55, 0), { rpm: true }),
    pcu: makeLabel('Inverter', '#d0d6de', new THREE.Vector3(-3.1, 4.55, -2.3), { lead: 30 }),
    battery: makeLabel('Battery', '#74d67e', new THREE.Vector3(4.4, -3.9, -3.2), { lead: 14 }),
    final: makeLabel('Final drive to wheels', '#d0d6de', new THREE.Vector3(X.planetary, AXLE_Y - 2.4, 1.2), { lead: 14 }),
  };
  for (const l of Object.values(labels)) scene.add(l.obj);

  /* ---------- ground ---------- */
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(60, 64),
    new THREE.MeshStandardMaterial({ color: 0x0d1013, metalness: 0.1, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = GROUND_Y;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(120, 60, 0x1e2630, 0x141a21);
  grid.position.y = GROUND_Y + 0.02;
  scene.add(grid);

  /* ---------- per-frame update ---------- */
  const VIS = 0.002; // rpm → rad/s on screen
  let sunA = 0, carA = 0;
  const P2 = Math.PI * 2;

  function update(sim, dt, time) {
    sunA = (sunA + sim.sun * VIS * dt) % P2;
    carA = (carA + sim.engine * VIS * dt) % P2;

    sun.rotation.z = sunA;
    carrier.rotation.z = carA;
    pulley.rotation.z = carA;
    mg1Rotor.rotation.x = sunA;

    let ringA = 0;
    for (let k = 0; k < PLANETS; k++) {
      const theta = carA + (k / PLANETS) * P2;
      const phase = meshExternal(sunA, Z.sun, Z.planet, theta);
      const p = planets[k];
      p.position.set(Math.cos(theta) * CARRIER_R, Math.sin(theta) * CARRIER_R, 0);
      p.rotation.z = phase;
      if (k === 0) ringA = meshInternal(phase, Z.planet, Z.ring, theta);
    }
    ring.rotation.z = ringA;
    flange.rotation.z = ringA;
    mg2Rotor.rotation.x = ringA;

    const finalA = meshExternal(ringA, Z.ringOut, Z.final, -Math.PI / 2);
    finalGear.rotation.z = finalA;
    axle.rotation.x = finalA;
    diff.rotation.x = finalA;
    for (const w of wheels) w.rotation.x = finalA;

    // engine idle shake when running
    const shake = sim.vibe * Math.min(1, sim.engine / 3000);
    engine.position.y = 0.15 + Math.sin(time * 55) * 0.012 * shake;
    engine.position.z = Math.cos(time * 47) * 0.008 * shake;

    // power-flow particles (battPcu curve is drawn PCU→battery, so a
    // positive battery→PCU flow moves particles backwards along it)
    for (const [key, f] of Object.entries(flows)) {
      const v = sim.flow[key];
      const dir = key === 'battPcu' ? -1 : 1;
      const spec = sim.mode.flows[key];
      f.material.opacity = Math.min(1, Math.abs(v)) * 0.95;
      if (spec.color) f.material.color.setHex(COLORS[spec.color]);
      f.t = (f.t + dt * v * dir * 0.35 + 1) % 1;
      const pos = f.points.geometry.attributes.position;
      for (let i = 0; i < f.n; i++) {
        const p = f.curve.getPoint((f.t + i / f.n) % 1);
        pos.setXYZ(i, p.x, p.y, p.z);
      }
      pos.needsUpdate = true;
    }

    // battery indicator
    const b = sim.mode.batt;
    battGlowMat.emissive.setHex(b === 'charge' ? COLORS.green : COLORS.amber);
    battGlowMat.emissiveIntensity =
      b === 'hold' ? 0.08 : 0.55 + Math.sin(time * 3.5) * 0.3;

    // live rpm labels
    labels.engine.rpmEl.textContent = fmt(sim.engine);
    labels.mg1.rpmEl.textContent = fmt(sim.sun);
    labels.mg2.rpmEl.textContent = fmt(sim.ring);
    labels.engine.el.classList.toggle('is-off', sim.mode.engineOn === false);
  }

  return { update };
}

const fmt = (v) => `${Math.round(v).toLocaleString('en-US')} rpm`;

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

import * as THREE from 'three';

// Tooth counts — the actual Toyota HSD (gen 1/2) planetary set,
// plus a simplified ring-to-final-drive pair.
export const Z = { sun: 30, planet: 23, ring: 78, ringOut: 90, final: 48 };
export const MODULE = 0.07;

export const R = {
  sun: (MODULE * Z.sun) / 2,          // 1.05
  planet: (MODULE * Z.planet) / 2,    // 0.805
  ring: (MODULE * Z.ring) / 2,        // 2.73
  ringOut: (MODULE * Z.ringOut) / 2,  // 3.15
  final: (MODULE * Z.final) / 2,      // 1.68
};
export const CARRIER_R = R.sun + R.planet;

const mod1 = (x) => ((x % 1) + 1) % 1;

// Polygon outline of a gear: rA = radius between teeth, rB = radius at teeth.
// Tooth centers land at local angle (i + 0.5) * (2π/z).
function gearPoints(z, rA, rB) {
  const pts = [];
  const p = (Math.PI * 2) / z;
  for (let i = 0; i < z; i++) {
    const a = i * p;
    for (const [f, r] of [[0, rA], [0.18, rA], [0.32, rB], [0.68, rB], [0.82, rA]]) {
      const t = a + f * p;
      pts.push(new THREE.Vector2(Math.cos(t) * r, Math.sin(t) * r));
    }
  }
  return pts;
}

const EXTRUDE = { bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 };

// External spur gear, extruded along local Z, centered on origin.
export function makeGear({ z, thickness, hole = 0.3, material }) {
  const r = (MODULE * z) / 2;
  const shape = new THREE.Shape(gearPoints(z, r - 1.25 * MODULE, r + MODULE));
  if (hole > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, hole, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { ...EXTRUDE, depth: thickness });
  geo.translate(0, 0, -thickness / 2);
  return new THREE.Mesh(geo, material);
}

// The HSD ring gear: internal teeth (mesh with planets) + external drive
// teeth (mesh with the final drive) cut into one annulus.
export function makeRingGear({ thickness, material }) {
  const outer = gearPoints(Z.ringOut, R.ringOut - 1.25 * MODULE, R.ringOut + MODULE);
  const inner = gearPoints(Z.ring, R.ring + 1.25 * MODULE, R.ring - MODULE).reverse();
  const shape = new THREE.Shape(outer);
  shape.holes.push(new THREE.Path(inner));
  const geo = new THREE.ExtrudeGeometry(shape, { ...EXTRUDE, depth: thickness });
  geo.translate(0, 0, -thickness / 2);
  return new THREE.Mesh(geo, material);
}

// Phase for an external gear (zB teeth) meshing with gear A (phase phaseA,
// zA teeth) where the line of centers points from A toward B at angle
// `contact` (in A's plane). Derived from rolling contact; recompute every
// frame and the pair stays meshed.
export function meshExternal(phaseA, zA, zB, contact) {
  const pB = (Math.PI * 2) / zB;
  const fA = mod1((contact - phaseA) / ((Math.PI * 2) / zA) - 0.5);
  return contact + Math.PI + pB * fA;
}

// Phase for an internal ring (zRing) meshing with a planet (phaseP, zP)
// whose center sits at angle `contact` from the ring center.
export function meshInternal(phaseP, zP, zRing, contact) {
  const pR = (Math.PI * 2) / zRing;
  const fP = mod1((contact - phaseP) / ((Math.PI * 2) / zP) - 0.5);
  return contact - pR * fP;
}

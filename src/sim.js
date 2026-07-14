import { Z } from './gears.js';

// Willis equation for the planetary set:
//   ωc · (Zs + Zr) = Zs · ωs + Zr · ωr
// Each mode pins the two independent speeds — engine (carrier) and
// ring (road speed) — and MG1 (sun) falls out of the constraint.
export const sunRPM = (engine, ring) =>
  ((Z.sun + Z.ring) * engine - Z.ring * ring) / Z.sun;

export const finalRatio = Z.ringOut / Z.final;

// flows: battPcu (+ = battery→inverter), pcuMg1 (+ = inverter→MG1),
// pcuMg2 (+ = inverter→MG2). Colors: amber = battery discharging,
// green = charging, cyan = MG1→MG2 electrical path.
export const MODES = [
  {
    id: 'ev', num: '01', name: 'EV Drive',
    engine: 0, ring: 1600, engineOn: false, batt: 'discharge',
    roles: { mg1: 'freewheeling', mg2: 'driving' },
    desc: 'Battery power drives MG2, which turns the ring gear and the wheels directly. The engine stays off — with the carrier parked, the planetary forces MG1 to freewheel backwards.',
    flows: { battPcu: { v: 1, color: 'amber' }, pcuMg1: { v: 0 }, pcuMg2: { v: 1, color: 'amber' } },
  },
  {
    id: 'accel', num: '02', name: 'Full Acceleration',
    engine: 4200, ring: 2400, engineOn: true, batt: 'discharge',
    roles: { mg1: 'generating', mg2: 'driving + boost' },
    desc: 'The engine spins the carrier hard. MG1 loads the sun gear as a generator so torque can react through to the ring, and its power — plus a battery boost — feeds MG2 for maximum drive.',
    flows: { battPcu: { v: 1, color: 'amber' }, pcuMg1: { v: -1, color: 'cyan' }, pcuMg2: { v: 1, color: 'cyan' } },
  },
  {
    id: 'cruise', num: '03', name: 'Highway Cruise',
    engine: 2000, ring: 2400, engineOn: true, batt: 'hold',
    roles: { mg1: 'generating', mg2: 'driving' },
    desc: 'The engine supplies all the power. It splits at the planetary: most flows mechanically to the ring gear, while MG1 skims off a slice electrically and hands it to MG2. The battery just rests.',
    flows: { battPcu: { v: 0 }, pcuMg1: { v: -1, color: 'cyan' }, pcuMg2: { v: 1, color: 'cyan' } },
  },
  {
    id: 'regen', num: '04', name: 'Regen Braking',
    engine: 0, ring: 1400, engineOn: false, batt: 'charge',
    roles: { mg1: 'freewheeling', mg2: 'generating' },
    desc: 'Slowing down, the wheels back-drive MG2, which switches to a generator and pumps the braking energy into the battery instead of burning it off as heat in the brake discs.',
    flows: { battPcu: { v: -1, color: 'green' }, pcuMg1: { v: 0 }, pcuMg2: { v: -1, color: 'green' } },
  },
  {
    id: 'charge', num: '05', name: 'Idle Charge',
    engine: 1300, ring: 0, engineOn: true, batt: 'charge',
    roles: { mg1: 'generating', mg2: 'holding' },
    desc: 'Stopped at a light with a low battery: the wheels hold the ring gear still, the engine turns the carrier, and the planetary spins MG1 fast — generating charge for the battery.',
    flows: { battPcu: { v: -1, color: 'green' }, pcuMg1: { v: -1, color: 'green' }, pcuMg2: { v: 0 } },
  },
];

export class Sim {
  constructor() {
    this.mode = MODES[0];
    this.engine = 0;
    this.ring = 0;
    this.flow = { battPcu: 0, pcuMg1: 0, pcuMg2: 0 };
    this.vibe = 0; // engine-running blend, 0..1
  }

  setMode(m) { this.mode = m; }

  step(dt) {
    const k = 1 - Math.exp(-dt / 0.9);
    this.engine += (this.mode.engine - this.engine) * k;
    this.ring += (this.mode.ring - this.ring) * k;
    this.vibe += ((this.mode.engineOn ? 1 : 0) - this.vibe) * k;
    for (const key of Object.keys(this.flow)) {
      this.flow[key] += ((this.mode.flows[key].v || 0) - this.flow[key]) * k;
    }
    this.sun = sunRPM(this.engine, this.ring);
    this.axle = -this.ring * finalRatio;
  }
}

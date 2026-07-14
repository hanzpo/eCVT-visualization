import { MODES } from './sim.js';
import { Z } from './gears.js';

const NOMO = { w: 264, h: 150, pad: 22, range: 10000 };
// carrier axis sits Zr/(Zs+Zr) of the way from sun to ring
const CARRIER_T = Z.ring / (Z.sun + Z.ring);

export function buildUI(onMode) {
  const panel = document.getElementById('panel');
  const axisX = (t) => NOMO.pad + t * (NOMO.w - 2 * NOMO.pad);
  const xs = [axisX(0), axisX(CARRIER_T), axisX(1)];

  panel.innerHTML = `
    <header class="hd">
      <h1 class="hd-title">Toyota eCVT</h1>
      <div class="hd-sub">How the hybrid power-split transmission works</div>
    </header>

    <nav class="modes">
      ${MODES.map((m, i) => `
        <button class="mode ${i === 0 ? 'is-active' : ''}" data-id="${m.id}">${m.name}</button>`).join('')}
    </nav>

    <p class="desc" id="desc">${MODES[0].desc}</p>

    <section class="readouts">
      <div class="ro"><span class="ro-k dot-amber">Engine (carrier)</span><span class="ro-v" id="ro-engine">0</span></div>
      <div class="ro"><span class="ro-k dot-green">MG1 (sun)</span><span class="ro-v" id="ro-mg1">0</span></div>
      <div class="ro"><span class="ro-k dot-cyan">MG2 (ring)</span><span class="ro-v" id="ro-mg2">0</span></div>
      <div class="ro"><span class="ro-k">Battery</span><span class="ro-badge" id="ro-batt">—</span></div>
      <div class="ro ro-roles"><span id="ro-roles"></span></div>
    </section>

    <section class="nomo">
      <div class="sec-title">Speed relationship</div>
      <svg viewBox="0 0 ${NOMO.w} ${NOMO.h}" id="nomo-svg">
        <line x1="${NOMO.pad}" y1="${NOMO.h / 2}" x2="${NOMO.w - NOMO.pad}" y2="${NOMO.h / 2}" class="nm-zero"/>
        ${xs.map((x) => `<line x1="${x}" y1="10" x2="${x}" y2="${NOMO.h - 22}" class="nm-axis"/>`).join('')}
        <line id="nm-line" x1="0" y1="0" x2="0" y2="0" class="nm-line"/>
        <line id="nm-line2" x1="0" y1="0" x2="0" y2="0" class="nm-line2"/>
        <circle id="nm-sun" r="4" class="nm-dot nm-green"/>
        <circle id="nm-car" r="4" class="nm-dot nm-amber"/>
        <circle id="nm-ring" r="4" class="nm-dot nm-cyan"/>
        <text x="${xs[0]}" y="${NOMO.h - 8}" class="nm-label">MG1</text>
        <text x="${xs[1]}" y="${NOMO.h - 8}" class="nm-label">Engine</text>
        <text x="${xs[2]}" y="${NOMO.h - 8}" class="nm-label">MG2</text>
      </svg>
      <div class="nomo-note">The three speeds always sit on one straight line — that's the planetary gear constraint. Set any two and the third follows.</div>
    </section>

    <footer class="ft">
      <div class="legend">
        <span class="lg"><i class="sw sw-amber"></i>Battery power</span>
        <span class="lg"><i class="sw sw-cyan"></i>MG1 → MG2</span>
        <span class="lg"><i class="sw sw-green"></i>Charging</span>
      </div>
      <div class="ft-hint">Drag to rotate, scroll to zoom. Simplified geometry, real gear ratios (30:23:78).</div>
    </footer>
  `;

  const els = {
    desc: panel.querySelector('#desc'),
    engine: panel.querySelector('#ro-engine'),
    mg1: panel.querySelector('#ro-mg1'),
    mg2: panel.querySelector('#ro-mg2'),
    batt: panel.querySelector('#ro-batt'),
    roles: panel.querySelector('#ro-roles'),
    line: panel.querySelector('#nm-line'),
    line2: panel.querySelector('#nm-line2'),
    sun: panel.querySelector('#nm-sun'),
    car: panel.querySelector('#nm-car'),
    ring: panel.querySelector('#nm-ring'),
    buttons: [...panel.querySelectorAll('.mode')],
  };

  for (const btn of els.buttons) {
    btn.addEventListener('click', () => {
      const mode = MODES.find((m) => m.id === btn.dataset.id);
      els.buttons.forEach((b) => b.classList.toggle('is-active', b === btn));
      els.desc.textContent = mode.desc;
      onMode(mode);
    });
  }

  const rpmY = (v) => {
    const c = Math.max(-NOMO.range, Math.min(NOMO.range, v));
    return NOMO.h / 2 - (c / NOMO.range) * (NOMO.h / 2 - 14);
  };
  const fmt = (v) => Math.round(v).toLocaleString('en-US');
  const BATT = {
    discharge: ['Discharging', 'b-amber'],
    charge: ['Charging', 'b-green'],
    hold: ['Idle', 'b-dim'],
  };

  function update(sim) {
    els.engine.textContent = fmt(sim.engine);
    els.mg1.textContent = fmt(sim.sun);
    els.mg2.textContent = fmt(sim.ring);
    const [txt, cls] = BATT[sim.mode.batt];
    if (els.batt.textContent !== txt) {
      els.batt.textContent = txt;
      els.batt.className = `ro-badge ${cls}`;
    }
    const roles = `MG1 ${sim.mode.roles.mg1} · MG2 ${sim.mode.roles.mg2}`;
    if (els.roles.textContent !== roles) els.roles.textContent = roles;

    const ys = rpmY(sim.sun), yc = rpmY(sim.engine), yr = rpmY(sim.ring);
    for (const ln of [els.line, els.line2]) {
      ln.setAttribute('x1', xs[0]); ln.setAttribute('y1', ys);
      ln.setAttribute('x2', xs[2]); ln.setAttribute('y2', yr);
    }
    els.sun.setAttribute('cx', xs[0]); els.sun.setAttribute('cy', ys);
    els.car.setAttribute('cx', xs[1]); els.car.setAttribute('cy', yc);
    els.ring.setAttribute('cx', xs[2]); els.ring.setAttribute('cy', yr);
  }

  return { update };
}

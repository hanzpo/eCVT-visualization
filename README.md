# Toyota eCVT Visualization

Interactive 3D visualization of the Toyota Hybrid Synergy Drive power-split
device ("eCVT"): ICE engine, MG1, MG2, the planetary gearset, final drive to
the wheels, HV battery, and inverter — with animated, color-coded power flows
for five driving modes and a live speed nomograph.

Built with vanilla [Three.js](https://threejs.org/) + Vite. No framework.

The gear animation uses the real THS planetary tooth counts (sun 30, planet 23,
ring 78) and the actual kinematic constraint (Willis equation), so gear speeds
and mesh phases are physically consistent. Geometry is simplified — the MG2
reduction gear and counter gear are omitted, and the ring gear drives the final
drive directly.

## Develop

```sh
npm install
npm run dev
```

## Deploy to Cloudflare Workers

One-time: `npx wrangler login`

```sh
npm run deploy
```

This builds to `dist/` and uploads it as Workers static assets
(config in `wrangler.jsonc`).

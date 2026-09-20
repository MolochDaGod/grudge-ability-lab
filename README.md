# Grudge Ability Lab

Three.js skillshot lab. Source zip stays under 100 MB — `node_modules` is not included.

```bash
npm install
npm run dev
```

Dev server: `0.0.0.0:8080`.

## Upload bundle

This folder (without `node_modules`) is the upload. On the other machine:

1. Unzip
2. `npm install`
3. `npm run dev`

## Skills for another game

In the lab, **Tab → Saves**:

- **Download last** — JSON / JS knobs for the skill you just cast
- **README** — how the effects are produced
- **Runtime zip** — Ability classes, shaders, particles (~400 KB)
- **Lab zip** — this whole project, no `node_modules`

JSON is settings. The runtime zip is the VFX. GLB is a container only.

See `public/skills/RUNTIME.md`.

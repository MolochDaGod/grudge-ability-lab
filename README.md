# Grudge Ability Lab

Three.js skillshot lab. Source stays under 100 MB — binaries live in **Git LFS**.

```bash
git lfs install
git clone <this-repo>
npm install
npm run dev
```

If you skip `git lfs install`, HDR / GLB / FBX / textures checkout as 132-byte pointer files and the stage looks black.

## Git LFS

Tracked patterns (see `.gitattributes`):

- `*.hdr` — environment
- `*.glb` / `*.fbx` — meshes
- `*.png` / `*.jpg` / `*.jpeg` / `*.webp` — textures and HUD art
- `*.zip` — runtime pack

Git itself stores a pointer (~130 bytes). The real files download from LFS on clone. GitHub’s 100 MB blob cap does not apply to those objects.

## Upload bundle

Tab → **Lab zip** is the whole project without `node_modules` (~19 MB). On the other machine:

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

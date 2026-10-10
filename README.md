# Grudge Ability Lab

Three.js skillshot lab. Tune a cast here, then drop `createSkillRuntime` into another game.

https://github.com/MolochDaGod/grudge-ability-lab

```bash
git lfs install
git clone https://github.com/MolochDaGod/grudge-ability-lab.git
npm install
npm run dev
```

If you skip `git lfs install`, HDR / GLB / FBX / textures checkout as pointer files and the stage looks black.

## Use the skills in another game

```js
import { createSkillRuntime } from './src/lab/api/skillRuntime.js';

const skills = createSkillRuntime({ scene, camera, envMap });
skills.apply(jsonPack); // knobs from Tab → Download last
skills.paint('fireBend', { palette: 'frost', texture: 'plasma' });
skills.cast({ id: 'staff_fire_bolt', origin, direction });

function tick(dt) {
  skills.step(dt, { width, height });
  camera.position.add(skills.shakeOffset);
  renderer.render(scene, camera);
  camera.position.sub(skills.shakeOffset);
}
```

`onImpact` gives you `{ labId, statuses, position }`. Damage stays in your game.

| Call | Job |
|---|---|
| `cast` | lab id or catalog id, floor origin, facing. Cooldown, min range, and a zero aim come back as `reason`. |
| `apply` | `grudge.skill/v1` look pack, or a Studio combat override (range / cooldown) |
| `paint` | the same colour and texture chips as ▾ |
| `step` | uniforms, travel, particles, decals, lights, shake, flash |

Full notes: `public/skills/RUNTIME.md`. In the lab, Tab → README / Runtime zip.

## Git LFS

Tracked patterns (see `.gitattributes`):

- `*.hdr` — environment
- `*.glb` / `*.fbx` — meshes
- `*.png` / `*.jpg` / `*.jpeg` / `*.webp` — textures and HUD art
- `*.zip` — runtime pack

## Upload bundle

Tab → **Lab zip** is the whole project without `node_modules`. On the other machine: unzip, `npm install`, `npm run dev`.

JSON is settings. The runtime zip is the VFX. GLB is a container only.

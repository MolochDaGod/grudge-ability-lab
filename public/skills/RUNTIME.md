# Grudge skill runtime

Drop this into a Three.js game. These casts are **procedural**. A JSON pack is the knobs. The Ability class is the effect. A GLB is an empty container.

Repo: [github.com/MolochDaGod/grudge-ability-lab](https://github.com/MolochDaGod/grudge-ability-lab)

```bash
git lfs install
git clone https://github.com/MolochDaGod/grudge-ability-lab.git
```

Minimum dependency: **`three` ^0.185**.

---

## Use it

Copy this zip next to your game (imports are relative) and call one object.

```js
import { createSkillRuntime } from './grudge-ability-runtime/api/skillRuntime.js';

const skills = createSkillRuntime({
  scene,
  camera,
  envMap // optional equirect HDR — water looks wet
});

skills.apply(pack); // grudge.skill/v1 JSON, JS module, or combat override
skills.paint('fireBend', { palette: 'frost', texture: 'plasma' });
skills.paint('waterBend', { palette: 'void', texture: 'ice' });

const shot = skills.cast({
  id: 'staff_fire_bolt',          // lab id or catalog id
  origin: caster.position,        // { x, y, z } on the floor
  direction: facing                // flattened and normalised for you
});
// shot.ok, shot.statuses, shot.cooldown
// shot.reason is 'unknown' | 'aim' | 'too-close' | 'cooldown'

function tick(dt) {
  const frame = skills.step(dt, { width, height });
  camera.position.add(skills.shakeOffset);
  renderer.render(scene, camera);
  camera.position.sub(skills.shakeOffset);
}
```

`onImpact` is where your game applies damage. The runtime does not know hit points.

```js
const skills = createSkillRuntime({
  scene,
  camera,
  onImpact({ labId, statuses, position }) {
    // statuses: [{ id: 'burn', durationSec, magnitude }]
  }
});
```

| Call | What it does |
|---|---|
| `list()` | every skill: lab id, catalog id, range, cooldown, delivery, chip names |
| `resolve(id)` | `staff_fire_bolt` → `fireBolt` |
| `apply(pack)` | writes knobs. Live. A bolt already in the air changes. |
| `paint(id, { palette, texture, size })` | the ▾ chips. Bad names return `reason` and the legal `options`. |
| `cast({ id, origin, direction, distance, force })` | pools a cast. `distance` defaults to `settings[id].range`. |
| `step(dt, { width, height, elapsed })` | uniforms, abilities, particles, decals, bursts, lights, shake, flash |
| `clear()` | kill every live cast and reset pools |
| `dispose()` | GPU teardown |

Cooldown is on unless you pass `cooldown: false` or `cast({ force: true })`. `step` expects real seconds. `settings.global.timeScale` slows the VFX only, not the cooldown.

You do not construct `ParticleEngine`, `LightPool`, `DecalSystem`, or `AbilityManager` yourself. Pass them only if this lab and your game must share one pool.

---

## What to grab

1. Arm a skill, tune Shape / Motion / ▾ colour, cast it.
2. Tab → **Download last**. Prefer **JSON**. JS gives you `applySkill(settings)`.
3. Tab → **Runtime zip** is this code. Tab → **README** is this file.
4. Skip GLB unless an asset pipeline must carry the pack. It does not hold the flame.

```json
{
  "format": "grudge.skill/v1",
  "labId": "fireBolt",
  "engine": "three.js",
  "runtime": "grudge-ability",
  "settings": { "range": 18, "speed": 16.5, "flameWidth": 0.2 }
}
```

`labId` is the Ability class. `settings` overwrites that class’s live knob block.

Combat-only exports (Studio → Export) are range / cooldown / status names. `skills.apply` writes those too. They do not invent a look.

---

## What the runtime owns

```
grudge-ability-runtime/
  api/skillRuntime.js       ← createSkillRuntime
  abilities/                Ability.js, AbilityManager.js, *Ability.js
  config/                   settings, packs, catalog, colour chips
  core/                     FrameUniforms.js, Layers.js
  materials/                custom ShaderMaterials
  effects/                  ribbons, bursts, decals, lights, shake, flash
  particles/                GPU particle engine
  assets/                   ProceduralGeometry.js
  shaders/lib/              noise + common
  utils/
  postprocessing/           bloom + heat-haze (recommended, not required)
```

Do not copy the lab HUD, Codex, character, or cathedral. Those are the sandbox.

---

## If you render it yourself

`createSkillRuntime` already fills `frame` uniforms and flushes particles. You still want, for the finished look:

| Skip | Result |
|---|---|
| Ability classes, JSON only | Nothing draws. A pack is knobs. |
| Depth prepass / `frame.uSceneDepth` | Volumes slice through the floor |
| `postprocessing/PostProcessing.js` | No heat haze, no bloom |
| `envMap` | Water reads as plastic |
| Adding PointLights per cast | Hitch. LightPool already exists. |
| Copying the GLB in as a mesh | Empty node. Fire is a raymarched volume. |

`PostProcessing` expects the lab renderer (`renderer.gl`). If your game already has a composer, sample `skills.flash.color` and `skills.flash.strength` in your grade pass and upload the opaque depth into `frame.uSceneDepth`.

Layers live in `core/Layers.js`: WORLD (opaque depth), VFX, DISTORTION.

---

## Phases

```
skills.cast(...)
  → TRAVEL     head runs the line at settings.speed m/s
  → IMPACT     onImpact fires once; burst / decal / shockwave
  → FADE       stream dies, then back to the pool
```

Far casts (Pyre, Air Bend, Electrical Sphere) use the far end of the same line. You do not aim them with a second function.

---

## Checklist

1. `npm i three@^0.185`
2. Clone the repo, or unzip the runtime.
3. `createSkillRuntime({ scene, camera })`
4. `skills.step(dt)` every frame, then render.
5. `skills.cast({ id, origin, direction })`
6. `skills.apply(pack)` for a tune you downloaded from the lab.
7. Add depth + bloom when you want it to look like the lab.

That is the whole path. Tune here. Pack the knobs. Call the runtime.

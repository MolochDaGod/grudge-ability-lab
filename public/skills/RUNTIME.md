# Grudge skill runtime — drop this into a Three.js game

These casts are **procedural**. They are not meshes, sprite sheets, or GLB clips.
A downloaded **JSON / JS pack is the knobs**. The **Ability class is the effect**.

```
JSON / JS pack  →  settings[labId]   (numbers + colours)
Ability class   →  shaders, particles, ribbons, impacts
GLB download    →  empty container (extras.grudgeSkill). Not a VFX mesh.
```

In this lab: **Tab → Saves** downloads the last cast as JSON (recommended), JS (`applySkill`), or a GLB wrapper. **Tab → Runtime zip** is the code this README describes.

---

## 1. What to grab

### A. Tune a skill, then download the pack

1. Arm a skill, tune Shape / Motion / ▾ colour-texture, cast it.
2. Tab → **Download last**.
3. Prefer **JSON**. Use **JS** if you want `applySkill(settings)` ready to import.
4. Skip GLB unless an asset pipeline must carry the pack — it does not hold the flame / water / lightning.

The pack looks like:

```json
{
  "format": "grudge.skill/v1",
  "labId": "fireBolt",
  "engine": "three.js",
  "runtime": "grudge-ability",
  "settings": { "range": 18, "speed": 16.5, "flameWidth": 0.2 }
}
```

`labId` is the Ability class to spawn. `settings` overwrites that class’s live knob block.

### B. Copy the runtime (this zip, or the lab `src/lab` tree)

Minimum npm dependency: **`three` ^0.185**.

Copy this folder as-is (imports are relative):

```
grudge-ability-runtime/
  README.md                 ← this file
  abilities/                Ability.js, AbilityManager.js, *Ability.js
  config/                   settings.js  (source of truth for every knob)
  core/                     FrameUniforms.js, Layers.js
  materials/                every custom ShaderMaterial
  effects/                  ribbons, bursts, decals, lights, shake, flash, fire hull
  particles/                GPU particle engine
  assets/                   ProceduralGeometry.js
  shaders/lib/              common.glsl.js, noise.glsl.js
  utils/                    math, colour, pool, dispose
  postprocessing/           bloom + heat-haze (recommended, not mandatory)
```

Do **not** copy the lab HUD, Codex, character, or world. Those are this sandbox.

---

## 2. How a cast is produced

Every skill is one class extending `Ability`. The base owns the line, the clock, and the light. The subclass only describes the look.

```
select labId
  → AbilityManager.cast(origin, direction, distance, labId)
    → spawn()           reset pooled instance, no alloc
    → TRAVEL            head runs the line at settings.speed m/s
    → IMPACT            burst / decal / shockwave / particles
    → FADE              stream dies, then back to the pool
```

Signature (metres, Y-up, direction flat):

```js
import { Vector3 } from 'three';
import { AbilityManager } from './abilities/AbilityManager.js';
import { settings } from './config/settings.js';
import { applySkill } from './fire-bolt.js'; // downloaded JS pack

applySkill(settings); // optional — paints knobs onto settings.fireBolt

const origin = new Vector3(caster.x, 0, caster.z);
const direction = new Vector3(facing.x, 0, facing.z).normalize();
const distance = settings.fireBolt.range;

manager.cast(origin, direction, distance, 'fireBolt');
manager.update(dt); // every frame, seconds
```

`origin` is on the floor. `direction` is unit and flat. `distance` is metres. Far-casts (Pyre, Air Bend, Electrical Sphere) use the **far end** of that same line as the footprint — you do not need a second spawn API.

Aiming is your game’s problem. This runtime only consumes the three numbers.

---

## 3. Host context you must provide

`AbilityManager` is constructed with a context object. Abilities read these every frame:

```js
{
  scene,          // THREE.Scene
  camera,         // THREE.Camera
  environment,    // { scene } is enough; water also samples frame.uEnvMap
  particles,      // ParticleEngine
  lights,         // LightPool
  decals,         // DecalSystem (GroundDecals.js)
  bursts,         // BurstSystem (BurstSphere.js)
  shake,          // CameraShake  — stub { add() {}, rumble() {} } if you skip
  flash           // ScreenFlash  — stub { trigger() {} } if you skip
}
```

Each frame, **before** abilities:

```js
frame.uTime.value = elapsed;
frame.uDelta.value = dt;
frame.uResolution.value.set(width, height);
frame.uCameraNear.value = camera.near;
frame.uCameraFar.value = camera.far;
```

Each frame, **after** abilities:

```js
particles.flush();   // uploads GPU spawns
lights.update(dt);   // if your LightPool needs it
decals.update(dt);
bursts.update(dt);
shake.update(dt);
flash.update(dt);
```

### Layers

`core/Layers.js` — WORLD (opaque depth), VFX, DISTORTION. Soft particles and volumes clip against the WORLD depth prepass (`frame.uSceneDepth`). If you skip the depth prepass, flames and water will not fade against the ground.

### Optional but what makes it look finished

- **PostProcessing** — depth prepass, distortion buffer (heat haze / water refraction), bloom, grade.
- **HDR env map** on `frame.uEnvMap` — Water Bend reflections.
- **Character cast clip** — cosmetic. The VFX does not need the FBX.

---

## 4. Apply a downloaded pack

JSON:

```js
import pack from './cinder-slash.json' assert { type: 'json' };
Object.assign(settings[pack.labId], pack.settings);
manager.cast(origin, direction, pack.settings.range, pack.labId);
```

JS module from Tab:

```js
import pack, { applySkill } from './cinder-slash.js';
applySkill(settings);
manager.cast(origin, direction, settings[pack.labId].range, pack.labId);
```

Knobs are **live**. Mutating `settings.fireBolt.flameWidth` while a bolt is in flight changes that bolt. Same contract as the lab editor.

---

## 5. Shared systems (every skill)

| System | File | Why |
|---|---|---|
| Ability base | `abilities/Ability.js` | Line, phases, pooling, shockwave, light |
| Manager | `abilities/AbilityManager.js` | 6 concurrent, per-type pool |
| Settings | `config/settings.js` | Every metre / colour / rate |
| Frame uniforms | `core/FrameUniforms.js` | Time, depth, env, glow — shared by identity |
| Particles | `particles/ParticleSystem.js` | GPU embers, sparks, smoke, spray |
| Bursts | `effects/BurstSphere.js` | FIRE / WATER / AIR / EARTH / FROST / STORM shells |
| Decals | `effects/GroundDecals.js` | Scorch, foam, ripple, frost |
| Lights | `effects/LightPool.js` | Fixed point lights — never add/remove at runtime |
| Ribbons | `effects/RibbonGeometry.js` | Camera-facing proxy hulls |
| Geometry | `assets/ProceduralGeometry.js` | Crystals, rocks, bolts, tubes |
| GLSL lib | `shaders/lib/*.js` | Noise + common, inlined into materials |

---

## 6. Per-skill files

Copy **shared systems** plus the row you want. `labId` is what the pack and `manager.cast(..., labId)` use.

| Skill | labId | Ability | Extra materials / helpers |
|---|---|---|---|
| Fire Bolt | `fireBolt` | `FireBoltAbility.js` | `VolumetricFireMaterial`, `SlashCoreMaterial`, `FireVolume`, `DistortionMaterial` |
| Cinder Slash | `cinderSlash` | `CinderSlashAbility.js` | same fire stack as bolt |
| Fire Bend | `fireBend` | `FireBendAbility.js` | `VolumetricFireMaterial`, `FireVolume`, `DistortionMaterial` |
| Water Bend | `waterBend` | `WaterBendAbility.js` | `OceanWaterMaterial`, `DistortionMaterial` |
| Air Bend | `airBend` | `AirBendAbility.js` | `WindMaterial`, `DistortionMaterial` |
| Frost Lance | `ice` | `IceAbility.js` | `IceMaterial` |
| Storm Lance | `thunder` | `ThunderAbility.js` | `LightningMaterial` |
| Nova Beam | `beam` | `BeamAbility.js` | `BeamMaterial` |
| Pyre Crown | `pyre` | `PyreAbility.js` | `PyreMaterial`, `EmberFieldMaterial` |
| Kraken Crown | `kraken` | `KrakenAbility.js` | `KrakenMaterial`, `AbyssFieldMaterial` |
| Electrical Sphere | `electrical` | `ElectricalSphereAbility.js` | `ElectricalSphereMaterial`, `RadialBoltMaterial` |
| Earthen Spire | `earth` | `EarthAbility.js` | `RockMaterial`, `GlassMaterial` |
| Verdant Gate | `portal` | `PortalAbility.js` | `RockMaterial` |
| Tidewrought Ring | `aether` | `AetherRingAbility.js` | `RockMaterial` |
| Fire Portal | `firePortal` | `FirePortalAbility.js` | scribe shaders live on the ability |

Buffs (B / M / K) are **not** abilities. They are `ElectricBoost`, `MagicBoost`, `FireBoost` under `effects/` — skip them unless you want the self-channel look.

---

## 7. Minimal host (R3F or vanilla)

Vanilla:

```js
const manager = new AbilityManager({
  scene, camera, environment: { scene },
  particles: new ParticleEngine(scene),
  lights: new LightPool(scene),
  decals: new DecalSystem(scene),
  bursts: new BurstSystem(scene),
  shake: { add() {}, rumble() {} },
  flash: { trigger() {} }
});

function tick(dt) {
  manager.update(dt);
  particles.flush();
  decals.update(dt);
  bursts.update(dt);
  renderer.render(scene, camera);
}
```

R3F: put the same manager in a `useFrame` store. Do not recreate materials inside `useFrame`. Pools exist so fifty casts allocate **zero** GPU objects.

---

## 8. What will look wrong if you skip pieces

| Skip | Result |
|---|---|
| Ability class, JSON only | Nothing draws. Pack is knobs. |
| `ParticleEngine.flush()` | No embers / smoke / spray |
| Depth prepass / `uSceneDepth` | Volumes slice through the floor |
| Distortion pass | No heat haze, no water refraction |
| Bloom | Cores look grey instead of white-hot |
| `uEnvMap` | Water reads as plastic, not wet |
| Adding PointLights per cast | Hitch — LightPool exists to prevent this |
| Copying a GLB into a mesh | Empty node. The fire is a raymarched volume |

---

## 9. Production ids (game data, not VFX)

Studio (U) and `public/skills/production/*.json` are **weapon-skill catalog overrides** (range, cooldown, status names). They do not draw anything. Use them next to combat data. Keep using `grudge.skill/v1` packs for the look.

---

## 10. Checklist for a new game

1. `npm i three@^0.185`
2. Copy this runtime folder.
3. Construct `AbilityManager` with the context above.
4. Drive `frame` uniforms + `manager.update(dt)` + `particles.flush()`.
5. Cast with `(origin, direction, distance, labId)`.
6. Drop a Tab JSON/JS pack onto `settings[labId]`.
7. Add postprocessing when you want haze and bloom.

That is the whole delivery path. Tune here, pack the knobs, ship the Ability runtime.

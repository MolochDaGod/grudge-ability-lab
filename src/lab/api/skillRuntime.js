// @ts-nocheck
/**
 * The only API another Three.js game needs.
 *
 *   import { createSkillRuntime } from './api/skillRuntime.js';
 *
 *   const skills = createSkillRuntime({ scene, camera, envMap });
 *   skills.apply(pack);                                   // JSON / JS / combat override
 *   skills.paint('fireBend', { palette: 'frost', texture: 'plasma' });
 *   const shot = skills.cast({ id: 'fireBolt', origin, direction });
 *   skills.step(dt, { width, height });                   // every frame
 *   camera.position.add(skills.shakeOffset);             // optional
 *
 * `id` accepts a lab id (`fireBolt`) or a catalog id (`staff_fire_bolt`).
 * JSON packs are knobs. This module plus the Ability classes are the VFX.
 */
import { Vector3 } from 'three';
import { settings, ELEMENTS, ELEMENT_META, resetSettings } from '../config/settings.js';
import { SKILL_CATALOG } from '../config/skillCatalog.js';
import { parseImportedPack, SKILL_FORMAT } from '../config/skillPack.js';
import { PALETTES, TEXTURES, BOLT_SIZES, VARIANT_SLOTS, applyPalette, applyTexture, applyBoltSize } from '../config/variants.js';
import { AbilityManager } from '../abilities/AbilityManager.js';
import { ParticleEngine } from '../particles/ParticleEngine.js';
import { LightPool } from '../effects/LightPool.js';
import { DecalSystem } from '../effects/GroundDecals.js';
import { BurstSystem } from '../effects/BurstSphere.js';
import { CameraShake } from '../effects/CameraShake.js';
import { ScreenFlash } from '../effects/ScreenFlash.js';
import { frame } from '../core/FrameUniforms.js';
import { AbilityPhase } from '../abilities/Ability.js';
import { patchOnBeforeCompile } from '../utils/shaderPatch.js';

const _origin = new Vector3();
const _direction = new Vector3();

const BY_ID = new Map(SKILL_CATALOG.map((row) => [row.id, row]));
const BY_CATALOG = new Map(SKILL_CATALOG.map((row) => [row.catalogId, row.id]));

/** lab id or production catalog id → lab id. */
export function resolveSkillId(id) {
  if (id == null) return null;
  const key = String(id).trim();
  if (!key) return null;
  if (BY_ID.has(key)) return key;
  if (BY_CATALOG.has(key)) return BY_CATALOG.get(key);
  const lower = key.toLowerCase();
  for (const row of SKILL_CATALOG) {
    if (row.id.toLowerCase() === lower || row.catalogId.toLowerCase() === lower) return row.id;
  }
  return null;
}

export function describeSkills() {
  return SKILL_CATALOG.map((row) => {
    const meta = ELEMENT_META[row.id] ?? {};
    const cfg = settings[row.id] ?? {};
    return {
      labId: row.id,
      catalogId: row.catalogId,
      label: meta.label ?? row.id,
      key: meta.key ?? '',
      family: row.family,
      delivery: row.delivery,
      castShape: meta.cast ?? 'line',
      range: cfg.range ?? 0,
      minRange: cfg.minRange ?? 0,
      cooldown: cfg.cooldown ?? 0,
      speed: cfg.speed ?? 0,
      statuses: row.statuses,
      variants: variantOptions(row.id)
    };
  });
}

export function variantOptions(id) {
  const labId = resolveSkillId(id) ?? id;
  return {
    palettes: VARIANT_SLOTS.includes(labId) ? ['default', ...Object.keys(PALETTES)] : [],
    textures: Object.keys(TEXTURES[labId] ?? {}),
    sizes: labId === 'fireBolt' ? Object.keys(BOLT_SIZES) : []
  };
}

function applyLook(labId, block) {
  const target = settings[labId];
  if (!target || !block || typeof block !== 'object') return false;
  Object.assign(target, block);
  return true;
}

function applyCombat(row) {
  const labId = resolveSkillId(row.labId || row.id || row.catalogId);
  if (!labId || !settings[labId]) return null;
  const target = settings[labId];
  if (row.rangeM != null) target.range = Number(row.rangeM);
  if (row.minRangeM != null) target.minRange = Number(row.minRangeM);
  if (row.cooldownSec != null) target.cooldown = Number(row.cooldownSec);
  if (row.speedMs != null) target.speed = Number(row.speedMs);
  if (row.aoeM != null) {
    if ('zoneRadius' in target) target.zoneRadius = Number(row.aoeM);
    if ('ringRadius' in target && !('zoneRadius' in target)) target.ringRadius = Number(row.aoeM);
  }
  return labId;
}

/**
 * Paint knobs onto the live settings.
 * Accepts a grudge.skill/v1 pack, a JS module (`{ pack }`), a combat override,
 * or `{ skills: [...] }` from Studio → Export all.
 */
export function applySkillPayload(payload) {
  let data = payload;
  if (typeof data === 'string') {
    const parsed = parseImportedPack(data);
    if (parsed) data = parsed;
    else {
      try {
        data = JSON.parse(data);
      } catch {
        return { ok: false, reason: 'unreadable' };
      }
    }
  }
  if (!data || typeof data !== 'object') return { ok: false, reason: 'unreadable' };
  if (data.pack?.labId) data = data.pack;
  if (data.extras?.grudgeSkill) data = data.extras.grudgeSkill;

  if (Array.isArray(data.skills)) {
    const applied = [];
    for (const row of data.skills) {
      const id = resolveSkillId(row.labId || row.id || row.catalogId);
      if (!id) continue;
      if (row.settings) applyLook(id, row.settings);
      else applyCombat(row);
      applied.push(id);
    }
    return { ok: applied.length > 0, kind: 'catalog', applied };
  }

  if (data.format === SKILL_FORMAT || (data.labId && data.settings)) {
    const labId = resolveSkillId(data.labId);
    if (!labId) return { ok: false, reason: 'unknown', id: data.labId };
    applyLook(labId, data.settings);
    return { ok: true, kind: 'look', labId };
  }

  if (data.schema === 'weapon-skill-production-override' || data.rangeM != null || data.cooldownSec != null) {
    const labId = applyCombat(data);
    if (!labId) return { ok: false, reason: 'unknown', id: data.labId || data.id || data.catalogId };
    return { ok: true, kind: 'combat', labId };
  }

  return { ok: false, reason: 'unreadable' };
}

/**
 * Colour / texture chips, same writes the ▾ menu makes.
 * @param {string} id
 * @param {{ palette?: string, texture?: string, size?: string }} choice
 */
export function paintSkill(id, choice = {}) {
  const labId = resolveSkillId(id);
  if (!labId) return { ok: false, reason: 'unknown', id };
  if (!VARIANT_SLOTS.includes(labId)) return { ok: false, reason: 'no-variants', labId };
  const applied = [];
  if (choice.palette) {
    if (choice.palette !== 'default' && !PALETTES[choice.palette]) {
      return { ok: false, reason: 'palette', labId, options: variantOptions(labId).palettes };
    }
    applyPalette(labId, choice.palette);
    applied.push('palette');
  }
  if (choice.texture) {
    if (!TEXTURES[labId]?.[choice.texture]) {
      return { ok: false, reason: 'texture', labId, options: variantOptions(labId).textures };
    }
    applyTexture(labId, choice.texture);
    applied.push('texture');
  }
  if (choice.size) {
    if (labId !== 'fireBolt' || !BOLT_SIZES[choice.size]) {
      return { ok: false, reason: 'size', labId, options: variantOptions(labId).sizes };
    }
    applyBoltSize(choice.size);
    applied.push('size');
  }
  if (!applied.length) return { ok: false, reason: 'empty', labId };
  return { ok: true, labId, applied };
}

function hostEnvironment(scene, environment) {
  const base = environment ?? { scene };
  if (typeof base.registerShadowCasterWithPatch === 'function') return base;
  return {
    scene: base.scene ?? scene,
    registerShadowCaster(material) {
      return material;
    },
    registerShadowCasterWithPatch(material, patch) {
      patchOnBeforeCompile(material, patch);
      return material;
    }
  };
}

function asPoint(value, target) {
  if (!value || typeof value.x !== 'number' || typeof value.z !== 'number') return false;
  target.set(value.x, value.y ?? 0, value.z);
  return true;
}

function asAim(value, target, keepY) {
  if (!asPoint(value, target)) return false;
  if (!keepY) target.y = 0;
  if (target.lengthSq() < 1e-8) return false;
  target.normalize();
  return true;
}

/**
 * @param {object} options
 * @param {import('three').Scene} options.scene
 * @param {import('three').Camera} options.camera
 * @param {object} [options.envMap] equirect HDR for water reflections
 * @param {boolean} [options.cooldown=true] honor settings cooldown unless cast({ force: true })
 * @param {(event: object) => void} [options.onCast]
 * @param {(event: object) => void} [options.onImpact] statuses land here — damage is your game
 */
export function createSkillRuntime(options = {}) {
  const scene = options.scene;
  const camera = options.camera;
  if (!scene || !camera) throw new Error('createSkillRuntime needs { scene, camera }');

  const particles = options.particles ?? new ParticleEngine(scene);
  const lights = options.lights ?? new LightPool(scene);
  const decals = options.decals ?? new DecalSystem(scene);
  const bursts = options.bursts ?? new BurstSystem(scene);
  const shakeRig = options.rig ?? { shakeOffset: new Vector3(), shakeRoll: 0 };
  const shake = options.shake ?? new CameraShake(shakeRig);
  const flash = options.flash ?? new ScreenFlash();
  const environment = hostEnvironment(scene, options.environment);
  const manager =
    options.manager ??
    new AbilityManager({
      scene,
      camera,
      environment,
      particles,
      lights,
      decals,
      bursts,
      shake,
      flash
    });

  if (options.envMap) frame.uEnvMap.value = options.envMap;

  const honorCooldown = options.cooldown !== false;
  const cooldowns = new Map(ELEMENTS.map((id) => [id, 0]));
  const phaseWas = new WeakMap();
  let elapsed = 0;
  const owned = {
    manager: !options.manager,
    particles: !options.particles,
    lights: !options.lights,
    decals: !options.decals,
    bursts: !options.bursts
  };

  function emitImpact(ability) {
    const row = BY_ID.get(ability.element);
    options.onImpact?.({
      labId: ability.element,
      catalogId: row?.catalogId ?? null,
      label: ELEMENT_META[ability.element]?.label ?? ability.element,
      statuses: row?.statuses ?? [],
      position: ability.position,
      origin: ability.origin,
      direction: ability.direction,
      ability
    });
  }

  const api = {
    scene,
    camera,
    manager,
    particles,
    lights,
    decals,
    bursts,
    shake,
    flash,
    settings,
    get shakeOffset() {
      return shakeRig.shakeOffset;
    },
    get shakeRoll() {
      return shakeRig.shakeRoll;
    },
    list: describeSkills,
    resolve: resolveSkillId,
    options: variantOptions,
    cooldownLeft(id) {
      const labId = resolveSkillId(id);
      return labId ? (cooldowns.get(labId) ?? 0) : 0;
    },
    apply: applySkillPayload,
    paint: paintSkill,
    select(id) {
      const labId = resolveSkillId(id);
      if (!labId) return { ok: false, reason: 'unknown', id };
      manager.select(labId);
      return { ok: true, labId };
    },
    cast(request = {}) {
      const labId = resolveSkillId(request.id ?? request.labId ?? request.catalogId ?? manager.selected);
      if (!labId) return { ok: false, reason: 'unknown', id: request.id ?? request.labId ?? request.catalogId };
      const left = cooldowns.get(labId) ?? 0;
      if (honorCooldown && left > 0 && request.force !== true) {
        return { ok: false, reason: 'cooldown', labId, remaining: left };
      }
      if (!asPoint(request.origin, _origin)) return { ok: false, reason: 'aim', labId };
      if (!asAim(request.direction, _direction, request.keepY === true)) {
        return { ok: false, reason: 'aim', labId };
      }
      const cfg = settings[labId] ?? {};
      const distance = Number(request.distance ?? request.range ?? cfg.range ?? 8);
      const minRange = cfg.minRange ?? 0;
      if (!(distance > 0) || distance < minRange) {
        return { ok: false, reason: 'too-close', labId, minRange, distance };
      }
      const ability = manager.cast(_origin, _direction, distance, labId);
      if (!ability) return { ok: false, reason: 'rejected', labId };
      const cooldown = Math.max(0, Number(cfg.cooldown) || 0);
      cooldowns.set(labId, cooldown);
      const row = BY_ID.get(labId);
      const event = {
        ok: true,
        labId,
        catalogId: row?.catalogId ?? null,
        label: ELEMENT_META[labId]?.label ?? labId,
        distance,
        cooldown,
        statuses: row?.statuses ?? [],
        ability,
        origin: ability.origin,
        direction: ability.direction
      };
      options.onCast?.(event);
      return event;
    },
    /**
     * One frame. `dt` is real seconds. Simulation is scaled by settings.global.timeScale.
     * Cooldowns, shake, and flash use the real `dt` so a slow-mo slider does not stretch them.
     */
    step(dt, clock = {}) {
      const real = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      const scaled = real * (clock.timeScale ?? settings.global.timeScale ?? 1);
      elapsed = clock.elapsed ?? elapsed + scaled;
      frame.uTime.value = elapsed;
      frame.uDelta.value = scaled;
      frame.uShaderIntensity.value = settings.global.shaderIntensity;
      frame.uGlobalGlow.value = settings.global.glow;
      frame.uCameraNear.value = camera.near;
      frame.uCameraFar.value = camera.far;
      if (clock.width > 0 && clock.height > 0) frame.uResolution.value.set(clock.width, clock.height);
      if (options.envMap) frame.uEnvMap.value = options.envMap;

      for (const ability of manager.active) phaseWas.set(ability, ability.phase);
      for (const [id, remaining] of cooldowns) {
        if (remaining > 0) cooldowns.set(id, Math.max(0, remaining - real));
      }
      manager.update(scaled);
      for (const ability of manager.active) {
        const was = phaseWas.get(ability);
        if (was !== AbilityPhase.IMPACT && ability.phase === AbilityPhase.IMPACT) emitImpact(ability);
      }
      particles.flush();
      decals.update(scaled);
      bursts.update(scaled);
      lights.update(scaled);
      shake.update(real);
      flash.update(real);
      return { elapsed, dt: scaled, active: manager.active.length };
    },
    clear() {
      manager.clear();
      particles.reset?.();
      decals.clear?.();
      bursts.clear?.();
      lights.reset?.();
      shake.reset?.();
      flash.reset?.();
    },
    resetKnobs() {
      resetSettings();
    },
    dispose() {
      api.clear();
      if (owned.manager) manager.dispose();
      if (owned.particles) particles.dispose?.();
      if (owned.decals) decals.dispose?.();
      if (owned.bursts) bursts.dispose?.();
      if (owned.lights) lights.dispose?.();
    }
  };

  return api;
}

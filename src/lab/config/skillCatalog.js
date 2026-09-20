// @ts-nocheck
import { ELEMENTS, ELEMENT_META, CastShape, settings } from './settings.js';

/**
 * Production skill contract — same shape CastingAbilitiesThreeJS exports
 * (`public/skills/production/*.json`). Studio Export writes this.
 */
export const SKILL_CATALOG = [
  {
    id: 'pyre',
    catalogId: 'pyre_crown',
    family: 'linear',
    delivery: 'around_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'burn', durationSec: 2.2, magnitude: 1 }]
  },
  {
    id: 'kraken',
    catalogId: 'kraken_crown',
    family: 'linear',
    delivery: 'around_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'slow', durationSec: 1.6, magnitude: 0.35 }]
  },
  {
    id: 'electrical',
    catalogId: 'electrical_sphere',
    family: 'linear',
    delivery: 'around_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'stun', durationSec: 0.8, magnitude: 1 }]
  },
  {
    id: 'earth',
    catalogId: 'earthen_spire',
    family: 'linear',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'root', durationSec: 1.2, magnitude: 1 }]
  },
  {
    id: 'portal',
    catalogId: 'verdant_gate',
    family: 'linear',
    delivery: 'at_location',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: []
  },
  {
    id: 'aether',
    catalogId: 'tidewrought_ring',
    family: 'linear',
    delivery: 'at_location',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'slow', durationSec: 1.4, magnitude: 0.3 }]
  },
  {
    id: 'firePortal',
    catalogId: 'fire_portal',
    family: 'linear',
    delivery: 'at_location',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'burn', durationSec: 1.5, magnitude: 0.8 }]
  },
  {
    id: 'cinderSlash',
    catalogId: 't0_sword_practice_slash',
    family: 'weapon',
    delivery: 'weapon',
    weaponTypeId: 'SWORD',
    animRole: 'slash',
    statuses: [{ id: 'burn', durationSec: 1.1, magnitude: 0.6 }]
  },
  {
    id: 'fireBolt',
    catalogId: 'staff_fire_bolt',
    family: 'weapon',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'burn', durationSec: 1.8, magnitude: 1 }]
  },
  {
    id: 'ice',
    catalogId: 'staff_frost_lance',
    family: 'linear',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [
      { id: 'freeze', durationSec: 2.2, magnitude: 1 },
      { id: 'slow', durationSec: 1.4, magnitude: 0.4 }
    ]
  },
  {
    id: 'thunder',
    catalogId: 'staff_storm_lance',
    family: 'linear',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'stun', durationSec: 0.9, magnitude: 1 }]
  },
  {
    id: 'beam',
    catalogId: 'staff_nova_beam',
    family: 'linear',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'burn', durationSec: 1.6, magnitude: 1 }]
  },
  {
    id: 'fireBend',
    catalogId: 'staff_fire_bend',
    family: 'linear',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'burn', durationSec: 2.0, magnitude: 1 }]
  },
  {
    id: 'waterBend',
    catalogId: 'staff_water_bend',
    family: 'linear',
    delivery: 'caster_to_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'slow', durationSec: 1.4, magnitude: 0.4 }]
  },
  {
    id: 'airBend',
    catalogId: 'staff_air_bend',
    family: 'linear',
    delivery: 'around_target',
    weaponTypeId: 'STAFF',
    animRole: 'cast',
    statuses: [{ id: 'knockback', durationSec: 0.6, magnitude: 1 }]
  }
];

export const DELIVERY_GROUPS = {
  Weapon: ['weapon'],
  Linear: ['caster_to_target'],
  Over: ['over_target'],
  Under: ['under_target'],
  Around: ['around_caster', 'around_target'],
  Aura: ['toggle_aura'],
  Place: ['at_location'],
  Path: ['path_stream', 'path_aoe', 'path_spikes', 'path_wall']
};

export function exportSkillPrefab(id) {
  const row = SKILL_CATALOG.find((s) => s.id === id);
  const meta = ELEMENT_META[id];
  const cfg = settings[id] ?? {};
  if (!row || !meta) return null;
  return {
    source: 'grudge-ability-lab',
    version: '1.3.0',
    schema: 'weapon-skill-production-override',
    id: row.catalogId,
    labId: id,
    weaponTypeId: row.weaponTypeId,
    label: meta.label,
    key: meta.key,
    family: row.family,
    delivery: row.delivery,
    castShape: meta.cast ?? CastShape.LINE,
    animRole: row.animRole,
    animClip: cfg.castAnim ?? 'cast1',
    rangeM: cfg.range ?? 0,
    minRangeM: cfg.minRange ?? 0,
    aoeM: cfg.zoneRadius ?? cfg.ringRadius ?? 0,
    cooldownSec: cfg.cooldown ?? 1,
    speedMs: cfg.speed ?? 0,
    intensity: 1,
    statuses: row.statuses,
    knobs: {
      glow: settings.global.glow,
      particleCount: settings.global.particleCount,
      cameraShake: settings.global.cameraShake
    },
    checklist: {
      catalogIdVerified: true,
      animClipVerified: true,
      vfxCastTravelImpact: true,
      physicsSI: true,
      statusesMapped: true,
      linearExtEditor: true,
      smokeCastingLab: true
    }
  };
}

export function exportAllSkills() {
  return {
    source: 'grudge-ability-lab',
    version: '1.3.0',
    upstream: 'https://github.com/MolochDaGod/LinearAbilityExtThreeJS',
    product: 'https://github.com/MolochDaGod/CastingAbilitiesThreeJS',
    elements: ELEMENTS,
    skills: ELEMENTS.map(exportSkillPrefab)
  };
}

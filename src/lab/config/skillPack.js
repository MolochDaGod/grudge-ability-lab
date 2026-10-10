// @ts-nocheck
/**
 * Portable skill packs for Three.js games.
 *
 * These casts are procedural (custom shaders, particles, ribbons, shockwaves).
 * GLB stores meshes and baked clips — not that runtime. The skill itself is a
 * JSON snapshot of knobs plus the matching Ability class. A GLB download is
 * only a container: the pack lives in `extras.grudgeSkill`.
 */
import { settings, ELEMENT_META } from './settings.js';
import { snapshotAbility } from './loadout.js';
import { shapeKnobs, motionKnobs } from './skillTune.js';

export const SKILL_FORMAT = 'grudge.skill/v1';

export const DELIVERY_NOTE =
  'Use JSON or the JS module in a Three.js / R3F game that runs the Grudge Ability classes. GLB is a container only — it does not hold the VFX mesh.';

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value, (_key, next) => (typeof next === 'function' ? undefined : next)));
}

export function slugSkill(name) {
  return (
    String(name || 'skill')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skill'
  );
}

export function buildSkillPack({ labId, name, snapshot, extra = {} } = {}) {
  const id = labId || extra.sourceId;
  const block = snapshot ?? snapshotAbility(id);
  const meta = ELEMENT_META[id] ?? {};
  if (!id || !block) return null;
  return {
    format: SKILL_FORMAT,
    name: String(name || meta.label || id).trim(),
    labId: id,
    engine: 'three.js',
    runtime: 'grudge-ability',
    delivery: {
      recommended: 'json',
      also: ['js', 'glb-extras'],
      not: 'glb-mesh',
      note: DELIVERY_NOTE
    },
    meta: {
      label: meta.label ?? id,
      accent: meta.accent ?? '#7fd6ff',
      key: meta.key ?? null,
      cast: meta.cast ?? 'line',
      range: block.range ?? null,
      cooldown: block.cooldown ?? null
    },
    knobs: {
      shape: shapeKnobs(id).map((row) => row.key),
      motion: motionKnobs(id).map((row) => row.key)
    },
    settings: jsonClone(block),
    weaponId: extra.weaponId ?? null,
    weaponType: extra.weaponType ?? null,
    exportedAt: new Date().toISOString()
  };
}

export function packFromSaved(item) {
  if (!item) return null;
  return buildSkillPack({
    labId: item.sourceId,
    name: item.name,
    snapshot: item.snapshot,
    extra: { weaponId: item.weaponId, weaponType: item.weaponType }
  });
}

export function toModuleSource(pack) {
  const json = JSON.stringify(pack, null, 2);
  return `/** Grudge skill pack — ${pack.name}
 * Drop this next to your Three.js / R3F Ability runtime.
 *
 *   import pack, { applySkill } from './${slugSkill(pack.name)}.js';
 *   applySkill(settings);
 *
 * GLB is not the VFX. The Ability class for labId "${pack.labId}" is the runtime.
 */
export const pack = ${json};

export function applySkill(settingsMap) {
  const block = settingsMap?.[pack.labId];
  if (!block) throw new Error('Unknown labId ' + pack.labId);
  Object.assign(block, pack.settings);
  return pack.labId;
}

export default pack;
`;
}

function padTo4(bytes, fill = 0x20) {
  const pad = (4 - (bytes.length % 4)) % 4;
  if (!pad) return bytes;
  const out = new Uint8Array(bytes.length + pad);
  out.set(bytes);
  out.fill(fill, bytes.length);
  return out;
}

/** Empty glTF with the skill in node extras — asset-pipeline container, not a mesh. */
export function packToGlb(pack) {
  const gltf = {
    asset: { version: '2.0', generator: 'grudge-skill-pack' },
    extras: { grudgeSkill: pack, note: DELIVERY_NOTE },
    scenes: [{ nodes: [0], extras: { grudgeSkill: pack } }],
    scene: 0,
    nodes: [{ name: pack.name || pack.labId, extras: { grudgeSkill: pack } }]
  };
  const json = padTo4(new TextEncoder().encode(JSON.stringify(gltf)), 0x20);
  const total = 12 + 8 + json.length;
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, json.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(json, 20);
  return bytes;
}

export function parseImportedPack(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  let data = null;
  try {
    data = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/export const pack = (\{[\s\S]*\});/);
    if (!match) return null;
    try {
      data = JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  if (data?.extras?.grudgeSkill) data = data.extras.grudgeSkill;
  if (data?.scenes?.[0]?.extras?.grudgeSkill) data = data.scenes[0].extras.grudgeSkill;
  if (data?.pack?.labId) data = data.pack;
  if (!data?.labId || !data?.settings) return null;
  if (data.format && data.format !== SKILL_FORMAT) return null;
  return data;
}

function triggerDownload(filename, body, mime) {
  const blob = body instanceof Blob ? body : new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadSkillPack(pack, kind = 'json') {
  if (!pack) return false;
  const base = slugSkill(pack.name || pack.labId);
  if (kind === 'js') {
    triggerDownload(`${base}.js`, toModuleSource(pack), 'text/javascript');
    return true;
  }
  if (kind === 'glb') {
    triggerDownload(`${base}.glb`, new Blob([packToGlb(pack)], { type: 'model/gltf-binary' }), 'model/gltf-binary');
    return true;
  }
  triggerDownload(`${base}.json`, JSON.stringify(pack, null, 2), 'application/json');
  return true;
}

export function lastFallback(element) {
  if (!element) return null;
  const meta = ELEMENT_META[element] ?? {};
  return {
    element,
    label: meta.label ?? element,
    accent: meta.accent ?? '#7fd6ff',
    via: 'selected',
    at: Date.now()
  };
}

export function downloadRuntimeGuide() {
  const link = document.createElement('a');
  link.href = '/skills/RUNTIME.md';
  link.download = 'grudge-skill-runtime.md';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

export function downloadRuntimeZip() {
  const link = document.createElement('a');
  link.href = '/skills/grudge-ability-runtime.zip';
  link.download = 'grudge-ability-runtime.zip';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

export function downloadLabZip() {
  const link = document.createElement('a');
  link.href = '/skills/grudge-ability-lab.zip';
  link.download = 'grudge-ability-lab.zip';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

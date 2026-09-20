// @ts-nocheck
import { settings, ELEMENT_META } from './settings.js';
import { getWeapon } from './weaponCatalog.js';

export const PLAY_SLOTS = Object.freeze(['1', '2', '3', '4', '5', '6', '7', 'R', 'F']);

export const DEFAULT_SLOTS = Object.freeze({
  '1': { kind: 'lab', id: 'cinderSlash' },
  '2': { kind: 'lab', id: 'fireBolt' },
  '3': { kind: 'lab', id: 'ice' },
  '4': { kind: 'lab', id: 'thunder' },
  '5': { kind: 'lab', id: 'beam' },
  '6': { kind: 'lab', id: 'fireBend' },
  '7': { kind: 'lab', id: 'waterBend' },
  R: { kind: 'weapon', id: 'sword_vengeful_slash' },
  F: { kind: 'weapon', id: 'staff_fire_bolt' }
});

const STORAGE_SLOTS = 'grudge-lab.loadout.v1';
const STORAGE_SAVED = 'grudge-lab.saved.v1';

function uid() {
  return `sav_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('[loadout] persist failed', error);
  }
}

/** Snapshot one ability block without replacing the live object identity. */
export function snapshotAbility(id) {
  const block = settings[id];
  if (!block) return null;
  return structuredClone(block);
}

export function applyAbilitySnapshot(id, snapshot) {
  const block = settings[id];
  if (!block || !snapshot) return;
  Object.assign(block, snapshot);
}

/**
 * Play-bar loadout + named saved skills.
 *
 * Slots bind a lab ability, a saved snapshot, or a canonical weapon skill.
 * Saved snapshots merge into the live `settings[id]` object so G-editor
 * bindings and in-flight casts stay valid.
 */
export class LoadoutStore {
  constructor() {
    this.listeners = new Set();
    this.mode = 'lab';
    this.slots = { ...DEFAULT_SLOTS };
    this.saved = [];
    this._read();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    this._write();
    for (const fn of this.listeners) fn(this);
  }

  _read() {
    const stored = readJSON(STORAGE_SLOTS, null);
    if (stored && typeof stored === 'object') {
      if (stored.mode === 'play' || stored.mode === 'lab') this.mode = stored.mode;
      if (stored.slots && typeof stored.slots === 'object') {
        for (const key of PLAY_SLOTS) {
          const row = stored.slots[key];
          if (row && row.kind && row.id) this.slots[key] = { kind: row.kind, id: row.id };
        }
      }
    }
    const saved = readJSON(STORAGE_SAVED, null);
    if (Array.isArray(saved?.items)) this.saved = saved.items;
  }

  _write() {
    writeJSON(STORAGE_SLOTS, { mode: this.mode, slots: this.slots });
    writeJSON(STORAGE_SAVED, { items: this.saved });
  }

  setMode(mode) {
    const next = mode === 'play' ? 'play' : 'lab';
    if (this.mode === next) return;
    this.mode = next;
    this._emit();
  }

  bind(slot, bind) {
    if (!PLAY_SLOTS.includes(slot)) return false;
    if (!bind || !bind.kind || !bind.id) {
      this.slots[slot] = { ...DEFAULT_SLOTS[slot] };
    } else {
      this.slots[slot] = { kind: bind.kind, id: bind.id };
    }
    this._emit();
    return true;
  }

  unbind(slot) {
    if (!PLAY_SLOTS.includes(slot)) return false;
    this.slots[slot] = { ...DEFAULT_SLOTS[slot] };
    this._emit();
    return true;
  }

  slotOf(kind, id) {
    return PLAY_SLOTS.find((slot) => this.slots[slot]?.kind === kind && this.slots[slot]?.id === id) ?? null;
  }

  saveCurrent(name, sourceId, extra = {}) {
    const snapshot = snapshotAbility(sourceId);
    if (!snapshot) return null;
    const item = {
      id: uid(),
      name: String(name || ELEMENT_META[sourceId]?.label || 'Saved skill').trim(),
      sourceId,
      weaponId: extra.weaponId ?? null,
      weaponType: extra.weaponType ?? null,
      snapshot,
      createdAt: Date.now()
    };
    this.saved.unshift(item);
    this._emit();
    return item;
  }

  /** Bring a downloaded pack back into Saved without arming it. */
  importPack(pack) {
    const sourceId = pack?.labId || pack?.sourceId;
    const snapshot = pack?.settings || pack?.snapshot;
    if (!sourceId || !snapshot || !settings[sourceId]) return null;
    const item = {
      id: uid(),
      name: String(pack.name || ELEMENT_META[sourceId]?.label || 'Imported skill').trim(),
      sourceId,
      weaponId: pack.weaponId ?? null,
      weaponType: pack.weaponType ?? null,
      snapshot: structuredClone(snapshot),
      createdAt: Date.now()
    };
    this.saved.unshift(item);
    this._emit();
    return item;
  }

  overwrite(id, sourceId) {
    const item = this.saved.find((row) => row.id === id);
    const snapshot = snapshotAbility(sourceId ?? item?.sourceId);
    if (!item || !snapshot) return false;
    item.snapshot = snapshot;
    if (sourceId) item.sourceId = sourceId;
    item.createdAt = Date.now();
    this._emit();
    return true;
  }

  rename(id, name) {
    const item = this.saved.find((row) => row.id === id);
    if (!item) return false;
    item.name = String(name || item.name).trim();
    this._emit();
    return true;
  }

  removeSaved(id) {
    const index = this.saved.findIndex((row) => row.id === id);
    if (index < 0) return false;
    this.saved.splice(index, 1);
    for (const slot of PLAY_SLOTS) {
      if (this.slots[slot]?.kind === 'saved' && this.slots[slot].id === id) {
        this.slots[slot] = { ...DEFAULT_SLOTS[slot] };
      }
    }
    this._emit();
    return true;
  }

  getSaved(id) {
    return this.saved.find((row) => row.id === id) ?? null;
  }

  /**
   * Resolve a play-bar slot into the lab VFX to cast.
   * `apply()` writes a saved snapshot into the live settings object.
   */
  resolve(slot) {
    const bind = this.slots[slot];
    if (!bind) return null;

    if (bind.kind === 'lab') {
      const meta = ELEMENT_META[bind.id];
      if (!meta) return null;
      return {
        kind: 'lab',
        bindId: bind.id,
        element: bind.id,
        label: meta.label,
        accent: meta.accent,
        apply() {}
      };
    }

    if (bind.kind === 'saved') {
      const item = this.getSaved(bind.id);
      if (!item) return null;
      const meta = ELEMENT_META[item.sourceId];
      return {
        kind: 'saved',
        bindId: bind.id,
        element: item.sourceId,
        label: item.name,
        accent: meta?.accent ?? '#7fd6ff',
        apply: () => applyAbilitySnapshot(item.sourceId, item.snapshot)
      };
    }

    if (bind.kind === 'weapon') {
      const skill = getWeapon(bind.id);
      if (!skill) return null;
      const meta = ELEMENT_META[skill.labId];
      return {
        kind: 'weapon',
        bindId: bind.id,
        element: skill.labId,
        label: skill.name,
        accent: meta?.accent ?? '#7fd6ff',
        weapon: skill,
        apply() {}
      };
    }

    return null;
  }
}

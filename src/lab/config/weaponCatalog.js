// @ts-nocheck
/**
 * Canonical weapon skills from info.grudge-studio.com, mapped onto lab VFX.
 * The compact dump lives in /skills/canonical-weapons.json so the lab works
 * without a live network call.
 */

const CATALOG_URL = '/skills/canonical-weapons.json';

export const weaponCatalog = {
  loaded: false,
  source: '',
  types: [],
  skills: [],
  byId: new Map()
};

export function getWeapon(id) {
  return weaponCatalog.byId.get(id) ?? null;
}

export async function loadWeaponCatalog() {
  if (weaponCatalog.loaded && weaponCatalog.skills.length) return weaponCatalog;
  try {
    const response = await fetch(CATALOG_URL);
    if (!response.ok) throw new Error(`catalog ${response.status}`);
    const data = await response.json();
    const skills = Array.isArray(data.skills) ? data.skills : [];
    weaponCatalog.source = data.source ?? CATALOG_URL;
    weaponCatalog.types = Array.isArray(data.types) ? data.types : [];
    weaponCatalog.skills = skills;
    weaponCatalog.byId = new Map(skills.map((row) => [row.id, row]));
    weaponCatalog.loaded = true;
  } catch (error) {
    console.warn('[weaponCatalog] failed to load', error);
    weaponCatalog.loaded = true;
  }
  return weaponCatalog;
}

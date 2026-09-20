// @ts-nocheck
/**
 * Per-slot colour / texture / size variants.
 *
 * The HUD mounts a tiny menu on 1 2 3 4 5 Q R B K. Picking a chip writes
 * straight into `settings[id]` so the next (and any standing) cast picks it
 * up — same live-binding contract as the G editor.
 */
import { settings, DEFAULT_SETTINGS, ELEMENT_META } from './settings.js';

export const VARIANT_SLOTS = [
  'cinderSlash',
  'fireBolt',
  'ice',
  'thunder',
  'beam',
  'pyre',
  'electrical',
  'boost',
  'fire',
  'fireBend',
  'waterBend'
];

export const PALETTES = {
  ember: {
    label: 'Ember',
    swatch: '#ff7a22',
    core: '#fff6d8',
    mid: '#ffb02e',
    edge: '#ff3d10',
    deep: '#1a0804',
    smoke: '#181616',
    light: '#ff8a28'
  },
  frost: {
    label: 'Frost',
    swatch: '#7ad8ff',
    core: '#f2feff',
    mid: '#8adaff',
    edge: '#3aa0ff',
    deep: '#052038',
    smoke: '#0c1c28',
    light: '#7ad8ff'
  },
  storm: {
    label: 'Storm',
    swatch: '#7fb4ff',
    core: '#ffffff',
    mid: '#c9ecff',
    edge: '#3aa0ff',
    deep: '#061428',
    smoke: '#121c2a',
    light: '#63b8ff'
  },
  void: {
    label: 'Void',
    swatch: '#8a5cff',
    core: '#f0e6ff',
    mid: '#a878ff',
    edge: '#5a20d8',
    deep: '#100818',
    smoke: '#140c1c',
    light: '#9a70ff'
  },
  toxic: {
    label: 'Toxic',
    swatch: '#79ef27',
    core: '#f2ffd8',
    mid: '#9ef04a',
    edge: '#3cb818',
    deep: '#081808',
    smoke: '#101810',
    light: '#79ef27'
  },
  holy: {
    label: 'Holy',
    swatch: '#ffe9a0',
    core: '#fffdf4',
    mid: '#ffe9a0',
    edge: '#e8c050',
    deep: '#2a2010',
    smoke: '#1c1810',
    light: '#ffe9a0'
  },
  blood: {
    label: 'Blood',
    swatch: '#ff3b5c',
    core: '#ffd0d4',
    mid: '#ff5a6e',
    edge: '#c01028',
    deep: '#180408',
    smoke: '#14080a',
    light: '#ff4a62'
  },
  solar: {
    label: 'Solar',
    swatch: '#ffd166',
    core: '#fff4c8',
    mid: '#ffd166',
    edge: '#ff9a18',
    deep: '#221408',
    smoke: '#1a120c',
    light: '#ffc44a'
  }
};

const FIRE_TEXTURES = {
  live: {
    label: 'Live',
    patch: { soot: 0.52, shred: 0.5, buoyancy: 1.05, volumeDensity: 1.5, glow: 2.5, flicker: 0.55 }
  },
  plasma: {
    label: 'Plasma',
    patch: { soot: 0.18, shred: 0.32, buoyancy: 0.7, volumeDensity: 1.25, glow: 3.2, flicker: 0.32, tempCore: 3100 }
  },
  coal: {
    label: 'Coal',
    patch: { soot: 1.15, shred: 0.7, buoyancy: 1.1, volumeDensity: 1.9, glow: 2.0, flicker: 0.8, tempCore: 1650 }
  }
};

export const TEXTURES = {
  cinderSlash: FIRE_TEXTURES,
  fireBolt: FIRE_TEXTURES,
  pyre: {
    live: { label: 'Live', patch: { soot: 0.48, curl: 0.71, sharp: 0.15, flameGain: 1.52, glow: 1.28 } },
    plasma: { label: 'Plasma', patch: { soot: 0.12, curl: 0.4, sharp: 0.35, flameGain: 1.9, glow: 1.7 } },
    coal: { label: 'Coal', patch: { soot: 0.82, curl: 0.55, sharp: 0.22, flameGain: 1.2, glow: 1.05 } }
  },
  fire: {
    live: { label: 'Live', patch: { veins: 0.85, veinSharp: 0.85, fresnelFlicker: 0.28, flameLife: 0.59 } },
    plasma: { label: 'Plasma', patch: { veins: 0.55, veinSharp: 1.0, fresnelFlicker: 0.12, flameLife: 0.72 } },
    coal: { label: 'Coal', patch: { veins: 1.0, veinSharp: 0.55, fresnelFlicker: 0.4, flameLife: 0.48 } }
  },
  ice: {
    crystal: { label: 'Crystal', patch: { facetSharp: 0.68, fracture: 0.62, veins: 0.45, opacity: 0.92, translucency: 1.5 } },
    rime: { label: 'Rime', patch: { facetSharp: 0.32, fracture: 0.85, veins: 0.9, opacity: 0.78, frostLine: 0.85 } },
    glass: { label: 'Glass', patch: { facetSharp: 0.9, fracture: 0.22, veins: 0.12, opacity: 0.55, translucency: 2.2, envIntensity: 1.35 } }
  },
  thunder: {
    filament: { label: 'Filament', patch: { glow: 2.3, opacity: 1.0, flicker: 0.3, strandFlash: 0.5 } },
    arc: { label: 'Arc', patch: { glow: 2.8, opacity: 0.85, flicker: 0.55, strandFlash: 0.75, restrike: 32 } },
    spark: { label: 'Spark', patch: { glow: 1.7, opacity: 1.0, flicker: 0.18, strandFlash: 0.25, restrike: 14 } }
  },
  electrical: {
    filament: { label: 'Filament', patch: {} },
    arc: { label: 'Arc', patch: {} },
    spark: { label: 'Spark', patch: {} }
  },
  boost: {
    filament: { label: 'Filament', patch: { veins: 0.72, veinSharp: 1.0, fresnelFlicker: 0.2, arcs: 25 } },
    arc: { label: 'Arc', patch: { veins: 0.95, veinSharp: 0.7, fresnelFlicker: 0.4, arcs: 32 } },
    spark: { label: 'Spark', patch: { veins: 0.4, veinSharp: 1.0, fresnelFlicker: 0.12, arcs: 14 } }
  },
  beam: {
    nova: { label: 'Nova', patch: { glow: 0.74, opacity: 0.29, streak: 1.1, coils: 4 } },
    solar: { label: 'Solar', patch: { glow: 1.05, opacity: 0.38, streak: 1.4, coils: 6 } },
    lance: { label: 'Lance', patch: { glow: 0.95, opacity: 0.42, streak: 0.7, coils: 2 } }
  },
  fireBend: {
    live: {
      label: 'Live',
      patch: {
        soot: 1.42,
        shred: 1.57,
        buoyancy: 3.09,
        volumeDensity: 2.09,
        glow: 3.06,
        flicker: 0.96,
        tempCore: 1980,
        coreClarity: 0.54,
        wisps: 0.81,
        flameTurbulence: 3.2,
        flameHeight: 1.84,
        flameWidth: 0.22,
        streamLength: 10.0,
        smokeDensity: 1.05,
        heatDistortion: 0.18
      }
    },
    plasma: {
      label: 'Plasma',
      patch: {
        soot: 0.38,
        shred: 0.72,
        buoyancy: 1.55,
        volumeDensity: 1.55,
        glow: 3.55,
        flicker: 0.42,
        tempCore: 2860,
        coreClarity: 0.78,
        wisps: 0.28,
        flameTurbulence: 1.65,
        flameHeight: 1.35,
        flameWidth: 0.2,
        streamLength: 8.5,
        smokeDensity: 0.28,
        heatDistortion: 0.42
      }
    },
    coal: {
      label: 'Coal',
      patch: {
        soot: 2.05,
        shred: 1.85,
        buoyancy: 3.45,
        volumeDensity: 2.45,
        glow: 2.35,
        flicker: 1.15,
        tempCore: 1620,
        coreClarity: 0.38,
        wisps: 1.05,
        flameTurbulence: 3.6,
        flameHeight: 2.15,
        flameWidth: 0.26,
        streamLength: 11.5,
        smokeDensity: 1.55,
        heatDistortion: 0.12
      }
    },
    whip: {
      label: 'Whip',
      patch: {
        soot: 0.85,
        shred: 1.15,
        buoyancy: 1.85,
        volumeDensity: 1.82,
        glow: 3.2,
        flicker: 0.62,
        tempCore: 2240,
        coreClarity: 0.66,
        wisps: 0.45,
        flameTurbulence: 2.2,
        flameHeight: 1.28,
        flameWidth: 0.14,
        streamLength: 13.5,
        smokeDensity: 0.42,
        heatDistortion: 0.28
      }
    }
  },
  waterBend: {
    ocean: {
      label: 'Ocean',
      patch: {
        foam: 2.5,
        foamSharpness: 2.5,
        transparency: 0.68,
        depthDensity: 0.2,
        fresnel: 2.65,
        shred: 0.8,
        glow: 0.8,
        translucency: 2.5,
        skyReflection: 3.0,
        envIntensity: 1.0,
        specular: 1.6,
        waveAmplitude: 0.26,
        chop: 0.6,
        foamRate: 75,
        mistDensity: 0.2
      }
    },
    ice: {
      label: 'Ice',
      patch: {
        foam: 1.35,
        foamSharpness: 3.2,
        transparency: 0.46,
        depthDensity: 0.11,
        fresnel: 3.45,
        shred: 0.32,
        glow: 1.18,
        translucency: 3.3,
        skyReflection: 2.15,
        envIntensity: 1.4,
        specular: 2.45,
        waveAmplitude: 0.12,
        chop: 0.22,
        foamRate: 36,
        mistDensity: 0.08
      }
    },
    ink: {
      label: 'Ink',
      patch: {
        foam: 0.55,
        foamSharpness: 1.35,
        transparency: 0.84,
        depthDensity: 0.58,
        fresnel: 1.55,
        shred: 1.15,
        glow: 0.32,
        translucency: 1.05,
        skyReflection: 1.15,
        envIntensity: 0.5,
        specular: 0.7,
        waveAmplitude: 0.38,
        chop: 0.95,
        foamRate: 22,
        mistDensity: 0.48
      }
    },
    foam: {
      label: 'Foam',
      patch: {
        foam: 4.2,
        foamSharpness: 2.85,
        transparency: 0.54,
        depthDensity: 0.14,
        fresnel: 2.2,
        shred: 1.45,
        glow: 1.08,
        translucency: 2.05,
        skyReflection: 2.4,
        envIntensity: 0.92,
        specular: 1.35,
        waveAmplitude: 0.34,
        chop: 0.85,
        foamRate: 160,
        mistDensity: 0.55
      }
    }
  }
};

export const BOLT_SIZES = {
  bullet: {
    label: 'Bullet',
    hint: 'small round',
    patch: {
      flameWidth: 0.05,
      headSize: 1.28,
      streamLength: 1.8,
      coreWidth: 0.08,
      lightRadius: 5.5,
      lightIntensity: 11,
      burstRadius: 1.15,
      scorchRadius: 0.65,
      wakeRise: 0.04,
      flightArc: 0.28,
      gravity: 0.9
    }
  },
  standard: {
    label: 'Standard',
    hint: 'staff bolt',
    patch: {
      flameWidth: 0.2,
      headSize: 1.72,
      streamLength: 3.4,
      coreWidth: 0.18,
      lightRadius: 14,
      lightIntensity: 24,
      burstRadius: 3.3,
      scorchRadius: 2.3,
      wakeRise: 0.1,
      flightArc: 0.95,
      gravity: 0.55
    }
  },
  great: {
    label: 'Great',
    hint: '1.5 m wide',
    patch: {
      flameWidth: 0.38,
      headSize: 1.95,
      streamLength: 4.8,
      coreWidth: 0.32,
      lightRadius: 22,
      lightIntensity: 38,
      burstRadius: 5.4,
      scorchRadius: 3.8,
      wakeRise: 0.16,
      flightArc: 1.15,
      gravity: 0.42
    }
  }
};

const STORAGE_KEY = 'grudge-lab-variants';

/** @type {Record<string, { palette?: string, texture?: string, size?: string }>} */
export const variantState = Object.create(null);

for (const id of VARIANT_SLOTS) {
  variantState[id] = { palette: 'default', texture: defaultTexture(id), size: id === 'fireBolt' ? 'standard' : undefined };
}

function defaultTexture(id) {
  const pack = TEXTURES[id];
  return pack ? Object.keys(pack)[0] : undefined;
}

function luminance(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (!Number.isFinite(n)) return 0.5;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function paintBlock(block, palette) {
  for (const key of Object.keys(block)) {
    if (key === 'colorInvalid') continue;
    const isLight = key === 'lightColor';
    if (!isLight && !key.startsWith('color')) continue;
    const cur = block[key];
    if (typeof cur !== 'string' || cur.charAt(0) !== '#') continue;
    const k = key.toLowerCase();
    if (/smoke|ash|char|soot|scorch|rock|deep|drowned/.test(k)) block[key] = palette.deep;
    else if (isLight || /light/.test(k)) block[key] = palette.light;
    else if (/foam|glint|highlight|core|inner|flash|hot|muzzle/.test(k)) block[key] = palette.core;
    else if (/shallow/.test(k)) block[key] = palette.mid;
    else if (/mid|flame|ember|vein|body|shock/.test(k)) block[key] = palette.mid;
    else if (/edge|outer|rim|halo|field|arc|ice/.test(k)) block[key] = palette.edge;
    else if (/[aA]$/.test(key) && /color[A-Z]/.test(key)) block[key] = palette.core;
    else if (/[bB]$/.test(key) && /color[A-Z]/.test(key)) block[key] = palette.mid;
    else if (/[cC]$/.test(key) && /color[A-Z]/.test(key)) block[key] = palette.edge;
    else if (/[dD]$/.test(key) && /color[A-Z]/.test(key)) block[key] = palette.deep;
    else {
      const L = luminance(cur);
      block[key] = L > 0.72 ? palette.core : L > 0.4 ? palette.mid : L > 0.15 ? palette.edge : palette.deep;
    }
  }
}

function restoreColors(id) {
  const fresh = DEFAULT_SETTINGS[id];
  const block = settings[id];
  if (!fresh || !block) return;
  for (const key of Object.keys(block)) {
    if (key === 'lightColor' || key.startsWith('color')) block[key] = fresh[key];
  }
}

function applyPatch(id, patch) {
  const block = settings[id];
  if (!block || !patch) return;
  for (const [key, value] of Object.entries(patch)) {
    if (key in block) block[key] = value;
  }
}

function setAccent(id, hex) {
  if (ELEMENT_META[id]) ELEMENT_META[id].accent = hex;
}

export function applyPalette(id, paletteId) {
  if (!VARIANT_SLOTS.includes(id)) return;
  variantState[id].palette = paletteId;
  const block = settings[id];
  const fresh = DEFAULT_SETTINGS[id];
  if (paletteId === 'default' || !PALETTES[paletteId]) {
    restoreColors(id);
    if (block && fresh && typeof fresh.paletteBlend === 'number' && 'paletteBlend' in block) {
      block.paletteBlend = fresh.paletteBlend;
    }
    setAccent(id, fresh?.lightColor || fresh?.colorCore || ELEMENT_META[id]?.accent);
  } else {
    const palette = PALETTES[paletteId];
    paintBlock(block, palette);
    setAccent(id, palette.swatch);
    // Black-body fire ignores the gradient at paletteBlend 0. Lift just enough
    // that a colour chip actually tints the volume.
    if (block && typeof block.paletteBlend === 'number') {
      block.paletteBlend = Math.max(block.paletteBlend, 0.32);
    }
  }
  persist();
}

export function applyTexture(id, textureId) {
  if (!VARIANT_SLOTS.includes(id)) return;
  const pack = TEXTURES[id];
  if (!pack || !pack[textureId]) return;
  variantState[id].texture = textureId;
  applyPatch(id, pack[textureId].patch);
  persist();
}

export function applyBoltSize(sizeId) {
  const size = BOLT_SIZES[sizeId] ?? BOLT_SIZES.standard;
  variantState.fireBolt.size = sizeId;
  applyPatch('fireBolt', size.patch);
  persist();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(variantState));
  } catch {
    /* private mode */
  }
}

export function loadVariants() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const id of VARIANT_SLOTS) {
      const row = saved[id];
      if (!row) continue;
      if (row.palette) applyPalette(id, row.palette);
      if (row.texture) applyTexture(id, row.texture);
      if (id === 'fireBolt' && row.size) applyBoltSize(row.size);
    }
  } catch {
    /* ignore */
  }
}

loadVariants();

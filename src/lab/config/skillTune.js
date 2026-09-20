// @ts-nocheck
/**
 * Per-skill HUD tune panels.
 *
 * Two buttons on every ability card open these: Shape (size, shockwave, span)
 * and Motion (speed, lob, impact, smoke, duration). Sliders write straight
 * into `settings[id]` so the next — and any standing — cast picks them up.
 */
import { settings, ELEMENT_META } from './settings.js';

function S(key, label, min, max, step) {
  return { key, label, min, max, step };
}

/** Shape / size / shockwave / start–finish. */
export const SHAPE_PANEL = {
  pyre: [
    S('zoneRadius', 'Size', 1.2, 10, 0.05),
    S('glow', 'Intensity', 0, 5, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('fieldCoreSize', 'End size', 0.08, 0.8, 0.01),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  kraken: [
    S('zoneRadius', 'Size', 1.2, 10, 0.05),
    S('glow', 'Intensity', 0, 5, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  electrical: [
    S('sphereRadius', 'Size', 0.4, 4, 0.05),
    S('glow', 'Intensity', 0, 5, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('zoneRadius', 'End size', 1.2, 10, 0.05),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  earth: [
    S('crustWidth', 'Size', 0.3, 4, 0.05),
    S('glow', 'Intensity', 0, 4, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('towerWidth', 'End size', 0.4, 4, 0.05),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  portal: [
    S('gateWidth', 'Size', 1.2, 8, 0.05),
    S('lightIntensity', 'Intensity', 0, 40, 0.1),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('gateHeight', 'End size', 1.2, 6, 0.05),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  aether: [
    S('ringRadius', 'Size', 0.6, 6, 0.05),
    S('lightIntensity', 'Intensity', 0, 40, 0.1),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('ringDepth', 'End size', 0.04, 0.8, 0.01),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  firePortal: [
    S('ringRadius', 'Size', 0.6, 6, 0.05),
    S('lightIntensity', 'Intensity', 0, 40, 0.1),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('scribeHeadSize', 'End size', 0.04, 0.6, 0.01),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  cinderSlash: [
    S('flameWidth', 'Size', 0.05, 0.8, 0.01),
    S('glow', 'Intensity', 0, 6, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('headSize', 'End size', 0.6, 3.2, 0.01),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  fireBolt: [
    S('flameWidth', 'Size', 0.06, 0.9, 0.01),
    S('glow', 'Intensity', 0, 6, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('headSize', 'End size', 0.8, 3.5, 0.01),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  ice: [
    S('width', 'Size', 0.4, 8, 0.05),
    S('glow', 'Intensity', 0, 4, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('widthNear', 'End size', 0.1, 4, 0.05),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  thunder: [
    S('spread', 'Size', 0.1, 3, 0.05),
    S('glow', 'Intensity', 0, 6, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('spreadNear', 'End size', 0.02, 1.2, 0.01),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  beam: [
    S('radius', 'Size', 0.08, 3, 0.02),
    S('glow', 'Intensity', 0, 6, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('radiusNear', 'End size', 0.04, 1.2, 0.01),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  fireBend: [
    S('flameWidth', 'Size', 0.06, 0.9, 0.01),
    S('glow', 'Intensity', 0, 6, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('headSize', 'End size', 0.8, 3.5, 0.01),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  waterBend: [
    S('radius', 'Size', 0.04, 0.6, 0.01),
    S('glow', 'Intensity', 0, 4, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('headSize', 'End size', 0.8, 3.5, 0.01),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ],
  airBend: [
    S('ribbonWidth', 'Size', 0.4, 5, 0.05),
    S('glow', 'Intensity', 0, 4, 0.05),
    S('shockwaveWidth', 'Shockwave width', 0.02, 0.45, 0.005),
    S('spiralRadius', 'End size', 0.2, 3.5, 0.05),
    S('startAlong', 'Start', 0, 0.85, 0.01),
    S('finishAlong', 'Finish', 0.15, 1, 0.01)
  ]
};

/** Speed / lob / impact / particles / smoke / after-AOE / duration. */
export const MOTION_PANEL = {
  pyre: [
    S('speed', 'Speed', 8, 90, 0.5),
    S('emberRate', 'Impact particles', 0, 600, 1),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('lifetime', 'Effect time', 0.6, 12, 0.05)
  ],
  kraken: [
    S('speed', 'Speed', 8, 90, 0.5),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('lifetime', 'Effect time', 0.8, 14, 0.05)
  ],
  electrical: [
    S('speed', 'Speed', 10, 120, 0.5),
    S('sparkRate', 'Impact particles', 0, 800, 1),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('lifetime', 'Effect time', 0.6, 10, 0.05)
  ],
  earth: [
    S('speed', 'Speed', 6, 60, 0.5),
    S('pebbleRate', 'Impact particles', 0, 120, 1),
    S('dustAmount', 'Smoke', 0, 3, 0.05),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('lifetime', 'Effect time', 0.6, 10, 0.05)
  ],
  portal: [
    S('speed', 'Speed', 8, 80, 0.5),
    S('dustAmount', 'Smoke', 0, 3, 0.05),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05)
  ],
  aether: [
    S('speed', 'Speed', 8, 80, 0.5),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05)
  ],
  firePortal: [
    S('speed', 'Speed', 8, 90, 0.5),
    S('sparkRate', 'Impact particles', 0, 8000, 50),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('scribeTime', 'Effect time', 0.15, 3, 0.01)
  ],
  cinderSlash: [
    S('speed', 'Speed', 8, 80, 0.5),
    S('bow', 'Lob', 0, 2, 0.02),
    S('burstRadius', 'Impact size', 0.4, 8, 0.05),
    S('emberRate', 'Impact particles', 0, 500, 1),
    S('smokeDensity', 'Smoke', 0, 2.5, 0.02),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('fadeTime', 'Effect time', 0.15, 3, 0.01)
  ],
  fireBolt: [
    S('speed', 'Speed', 6, 50, 0.5),
    S('flightArc', 'Lob', 0, 2.6, 0.02),
    S('burstRadius', 'Impact size', 0.4, 8, 0.05),
    S('emberRate', 'Impact particles', 0, 500, 1),
    S('smokeDensity', 'Smoke', 0, 2.5, 0.02),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('impactTime', 'Effect time', 0.15, 3, 0.01)
  ],
  ice: [
    S('speed', 'Speed', 6, 80, 0.5),
    S('burstSize', 'Impact size', 0.4, 10, 0.05),
    S('burstShards', 'Impact particles', 0, 240, 1),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('lifetime', 'Effect time', 0.4, 10, 0.05)
  ],
  thunder: [
    S('speed', 'Speed', 20, 240, 1),
    S('sag', 'Lob', -2, 3, 0.02),
    S('burstSize', 'Impact size', 0.4, 10, 0.05),
    S('sparkRate', 'Impact particles', 0, 800, 1),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('lifetime', 'Effect time', 0.1, 4, 0.01)
  ],
  beam: [
    S('speed', 'Speed', 40, 260, 1),
    S('burstSize', 'Impact size', 0.4, 14, 0.05),
    S('sparkRate', 'Impact particles', 0, 800, 1),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('lifetime', 'Effect time', 0.2, 6, 0.05)
  ],
  fireBend: [
    S('speed', 'Speed', 4, 40, 0.1),
    S('flightArc', 'Lob', 0, 2.4, 0.02),
    S('explosionSize', 'Impact size', 0.4, 8, 0.05),
    S('emberRate', 'Impact particles', 0, 500, 1),
    S('smokeDensity', 'Smoke', 0, 2.5, 0.02),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('lifetime', 'Effect time', 0.4, 8, 0.05)
  ],
  waterBend: [
    S('speed', 'Speed', 3, 24, 0.1),
    S('surge', 'Lob', 0, 1.6, 0.02),
    S('splashSize', 'Impact size', 0.4, 8, 0.05),
    S('dropletRate', 'Impact particles', 0, 700, 1),
    S('mistDensity', 'Smoke', 0, 2, 0.02),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('foamLingering', 'Effect time', 0.4, 10, 0.05)
  ],
  airBend: [
    S('speed', 'Speed', 6, 40, 0.1),
    S('flightArc', 'Lob', 0, 2.4, 0.02),
    S('tornadoRadius', 'Impact size', 0.6, 8, 0.05),
    S('leafCount', 'Impact particles', 0, 160, 1),
    S('dustAmount', 'Smoke', 0, 4, 0.05),
    S('afterAoe', 'After AOE', 0.3, 3, 0.05),
    S('tornadoDuration', 'Effect time', 0.4, 6, 0.05)
  ]
};

export function shapeKnobs(id) {
  return SHAPE_PANEL[id] ?? [];
}

export function motionKnobs(id) {
  return MOTION_PANEL[id] ?? [];
}

export function formatTune(value, step) {
  if (!Number.isFinite(value)) return '—';
  if (step >= 1) return String(Math.round(value));
  if (step >= 0.1) return value.toFixed(1);
  return value.toFixed(2);
}

export function clampTune(spec, value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return settings[spec.id]?.[spec.key];
  return Math.min(spec.max, Math.max(spec.min, v));
}

export function writeTune(id, key, value) {
  const block = settings[id];
  if (!block) return;
  block[key] = value;
}

export function tuneTitle(id, panel) {
  const label = ELEMENT_META[id]?.label ?? id;
  return panel === 'shape' ? `${label} · Shape` : `${label} · Motion`;
}

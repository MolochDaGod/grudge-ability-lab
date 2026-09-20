// @ts-nocheck
import { Vector3 } from 'three';
import { RibbonMode } from './RibbonGeometry.js';
import { fireHullReach } from '../materials/VolumetricFireMaterial.js';
import { saturate, smoothstep } from '../utils/math.js';

const _dir = new Vector3();

/**
 * Radius along a fire stream, 0 = tail, 1 = head, in units of flameWidth.
 * Must stay in step with flameProfile() in VolumetricFireMaterial.
 */
export function radiusProfile(u, headSize, wakeSpread) {
  const body = (0.34 + 0.66 * Math.pow(u, 0.55)) * (1 + wakeSpread * Math.pow(1 - u, 1.8));
  return body * (1 + (headSize - 1) * smoothstep(0.62, 1, u));
}

/**
 * Rebuild a camera-facing proxy hull around `points[0..count)`.
 * Pads both ends so the volume caps are not sliced by the ribbon edge.
 *
 * @param {import('./RibbonGeometry.js').RibbonGeometry} ribbon
 * @param {Vector3[]} points
 * @param {number} count
 * @param {object} cfg ability settings (flameWidth, headSize, wakeSpread, flameHeight, wakeRise)
 * @param {Vector3} cameraPosition
 * @param {import('../materials/VolumetricFireMaterial.js').VolumetricFireMaterial} fireMaterial
 * @param {Vector3[]} hull scratch points, length >= count + 2
 * @param {number} [widthScale]
 */
export function buildFireHull(ribbon, points, count, cfg, cameraPosition, fireMaterial, hull, widthScale = 1) {
  if (count < 2) {
    ribbon.clear();
    return;
  }

  let length = 0;
  for (let i = 1; i < count; i++) length += points[i].distanceTo(points[i - 1]);
  if (length < 1e-3) {
    ribbon.clear();
    return;
  }

  const radius = cfg.flameWidth * widthScale;
  const headSize = cfg.headSize;
  const wakeSpread = cfg.wakeSpread;
  const headRadius = radius * headSize;
  const reach = fireHullReach(cfg);
  const tailPad = radius * radiusProfile(0, 1, wakeSpread) * reach;
  const headPad = headRadius * reach;

  _dir.copy(points[0]).sub(points[1]);
  if (_dir.lengthSq() < 1e-8) _dir.set(0, 0, 1);
  hull[0].copy(points[0]).addScaledVector(_dir.normalize(), tailPad);

  const wakeRise = cfg.wakeRise ?? 0;
  for (let i = 0; i < count; i++) {
    const age = 1 - i / (count - 1);
    hull[i + 1].copy(points[i]);
    hull[i + 1].y += wakeRise * Math.pow(age, 1.5);
  }
  hull[0].y += wakeRise;

  _dir.copy(points[count - 1]).sub(points[count - 2]);
  if (_dir.lengthSq() < 1e-8) _dir.set(0, 0, 1);
  hull[count + 1].copy(points[count - 1]).addScaledVector(_dir.normalize(), headPad);

  const arcLength = tailPad + length + headPad;
  const u = fireMaterial.uniforms;
  u.uRadius.value = radius;
  u.uStreamLength.value = length;
  u.uArcLength.value = arcLength;
  u.uTailPad.value = tailPad;

  const cover = 1.08 * reach * Math.max(1, cfg.flameHeight);

  ribbon.build(hull, {
    count: count + 2,
    width: 2 * headRadius * cover,
    mode: RibbonMode.BILLBOARD,
    cameraPosition,
    widthProfile: (t) =>
      radiusProfile(saturate((t * arcLength - tailPad) / Math.max(length, 1e-3)), headSize, wakeSpread) /
      headSize
  });
}

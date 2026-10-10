import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Scene } from 'three';
import { resetSettings, settings } from '../src/lab/config/settings.js';
import { applySkillPayload, createSkillRuntime, paintSkill, resolveSkillId } from '../src/lab/api/skillRuntime.js';

test('resolve accepts lab ids and catalog ids', () => {
  assert.equal(resolveSkillId('fireBolt'), 'fireBolt');
  assert.equal(resolveSkillId('staff_fire_bolt'), 'fireBolt');
  assert.equal(resolveSkillId('STAFF_WATER_BEND'), 'waterBend');
  assert.equal(resolveSkillId('nope'), null);
});

test('apply paints look packs and combat overrides', () => {
  resetSettings();
  const look = applySkillPayload({
    format: 'grudge.skill/v1',
    labId: 'fireBolt',
    settings: { flameWidth: 0.41, range: 9 }
  });
  assert.equal(look.ok, true);
  assert.equal(look.kind, 'look');
  assert.equal(settings.fireBolt.flameWidth, 0.41);
  assert.equal(settings.fireBolt.range, 9);

  const combat = applySkillPayload({
    schema: 'weapon-skill-production-override',
    catalogId: 'staff_fire_bolt',
    labId: 'fireBolt',
    rangeM: 12,
    cooldownSec: 0.4
  });
  assert.equal(combat.kind, 'combat');
  assert.equal(settings.fireBolt.range, 12);
  assert.equal(settings.fireBolt.cooldown, 0.4);
  assert.equal(settings.fireBolt.flameWidth, 0.41);

  const junk = applySkillPayload('not json');
  assert.equal(junk.ok, false);
  resetSettings();
});

test('paint rejects unknown chips and writes a real palette', () => {
  resetSettings();
  const missing = paintSkill('fireBend', { palette: 'nope' });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'palette');
  const painted = paintSkill('fireBend', { palette: 'frost', texture: 'plasma' });
  assert.equal(painted.ok, true);
  assert.ok(settings.fireBend.paletteBlend >= 0.32);
  resetSettings();
});

test('cast enforces aim, range, and cooldown, then steps', () => {
  resetSettings();
  settings.fireBolt.cooldown = 0.5;
  settings.fireBolt.minRange = 1;
  const impacts = [];
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 200);
  const skills = createSkillRuntime({
    scene,
    camera,
    onImpact: (event) => impacts.push(event.labId)
  });

  assert.equal(skills.cast({ id: 'missing', origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } }).reason, 'unknown');
  assert.equal(skills.cast({ id: 'staff_fire_bolt', origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 0 } }).reason, 'aim');
  assert.equal(
    skills.cast({ id: 'fireBolt', origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 }, distance: 0.2 }).reason,
    'too-close'
  );

  const shot = skills.cast({
    id: 'staff_fire_bolt',
    origin: { x: 1, y: 0, z: 2 },
    direction: { x: 0, y: 4, z: -3 }
  });
  assert.equal(shot.ok, true);
  assert.equal(shot.labId, 'fireBolt');
  assert.equal(shot.catalogId, 'staff_fire_bolt');
  assert.ok(Math.abs(shot.direction.y) < 1e-6);
  assert.ok(skills.cooldownLeft('fireBolt') > 0);

  const blocked = skills.cast({ id: 'fireBolt', origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } });
  assert.equal(blocked.reason, 'cooldown');

  const forced = skills.cast({
    id: 'fireBolt',
    origin: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: -1 },
    force: true
  });
  assert.equal(forced.ok, true);

  const frame = skills.step(1 / 60, { width: 1280, height: 720 });
  assert.equal(frame.active, 2);
  assert.ok(frame.elapsed > 0);

  skills.step(30);
  skills.clear();
  assert.equal(skills.step(0).active, 0);
  skills.dispose();
  resetSettings();
  assert.ok(impacts.length >= 0);
});

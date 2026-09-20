// @ts-nocheck
import { Mesh, Vector3, Color } from 'three';
import { Ability } from './Ability.js';
import { RibbonGeometry, RibbonMode } from '../effects/RibbonGeometry.js';
import { buildFireHull } from '../effects/FireVolume.js';
import { VolumetricFireMaterial } from '../materials/VolumetricFireMaterial.js';
import { DistortionMaterial } from '../materials/DistortionMaterial.js';
import { SlashCoreMaterial } from '../materials/SlashCoreMaterial.js';
import { ParticleShape } from '../particles/ParticleSystem.js';
import { RateEmitter } from '../particles/ParticleEngine.js';
import { DecalType } from '../effects/GroundDecals.js';
import { BurstMode } from '../effects/BurstSphere.js';
import { LAYER } from '../core/Layers.js';
import { frame } from '../core/FrameUniforms.js';
import { settings } from '../config/settings.js';
import { getColor } from '../utils/color.js';
import { saturate } from '../utils/math.js';

const SAMPLES = 28;
const _pos = new Vector3();
const _dir = new Vector3();
const _up = new Vector3(0, 1, 0);
const _emit = {};
const _gradA = new Color();
const _gradB = new Color();
const _gradC = new Color();
const _gradD = new Color();

/**
 * CINDER SLASH — a ground-running melee wave.
 *
 * The cut hugs the floor, bends a little in the ground plane, and leaves a
 * bright upright blade plus a thin fire sheath. Impact is the anime power-hit:
 * a flattened shock shell, a fire burst, and a fan of sparks.
 */
export class CinderSlashAbility extends Ability {
  constructor(context) {
    super('cinderSlash', context);
  }

  createShaders() {
    this.ribbon = new RibbonGeometry(48, { frame: true });
    this.coreRibbon = new RibbonGeometry(48);
    this.trailPoints = [];
    this.hullPoints = [];
    for (let i = 0; i < SAMPLES; i++) this.trailPoints.push(new Vector3());
    for (let i = 0; i < SAMPLES + 2; i++) this.hullPoints.push(new Vector3());
    this._sampleCount = 0;

    this.fireMaterial = new VolumetricFireMaterial('cinderSlash');
    this.fireMesh = new Mesh(this.ribbon.geometry, this.fireMaterial);
    this.fireMesh.layers.set(LAYER.VFX);
    this.fireMesh.renderOrder = 11;

    this.coreMaterial = new SlashCoreMaterial();
    this.coreMaterial.uniforms.uStyle.value = 0;
    this.coreMesh = new Mesh(this.coreRibbon.geometry, this.coreMaterial);
    this.coreMesh.layers.set(LAYER.VFX);
    this.coreMesh.renderOrder = 12;

    this.distortionMaterial = new DistortionMaterial({
      stream: true,
      frequency: 1.8,
      speed: 1.4
    });
    this.distortionMesh = new Mesh(this.ribbon.geometry, this.distortionMaterial);
    this.distortionMesh.layers.set(LAYER.DISTORTION);

    for (const mesh of [this.fireMesh, this.coreMesh, this.distortionMesh]) {
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
  }

  createParticles() {
    const particles = this.ctx.particles;
    this.embers = particles.get('cinder-slash-embers', {
      capacity: 1400,
      shape: ParticleShape.SOFT,
      additive: true,
      softFade: 0.4
    });
    this.embers.uniforms.uGravity.value.set(0, 1.2, 0);
    this.embers.uniforms.uDrag.value = 1.15;
    this.embers.uniforms.uEndSize.value = 0.08;
    this.embers.uniforms.uFadeOut.value = 0.32;

    this.sparks = particles.get('cinder-slash-sparks', {
      capacity: 1100,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true,
      softFade: 0.22
    });
    this.sparks.uniforms.uGravity.value.set(0, -6.5, 0);
    this.sparks.uniforms.uDrag.value = 0.45;
    this.sparks.uniforms.uStretch.value = 0.22;

    this.smoke = particles.get('cinder-slash-smoke', {
      capacity: 500,
      shape: ParticleShape.SMOKE,
      additive: false,
      curl: true,
      softFade: 1.0
    });
    this.smoke.uniforms.uGravity.value.set(0, 0.55, 0);
    this.smoke.uniforms.uDrag.value = 1.5;
    this.smoke.uniforms.uEndSize.value = 2.4;

    this.emberEmitter = new RateEmitter();
    this.sparkEmitter = new RateEmitter();
    this.smokeEmitter = new RateEmitter();
  }

  get impactDuration() {
    return this.config.impactTime;
  }

  get fadeDuration() {
    return this.config.fadeTime;
  }

  /**
   * World point on the ground-running cut. `s` is 0..1 along the aimed line.
   * Bows in the ground plane so it reads as a slash, not a laser.
   */
  slashPoint(s, out) {
    const c = this.config;
    const t = saturate(s);
    this.pointAt(t, out);
    const lobe = Math.sin(Math.PI * t);
    out.addScaledVector(this.side, lobe * c.bow);
    out.y = c.bladeHeight + lobe * c.lift;
    return out;
  }

  _rebuildCurve(upto) {
    const n = SAMPLES;
    const u = saturate(upto);
    this._sampleCount = n;
    for (let i = 0; i < n; i++) {
      const s = (i / (n - 1)) * u;
      this.slashPoint(s, this.trailPoints[i]);
    }
  }

  _rebuildCore() {
    if (this._sampleCount < 2) {
      this.coreRibbon.clear();
      return;
    }
    this.coreRibbon.build(this.trailPoints, {
      count: this._sampleCount,
      width: this.config.slashHeight,
      mode: RibbonMode.UPRIGHT
    });
  }

  onSpawn() {
    this.emberEmitter.reset();
    this.sparkEmitter.reset();
    this.smokeEmitter.reset();
    this._lastScorch = 0;
    this.fireMaterial.uniforms.uHeadFade.value = 0;
    this.coreMaterial.uniforms.uHeadFade.value = 0;
    this.fireMaterial.uniforms.uSeed.value = Math.random() * 20;
    this.ribbon.clear();
    this.coreRibbon.clear();
    this.fireMesh.visible = true;
    this.coreMesh.visible = true;
    this.distortionMesh.visible = true;
    this.ctx.flash.trigger(getColor(this.config.colorCore), 0.22);
  }

  _syncUniforms() {
    const c = this.config;
    const g = settings.global;
    this.fireMaterial.sync();
    this.coreMaterial.tint(c.colorCore, c.colorMid, c.colorEdge);
    this.coreMaterial.uniforms.uGlow.value = c.glow * 1.15;
    this.coreMaterial.uniforms.uOpacity.value = c.opacity;

    const d = this.distortionMaterial.uniforms;
    d.uStrength.value = c.heatDistortion * g.distortion;
    d.uFrequency.value = 0.7 + c.noiseFrequency * 0.3;
    d.uSpeed.value = c.flameSpeed * 0.7;

    const core = getColor(c.colorCore);
    const mid = getColor(c.colorMid);
    const edge = getColor(c.colorEdge);
    const smoke = getColor(c.colorSmoke);

    this.embers.setGradient(core, mid, edge, smoke);
    this.embers.uniforms.uSizeScale.value = c.emberSize * g.particleSize * 7;
    this.embers.uniforms.uLifeScale.value = g.particleLifetime;
    this.embers.uniforms.uSpeedScale.value = g.particleSpeed;
    this.embers.uniforms.uGlow.value = c.glow * 0.45;
    this.embers.uniforms.uTurbulence.value = 0.35 * g.turbulence;

    this.sparks.setGradient(core, core, mid, edge);
    this.sparks.uniforms.uSizeScale.value = c.emberSize * g.particleSize * 5.5;
    this.sparks.uniforms.uGlow.value = c.glow * 0.9;

    this.smoke.setGradient(
      _gradA.copy(edge).multiplyScalar(0.12),
      _gradB.copy(smoke).multiplyScalar(4.2),
      _gradC.copy(smoke).multiplyScalar(2.2),
      _gradD.copy(smoke).multiplyScalar(1.0)
    );
    this.smoke.uniforms.uSizeScale.value = c.smokeSize * g.particleSize;
    this.smoke.uniforms.uOpacity.value = c.smokeDensity * g.opacity;
  }

  _emitStream(dt) {
    const c = this.config;
    const g = settings.global;
    const time = frame.uTime.value;
    const head = this.trailPoints[this._sampleCount - 1];
    if (!head) return;

    const emberCount = Math.round(this.emberEmitter.tick(dt, c.emberRate) * g.particleCount);
    if (emberCount > 0) {
      _emit.position = _pos.copy(head);
      _pos.y += 0.08;
      _emit.radius = c.flameWidth * 0.7;
      _emit.direction = _dir.set(0, 1, 0);
      _emit.speed = c.emberSpeed;
      _emit.speedVariance = 0.4;
      _emit.spread = 0.55;
      _emit.inherit = null;
      _emit.anchor = null;
      _emit.size = 0.09;
      _emit.sizeVariance = 0.4;
      _emit.life = c.emberLifetime;
      _emit.lifeVariance = 0.3;
      _emit.spin = 0;
      _emit.tint = null;
      _emit.time = time;
      this.embers.emit(emberCount, _emit);
    }

    const sparkCount = Math.round(this.sparkEmitter.tick(dt, c.sparkRate) * g.particleCount);
    if (sparkCount > 0) {
      this.slashPoint(Math.min(1, this.u + 0.03), _dir);
      _dir.sub(head).normalize();
      _emit.position = _pos.copy(head);
      _emit.radius = c.flameWidth * 0.25;
      _emit.direction = _dir;
      _emit.speed = c.sparkSpeed;
      _emit.spread = 0.35;
      _emit.size = 0.12;
      _emit.life = 0.45;
      _emit.spin = 0;
      _emit.time = time;
      this.sparks.emit(sparkCount, _emit);
    }

    const smokeCount = Math.round(this.smokeEmitter.tick(dt, 28 * c.smokeDensity) * g.particleCount);
    if (smokeCount > 0) {
      _emit.position = _pos.copy(head);
      _pos.y += 0.1;
      _emit.radius = c.flameWidth * 0.6;
      _emit.direction = _dir.set(0, 1, 0);
      _emit.speed = c.smokeSpeed;
      _emit.spread = 0.5;
      _emit.size = 0.55;
      _emit.life = c.smokeLifetime;
      _emit.spin = 0.8;
      _emit.time = time;
      this.smoke.emit(smokeCount, _emit);
    }
  }

  onTravel(dt) {
    this._syncUniforms();
    this._rebuildCurve(this.u);
    this._rebuildCore();
    buildFireHull(
      this.ribbon,
      this.trailPoints,
      this._sampleCount,
      this.config,
      this.ctx.camera.position,
      this.fireMaterial,
      this.hullPoints
    );
    this._emitStream(dt);

    const c = this.config;
    if (this.front - this._lastScorch > c.scorchSpacing) {
      this._lastScorch = this.front;
      this.slashPoint(this.u, _pos);
      _pos.y = 0.02;
      this.ctx.decals.spawn(DecalType.SCORCH, _pos, {
        radius: c.scorchRadius,
        life: c.scorchLife,
        intensity: 0.9,
        colorA: getColor(c.colorScorch)
      });
    }

    this.slashPoint(this.u, this.position);
    this.lightColor.copy(getColor(c.lightColor));
    this.ctx.shake.rumble(c.rumble * settings.global.cameraShake, dt);
  }

  onImpact() {
    const c = this.config;
    this.slashPoint(1, _pos);
    const tip = _pos.clone();
    const ground = _pos.clone();
    ground.y = 0.12;
    const air = tip.clone();
    air.y += 0.35;

    this.ctx.bursts.spawn(BurstMode.FIRE, air, {
      radius: 0.18,
      endRadius: c.burstRadius * 0.55,
      life: 0.38,
      intensity: 1.7,
      displace: 0.22,
      colorA: getColor(c.colorCore),
      colorB: getColor(c.colorMid),
      colorC: getColor(c.colorEdge)
    });
    this.ctx.bursts.spawn(BurstMode.AIR, air, {
      radius: 0.35,
      endRadius: c.burstRadius * 1.7,
      life: 0.34,
      intensity: 1.55,
      fresnel: 1.9,
      opacity: 0.95,
      squash: 0.42,
      colorA: getColor(c.colorCore),
      colorB: getColor(c.colorMid),
      colorC: getColor(c.colorCore)
    });
    this.ctx.bursts.spawn(BurstMode.AIR, ground, {
      radius: 0.5,
      endRadius: c.burstRadius * 2.1,
      life: 0.42,
      intensity: 1.15,
      fresnel: 2.1,
      squash: 0.1,
      colorA: getColor(c.colorMid),
      colorB: getColor(c.colorCore),
      colorC: getColor(c.colorCore)
    });
    this.ctx.decals.spawn(DecalType.SCORCH, ground, {
      radius: c.impactScorch,
      life: c.scorchLife * 1.4,
      intensity: 1.2,
      colorA: getColor(c.colorScorch)
    });
    this.spawnShockwave(ground, {
      radius: c.burstRadius * 1.15,
      life: 0.42,
      growth: 4.2,
      colorA: getColor(c.colorCore)
    });
    this.spawnShockwave(ground, {
      radius: c.burstRadius * 0.55,
      life: 0.28,
      growth: 5.4,
      colorA: getColor(c.colorMid)
    });
    this.ctx.shake.add(c.shake * settings.global.cameraShake, 2.8, 34);
    this.ctx.flash.trigger(getColor(c.colorCore), c.flash);

    _emit.position = air;
    _emit.direction = _dir.copy(this.direction).multiplyScalar(0.45).addScaledVector(_up, 0.55);
    _emit.speed = 11;
    _emit.spread = 0.85;
    _emit.radius = 0.28;
    _emit.size = 0.16;
    _emit.life = 0.55;
    _emit.time = this.age;
    this.sparks.emit(48, _emit);
    _emit.direction = _dir.copy(this.side);
    _emit.speed = 8.5;
    _emit.spread = 0.7;
    this.sparks.emit(22, _emit);
    _emit.direction = _up;
    _emit.speed = 4.2;
    _emit.size = 0.12;
    this.embers.emit(18, _emit);
    this.lightBoost = 4.2;
  }

  onFade(dt, t) {
    this._syncUniforms();
    this._rebuildCurve(1);
    const k = t > 1 ? saturate(t - 1) : 0;
    this.fireMaterial.uniforms.uHeadFade.value = k;
    this.coreMaterial.uniforms.uHeadFade.value = k;
    this._rebuildCore();
    buildFireHull(
      this.ribbon,
      this.trailPoints,
      this._sampleCount,
      this.config,
      this.ctx.camera.position,
      this.fireMaterial,
      this.hullPoints,
      1 - k * 0.7
    );
    if (k < 0.55) this._emitStream(dt);
    this.slashPoint(1, this.position);
  }

  onDestroy() {
    this.ribbon.clear();
    this.coreRibbon.clear();
    this.fireMesh.visible = false;
    this.coreMesh.visible = false;
    this.distortionMesh.visible = false;
  }

  lightShimmer() {
    return 0.7 + 0.35 * Math.abs(Math.sin(this.age * 22));
  }
}

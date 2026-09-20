// @ts-nocheck
import { Mesh, Vector3, Color } from 'three';
import { Ability } from './Ability.js';
import { RibbonGeometry } from '../effects/RibbonGeometry.js';
import { buildFireHull } from '../effects/FireVolume.js';
import { VolumetricFireMaterial } from '../materials/VolumetricFireMaterial.js';
import { DistortionMaterial } from '../materials/DistortionMaterial.js';
import { ParticleShape } from '../particles/ParticleSystem.js';
import { RateEmitter } from '../particles/ParticleEngine.js';
import { BurstMode } from '../effects/BurstSphere.js';
import { DecalType } from '../effects/GroundDecals.js';
import { LAYER } from '../core/Layers.js';
import { frame } from '../core/FrameUniforms.js';
import { settings } from '../config/settings.js';
import { getColor } from '../utils/color.js';
import { saturate, lerp, smoothstep, randRange } from '../utils/math.js';

const MAX_TRAIL = 64;
const _emit = {};
const _pos = new Vector3();
const _dir = new Vector3();
const _inherit = new Vector3();
const _gradA = new Color();
const _gradB = new Color();
const _gradC = new Color();
const _gradD = new Color();

/**
 * FIRE BENDING — volumetric fire stream along a linear path, detonating at the
 * far end. Ported from Avatar FireAbility onto the lab's line-cast Ability.
 *
 * The mesh is only a camera-facing hull. VolumetricFireMaterial raymarches a
 * black-body volume inside it (silhouette → vortex → turbulence → shred).
 * There is no comet core — the white-hot axis is temperature, not a ribbon.
 */
export class FireBendAbility extends Ability {
  constructor(context) {
    super('fireBend', context);
    this.tangent = new Vector3(0, 0, 1);
    this.velocity = new Vector3();
  }

  createShaders() {
    this.ribbon = new RibbonGeometry(72, { frame: true });
    this.trailPoints = [];
    this.hullPoints = [];
    for (let i = 0; i < MAX_TRAIL; i++) this.trailPoints.push(new Vector3());
    for (let i = 0; i < MAX_TRAIL + 2; i++) this.hullPoints.push(new Vector3());
    this._trailCount = 0;

    this.fireMaterial = new VolumetricFireMaterial('fireBend');
    this.fireMesh = new Mesh(this.ribbon.geometry, this.fireMaterial);
    this.fireMesh.layers.set(LAYER.VFX);
    this.fireMesh.renderOrder = 11;

    this.distortionMaterial = new DistortionMaterial({ stream: true, frequency: 2.1, speed: 1.5 });
    this.distortionMesh = new Mesh(this.ribbon.geometry, this.distortionMaterial);
    this.distortionMesh.layers.set(LAYER.DISTORTION);

    for (const mesh of [this.fireMesh, this.distortionMesh]) {
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
  }

  createParticles() {
    const particles = this.ctx.particles;

    this.embers = particles.get('fire-bend-embers', {
      capacity: 4000,
      shape: ParticleShape.SOFT,
      additive: true,
      softFade: 0.4
    });
    this.embers.uniforms.uGravity.value.set(0, 1.4, 0);
    this.embers.uniforms.uDrag.value = 1.1;
    this.embers.uniforms.uEndSize.value = 0.05;
    this.embers.uniforms.uFadeOut.value = 0.25;

    this.sparks = particles.get('fire-bend-sparks', {
      capacity: 2000,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true,
      softFade: 0.3
    });
    this.sparks.uniforms.uGravity.value.set(0, -9.5, 0);
    this.sparks.uniforms.uDrag.value = 0.55;
    this.sparks.uniforms.uEndSize.value = 0.25;
    this.sparks.uniforms.uStretch.value = 0.12;

    this.smoke = particles.get('fire-bend-smoke', {
      capacity: 1400,
      shape: ParticleShape.SMOKE,
      additive: false,
      curl: true,
      softFade: 1.2
    });
    this.smoke.uniforms.uGravity.value.set(0, 0.75, 0);
    this.smoke.uniforms.uDrag.value = 1.6;
    this.smoke.uniforms.uEndSize.value = 3.4;
    this.smoke.uniforms.uFadeIn.value = 0.18;
    this.smoke.uniforms.uFadeOut.value = 0.35;

    this.emberEmitter = new RateEmitter();
    this.smokeEmitter = new RateEmitter();
    this.sparkEmitter = new RateEmitter();
  }

  get impactDuration() {
    return 0.85;
  }

  get fadeDuration() {
    return 1.0;
  }

  pathHeight(u) {
    const c = this.config;
    return c.flightHeight * (0.45 + 0.55 * smoothstep(0, 0.22, u)) + c.flightArc * Math.sin(Math.PI * u);
  }

  headPoint(s, out) {
    this.pointAt(s, out);
    out.y = this.pathHeight(s);
    return out;
  }

  onSpawn() {
    this.emberEmitter.reset();
    this.smokeEmitter.reset();
    this.sparkEmitter.reset();
    this._trailCount = 0;
    this.fireMaterial.uniforms.uHeadFade.value = 0;
    this.fireMaterial.uniforms.uSeed.value = Math.random() * 20;
    this.ribbon.clear();
    this.fireMesh.visible = true;
    this.distortionMesh.visible = true;
    this.headPoint(0, this.position);
    this.ctx.flash.trigger(getColor(this.config.colorCore), 0.16);
    this.lightBoost = 1.15;
  }

  _pushHead() {
    this.headPoint(this.u, _pos);
    this.position.copy(_pos);
    if (this._trailCount === 0) {
      this.trailPoints[0].copy(_pos);
      this._trailCount = 1;
      this.tangent.copy(this.direction);
      this.velocity.copy(this.direction).multiplyScalar(this.config.speed * settings.global.speed);
      return;
    }
    const last = this.trailPoints[this._trailCount - 1];
    this.tangent.copy(_pos).sub(last);
    if (this.tangent.lengthSq() < 1e-8) this.tangent.copy(this.direction);
    else this.tangent.normalize();
    this.velocity.copy(_pos).sub(last);

    if (_pos.distanceToSquared(last) < 0.0025) {
      last.copy(_pos);
      return;
    }
    if (this._trailCount < MAX_TRAIL) {
      this.trailPoints[this._trailCount].copy(_pos);
      this._trailCount++;
    } else {
      for (let i = 0; i < MAX_TRAIL - 1; i++) this.trailPoints[i].copy(this.trailPoints[i + 1]);
      this.trailPoints[MAX_TRAIL - 1].copy(_pos);
    }
    this._trimTrail(this.config.streamLength);
  }

  _trimTrail(maxLen) {
    while (this._trailCount > 2) {
      let len = 0;
      for (let i = 1; i < this._trailCount; i++) {
        len += this.trailPoints[i].distanceTo(this.trailPoints[i - 1]);
      }
      if (len <= maxLen) break;
      for (let i = 0; i < this._trailCount - 1; i++) this.trailPoints[i].copy(this.trailPoints[i + 1]);
      this._trailCount--;
    }
  }

  _syncUniforms() {
    const c = this.config;
    const g = settings.global;
    this.fireMaterial.sync();

    const distortion = this.distortionMaterial.uniforms;
    distortion.uStrength.value = c.heatDistortion * g.distortion;
    distortion.uFrequency.value = 0.9 + c.noiseFrequency * 0.5;
    distortion.uSpeed.value = c.flameSpeed * 0.8;

    const core = getColor(c.colorCore);
    const mid = getColor(c.colorMid);
    const edge = getColor(c.colorEdge);
    const smoke = getColor(c.colorSmoke);

    this.embers.setGradient(core, mid, edge, smoke);
    this.embers.uniforms.uSizeScale.value = c.emberSize * g.particleSize * 8;
    this.embers.uniforms.uLifeScale.value = g.particleLifetime;
    this.embers.uniforms.uSpeedScale.value = g.particleSpeed;
    this.embers.uniforms.uTurbulence.value = 0.55 * g.turbulence;
    this.embers.uniforms.uGlow.value = c.glow * 0.55;

    this.sparks.setGradient(core, core, mid, edge);
    this.sparks.uniforms.uSizeScale.value = c.emberSize * g.particleSize * 5;
    this.sparks.uniforms.uLifeScale.value = g.particleLifetime;
    this.sparks.uniforms.uSpeedScale.value = g.particleSpeed;
    this.sparks.uniforms.uGlow.value = c.glow * 0.9;

    this.smoke.setGradient(
      _gradA.copy(edge).multiplyScalar(0.14),
      _gradB.copy(smoke).multiplyScalar(5.5),
      _gradC.copy(smoke).multiplyScalar(3.0),
      _gradD.copy(smoke).multiplyScalar(1.2)
    );
    this.smoke.uniforms.uSizeScale.value = c.smokeSize * g.particleSize;
    this.smoke.uniforms.uLifeScale.value = g.particleLifetime;
    this.smoke.uniforms.uOpacity.value = c.smokeDensity * g.opacity;
    this.smoke.uniforms.uGlow.value = 1;
    this.smoke.uniforms.uTurbulence.value = 0.5 * g.turbulence;
  }

  onTravel(dt) {
    this._syncUniforms();
    this._pushHead();
    buildFireHull(
      this.ribbon,
      this.trailPoints,
      this._trailCount,
      this.config,
      this.ctx.camera.position,
      this.fireMaterial,
      this.hullPoints
    );
    this._emitStream(dt);
    this.lightColor.copy(getColor(this.config.lightColor));
  }

  _emitStream(dt) {
    const c = this.config;
    const g = settings.global;
    const time = frame.uTime.value;
    const countScale = g.particleCount;
    const radius = c.flameWidth;
    if (this._trailCount < 1) return;

    _inherit.copy(this.velocity).multiplyScalar(0.22);

    const emberCount = Math.round(this.emberEmitter.tick(dt, c.emberRate * c.emberCount) * countScale);
    if (emberCount > 0) {
      _emit.position = _pos.copy(this.position);
      _emit.radius = radius * c.headSize * 0.6;
      _emit.direction = _dir.set(0, 1, 0);
      _emit.speed = c.emberSpeed;
      _emit.speedVariance = 0.5;
      _emit.spread = 0.9;
      _emit.inherit = _inherit;
      _emit.anchor = null;
      _emit.size = 0.12;
      _emit.sizeVariance = 0.55;
      _emit.life = c.emberLifetime;
      _emit.lifeVariance = 0.4;
      _emit.spin = 0;
      _emit.tint = null;
      _emit.time = time;
      this.embers.emit(Math.ceil(emberCount * 0.6), _emit);

      if (this._trailCount > 4) {
        const index = Math.floor(randRange(0, this._trailCount - 1));
        _emit.position = _pos.copy(this.trailPoints[index]);
        _emit.radius = radius * 0.7;
        _emit.speed = c.emberSpeed * 0.55;
        _emit.inherit = null;
        this.embers.emit(Math.floor(emberCount * 0.4), _emit);
      }
    }

    const sparkCount = Math.round(this.sparkEmitter.tick(dt, c.sparkRate) * countScale);
    if (sparkCount > 0) {
      _emit.position = _pos.copy(this.position);
      _emit.radius = radius * 0.45;
      _emit.direction = _dir.copy(this.tangent).multiplyScalar(0.6).setY(0.35);
      _emit.speed = c.sparkSpeed;
      _emit.speedVariance = 0.6;
      _emit.spread = 0.9;
      _emit.inherit = _inherit;
      _emit.size = 0.16;
      _emit.sizeVariance = 0.5;
      _emit.life = 0.75;
      _emit.lifeVariance = 0.5;
      _emit.tint = null;
      _emit.time = time;
      this.sparks.emit(sparkCount, _emit);
    }

    const smokeCount = Math.round(this.smokeEmitter.tick(dt, 55 * c.smokeDensity) * countScale);
    if (smokeCount > 0) {
      _emit.position = _pos.copy(this.position).addScaledVector(this.tangent, -radius * c.headSize * 1.1);
      _pos.y += radius * 0.5;
      _emit.radius = radius * 0.8;
      _emit.direction = _dir.set(0, 1, 0);
      _emit.speed = c.smokeSpeed;
      _emit.speedVariance = 0.5;
      _emit.spread = 0.65;
      _emit.inherit = _inherit;
      _emit.size = 0.9;
      _emit.sizeVariance = 0.4;
      _emit.life = c.smokeLifetime;
      _emit.lifeVariance = 0.35;
      _emit.spin = 1.2;
      _emit.tint = null;
      _emit.time = time;
      this.smoke.emit(Math.ceil(smokeCount * 0.55), _emit);

      if (this._trailCount > 4) {
        const index = Math.floor(randRange(0, this._trailCount - 1));
        _emit.position = _pos.copy(this.trailPoints[index]);
        _pos.y += radius * 0.8;
        _emit.radius = radius * 1.3;
        _emit.speed = c.smokeSpeed * 0.7;
        _emit.spread = 0.9;
        _emit.inherit = null;
        _emit.size = 1.15;
        this.smoke.emit(Math.floor(smokeCount * 0.45), _emit);
      }
    }
  }

  onImpact() {
    const c = this.config;
    const g = settings.global;
    const time = frame.uTime.value;
    const scale = c.explosionSize * g.explosionIntensity;

    const core = getColor(c.colorCore);
    const mid = getColor(c.colorMid);
    const edge = getColor(c.colorEdge);

    _pos.copy(this.position);
    const groundFactor = saturate(1 - Math.max(0, this.position.y) / (scale * 1.2 + 1.5));

    this.ctx.bursts.spawn(BurstMode.FIRE, _pos, {
      radius: scale * 0.25,
      endRadius: scale,
      life: 0.85,
      intensity: c.explosionBrightness * g.glow,
      displace: 0.5,
      turbulence: c.flameTurbulence * 0.5,
      colorA: core,
      colorB: mid,
      colorC: edge
    });
    this.ctx.bursts.spawn(BurstMode.FIRE, _pos, {
      radius: scale * 0.1,
      endRadius: scale * 0.55,
      life: 0.35,
      intensity: c.explosionBrightness * 2.2 * g.glow,
      displace: 0.2,
      colorA: core,
      colorB: core,
      colorC: mid
    });
    this.ctx.bursts.spawn(BurstMode.AIR, _pos, {
      radius: scale * 0.3,
      endRadius: scale * 2.1,
      life: 0.45,
      intensity: 1.6 * g.glow,
      fresnel: 1.6,
      opacity: 0.7,
      displace: 0.12,
      colorA: core,
      colorB: mid,
      colorC: mid
    });

    if (groundFactor > 0.04) {
      this.ctx.decals.spawn(DecalType.SCORCH, this.position, {
        radius: scale * 0.85,
        life: 7,
        intensity: 0.9 * groundFactor,
        colorA: getColor(c.colorSmoke),
        colorB: mid
      });
      this.spawnShockwave(this.position, {
        radius: scale * 1.6,
        life: 0.65,
        width: 0.09,
        intensity: 1.4 * groundFactor,
        colorA: mid,
        colorB: core
      });
    }

    const countScale = g.particleCount;
    _emit.position = _pos;
    _emit.radius = scale * 0.25;
    _emit.direction = _dir.set(0, 0.35, 0);
    _emit.speed = 7 * scale * 0.4;
    _emit.speedVariance = 0.75;
    _emit.spread = 1.0;
    _emit.inherit = null;
    _emit.anchor = null;
    _emit.size = 0.2;
    _emit.sizeVariance = 0.6;
    _emit.life = 1.5;
    _emit.lifeVariance = 0.5;
    _emit.spin = 0;
    _emit.tint = null;
    _emit.time = time;
    this.embers.emit(Math.round(220 * countScale), _emit);

    _emit.direction = _dir.set(0, 0, 0);
    _emit.speed = 14 * scale * 0.4;
    _emit.size = 0.22;
    _emit.life = 1.2;
    _emit.spread = 1.0;
    this.sparks.emit(Math.round(160 * countScale), _emit);

    _emit.position = _pos;
    _emit.direction = _dir.set(0, 0.5, 0);
    _emit.speed = 3.2;
    _emit.spread = 0.9;
    _emit.size = 1.5;
    _emit.life = c.smokeLifetime * 1.6;
    _emit.spin = 1.0;
    this.smoke.emit(Math.round(70 * countScale), _emit);

    this.ctx.shake.add(0.42 * c.explosionShake * g.explosionIntensity, 1.9, 26);
    this.ctx.flash.trigger(mid, c.explosionFlash * g.explosionIntensity * 0.5);
    this.lightBoost = c.lightIntensity * 2.4 * g.explosionIntensity;
  }

  onFade(dt, t) {
    const c = this.config;
    this._syncUniforms();
    const fade = saturate(t);
    const remaining = c.streamLength * (1 - saturate(t * 0.85));
    if (remaining > 0.05 && this._trailCount >= 2) {
      this._trimTrail(remaining);
      buildFireHull(
        this.ribbon,
        this.trailPoints,
        this._trailCount,
        c,
        this.ctx.camera.position,
        this.fireMaterial,
        this.hullPoints,
        1 - fade * 0.65
      );
    } else {
      this.ribbon.clear();
    }

    const u = this.fireMaterial.uniforms;
    u.uOpacity.value = lerp(c.opacity * settings.global.opacity, 0, fade);
    u.uHeadFade.value = fade * 0.35;
    u.uDetachment.value = lerp(c.detachment, 1.1, fade);
    this.distortionMaterial.uniforms.uStrength.value =
      c.heatDistortion * settings.global.distortion * (1 - fade);
  }

  onDestroy() {
    this.ribbon.clear();
  }

  dispose() {
    this.ribbon.dispose();
    this.fireMaterial.dispose();
    this.distortionMaterial.dispose();
    super.dispose();
  }
}

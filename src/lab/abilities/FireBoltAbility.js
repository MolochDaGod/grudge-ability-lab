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
import { saturate, lerp, smoothstep, randRange } from '../utils/math.js';

const MAX_TRAIL = 48;
const _pos = new Vector3();
const _dir = new Vector3();
const _up = new Vector3(0, 1, 0);
const _inherit = new Vector3();
const _prev = new Vector3();
const _emit = {};
const _gradA = new Color();
const _gradB = new Color();
const _gradC = new Color();
const _gradD = new Color();

/**
 * STAFF FIRE BOLT — a compact live fireball with a clean comet wake.
 *
 * The orb is a raymarched black-body volume. A thin additive core keeps the
 * trail readable; the volume is a short, tight sheath instead of a long plume.
 * Impact is a melee-style power hit: fire burst plus a flattened shock shell.
 */
export class FireBoltAbility extends Ability {
  constructor(context) {
    super('fireBolt', context);
  }

  createShaders() {
    this.ribbon = new RibbonGeometry(64, { frame: true });
    this.coreRibbon = new RibbonGeometry(64);
    this.trailPoints = [];
    this.hullPoints = [];
    for (let i = 0; i < MAX_TRAIL; i++) this.trailPoints.push(new Vector3());
    for (let i = 0; i < MAX_TRAIL + 2; i++) this.hullPoints.push(new Vector3());
    this._trailCount = 0;

    this.fireMaterial = new VolumetricFireMaterial('fireBolt');
    this.fireMesh = new Mesh(this.ribbon.geometry, this.fireMaterial);
    this.fireMesh.layers.set(LAYER.VFX);
    this.fireMesh.renderOrder = 11;

    this.coreMaterial = new SlashCoreMaterial();
    this.coreMaterial.uniforms.uStyle.value = 1;
    this.coreMesh = new Mesh(this.coreRibbon.geometry, this.coreMaterial);
    this.coreMesh.layers.set(LAYER.VFX);
    this.coreMesh.renderOrder = 12;

    this.distortionMaterial = new DistortionMaterial({
      stream: true,
      frequency: 1.7,
      speed: 1.3
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
    this.embers = particles.get('fire-bolt-embers', {
      capacity: 1600,
      shape: ParticleShape.SOFT,
      additive: true,
      softFade: 0.4
    });
    this.embers.uniforms.uGravity.value.set(0, 1.2, 0);
    this.embers.uniforms.uDrag.value = 1.15;
    this.embers.uniforms.uEndSize.value = 0.06;
    this.embers.uniforms.uFadeOut.value = 0.3;

    this.sparks = particles.get('fire-bolt-sparks', {
      capacity: 1100,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true,
      softFade: 0.28
    });
    this.sparks.uniforms.uGravity.value.set(0, -11, 0);
    this.sparks.uniforms.uDrag.value = 0.5;
    this.sparks.uniforms.uStretch.value = 0.18;

    this.smoke = particles.get('fire-bolt-smoke', {
      capacity: 600,
      shape: ParticleShape.SMOKE,
      additive: false,
      curl: true,
      softFade: 1.1
    });
    this.smoke.uniforms.uGravity.value.set(0, 0.65, 0);
    this.smoke.uniforms.uDrag.value = 1.6;
    this.smoke.uniforms.uEndSize.value = 3.2;

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
   * Ballistic height along the shot. Leaves the hand, lobs, then droops into
   * the impact — the motion that sells "thrown fire" rather than a sliding orb.
   */
  boltHeight(s) {
    const c = this.config;
    const takeoff = lerp(c.handHeight, c.flightHeight, smoothstep(0, 0.2, s));
    const arc = Math.sin(Math.PI * s) * c.flightArc;
    const droop = c.gravity * s * s;
    return Math.max(0.18, takeoff + arc - droop);
  }

  boltPoint(s, out) {
    this.pointAt(s, out);
    out.y = this.boltHeight(s);
    return out;
  }

  _pushHead() {
    this.boltPoint(this.u, _pos);
    if (this._trailCount === 0) {
      this.trailPoints[0].copy(_pos);
      this._trailCount = 1;
      return;
    }
    if (_pos.distanceToSquared(this.trailPoints[this._trailCount - 1]) < 0.0025) {
      this.trailPoints[this._trailCount - 1].copy(_pos);
      return;
    }
    if (this._trailCount < MAX_TRAIL) {
      this.trailPoints[this._trailCount].copy(_pos);
      this._trailCount++;
    } else {
      for (let i = 0; i < MAX_TRAIL - 1; i++) this.trailPoints[i].copy(this.trailPoints[i + 1]);
      this.trailPoints[MAX_TRAIL - 1].copy(_pos);
    }

    const maxLen = this.config.streamLength;
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

  _rebuildCore() {
    if (this._trailCount < 2) {
      this.coreRibbon.clear();
      return;
    }
    const width = (this.config.coreWidth ?? 0.16) * 2;
    this.coreRibbon.build(this.trailPoints, {
      count: this._trailCount,
      width,
      mode: RibbonMode.BILLBOARD,
      cameraPosition: this.ctx.camera.position,
      widthProfile: (t) => 0.28 + 0.72 * t
    });
  }

  onSpawn() {
    this.emberEmitter.reset();
    this.sparkEmitter.reset();
    this.smokeEmitter.reset();
    this._trailCount = 0;
    this.fireMaterial.uniforms.uHeadFade.value = 0;
    this.coreMaterial.uniforms.uHeadFade.value = 0;
    this.fireMaterial.uniforms.uSeed.value = Math.random() * 20;
    this.ribbon.clear();
    this.coreRibbon.clear();
    this.fireMesh.visible = true;
    this.coreMesh.visible = true;
    this.distortionMesh.visible = true;
    this.boltPoint(0, this.position);
    this.ctx.flash.trigger(getColor(this.config.colorCore), 0.14);
    this.lightBoost = 1.2;
  }

  _syncUniforms() {
    const c = this.config;
    const g = settings.global;
    this.fireMaterial.sync();
    this.coreMaterial.tint(c.colorCore, c.colorMid, c.colorEdge);
    this.coreMaterial.uniforms.uGlow.value = c.glow * 0.9;
    this.coreMaterial.uniforms.uOpacity.value = c.opacity;

    const d = this.distortionMaterial.uniforms;
    d.uStrength.value = c.heatDistortion * g.distortion;
    d.uFrequency.value = 0.7 + c.noiseFrequency * 0.28;
    d.uSpeed.value = c.flameSpeed * 0.65;

    const core = getColor(c.colorCore);
    const mid = getColor(c.colorMid);
    const edge = getColor(c.colorEdge);
    const smoke = getColor(c.colorSmoke);

    this.embers.setGradient(core, mid, edge, smoke);
    this.embers.uniforms.uSizeScale.value = c.emberSize * g.particleSize * 8;
    this.embers.uniforms.uLifeScale.value = g.particleLifetime;
    this.embers.uniforms.uSpeedScale.value = g.particleSpeed;
    this.embers.uniforms.uGlow.value = c.glow * 0.55;
    this.embers.uniforms.uTurbulence.value = 0.32 * g.turbulence;

    this.sparks.setGradient(core, core, mid, edge);
    this.sparks.uniforms.uSizeScale.value = c.emberSize * g.particleSize * 5;
    this.sparks.uniforms.uGlow.value = c.glow * 0.9;

    this.smoke.setGradient(
      _gradA.copy(edge).multiplyScalar(0.14),
      _gradB.copy(smoke).multiplyScalar(5.5),
      _gradC.copy(smoke).multiplyScalar(3.0),
      _gradD.copy(smoke).multiplyScalar(1.2)
    );
    this.smoke.uniforms.uSizeScale.value = c.smokeSize * g.particleSize;
    this.smoke.uniforms.uOpacity.value = c.smokeDensity * g.opacity;
  }

  _velocity() {
    const speed = this.config.speed * settings.global.speed;
    this.boltPoint(Math.max(0, this.u - 0.02), _prev);
    this.boltPoint(this.u, _pos);
    _inherit.copy(_pos).sub(_prev);
    if (_inherit.lengthSq() < 1e-8) _inherit.copy(this.direction).multiplyScalar(speed * 0.016);
    return _inherit;
  }

  _emitStream(dt) {
    const c = this.config;
    const g = settings.global;
    const time = frame.uTime.value;
    if (this._trailCount < 1) return;
    const head = this.trailPoints[this._trailCount - 1];
    this._velocity();
    _inherit.multiplyScalar(0.22);

    const emberCount = Math.round(this.emberEmitter.tick(dt, c.emberRate) * g.particleCount);
    if (emberCount > 0) {
      _emit.position = _pos.copy(head);
      _emit.radius = c.flameWidth * c.headSize * 0.6;
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
        _emit.speed = c.emberSpeed * 0.55;
        _emit.inherit = null;
        this.embers.emit(Math.floor(emberCount * 0.4), _emit);
      }
    }

    const sparkCount = Math.round(this.sparkEmitter.tick(dt, c.sparkRate) * g.particleCount);
    if (sparkCount > 0) {
      _emit.position = _pos.copy(head);
      _emit.radius = c.flameWidth * 0.45;
      _emit.direction = _dir.copy(this.direction).multiplyScalar(0.6).setY(0.4);
      _emit.speed = c.sparkSpeed;
      _emit.spread = 0.9;
      _emit.inherit = _inherit;
      _emit.size = 0.16;
      _emit.life = 0.75;
      _emit.spin = 0;
      _emit.time = time;
      this.sparks.emit(sparkCount, _emit);
    }

    const smokeCount = Math.round(this.smokeEmitter.tick(dt, 22 * c.smokeDensity) * g.particleCount);
    if (smokeCount > 0) {
      _emit.position = _pos.copy(head).addScaledVector(this.direction, -c.flameWidth * c.headSize);
      _pos.y += 0.25;
      _emit.radius = c.flameWidth * 0.85;
      _emit.direction = _dir.set(0, 1, 0);
      _emit.speed = c.smokeSpeed;
      _emit.spread = 0.7;
      _emit.inherit = _inherit;
      _emit.size = 0.95;
      _emit.life = c.smokeLifetime;
      _emit.spin = 1.2;
      _emit.time = time;
      this.smoke.emit(smokeCount, _emit);
    }
  }

  onTravel(dt) {
    this._syncUniforms();
    this._pushHead();
    this._rebuildCore();
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
    this.boltPoint(this.u, this.position);
    this.lightColor.copy(getColor(this.config.lightColor));
    this.ctx.shake.rumble(this.config.rumble * settings.global.cameraShake, dt);
  }

  onImpact() {
    const c = this.config;
    this.boltPoint(1, _pos);
    const air = _pos.clone();
    const ground = _pos.clone();
    ground.y = 0.18;
    const groundFactor = saturate(1 - Math.max(0, air.y) / (c.burstRadius * 1.2 + 1.4));

    this.ctx.bursts.spawn(BurstMode.FIRE, air, {
      radius: 0.28,
      endRadius: c.burstRadius * 0.7,
      life: 0.55,
      intensity: 1.7,
      displace: 0.32,
      turbulence: c.flameTurbulence * 0.3,
      colorA: getColor(c.colorCore),
      colorB: getColor(c.colorMid),
      colorC: getColor(c.colorEdge)
    });
    this.ctx.bursts.spawn(BurstMode.AIR, air, {
      radius: 0.4,
      endRadius: c.burstRadius * 1.55,
      life: 0.36,
      intensity: 1.45,
      fresnel: 1.85,
      squash: 0.55,
      colorA: getColor(c.colorCore),
      colorB: getColor(c.colorMid),
      colorC: getColor(c.colorCore)
    });
    this.ctx.bursts.spawn(BurstMode.AIR, ground, {
      radius: 0.55,
      endRadius: c.burstRadius * 1.9,
      life: 0.44,
      intensity: 1.1,
      fresnel: 2.0,
      squash: 0.12,
      colorA: getColor(c.colorMid),
      colorB: getColor(c.colorCore),
      colorC: getColor(c.colorCore)
    });
    this.ctx.decals.spawn(DecalType.SCORCH, ground, {
      radius: c.scorchRadius * (0.55 + 0.45 * groundFactor),
      life: c.scorchLife,
      intensity: 1.15,
      colorA: getColor(c.colorScorch)
    });
    this.spawnShockwave(ground, {
      radius: c.burstRadius * 1.35,
      life: 0.5,
      growth: 3.8,
      colorA: getColor(c.colorCore)
    });
    this.spawnShockwave(ground, {
      radius: c.burstRadius * 0.5,
      life: 0.28,
      growth: 5.2,
      colorA: getColor(c.colorMid)
    });
    this.ctx.shake.add(c.shake * settings.global.cameraShake, 2.6, 28);
    this.ctx.flash.trigger(getColor(c.colorCore), c.flash);

    _emit.position = air;
    _emit.direction = _up;
    _emit.speed = 7.2;
    _emit.spread = 1;
    _emit.radius = 0.55;
    _emit.size = 0.2;
    _emit.life = 0.8;
    _emit.time = this.age;
    this.sparks.emit(42, _emit);
    this.embers.emit(36, _emit);
    _emit.speed = 1.7;
    _emit.size = 0.7;
    _emit.life = 1.3;
    this.smoke.emit(22, _emit);
    this.lightBoost = 4.4;
  }

  onFade(dt, t) {
    this._syncUniforms();
    const k = t > 1 ? saturate(t - 1) : saturate(t) * 0.15;
    this.fireMaterial.uniforms.uHeadFade.value = k;
    this.coreMaterial.uniforms.uHeadFade.value = k;
    if (this._trailCount >= 2) {
      this._rebuildCore();
      buildFireHull(
        this.ribbon,
        this.trailPoints,
        this._trailCount,
        this.config,
        this.ctx.camera.position,
        this.fireMaterial,
        this.hullPoints,
        1 - k * 0.75
      );
    }
    if (k < 0.65) this._emitStream(dt);
    this.boltPoint(1, this.position);
  }

  onDestroy() {
    this.ribbon.clear();
    this.coreRibbon.clear();
    this.fireMesh.visible = false;
    this.coreMesh.visible = false;
    this.distortionMesh.visible = false;
    this._trailCount = 0;
  }

  lightShimmer() {
    return 0.78 + 0.4 * Math.abs(Math.sin(this.age * 16));
  }
}

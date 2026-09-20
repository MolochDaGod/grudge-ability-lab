// @ts-nocheck
import { Mesh, Vector3, Color } from 'three';
import { Ability } from './Ability.js';
import { RibbonGeometry, RibbonMode } from '../effects/RibbonGeometry.js';
import { OceanWaterMaterial } from '../materials/OceanWaterMaterial.js';
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
const TAIL_RADIUS = 0.5;
const _emit = {};
const _pos = new Vector3();
const _jet = new Vector3();
const _radial = new Vector3();
const _dir = new Vector3();
const _inherit = new Vector3();
const _gradA = new Color();
const _gradB = new Color();

function radiusProfile(u, headSize) {
  const body = TAIL_RADIUS + 0.5 * Math.pow(u, 0.6);
  return body * (1 + (headSize - 1) * smoothstep(0.62, 1, u));
}

/**
 * WATER BENDING — a surging ocean body along a linear path, breaking into a
 * foaming splash at the end. Ported from Avatar WaterAbility.
 */
export class WaterBendAbility extends Ability {
  constructor(context) {
    super('waterBend', context);
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

    this.waterMaterial = new OceanWaterMaterial('waterBend');
    this.waterMesh = new Mesh(this.ribbon.geometry, this.waterMaterial);
    this.waterMesh.layers.set(LAYER.VFX);
    this.waterMesh.renderOrder = 11;

    this.distortionMaterial = new DistortionMaterial({ stream: true, frequency: 2.6, speed: 1.1 });
    this.distortionMesh = new Mesh(this.ribbon.geometry, this.distortionMaterial);
    this.distortionMesh.layers.set(LAYER.DISTORTION);

    for (const mesh of [this.waterMesh, this.distortionMesh]) {
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }

    this._wakeTimer = 0;
  }

  createParticles() {
    const particles = this.ctx.particles;

    this.droplets = particles.get('water-bend-droplets', {
      capacity: 3600,
      shape: ParticleShape.SOFT,
      additive: true,
      softFade: 0.3
    });
    this.droplets.uniforms.uGravity.value.set(0, -9.5, 0);
    this.droplets.uniforms.uDrag.value = 0.45;
    this.droplets.uniforms.uEndSize.value = 0.3;
    this.droplets.uniforms.uFadeOut.value = 0.5;

    this.spray = particles.get('water-bend-spray', {
      capacity: 2400,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true,
      softFade: 0.3
    });
    this.spray.uniforms.uGravity.value.set(0, -11, 0);
    this.spray.uniforms.uDrag.value = 0.5;
    this.spray.uniforms.uEndSize.value = 0.2;
    this.spray.uniforms.uStretch.value = 0.1;

    this.foam = particles.get('water-bend-foam', {
      capacity: 2200,
      shape: ParticleShape.SMOKE,
      additive: false,
      curl: true,
      softFade: 0.5
    });
    this.foam.uniforms.uGravity.value.set(0, -1.6, 0);
    this.foam.uniforms.uDrag.value = 2.4;
    this.foam.uniforms.uEndSize.value = 1.7;
    this.foam.uniforms.uFadeIn.value = 0.06;
    this.foam.uniforms.uFadeOut.value = 0.4;

    this.mist = particles.get('water-bend-mist', {
      capacity: 1600,
      shape: ParticleShape.SMOKE,
      additive: false,
      curl: true,
      softFade: 1.0
    });
    this.mist.uniforms.uGravity.value.set(0, 0.35, 0);
    this.mist.uniforms.uDrag.value = 1.8;
    this.mist.uniforms.uEndSize.value = 2.6;
    this.mist.uniforms.uFadeIn.value = 0.2;

    this.dropletEmitter = new RateEmitter();
    this.sprayEmitter = new RateEmitter();
    this.foamEmitter = new RateEmitter();
    this.mistEmitter = new RateEmitter();
  }

  get impactDuration() {
    return 0.9;
  }

  get fadeDuration() {
    return 1.1;
  }

  pathHeight(u) {
    const c = this.config;
    const phase = u * c.surgeLength * Math.PI * 2 - frame.uTime.value * c.surgeSpeed;
    return c.height * (0.4 + 0.6 * smoothstep(0, 0.25, u)) + c.surge * Math.sin(phase);
  }

  headPoint(s, out) {
    this.pointAt(s, out);
    out.y = this.pathHeight(s);
    return out;
  }

  onSpawn() {
    this.dropletEmitter.reset();
    this.sprayEmitter.reset();
    this.foamEmitter.reset();
    this.mistEmitter.reset();
    this.waterMaterial.uniforms.uSeed.value = Math.random() * 20;
    this.ribbon.clear();
    this._wakeTimer = 0;
    this._trailCount = 0;
    this.headPoint(0, this.position);
    this.ctx.flash.trigger(getColor(this.config.colorFoam), 0.1);
    this.lightBoost = 0.85;
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
    this.waterMaterial.sync();

    const d = this.distortionMaterial.uniforms;
    d.uStrength.value = c.refraction * g.distortion;
    d.uFrequency.value = 1.2 + c.noiseFrequency * 0.4;
    d.uSpeed.value = c.flowSpeed;

    const deep = getColor(c.colorDeep);
    const shallow = getColor(c.colorShallow);
    const foam = getColor(c.colorFoam);

    this.droplets.setGradient(foam, shallow, deep, _gradA.copy(deep).multiplyScalar(0.4));
    this.droplets.uniforms.uSizeScale.value = c.dropletSize * g.particleSize * 9;
    this.droplets.uniforms.uLifeScale.value = g.particleLifetime;
    this.droplets.uniforms.uSpeedScale.value = g.particleSpeed;
    this.droplets.uniforms.uGlow.value = c.glow * 0.8;
    this.droplets.uniforms.uTurbulence.value = 0.25 * g.turbulence;

    this.spray.setGradient(foam, foam, shallow, _gradA.copy(shallow).multiplyScalar(0.3));
    this.spray.uniforms.uSizeScale.value = c.dropletSize * g.particleSize * 6;
    this.spray.uniforms.uLifeScale.value = g.particleLifetime;
    this.spray.uniforms.uSpeedScale.value = g.particleSpeed;
    this.spray.uniforms.uGlow.value = c.glow * 1.1;

    this.foam.setGradient(foam, foam, _gradB.copy(shallow).lerp(foam, 0.45), shallow);
    this.foam.uniforms.uSizeScale.value = c.foamSize * g.particleSize;
    this.foam.uniforms.uLifeScale.value = g.particleLifetime;
    this.foam.uniforms.uOpacity.value = 0.5 * g.opacity;
    this.foam.uniforms.uGlow.value = 1;
    this.foam.uniforms.uTurbulence.value = 0.45 * g.turbulence;

    this.mist.setGradient(foam, shallow, _gradA.copy(shallow).multiplyScalar(0.5), deep);
    this.mist.uniforms.uSizeScale.value = c.mistSize * g.particleSize;
    this.mist.uniforms.uLifeScale.value = g.particleLifetime;
    this.mist.uniforms.uOpacity.value = c.mistDensity * 0.5 * g.opacity;
    this.mist.uniforms.uGlow.value = 0.9;
  }

  onTravel(dt) {
    this._syncUniforms();
    this._pushHead();
    this._buildHull();
    this._emitStream(dt);
    this._shedWake(dt);
    this.lightColor.copy(getColor(this.config.lightColor));
  }

  _buildHull(widthScale = 1) {
    const c = this.config;
    const count = this._trailCount;
    const points = this.trailPoints;
    if (count < 2) {
      this.ribbon.clear();
      return;
    }

    let length = 0;
    for (let i = 1; i < count; i++) length += points[i].distanceTo(points[i - 1]);
    if (length < 1e-3) {
      this.ribbon.clear();
      return;
    }

    const radius = c.radius * widthScale;
    const headSize = c.headSize;
    const headRadius = radius * headSize;
    const tailPad = radius * TAIL_RADIUS * 1.25;
    const headPad = headRadius * 1.25;

    const hull = this.hullPoints;
    _dir.copy(points[0]).sub(points[1]);
    if (_dir.lengthSq() < 1e-8) _dir.copy(this.tangent).negate();
    hull[0].copy(points[0]).addScaledVector(_dir.normalize(), tailPad);

    for (let i = 0; i < count; i++) {
      const age = 1 - i / (count - 1);
      hull[i + 1].copy(points[i]);
      hull[i + 1].y -= c.wakeSag * Math.pow(age, 1.5);
    }
    hull[0].y -= c.wakeSag;

    _dir.copy(points[count - 1]).sub(points[count - 2]);
    if (_dir.lengthSq() < 1e-8) _dir.copy(this.tangent);
    hull[count + 1].copy(points[count - 1]).addScaledVector(_dir.normalize(), headPad);

    const arcLength = tailPad + length + headPad;
    const u = this.waterMaterial.uniforms;
    u.uRadius.value = radius;
    u.uStreamLength.value = length;
    u.uArcLength.value = arcLength;
    u.uTailPad.value = tailPad;

    const cover = 1.2 * Math.max(1, c.crest) * (1 + c.waveAmplitude);
    this.ribbon.build(hull, {
      count: count + 2,
      width: 2 * headRadius * cover,
      mode: RibbonMode.BILLBOARD,
      cameraPosition: this.ctx.camera.position,
      widthProfile: (t) => radiusProfile(saturate((t * arcLength - tailPad) / length), headSize) / headSize
    });
  }

  _emitStream(dt) {
    const c = this.config;
    const g = settings.global;
    const time = frame.uTime.value;
    const countScale = g.particleCount;
    const radius = c.radius * c.headSize;
    if (this._trailCount < 1) return;

    _inherit.copy(this.velocity).multiplyScalar(0.3);

    const dropletCount = Math.round(this.dropletEmitter.tick(dt, c.dropletRate) * countScale);
    if (dropletCount > 0) {
      _emit.position = _pos.copy(this.position);
      _emit.radius = radius * 0.7;
      _emit.direction = _dir.copy(this.tangent).multiplyScalar(0.3).setY(0.95);
      _emit.speed = c.dropletSpeed;
      _emit.speedVariance = 0.6;
      _emit.spread = 0.8;
      _emit.inherit = _inherit;
      _emit.anchor = null;
      _emit.size = 0.14;
      _emit.sizeVariance = 0.6;
      _emit.life = c.dropletLifetime;
      _emit.lifeVariance = 0.4;
      _emit.spin = 0;
      _emit.tint = null;
      _emit.time = time;
      this.droplets.emit(Math.ceil(dropletCount * 0.65), _emit);

      if (this._trailCount > 4) {
        const index = Math.floor(randRange(0, this._trailCount - 1));
        _emit.position = _pos.copy(this.trailPoints[index]);
        _emit.radius = c.radius * 0.8;
        _emit.speed = c.dropletSpeed * 0.5;
        _emit.inherit = null;
        this.droplets.emit(Math.floor(dropletCount * 0.35), _emit);
      }
    }

    const sprayCount = Math.round(this.sprayEmitter.tick(dt, c.sprayRate) * countScale);
    if (sprayCount > 0) {
      _emit.position = _pos.copy(this.position).addScaledVector(this.tangent, radius * 0.4);
      _emit.radius = radius * 0.4;
      _emit.direction = _dir.copy(this.tangent).multiplyScalar(0.7).setY(0.5);
      _emit.speed = c.spraySpeed;
      _emit.speedVariance = 0.55;
      _emit.spread = 0.7;
      _emit.inherit = _inherit;
      _emit.size = 0.13;
      _emit.sizeVariance = 0.5;
      _emit.life = 0.7;
      _emit.lifeVariance = 0.5;
      _emit.time = time;
      this.spray.emit(sprayCount, _emit);
    }

    const foamCount = Math.round(this.foamEmitter.tick(dt, c.foamRate) * countScale);
    if (foamCount > 0) {
      _emit.position = _pos.copy(this.position).addScaledVector(this.tangent, -radius * 0.3);
      _pos.y += c.radius * 0.5;
      _emit.radius = radius * 0.55;
      _emit.direction = _dir.set(0, 0.7, 0);
      _emit.speed = 1.1;
      _emit.speedVariance = 0.7;
      _emit.spread = 0.9;
      _emit.inherit = _inherit;
      _emit.size = 0.3;
      _emit.sizeVariance = 0.7;
      _emit.life = c.foamLifetime;
      _emit.lifeVariance = 0.4;
      _emit.spin = 1.1;
      _emit.time = time;
      this.foam.emit(foamCount, _emit);
    }

    const mistCount = Math.round(this.mistEmitter.tick(dt, 22 * c.mistDensity) * countScale);
    if (mistCount > 0) {
      _emit.position = _pos.copy(this.position);
      _emit.radius = radius * 0.9;
      _emit.direction = _dir.set(0, 0.6, 0);
      _emit.speed = 0.7;
      _emit.speedVariance = 0.6;
      _emit.spread = 0.9;
      _emit.inherit = _inherit;
      _emit.size = 0.8;
      _emit.sizeVariance = 0.45;
      _emit.life = c.mistLifetime;
      _emit.lifeVariance = 0.4;
      _emit.spin = 0.8;
      _emit.time = time;
      this.mist.emit(mistCount, _emit);
    }
  }

  _shedWake(dt) {
    const c = this.config;
    if (c.wakeRate <= 0) return;
    this._wakeTimer += dt * c.wakeRate;
    if (this._wakeTimer < 1) return;
    this._wakeTimer = 0;
    this.ctx.decals.spawn(DecalType.RIPPLE, this.position, {
      radius: c.radius * randRange(1.4, 2.2),
      life: 0.9,
      width: 0.22,
      intensity: 0.18,
      colorA: getColor(c.colorShallow),
      colorB: getColor(c.colorFoam)
    });
  }

  onImpact() {
    const c = this.config;
    const g = settings.global;
    const time = frame.uTime.value;
    const scale = c.splashSize * g.explosionIntensity;
    const countScale = g.particleCount;

    const deep = getColor(c.colorDeep);
    const shallow = getColor(c.colorShallow);
    const foam = getColor(c.colorFoam);

    _pos.copy(this.position);

    this.ctx.bursts.spawn(BurstMode.WATER, _pos, {
      radius: scale * 0.18,
      endRadius: scale,
      life: 0.85,
      intensity: c.splashIntensity * g.glow,
      fresnel: c.fresnel * g.fresnel,
      displace: 0.42,
      squash: 0.65,
      colorA: deep,
      colorB: shallow,
      colorC: foam
    });
    this.ctx.bursts.spawn(BurstMode.WATER, _pos, {
      radius: scale * 0.1,
      endRadius: scale * 0.5,
      life: 0.4,
      intensity: c.splashIntensity * 1.8 * g.glow,
      fresnel: 1.2,
      displace: 0.25,
      squash: 1.1,
      colorA: shallow,
      colorB: foam,
      colorC: foam
    });

    this.ctx.decals.spawn(DecalType.FOAM, this.position, {
      radius: c.foamSpread * 0.5 * g.explosionIntensity,
      life: c.foamLingering,
      intensity: 1.0,
      height: 0.015,
      colorA: _gradA.copy(deep).multiplyScalar(0.5),
      colorB: foam
    });
    this.ctx.decals.spawn(DecalType.RIPPLE, this.position, {
      radius: c.rippleSize * 0.5 * g.explosionIntensity,
      life: 2.4 / Math.max(0.1, c.rippleSpeed),
      width: 0.1,
      intensity: 1.1,
      colorA: shallow,
      colorB: foam
    });
    this.ctx.decals.spawn(DecalType.RIPPLE, this.position, {
      radius: c.rippleSize * 0.32 * g.explosionIntensity,
      life: 1.5 / Math.max(0.1, c.rippleSpeed),
      width: 0.18,
      intensity: 0.7,
      colorA: deep,
      colorB: shallow
    });
    this.spawnShockwave(this.position, {
      radius: scale * 1.3,
      life: 0.5,
      width: 0.07,
      intensity: 0.9,
      colorA: shallow,
      colorB: foam
    });

    _emit.position = _pos;
    _emit.radius = scale * 0.16;
    _emit.direction = _dir.set(0, 1, 0);
    _emit.speed = 7.5 * c.splashIntensity;
    _emit.speedVariance = 0.6;
    _emit.spread = 0.35;
    _emit.inherit = null;
    _emit.anchor = null;
    _emit.size = 0.17;
    _emit.sizeVariance = 0.7;
    _emit.life = 1.5;
    _emit.lifeVariance = 0.5;
    _emit.spin = 0;
    _emit.tint = null;
    _emit.time = time;
    this.droplets.emit(Math.round(180 * countScale), _emit);

    const jets = Math.max(1, Math.round(c.crownJets));
    const perJet = Math.max(1, Math.round(9 * countScale));
    for (let i = 0; i < jets; i++) {
      const angle = (i / jets) * Math.PI * 2 + randRange(-0.12, 0.12);
      _radial.set(Math.cos(angle), 0, Math.sin(angle));
      _emit.position = _jet
        .copy(this.position)
        .addScaledVector(_radial, scale * 0.3)
        .setY(this.position.y * 0.35 + 0.12);
      _emit.radius = scale * 0.07;
      _emit.direction = _dir.copy(_radial).multiplyScalar(0.55).setY(1);
      _emit.speed = 6.5 * c.splashIntensity * randRange(0.75, 1.25);
      _emit.speedVariance = 0.35;
      _emit.spread = 0.22;
      _emit.size = 0.15;
      _emit.life = 1.2;
      this.droplets.emit(perJet, _emit);
      _emit.speed *= 1.5;
      _emit.size = 0.12;
      _emit.life = 0.8;
      this.spray.emit(Math.max(1, Math.round(perJet * 0.6)), _emit);
    }

    _emit.position = _pos;
    _emit.radius = scale * 0.35;
    _emit.direction = _dir.set(0, 0.25, 0);
    _emit.speed = 4.2;
    _emit.speedVariance = 0.7;
    _emit.spread = 1.0;
    _emit.size = 1.15;
    _emit.sizeVariance = 0.5;
    _emit.life = c.foamLifetime * 1.6;
    _emit.lifeVariance = 0.4;
    _emit.spin = 0.9;
    this.foam.emit(Math.round(120 * countScale), _emit);

    _emit.speed = 2.4;
    _emit.spread = 1.0;
    _emit.size = 1.2;
    _emit.life = c.mistLifetime * 1.5;
    _emit.spin = 0.6;
    this.mist.emit(Math.round(80 * countScale), _emit);

    this.ctx.shake.add(0.28 * c.explosionShake * g.explosionIntensity, 2.4, 20);
    this.ctx.flash.trigger(shallow, c.explosionFlash * g.explosionIntensity * 0.35);
    this.lightBoost = c.lightIntensity * 1.4 * g.explosionIntensity;
  }

  onFade(dt, t) {
    const c = this.config;
    this._syncUniforms();
    const fade = saturate(t);
    const remaining = c.streamLength * (1 - saturate(t * 0.9));
    if (remaining > 0.05 && this._trailCount >= 2) {
      this._trimTrail(remaining);
      this._buildHull(1 - fade * 0.6);
    } else {
      this.ribbon.clear();
    }
    const u = this.waterMaterial.uniforms;
    u.uOpacity.value = lerp(c.opacity * settings.global.opacity, 0, fade);
    u.uFoam.value = lerp(c.foam, c.foam * 2.2, fade);
    u.uChop.value = lerp(c.chop, c.chop * 1.8, fade);
    this.distortionMaterial.uniforms.uStrength.value =
      c.refraction * settings.global.distortion * (1 - fade);
  }

  onDestroy() {
    this.ribbon.clear();
  }

  dispose() {
    this.ribbon.dispose();
    this.waterMaterial.dispose();
    this.distortionMaterial.dispose();
    super.dispose();
  }
}

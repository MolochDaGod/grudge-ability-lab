// @ts-nocheck
import { Mesh, Group, Vector3, Color, CylinderGeometry, BufferAttribute, MathUtils } from 'three';
import { Ability } from './Ability.js';
import { RibbonGeometry, RibbonMode } from '../effects/RibbonGeometry.js';
import { WindRibbonMaterial, TornadoMaterial } from '../materials/WindMaterial.js';
import { DistortionMaterial } from '../materials/DistortionMaterial.js';
import { ParticleShape } from '../particles/ParticleSystem.js';
import { RateEmitter } from '../particles/ParticleEngine.js';
import { BurstMode } from '../effects/BurstSphere.js';
import { DecalType } from '../effects/GroundDecals.js';
import { LAYER } from '../core/Layers.js';
import { frame } from '../core/FrameUniforms.js';
import { settings } from '../config/settings.js';
import { getColor } from '../utils/color.js';
import { saturate, Easing, randRange, smoothstep } from '../utils/math.js';

const MAX_RIBBONS = 8;
const WINDOW_POINTS = 64;
const MAX_TORNADO_SHELLS = 4;
const MAX_TRAIL = 64;

const WIDTH_PROFILE = (t) =>
  0.05 + 0.95 * Math.pow(smoothstep(0, 0.3, t), 0.7) * (1 - 0.8 * smoothstep(0.55, 1, t));

const _emit = {};
const _pos = new Vector3();
const _dir = new Vector3();
const _side = new Vector3();
const _up = new Vector3(0, 1, 0);
const _normal = new Vector3();
const _tangent = new Vector3();
const _leafTint = new Color();

const LEAF_GRADIENT = [
  new Color(0.72, 0.34, 0.09),
  new Color(0.6, 0.25, 0.07),
  new Color(0.44, 0.19, 0.06),
  new Color(0.26, 0.11, 0.04)
];
const LEAF_TINTS = [
  new Color(1.35, 1.05, 0.55),
  new Color(1.15, 0.78, 0.4),
  new Color(1.0, 0.55, 0.3),
  new Color(0.85, 0.42, 0.3),
  new Color(0.95, 0.9, 0.6)
];

function randomLeafTint() {
  const base = LEAF_TINTS[(Math.random() * LEAF_TINTS.length) | 0];
  return _leafTint.copy(base).multiplyScalar(randRange(0.75, 1.25));
}

/**
 * AIR BENDING — zone AoE. A wavy air-bending trail runs from the caster to the
 * selected circle, then the Avatar tornado plants in that footprint.
 */
export class AirBendAbility extends Ability {
  constructor(context) {
    super('airBend', context);
    this.tangent = new Vector3(0, 0, 1);
    this.velocity = new Vector3();
    this._impactSite = new Vector3();
    this._seed = 0;
  }

  createShaders() {
    this.material = new WindRibbonMaterial('airBend');
    this.trailPoints = [];
    for (let i = 0; i < MAX_TRAIL; i++) this.trailPoints.push(new Vector3());
    this._trailCount = 0;

    this.ribbons = [];
    for (let i = 0; i < MAX_RIBBONS; i++) {
      const ribbon = new RibbonGeometry(WINDOW_POINTS - 1);
      const mesh = new Mesh(ribbon.geometry, this.material);
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      mesh.layers.set(LAYER.VFX);
      mesh.renderOrder = 11;
      mesh.visible = false;
      this.group.add(mesh);

      const points = [];
      for (let p = 0; p < WINDOW_POINTS; p++) points.push(new Vector3());

      const seed = (i * 0.6180339887) % 1;
      const seeds = new Float32Array(WINDOW_POINTS * 2).fill(seed);
      ribbon.geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));

      this.ribbons.push({
        ribbon,
        mesh,
        points,
        seed,
        phase: 0,
        radiusScale: 0.5 + 0.55 * ((i * 0.37) % 1),
        twistScale: 0.8 + 0.45 * ((i * 0.71) % 1)
      });
    }

    this.distortionMaterial = new DistortionMaterial({ frequency: 3.0, speed: 2.2, stream: true });
    this.distortionMesh = new Mesh(this.ribbons[0].ribbon.geometry, this.distortionMaterial);
    this.distortionMesh.layers.set(LAYER.DISTORTION);
    this.distortionMesh.frustumCulled = false;
    this.distortionMesh.matrixAutoUpdate = false;
    this.group.add(this.distortionMesh);

    this.tornadoGeometry = new CylinderGeometry(1, 1, 1, 72, 56, true);
    this.tornadoGeometry.translate(0, 0.5, 0);

    this.tornado = new Group();
    this.tornado.layers.set(LAYER.VFX);
    this.tornado.visible = false;
    this.group.add(this.tornado);

    this.tornadoShells = [];
    for (let i = 0; i < MAX_TORNADO_SHELLS; i++) {
      const material = new TornadoMaterial(i, 'airBend');
      const mesh = new Mesh(this.tornadoGeometry, material);
      mesh.layers.set(LAYER.VFX);
      mesh.renderOrder = 13;
      mesh.frustumCulled = false;
      this.tornado.add(mesh);
      this.tornadoShells.push({ mesh, material });
    }

    this._tornadoAge = -1;
  }

  createParticles() {
    const particles = this.ctx.particles;

    this.leaves = particles.get('air-bend-leaves', {
      capacity: 1200,
      shape: ParticleShape.LEAF,
      additive: false,
      swirl: true,
      lit: true,
      softFade: 0.3
    });
    this.leaves.uniforms.uGravity.value.set(0, -1.6, 0);
    this.leaves.uniforms.uDrag.value = 0.6;
    this.leaves.uniforms.uEndSize.value = 1.0;
    this.leaves.uniforms.uFadeOut.value = 0.7;
    this.leaves.uniforms.uSwirlExpand.value = 0.9;

    this.dust = particles.get('air-bend-dust', {
      capacity: 2600,
      shape: ParticleShape.SOFT,
      additive: true,
      swirl: true,
      softFade: 0.5
    });
    this.dust.uniforms.uGravity.value.set(0, -0.4, 0);
    this.dust.uniforms.uDrag.value = 0.9;
    this.dust.uniforms.uEndSize.value = 0.5;
    this.dust.uniforms.uSwirlExpand.value = 1.4;

    this.leafEmitter = new RateEmitter();
    this.dustEmitter = new RateEmitter();
  }

  get impactDuration() {
    return Math.max(0.7, this.config.tornadoDuration);
  }

  get fadeDuration() {
    return 1.4;
  }

  speedProfile(u) {
    return 1.0 + 0.25 * Math.sin(u * 14.0);
  }

  /**
   * Wavy air path from the caster to the selected zone. Amplitude dies at both
   * ends so the trail leaves the hand cleanly and arrives on the circle.
   */
  bendPoint(s, out) {
    this.pointAt(s, out);
    const c = this.config;
    const envelope = Math.sin(Math.PI * s);
    const wave = Math.sin(s * c.waveFreq * Math.PI * 2 + this._seed) * c.waveAmp * envelope;
    const heave = Math.cos(s * c.waveFreq * 1.37 + this._seed * 1.7) * c.waveAmp * 0.45 * envelope;
    const height =
      c.flightHeight * (0.4 + 0.6 * smoothstep(0, 0.2, s)) + c.flightArc * Math.sin(Math.PI * s);
    out.addScaledVector(this.side, wave);
    out.y = Math.max(0.35, height + heave);
    return out;
  }

  advance(dt) {
    const speed = this.config.speed * settings.global.speed * this.speedProfile(this.u);
    const easeIn = Easing.outQuad(saturate(this.age / 0.08));
    this.front += speed * easeIn * dt;
    const previousU = this.u;
    this.u = saturate(this.front / this.length);
    this.bendPoint(this.u, this.position);
    return this.u >= 1 && previousU < 1;
  }

  onSpawn() {
    this.leafEmitter.reset();
    this.dustEmitter.reset();
    this._tornadoAge = -1;
    this._trailCount = 0;
    this._seed = Math.random() * Math.PI * 2;
    this.tornado.visible = false;
    this.bendPoint(0, this.position);
    this.pointAt(1, this._impactSite);
    this._impactSite.y = 0;
    for (const entry of this.ribbons) {
      entry.mesh.visible = false;
      entry.ribbon.clear();
    }
  }

  _pushHead() {
    this.bendPoint(this.u, _pos);
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
    this._trimTrail(this.config.ribbonLength);
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
    this.material.sync();

    const shells = MathUtils.clamp(Math.round(c.tornadoShells), 1, MAX_TORNADO_SHELLS);
    for (let i = 0; i < MAX_TORNADO_SHELLS; i++) {
      const shell = this.tornadoShells[i];
      shell.mesh.visible = i < shells;
      if (i < shells) shell.material.sync(shells);
    }

    const d = this.distortionMaterial.uniforms;
    d.uStrength.value = c.distortion * g.distortion * 0.7;
    d.uFrequency.value = 1.6 + c.noiseFrequency * 0.6;
    d.uSpeed.value = c.swirlSpeed * 1.2;

    const inner = getColor(c.colorInner);
    const outer = getColor(c.colorOuter);

    this.dust.setGradient(inner, outer, outer, inner);
    this.dust.uniforms.uSizeScale.value = c.dustSize * g.particleSize * 3.5;
    this.dust.uniforms.uLifeScale.value = g.particleLifetime;
    this.dust.uniforms.uSpeedScale.value = g.particleSpeed;
    this.dust.uniforms.uOpacity.value = c.dustAmount * 0.35 * g.opacity;
    this.dust.uniforms.uGlow.value = c.glow * 0.8;
    this.dust.uniforms.uSwirl.value = c.rotationSpeed * c.vortexStrength;

    this.leaves.setGradient(...LEAF_GRADIENT);
    this.leaves.uniforms.uSizeScale.value = c.leafSize * g.particleSize * 7;
    this.leaves.uniforms.uLifeScale.value = g.particleLifetime;
    this.leaves.uniforms.uSpeedScale.value = g.particleSpeed;
    this.leaves.uniforms.uOpacity.value = g.opacity;
    this.leaves.uniforms.uSwirl.value = c.rotationSpeed * c.vortexStrength;
  }

  _buildRibbonPoints(entry, count) {
    const c = this.config;
    const time = frame.uTime.value;
    const turb = c.turbulence * c.spiralRadius * 0.9;

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const point = this.trailPoints[i];
      const next = this.trailPoints[Math.min(count - 1, i + 1)];
      const prev = this.trailPoints[Math.max(0, i - 1)];
      _tangent.copy(next).sub(prev);
      if (_tangent.lengthSq() < 1e-8) _tangent.set(0, 0, 1);
      _tangent.normalize();
      _side.crossVectors(_tangent, _up).normalize();
      if (_side.lengthSq() < 1e-8) _side.copy(this.side);
      _normal.crossVectors(_tangent, _side).normalize();

      const phase =
        entry.phase + t * c.vortexStrength * 1.5 * entry.twistScale + time * c.rotationSpeed * 0.22;
      const flare = 0.7 + 0.5 * Math.sin(t * 2.4 - time * 1.1 + entry.phase);
      const radius = c.spiralRadius * entry.radiusScale * flare * (0.3 + 0.7 * Math.pow(t, 0.6));
      const seed = entry.seed * 31.0;
      const wobbleS =
        Math.sin(t * 2.7 + time * 0.8 + seed) * 0.7 + Math.sin(t * 5.9 - time * 1.3 + seed * 2.3) * 0.28;
      const wobbleN =
        Math.cos(t * 2.2 - time * 0.9 + seed * 1.7) * 0.7 + Math.cos(t * 5.1 + time * 1.1 + seed) * 0.28;

      entry.points[i]
        .copy(point)
        .setY(point.y + 0.35 + Math.sin(phase * 0.5) * 0.12 + wobbleN * turb * 0.35)
        .addScaledVector(_side, Math.cos(phase) * radius + wobbleS * turb)
        .addScaledVector(_normal, Math.sin(phase) * radius + wobbleN * turb);
    }
  }

  _activeRibbons() {
    const count = MathUtils.clamp(Math.round(this.config.ribbonCount), 1, MAX_RIBBONS);
    for (let i = 0; i < MAX_RIBBONS; i++) {
      this.ribbons[i].phase = (i / count) * Math.PI * 2;
    }
    return count;
  }

  _buildSheet(entry, count, widthScale) {
    const c = this.config;
    this._buildRibbonPoints(entry, count);
    entry.ribbon.build(entry.points, {
      count,
      width: c.ribbonWidth * entry.twistScale * widthScale,
      mode: RibbonMode.BILLBOARD,
      cameraPosition: this.ctx.camera.position,
      widthProfile: WIDTH_PROFILE,
      twist: c.sheetTwist * entry.twistScale,
      twistPhase: entry.phase
    });
  }

  onTravel(dt) {
    this._syncUniforms();
    this._pushHead();

    const count = Math.min(this._trailCount, WINDOW_POINTS);
    const ribbonCount = this._activeRibbons();
    for (let i = 0; i < MAX_RIBBONS; i++) {
      const entry = this.ribbons[i];
      const active = i < ribbonCount && count >= 2;
      entry.mesh.visible = active;
      if (!active) continue;
      this._buildSheet(entry, count, 1);
    }
    this.distortionMesh.visible = count >= 2;
    this._emitDebris(dt);
  }

  _emitDebris(dt) {
    const c = this.config;
    const g = settings.global;
    const time = frame.uTime.value;
    const head = _pos.copy(this.position);
    _dir.copy(this.tangent);

    const leafCount = Math.round(this.leafEmitter.tick(dt, c.leafCount) * g.particleCount);
    if (leafCount > 0) {
      _emit.position = head;
      _emit.radius = c.spiralRadius * 1.3;
      _emit.direction = _dir;
      _emit.speed = this.velocity.length() * 0.55;
      _emit.speedVariance = 0.3;
      _emit.spread = 0.25;
      _emit.inherit = null;
      _emit.anchor = head;
      _emit.size = 0.16;
      _emit.sizeVariance = 0.5;
      _emit.life = c.leafLifetime;
      _emit.lifeVariance = 0.4;
      _emit.spin = c.leafSpin;
      _emit.tint = randomLeafTint();
      _emit.time = time;
      this.leaves.emit(leafCount, _emit);
    }

    const dustCount = Math.round(this.dustEmitter.tick(dt, c.dustRate * c.dustAmount) * g.particleCount);
    if (dustCount > 0) {
      _emit.position = head;
      _emit.radius = c.spiralRadius * 1.1;
      _emit.direction = _dir;
      _emit.speed = this.velocity.length() * 0.4;
      _emit.speedVariance = 0.4;
      _emit.spread = 0.35;
      _emit.anchor = head;
      _emit.size = 0.12;
      _emit.sizeVariance = 0.6;
      _emit.life = 0.9;
      _emit.lifeVariance = 0.5;
      _emit.spin = 0;
      _emit.tint = null;
      _emit.time = time;
      this.dust.emit(dustCount, _emit);
    }
  }

  onImpact() {
    const c = this.config;
    const g = settings.global;
    const time = frame.uTime.value;
    const inner = getColor(c.colorInner);
    const outer = getColor(c.colorOuter);

    this.pointAt(1, this._impactSite);
    this._impactSite.y = 0;
    this.position.copy(this._impactSite);

    this._tornadoAge = 0;
    this.tornado.visible = true;
    this.tornado.position.copy(this._impactSite);
    this.tornado.rotation.y = Math.random() * Math.PI * 2;
    this.tornado.scale.set(c.tornadoRadius * 0.55, c.tornadoHeight, c.tornadoRadius * 0.55);
    for (const shell of this.tornadoShells) shell.material.uniforms.uAge.value = 0;

    _pos.copy(this._impactSite).setY(1.0);
    this.ctx.bursts.spawn(BurstMode.AIR, _pos, {
      radius: 0.4,
      endRadius: c.tornadoRadius * 2.4 * c.burstIntensity * g.explosionIntensity,
      life: 0.7,
      intensity: c.burstIntensity * g.glow,
      fresnel: c.fresnel * g.fresnel,
      displace: 0.25,
      colorA: outer,
      colorB: inner,
      colorC: inner
    });

    this.spawnShockwave(this._impactSite, {
      radius: c.tornadoRadius * 2.6 * g.explosionIntensity,
      life: 0.7,
      width: 0.06,
      intensity: 1.0,
      colorA: outer,
      colorB: inner
    });
    this.ctx.decals.spawn(DecalType.DUSTRING, this._impactSite, {
      radius: c.tornadoRadius * 2.0,
      life: 1.4,
      intensity: Math.min(1, c.dustAmount) * 0.3,
      colorA: inner,
      colorB: outer
    });

    _emit.position = _pos;
    _emit.radius = c.tornadoRadius * 0.8;
    _emit.direction = _dir.set(0, 1, 0);
    _emit.speed = 7.5 * c.burstIntensity;
    _emit.speedVariance = 0.6;
    _emit.spread = 0.9;
    _emit.inherit = null;
    _emit.anchor = _pos;
    _emit.size = 0.18;
    _emit.sizeVariance = 0.6;
    _emit.life = c.leafLifetime * 1.4;
    _emit.lifeVariance = 0.5;
    _emit.spin = c.leafSpin * 1.5;
    _emit.tint = randomLeafTint();
    _emit.time = time;
    this.leaves.emit(Math.round(140 * g.particleCount), _emit);

    _emit.size = 0.14;
    _emit.speed = 9.0;
    _emit.life = 1.2;
    _emit.spin = 0;
    _emit.tint = null;
    this.dust.emit(Math.round(220 * g.particleCount), _emit);

    this.ctx.shake.add(0.3 * c.explosionShake * g.explosionIntensity, 2.0, 24);
    this.ctx.flash.trigger(inner, c.explosionFlash * g.explosionIntensity * 0.3);
    this.lightBoost = c.lightIntensity * 1.6 * g.explosionIntensity;
  }

  onFade(dt, t) {
    const c = this.config;
    this._syncUniforms();
    const fade = saturate(t);

    const remaining = c.ribbonLength * (1 - saturate(t * 0.8));
    const count = Math.min(this._trailCount, WINDOW_POINTS);
    if (remaining > 0.1 && this._trailCount >= 2) {
      this._trimTrail(remaining);
      const ribbonCount = this._activeRibbons();
      for (let i = 0; i < MAX_RIBBONS; i++) {
        const entry = this.ribbons[i];
        const active = i < ribbonCount && count >= 2;
        entry.mesh.visible = active;
        if (!active) continue;
        this._buildSheet(entry, count, 1 - fade * 0.6);
      }
    } else {
      for (const entry of this.ribbons) entry.mesh.visible = false;
      this.distortionMesh.visible = false;
    }

    this.material.uniforms.uOpacity.value *= 1 - fade * 0.9;

    if (this._tornadoAge >= 0) {
      this._tornadoAge += dt;
      const life = Math.max(0.2, c.tornadoDuration);
      const p = saturate(this._tornadoAge / life);

      for (const shell of this.tornadoShells) shell.material.uniforms.uAge.value = p;

      const grow = 0.55 + 0.45 * Easing.outCubic(saturate(this._tornadoAge / 0.4));
      this.tornado.scale.set(c.tornadoRadius * grow, c.tornadoHeight, c.tornadoRadius * grow);
      this.tornado.rotation.y += dt * c.rotationSpeed * 0.6;
      this.tornado.visible = p < 1;
      this.position.copy(this._impactSite);
      this.position.y = c.tornadoHeight * 0.35;

      if (p < 0.9) {
        const skirt = Math.round(
          this.dustEmitter.tick(dt, c.dustRate * c.dustAmount * 0.8) * settings.global.particleCount
        );
        for (let i = 0; i < skirt; i++) {
          const angle = Math.random() * Math.PI * 2;
          const ring = c.tornadoRadius * grow * randRange(0.45, 1.0);
          _pos.set(
            this._impactSite.x + Math.cos(angle) * ring,
            this._impactSite.y + randRange(0.02, 0.5),
            this._impactSite.z + Math.sin(angle) * ring
          );
          _emit.position = _pos;
          _emit.radius = 0.25;
          _emit.direction = _dir.set(Math.cos(angle) * 1.2, 0.28, Math.sin(angle) * 1.2).normalize();
          _emit.speed = randRange(1.6, 3.4);
          _emit.speedVariance = 0.5;
          _emit.spread = 0.5;
          _emit.anchor = this._impactSite;
          _emit.size = randRange(0.14, 0.26);
          _emit.sizeVariance = 0.5;
          _emit.life = 1.1;
          _emit.lifeVariance = 0.5;
          _emit.spin = 0;
          _emit.tint = null;
          _emit.inherit = null;
          _emit.time = frame.uTime.value;
          this.dust.emit(1, _emit);
        }
      }

      if (p < 0.85 && Math.random() < 0.6) {
        const angle = Math.random() * Math.PI * 2;
        _pos.set(
          this._impactSite.x + Math.cos(angle) * c.tornadoRadius * 0.9,
          randRange(0.1, c.tornadoHeight * 0.4),
          this._impactSite.z + Math.sin(angle) * c.tornadoRadius * 0.9
        );
        _emit.position = _pos;
        _emit.radius = 0.3;
        _emit.direction = _dir.set(-Math.sin(angle), 0.9, Math.cos(angle));
        _emit.speed = 4.5;
        _emit.speedVariance = 0.5;
        _emit.spread = 0.3;
        _emit.anchor = this._impactSite;
        _emit.size = 0.15;
        _emit.sizeVariance = 0.5;
        _emit.life = 1.1;
        _emit.lifeVariance = 0.4;
        _emit.spin = c.leafSpin;
        _emit.tint = randomLeafTint();
        _emit.inherit = null;
        _emit.time = frame.uTime.value;
        this.leaves.emit(3, _emit);
        _emit.tint = null;
        this.dust.emit(5, _emit);
      }
    }
  }

  onDestroy() {
    this.tornado.visible = false;
    this.distortionMesh.visible = false;
    for (const entry of this.ribbons) {
      entry.mesh.visible = false;
      entry.ribbon.clear();
    }
  }

  dispose() {
    for (const entry of this.ribbons) entry.ribbon.dispose();
    this.material.dispose();
    for (const shell of this.tornadoShells) shell.material.dispose();
    this.tornadoGeometry.dispose();
    this.distortionMaterial.dispose();
    super.dispose();
  }
}

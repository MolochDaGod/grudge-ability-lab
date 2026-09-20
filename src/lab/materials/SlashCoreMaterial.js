// @ts-nocheck
import { ShaderMaterial, AdditiveBlending, DoubleSide, Color } from 'three';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { sharedUniforms } from '../core/FrameUniforms.js';
import { getColor } from '../utils/color.js';

/**
 * Thin additive blade / comet core.
 *
 * Style 0 is an upright ground-slash: a white-hot cut hugging the floor with a
 * fading wall above it. Style 1 is a comet streak — brightest at the head,
 * tapered across and along.
 */
export class SlashCoreMaterial extends ShaderMaterial {
  constructor() {
    super({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
      uniforms: sharedUniforms({
        uCore: { value: new Color(1, 0.96, 0.82) },
        uMid: { value: new Color(1, 0.55, 0.16) },
        uEdge: { value: new Color(1, 0.22, 0.04) },
        uOpacity: { value: 1 },
        uGlow: { value: 1.4 },
        uHeadFade: { value: 0 },
        uStyle: { value: 0 }
      }),
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vViewZ;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewZ = mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uCore;
        uniform vec3 uMid;
        uniform vec3 uEdge;
        uniform float uOpacity;
        uniform float uGlow;
        uniform float uHeadFade;
        uniform float uStyle;
        uniform float uGlobalGlow;
        uniform vec2 uResolution;
        uniform sampler2D uSceneDepth;
        uniform float uCameraNear;
        uniform float uCameraFar;
        varying vec2 vUv;
        varying float vViewZ;

        ${commonGLSL}

        void main() {
          float x = vUv.x;
          float y = vUv.y;
          float along = smoothstep(0.0, 0.1, x) * mix(0.22, 1.0, pow(x, 0.42));
          along *= 1.0 - uHeadFade;
          float across;
          float core;
          if (uStyle < 0.5) {
            float blade = exp(-pow(y / 0.14, 2.0) * 8.0);
            float wall = pow(max(1.0 - y, 0.0), 1.55) * 0.72;
            across = max(blade, wall);
            core = pow(blade, 1.2);
          } else {
            across = pow(1.0 - abs(y * 2.0 - 1.0), 3.8);
            core = pow(across, 1.8);
            along *= mix(0.12, 1.0, pow(x, 0.55));
          }
          if (across * along < 0.004) discard;
          vec3 color = mix(uEdge, uMid, across);
          color += uCore * core * 1.7;
          color *= uGlow * uGlobalGlow;
          float alpha = across * along * uOpacity;
          vec2 screenUV = gl_FragCoord.xy / uResolution;
          alpha *= softFade(uSceneDepth, screenUV, vViewZ, uCameraNear, uCameraFar, 0.28);
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
        }
      `
    });
  }

  tint(core, mid, edge) {
    this.uniforms.uCore.value.copy(getColor(core));
    this.uniforms.uMid.value.copy(getColor(mid));
    this.uniforms.uEdge.value.copy(getColor(edge));
  }
}

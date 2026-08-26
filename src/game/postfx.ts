// Post-processing: bloom, volumetric sun shafts, cinematic grade (vignette/saturation/flash/underwater)
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const GodRaysShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSunScreen: { value: new THREE.Vector2(0.5, 0.5) },
    uIntensity: { value: 0.5 },
    uColor: { value: new THREE.Color(1.0, 0.8, 0.55) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uSunScreen;
    uniform float uIntensity;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec2 delta = (uSunScreen - vUv) / 14.0;
      vec2 uv = vUv;
      float illum = 1.0;
      vec3 shaft = vec3(0.0);
      for (int i = 0; i < 14; i++) {
        uv += delta;
        vec3 s = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
        float lum = dot(s, vec3(0.299, 0.587, 0.114));
        float bright = smoothstep(0.72, 1.4, lum);
        shaft += s * bright * illum;
        illum *= 0.93;
      }
      shaft /= 14.0;
      float dist = distance(vUv, uSunScreen);
      float falloff = smoothstep(0.9, 0.0, dist);
      gl_FragColor = vec4(base.rgb + shaft * uColor * uIntensity * falloff * 2.4, base.a);
    }
  `,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSaturation: { value: 1.08 },
    uVignette: { value: 0.32 },
    uDamage: { value: 0 },
    uUnderwater: { value: 0 },
    uFlash: { value: 0 },     // thunder / explosion flash
    uFade: { value: 0 },      // sleep fade to black
    uTime: { value: 0 },
    uWarmth: { value: 0 },    // dusk warm grade
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSaturation;
    uniform float uVignette;
    uniform float uDamage;
    uniform float uUnderwater;
    uniform float uFlash;
    uniform float uFade;
    uniform float uTime;
    uniform float uWarmth;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      // underwater wobble
      if (uUnderwater > 0.01) {
        uv.x += sin(uv.y * 24.0 + uTime * 2.2) * 0.0035 * uUnderwater;
        uv.y += cos(uv.x * 20.0 + uTime * 1.8) * 0.0030 * uUnderwater;
      }
      vec3 c = texture2D(tDiffuse, uv).rgb;

      // saturation
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(lum), c, uSaturation);

      // dusk warmth
      c *= mix(vec3(1.0), vec3(1.08, 0.97, 0.86), uWarmth);

      // underwater tint
      c = mix(c, c * vec3(0.45, 0.75, 1.05) + vec3(0.0, 0.03, 0.08), uUnderwater);

      // vignette
      vec2 d = vUv - 0.5;
      float vig = 1.0 - dot(d, d) * uVignette * 2.2;
      c *= clamp(vig, 0.0, 1.0);

      // damage red pulse
      c = mix(c, vec3(0.75, 0.05, 0.05), uDamage * 0.55 * (0.7 + 0.3 * sin(uTime * 20.0)));

      // white flash (lightning/explosion)
      c += uFlash * vec3(0.9, 0.95, 1.0);

      // fade to black (sleeping)
      c = mix(c, vec3(0.0), uFade);

      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export class PostFX {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  godRays: ShaderPass;
  grade: ShaderPass;
  enabled = true;
  bloomEnabled = true;
  godRaysEnabled = true;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.godRays = new ShaderPass(GodRaysShader);
    this.composer.addPass(this.godRays);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.setSize(w, h);
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w * 0.5, h * 0.5);
  }

  applyQuality(autoLevel: number) {
    this.bloomEnabled = autoLevel < 2;
    this.godRaysEnabled = autoLevel < 1;
    this.bloom.enabled = this.bloomEnabled;
    this.godRays.enabled = this.godRaysEnabled;
  }

  setSunScreen(x: number, y: number, intensity: number, warm: number) {
    (this.godRays.uniforms.uSunScreen.value as THREE.Vector2).set(x, y);
    this.godRays.uniforms.uIntensity.value = intensity;
    (this.godRays.uniforms.uColor.value as THREE.Color).setRGB(1.0, 0.75 + warm * 0.2, 0.5 + warm * 0.3);
  }

  render(dt: number) { this.composer.render(dt); }
}

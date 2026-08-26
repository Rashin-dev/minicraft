// Custom shaders for chunk terrain + water — linear-space, fog, wind sway, waves
import * as THREE from 'three';

const CHUNK_VERT = /* glsl */ `
attribute vec4 aLight; // sky, r, g, b (0..1)
attribute float aAO;   // ao * faceShade (0..1)
attribute float aWind; // 1 = sway (leaves/plants)
uniform float uTime;
uniform float uDay;
varying vec2 vUv;
varying vec3 vLight;
varying float vFog;

void main() {
  vec3 pos = position;
  if (aWind > 0.5) {
    float w = sin(uTime * 1.7 + position.x * 0.9 + position.z * 1.1) + sin(uTime * 2.3 + position.z * 1.7);
    pos.x += w * 0.035;
    pos.z += cos(uTime * 1.9 + position.x * 1.3 + position.z * 0.7) * 0.035;
  }
  vec3 sky = vec3(aLight.r) * uDay;
  vec3 blk = aLight.gba;
  vec3 li = max(sky, blk);
  float mx = max(blk.r, max(blk.g, blk.b));
  li *= 1.0 + mx * mx * 0.9; // emissive glow boost (feeds bloom)
  vLight = (vec3(0.030, 0.034, 0.048) + li) * aAO;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  float d = length(wp.xyz - cameraPosition);
  vFog = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
  vUv = uv;
}
`;

const CHUNK_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uFogColor;
uniform float uOpacity;
uniform float uAlphaTest;
varying vec2 vUv;
varying vec3 vLight;
varying float vFog;

void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < uAlphaTest) discard;
  vec3 c = t.rgb * vLight;
  c = mix(c, uFogColor, clamp(vFog, 0.0, 1.0));
  gl_FragColor = vec4(c, t.a * uOpacity);
}
`;

const WATER_VERT = /* glsl */ `
attribute vec4 aLight; // sky, r, g, b
uniform float uTime;
varying vec3 vLight;
varying vec3 vWorld;
varying float vFog;
varying vec3 vWaveNormal;

void main() {
  vec3 pos = position;
  float t = uTime;
  // gentle layered waves
  float w1 = sin(pos.x * 0.7 + t * 1.4) * cos(pos.z * 0.6 + t * 1.1);
  float w2 = sin(pos.x * 1.9 - t * 2.0 + pos.z * 1.3);
  float h = (w1 * 0.5 + w2 * 0.5) * 0.06;
  // only displace surface verts (top of a cell)
  pos.y += h;
  // analytic normal
  float dx = (cos(pos.x * 0.7 + t * 1.4) * 0.7 * cos(pos.z * 0.6 + t * 1.1) * 0.5 + cos(pos.x * 1.9 - t * 2.0 + pos.z * 1.3) * 1.9) * 0.06;
  float dz = (-sin(pos.z * 0.6 + t * 1.1) * 0.6 * sin(pos.x * 0.7 + t * 1.4) * 0.5 + cos(pos.x * 1.9 - t * 2.0 + pos.z * 1.3) * 1.3) * 0.06;
  vWaveNormal = normalize(vec3(-dx, 1.0, -dz));
  vec3 sky = vec3(aLight.r) * uDay;
  vec3 blk = aLight.gba;
  vLight = max(sky, blk);
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorld = wp.xyz;
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  float d = length(wp.xyz - cameraPosition);
  vFog = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
}
`;

const WATER_FRAG = /* glsl */ `
uniform vec3 uFogColor;
uniform vec3 uSkyColor;   // current horizon/sky tint for reflection
uniform vec3 uSunDir;     // world-space
uniform vec3 uSunColor;
uniform float uDay;
uniform float uUnderwater;
varying vec3 vLight;
varying vec3 vWorld;
varying float vFog;
varying vec3 vWaveNormal;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorld);
  vec3 n = normalize(vWaveNormal + vec3(0.0, uUnderwater * -0.6, 0.0));
  float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);
  fres = mix(0.06, 0.85, fres);

  // sky reflection + deep water body
  vec3 deep = vec3(0.03, 0.14, 0.30) * (0.25 + vLight * 0.9);
  vec3 shallow = vec3(0.06, 0.28, 0.42) * (0.25 + vLight * 0.9);
  vec3 body = mix(deep, shallow, clamp(vLight.r * 0.6 + 0.3, 0.0, 1.0));
  vec3 refl = uSkyColor * (0.5 + uDay * 0.6);

  // sun glitter
  vec3 hv = normalize(viewDir + uSunDir);
  float spec = pow(max(dot(n, hv), 0.0), 180.0) * uDay;

  vec3 c = mix(body, refl, fres) + uSunColor * spec * 2.2;
  c = mix(c, uFogColor, clamp(vFog, 0.0, 1.0));
  float a = mix(0.82, 0.96, fres);
  gl_FragColor = vec4(c, a);
}
`;

export interface SceneUniforms {
  uTime: { value: number };
  uDay: { value: number };
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
}

export function makeChunkMaterials(atlas: THREE.Texture) {
  const shared: SceneUniforms = {
    uTime: { value: 0 },
    uDay: { value: 1 },
    uFogColor: { value: new THREE.Color(0x87ceeb) },
    uFogDensity: { value: 0.012 },
  };

  const opaque = new THREE.ShaderMaterial({
    vertexShader: CHUNK_VERT,
    fragmentShader: CHUNK_FRAG,
    uniforms: {
      uMap: { value: atlas },
      uAlphaTest: { value: 0.5 },
      uOpacity: { value: 1.0 },
      ...shared,
    },
  });

  const trans = new THREE.ShaderMaterial({
    vertexShader: CHUNK_VERT,
    fragmentShader: CHUNK_FRAG,
    uniforms: {
      uMap: { value: atlas },
      uAlphaTest: { value: 0.02 },
      uOpacity: { value: 0.8 },
      ...shared,
    },
    transparent: true,
    depthWrite: false,
  });

  const water = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: {
      ...shared,
      uSkyColor: { value: new THREE.Color(0x87ceeb) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 0.95, 0.8) },
      uUnderwater: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return { opaque, trans, water, shared };
}

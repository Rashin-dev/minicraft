// Cinematic sky: gradient dome, sun, moon with phases, twinkling stars, aurora borealis, blocky clouds
import * as THREE from 'three';
import { mulberry32 } from './noise';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uSunDir;
uniform float uDay;        // 0 night .. 1 day
uniform float uDusk;       // sunrise/sunset factor
uniform float uTime;
uniform float uOvercast;   // 0 clear .. 1 storm
uniform float uAurora;     // aurora strength
uniform float uSunPhase;   // moon phase 0..1 (0.5 = full)
uniform vec3 uFogColor;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec3 dir = normalize(vDir);
  float sunH = uSunDir.y;

  // --- base gradient ---
  vec3 dayZenith = vec3(0.16, 0.40, 0.78);
  vec3 dayHorizon = vec3(0.66, 0.83, 0.94);
  vec3 nightZenith = vec3(0.008, 0.012, 0.035);
  vec3 nightHorizon = vec3(0.025, 0.045, 0.10);
  float h = clamp(dir.y * 1.4 + 0.08, 0.0, 1.0);
  vec3 zen = mix(nightZenith, dayZenith, uDay);
  vec3 hor = mix(nightHorizon, dayHorizon, uDay);
  vec3 col = mix(hor, zen, pow(h, 0.8));

  // --- dusk / dawn glow around sun azimuth ---
  float sunDot = dot(dir, normalize(vec3(uSunDir.x, 0.0, uSunDir.z)));
  float towardSun = clamp(sunDot * 0.5 + 0.5, 0.0, 1.0);
  vec3 duskCol = mix(vec3(0.98, 0.45, 0.18), vec3(0.99, 0.62, 0.30), towardSun);
  float duskBand = pow(1.0 - abs(dir.y), 3.0) * uDusk;
  col = mix(col, duskCol, duskBand * towardSun * 0.85);

  // --- sun disc + halo (HDR bright for bloom/godrays) ---
  float sd = dot(dir, uSunDir);
  float disc = smoothstep(0.9993, 0.9997, sd);
  float halo = pow(clamp(sd, 0.0, 1.0), 90.0) * 0.5 + pow(clamp(sd, 0.0, 1.0), 350.0) * 0.5;
  vec3 sunTint = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.95, 0.8), clamp(sunH * 2.5, 0.0, 1.0));
  col += sunTint * (disc * 6.0 + halo * (0.6 + uDusk)) * (1.0 - uOvercast * 0.85);

  // --- moon with phase ---
  vec3 moonDir = -uSunDir;
  float md = dot(dir, moonDir);
  float moonDisc = smoothstep(0.9995, 0.9998, md);
  if (moonDisc > 0.0) {
    // phase: offset circle mask using sun direction projected on moon plane
    vec3 moonRight = normalize(cross(moonDir, vec3(0.0, 1.0, 0.0)));
    vec3 moonUp = cross(moonRight, moonDir);
    vec2 local = vec2(dot(dir - moonDir * md, moonRight), dot(dir - moonDir * md, moonUp));
    float phase = clamp(uSunPhase, 0.0, 1.0); // 0 new .. 0.5 full .. 1 new
    float r = length(local);
    float shift = mix(-1.6, 1.6, phase);
    float dark = smoothstep(r - 0.004, r + 0.004, shift * 0.02 + 0.0);
    float lit = smoothstep(0.0195, 0.019, r);
    float visible = clamp(lit * (0.25 + 0.75 * dark), 0.0, 1.0);
    col += vec3(0.92, 0.95, 1.0) * visible * 1.6 * (1.0 - uDay);
    col += vec3(0.4, 0.5, 0.7) * pow(clamp(md, 0.0, 1.0), 220.0) * 0.35 * (1.0 - uDay);
  }

  // --- procedural twinkling stars ---
  float night = 1.0 - uDay;
  if (night > 0.02 && dir.y > -0.1) {
    vec3 sp = dir * 220.0;
    vec3 cell = floor(sp);
    float star = hash13(cell);
    float star2 = hash13(cell + 7.7);
    float bright = step(0.995, star) + step(0.9985, star2) * 0.7;
    if (bright > 0.0) {
      vec3 f = fract(sp) - 0.5;
      float dist2 = dot(f, f);
      float twinkle = 0.6 + 0.4 * sin(uTime * (1.5 + star * 4.0) + star * 40.0);
      col += vec3(0.9, 0.93, 1.0) * bright * twinkle * smoothstep(0.16, 0.0, dist2) * night * (1.0 - uOvercast * 0.9);
    }
  }

  // --- aurora borealis ---
  if (uAurora > 0.01 && dir.y > 0.05) {
    float band = 0.0;
    float ax = dir.x * 2.5 + uTime * 0.03;
    float az = dir.z * 1.8;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float y0 = 0.28 + fk * 0.13;
      float curtain = sin(ax * (1.3 + fk * 0.7) + az * (0.9 + fk * 0.5) + uTime * (0.12 + fk * 0.05));
      curtain += sin(ax * 2.7 - az * 1.7 + uTime * 0.21 + fk * 2.1) * 0.5;
      float yCenter = y0 + curtain * 0.06;
      float w = 0.045 + 0.02 * sin(ax * 3.3 + uTime * 0.3);
      band += exp(-pow((dir.y - yCenter) / w, 2.0)) * (0.9 - fk * 0.22);
    }
    vec3 auroraCol = mix(vec3(0.1, 0.95, 0.45), vec3(0.35, 0.3, 0.95), clamp(dir.y * 2.2 - 0.4, 0.0, 1.0));
    col += auroraCol * band * uAurora * night * (1.0 - uOvercast) * 0.55;
  }

  // --- overcast wash ---
  col = mix(col, uFogColor * 0.9, uOvercast * clamp(1.0 - dir.y * 0.5, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

const CLOUD_CELL = 14;

export class SkySystem {
  dome: THREE.Mesh;
  clouds: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  private cloudMat: THREE.MeshBasicMaterial;
  sunDir = new THREE.Vector3(0, 1, 0);
  fogColor = new THREE.Color(0x87ceeb);
  horizonColor = new THREE.Color(0x87ceeb);
  dayFactor = 1;
  duskFactor = 0;
  uSunPhase = 0.5;

  constructor(scene: THREE.Scene, seed: number) {
    this.uniforms = {
      uSunDir: { value: this.sunDir },
      uDay: { value: 1 },
      uDusk: { value: 0 },
      uTime: { value: 0 },
      uOvercast: { value: 0 },
      uAurora: { value: 0 },
      uFogColor: { value: this.fogColor },
      uSunPhase: { value: 0.5 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // blocky MC-style clouds from noise grid, merged into one geometry
    const rng = mulberry32(seed + 5);
    const positions: number[] = [];
    const indices: number[] = [];
    const grid = 40;
    const cell = 14;
    for (let gz = 0; gz < grid; gz++) for (let gx = 0; gx < grid; gx++) {
      const n = rng() * 0.5 + (Math.sin(gx * 0.7 + rng()) + Math.cos(gz * 0.8)) * 0.25;
      if (n < 0.42) continue;
      const x0 = (gx - grid / 2) * cell, z0 = (gz - grid / 2) * cell;
      const y0 = 92 + Math.floor(rng() * 2);
      const b = positions.length / 3;
      positions.push(
        x0, y0, z0, x0 + cell, y0, z0, x0, y0, z0 + cell, x0 + cell, y0, z0 + cell,
        x0, y0 + 3.2, z0, x0 + cell, y0 + 3.2, z0, x0, y0 + 3.2, z0 + cell, x0 + cell, y0 + 3.2, z0 + cell,
      );
      const quads = [
        [0, 1, 3, 2], [4, 6, 7, 5], // bottom, top
        [0, 2, 6, 4], [1, 5, 7, 3], // sides
        [0, 4, 5, 1], [2, 3, 7, 6],
      ];
      for (const q of quads) indices.push(b + q[0], b + q[1], b + q[2], b + q[0], b + q[2], b + q[3]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    this.cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
    this.clouds = new THREE.Mesh(geo, this.cloudMat);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -5;
    scene.add(this.clouds);
  }

  // timeOfDay: 0..1 (0.25 = sunrise, 0.5 = noon, 0.75 = sunset)
  update(timeOfDay: number, camPos: THREE.Vector3, overcast: number, elapsed: number, auroraStrength: number, phase: number) {
    const ang = timeOfDay * Math.PI * 2 - Math.PI / 2;
    this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.18).normalize();
    const sunY = this.sunDir.y;
    const day = Math.max(0, Math.min(1, sunY * 3.2 + 0.12));
    const dusk = Math.max(0, 1 - Math.abs(sunY) * 4.5) * (sunY > -0.22 ? 1 : 0);
    this.dayFactor = day;
    this.duskFactor = dusk;
    this.uSunPhase = phase;

    // fog/horizon color tracks sky
    const dayHor = new THREE.Color(0xa8ccec), nightHor = new THREE.Color(0x0a1226);
    const duskHor = new THREE.Color(0xe8925c);
    this.fogColor.copy(nightHor).lerp(dayHor, day);
    this.fogColor.lerp(duskHor, dusk * 0.55);
    if (overcast > 0) this.fogColor.lerp(new THREE.Color(0x6a7482).multiplyScalar(0.25 + day * 0.75), overcast * 0.7);
    this.horizonColor.copy(this.fogColor);

    (this.uniforms.uDay.value as number) = day;
    (this.uniforms.uDusk.value as number) = dusk;
    (this.uniforms.uTime.value as number) = elapsed;
    (this.uniforms.uOvercast.value as number) = overcast;
    (this.uniforms.uAurora.value as number) = auroraStrength;
    (this.uniforms.uSunPhase.value as number) = phase;

    this.dome.position.copy(camPos);
    // clouds follow player in steps, drift with wind
    this.clouds.position.set(
      Math.round(camPos.x / CLOUD_CELL) * CLOUD_CELL + ((elapsed * 1.1) % CLOUD_CELL),
      0,
      Math.round(camPos.z / CLOUD_CELL) * CLOUD_CELL,
    );
    const cloudBright = 0.25 + day * 0.75;
    this.cloudMat.color.setRGB(cloudBright, cloudBright, cloudBright * (1 - overcast * 0.05));
    this.cloudMat.opacity = 0.28 + day * 0.3 + overcast * 0.4;
    this.clouds.visible = overcast < 0.98;
  }

  setCloudsVisible(v: boolean) { this.clouds.visible = v; }
}

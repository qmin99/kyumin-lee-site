import * as THREE from 'three'
import { NOISE, RIPPLE, VOLUME, WORLEY } from './glsl.js'

/* everything below the line.
   dome  : the water volume, carries the light shafts
   under : the underside of the surface, carries snell's window,
           total internal reflection and the caustic net */

const WORLD_VERT = /* glsl */`
varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

const DOME_FRAG = /* glsl */`
precision highp float;
uniform vec3 uCam;
${NOISE}
${VOLUME}
varying vec3 vWorld;
void main(){
  vec3 d = normalize(vWorld - uCam);
  gl_FragColor = vec4(volumeColor(d), 1.0);
}`

const UNDER_FRAG = /* glsl */`
precision highp float;
uniform vec3  uCam;
uniform vec3  uSunDir;       // world sun direction, above water
uniform vec3  uSkyZenith;
uniform vec3  uSkyHaze;
uniform vec3  uSunCol;
uniform vec3  uFoam;
uniform float uTime;
uniform float uRipple;
uniform float uFogDensity;
uniform float uSkyGain;
${NOISE}
${RIPPLE}
${WORLEY}
${VOLUME}
varying vec3 vWorld;

void main(){
  vec3 toS = vWorld - uCam;
  float dist = length(toS);
  vec3 d = toS / max(dist, 1e-4);

  // ripple normal on the underside, pointing up
  vec2 rp = vWorld.xz * 0.34;
  vec3 nn = rippleNormal(rp, uTime, uRipple);

  float ct = clamp(dot(d, nn), 0.0, 1.0);
  float sinIn  = sqrt(max(0.0, 1.0 - ct * ct));
  float sinOut = sinIn * 1.3333;

  // outside the critical angle the surface mirrors the deep
  float tir = smoothstep(0.965, 1.005, sinOut);

  float cosOut = sqrt(max(0.0, 1.0 - min(sinOut, 1.0) * min(sinOut, 1.0)));
  vec3 tang = normalize(d - nn * ct + vec3(1e-5));
  vec3 outDir = normalize(nn * cosOut + tang * min(sinOut, 1.0));

  // compressed sky seen through the window
  float horiz = clamp(1.0 - outDir.y, 0.0, 1.0);
  vec3 skyc = mix(uSkyZenith, uSkyHaze, pow(horiz, 1.35));
  float sd = max(0.0, dot(outDir, normalize(uSunDir)));
  skyc += uSunCol * pow(sd, 420.0) * 26.0;
  skyc += uSunCol * pow(sd, 14.0) * 0.55;
  skyc *= uSkyGain;

  // mirrored deep for the total internal reflection ring
  vec3 mirrored = volumeColor(reflect(d, nn));

  vec3 col = mix(skyc, mirrored, tir);

  // caustic net. worley cell boundaries, two scales, so the filaments
  // stay thin instead of turning into ceiling tiles
  vec2 cp = vWorld.xz * 0.30;
  float k1 = causticNet(cp, uTime);
  float k2 = causticNet(cp * 1.7 + 37.0, uTime * 1.3);
  float veins = pow(max(k1, k2 * 0.85), 3.4);
  float sparkle = pow(k1, 8.0);
  float rim = smoothstep(0.55, 0.99, sinOut) * (1.0 - tir);
  col += vec3(0.55, 0.92, 1.0) * veins * (0.42 + rim * 1.9) * uSkyGain;
  col += uFoam * sparkle * (0.55 + rim) * uSkyGain;
  col += uFoam * rim * 0.30 * uSkyGain;

  // fade into the volume so the dome seam never shows
  float fog = exp(-dist * uFogDensity);
  col = mix(volumeColor(d), col, clamp(fog, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}`

export function createDeep(scene, { mobile = false } = {}) {
  const shared = {
    uShallow:  { value: new THREE.Color(0x2f9fa4) },
    uDeepC:    { value: new THREE.Color(0x03161c) },
    uSunUW:    { value: new THREE.Vector3(0, 1, -1) },
    uShaft:    { value: 1 },
    uVolTime:  { value: 0 },
    uCamDepth: { value: 0 },
  }
  const cam = { value: new THREE.Vector3() }

  const domeMat = new THREE.ShaderMaterial({
    vertexShader: WORLD_VERT, fragmentShader: DOME_FRAG,
    uniforms: { uCam: cam, ...shared },
    side: THREE.BackSide, depthWrite: false, fog: false,
  })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(240, mobile ? 24 : 40, mobile ? 16 : 26), domeMat)
  dome.renderOrder = -60
  dome.frustumCulled = false
  scene.add(dome)

  const underMat = new THREE.ShaderMaterial({
    vertexShader: WORLD_VERT, fragmentShader: UNDER_FRAG,
    uniforms: {
      uCam: cam,
      uSunDir:    { value: new THREE.Vector3(0, 0.1, -1) },
      uSkyZenith: { value: new THREE.Color(0x6fc4d8) },
      uSkyHaze:   { value: new THREE.Color(0xffe0b0) },
      uSunCol:    { value: new THREE.Color(0xffdba3) },
      uFoam:      { value: new THREE.Color(0xe0f4f2) },
      uTime:      { value: 0 },
      uRipple:    { value: 1.0 },
      uFogDensity:{ value: 0.020 },
      uSkyGain:   { value: 1.0 },
      ...shared,
    },
    side: THREE.DoubleSide, depthWrite: true, fog: false,
  })
  const under = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), underMat)
  under.rotation.x = -Math.PI / 2
  under.renderOrder = -50
  under.frustumCulled = false
  scene.add(under)

  const group = { dome, under }

  return {
    ...group,
    setVisible(v) { dome.visible = v; under.visible = v },
    setSun(dir) {
      underMat.uniforms.uSunDir.value.copy(dir)
      shared.uSunUW.value.copy(dir)
    },
    update(camPos, time) {
      cam.value.copy(camPos)
      dome.position.set(camPos.x, camPos.y, camPos.z)
      shared.uVolTime.value = time
      shared.uCamDepth.value = Math.max(0, -camPos.y)
      underMat.uniforms.uTime.value = time
    },
    u: underMat.uniforms,
    shared,
    dispose() {
      dome.geometry.dispose(); domeMat.dispose()
      under.geometry.dispose(); underMat.dispose()
    },
  }
}

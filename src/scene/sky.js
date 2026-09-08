import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'

/* Preetham atmosphere plus a star shell plus the sun billboard that the
   god ray pass takes as its light source. */

const STAR_VERT = /* glsl */`
attribute float aSize;
attribute float aSeed;
uniform float uTime;
uniform float uPix;
varying float vTw;
varying float vSeed;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.62 + 0.38 * sin(uTime * (1.1 + aSeed * 2.7) + aSeed * 40.0);
  vTw = tw;
  vSeed = aSeed;
  gl_PointSize = aSize * uPix * (0.72 + 0.28 * tw);
}`

const STAR_FRAG = /* glsl */`
uniform float uOpacity;
varying float vTw;
varying float vSeed;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float core = exp(-r * r * 42.0);
  float halo = exp(-r * r * 7.0) * 0.30;
  // faint four point flare on the brighter stars
  float cross = max(0.0, 1.0 - abs(c.x) * 26.0) + max(0.0, 1.0 - abs(c.y) * 26.0);
  cross *= smoothstep(0.30, 0.5, r) * 0.0 + exp(-r * r * 18.0) * 0.22 * step(0.72, vSeed);
  float a = (core + halo + cross) * uOpacity * vTw;
  if (a < 0.003) discard;
  vec3 warm = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.88, 0.74), vSeed);
  gl_FragColor = vec4(warm * a * 1.6, 1.0);
}`

export function createSky(scene, opts = {}) {
  const sky = new Sky()
  sky.scale.setScalar(24000)
  sky.material.depthWrite = false
  sky.renderOrder = -1000
  scene.add(sky)

  const u = sky.material.uniforms
  u.turbidity.value = 0.6
  u.rayleigh.value = 0.14
  u.mieCoefficient.value = 0.0022
  u.mieDirectionalG.value = 0.86

  const sunDir = new THREE.Vector3()
  const sunPos = new THREE.Vector3()
  const tmp = new THREE.Vector3()

  // ---- stars ----
  const N = opts.stars ?? 2200
  const pos = new Float32Array(N * 3)
  const size = new Float32Array(N)
  const seed = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    // upper hemisphere shell, denser away from the horizon
    const t = Math.random()
    const y = Math.pow(t, 0.55) * 0.98 + 0.02
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const a = Math.random() * Math.PI * 2
    const R = 9000
    pos[i * 3] = Math.cos(a) * r * R
    pos[i * 3 + 1] = y * R
    pos[i * 3 + 2] = Math.sin(a) * r * R
    const m = Math.random()
    size[i] = 1.1 + Math.pow(m, 5.0) * 9.0
    seed[i] = Math.random()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const starU = {
    uTime: { value: 0 },
    uOpacity: { value: 1 },
    uPix: { value: 1 },
  }
  const stars = new THREE.Points(g, new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: starU,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, fog: false,
  }))
  stars.renderOrder = -900
  stars.frustumCulled = false
  scene.add(stars)

  // ---- sun billboard, doubles as the god ray source ----
  const sunMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffe7bd), transparent: true, depthWrite: false, fog: false,
  })
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), sunMat)
  sun.renderOrder = -800
  sun.frustumCulled = false
  scene.add(sun)

  return {
    sky, stars, sun, sunDir, sunMaterial: sunMat,
    /* elevation and azimuth in degrees */
    setSun(elevation, azimuth) {
      const phi = THREE.MathUtils.degToRad(90 - elevation)
      const theta = THREE.MathUtils.degToRad(azimuth)
      sunPos.setFromSphericalCoords(1, phi, theta)
      sunDir.copy(sunPos)
      u.sunPosition.value.copy(sunPos)
    },
    setAtmosphere(rayleigh, turbidity, mie, mieG) {
      u.rayleigh.value = rayleigh
      u.turbidity.value = turbidity
      u.mieCoefficient.value = mie
      if (mieG !== undefined) u.mieDirectionalG.value = mieG
    },
    update(time, pixelRatio) {
      starU.uTime.value = time
      starU.uPix.value = pixelRatio
    },
    setStarOpacity(v) { starU.uOpacity.value = v; stars.visible = v > 0.001 },
    /* above water the sun sits on the dome. below water it becomes the
       bright patch of the snell window so the god rays radiate from it. */
    placeSunAbove(camPos) {
      tmp.set(camPos.x, 0, camPos.z)
      sun.position.copy(sunDir).multiplyScalar(15000).add(tmp)
      sun.scale.setScalar(240)
    },
    placeSunBelow(camPos) {
      // small and right under the surface so it merges with the bright
      // patch of the snell window and only feeds the god ray pass
      sun.position.set(
        camPos.x + sunDir.x * 7.0,
        -0.55,
        camPos.z + sunDir.z * 7.0,
      )
      sun.scale.setScalar(0.62)
    },
    dispose() {
      g.dispose(); stars.material.dispose()
      sky.geometry.dispose(); sky.material.dispose()
      sun.geometry.dispose(); sunMat.dispose()
    },
  }
}

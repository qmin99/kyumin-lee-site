import * as THREE from 'three'

/* three point systems, all camera relative:
   streaks : the fall. vertical smears streaming past the lens
   spray   : impact and breach. a radial burst of foam
   bubbles : underwater. rising, ringed, parallaxed */

const STREAK_VERT = /* glsl */`
attribute float aSeed;
uniform float uScroll, uPix, uSpan, uSize;
varying float vA;
varying float vS;
void main(){
  vec3 p = position;
  p.y = mod(p.y - uScroll * (0.55 + aSeed * 0.9), uSpan) - uSpan * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(-mv.z, 0.001);
  vA = smoothstep(0.6, 4.0, d) * (1.0 - smoothstep(uSpan * 0.30, uSpan * 0.52, d));
  vS = aSeed;
  gl_PointSize = uSize * uPix * (150.0 / d);
}`

const STREAK_FRAG = /* glsl */`
uniform float uStretch, uOpacity;
uniform vec3 uColor;
varying float vA;
varying float vS;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float w = 0.048 / max(uStretch, 0.12);
  float a = exp(-(c.x * c.x) / (w * w)) * pow(max(0.0, 1.0 - abs(c.y) * 2.0), 1.3);
  a *= vA * uOpacity * (0.45 + vS * 0.75);
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
}`

const SPRAY_VERT = /* glsl */`
attribute vec3 aDir;
attribute float aSeed;
uniform float uBurst, uPix, uScale;
varying float vA;
void main(){
  float t = clamp(uBurst, 0.0, 1.0);
  float r = pow(t, 0.42) * uScale * (0.30 + aSeed * 1.25);
  vec3 p = aDir * r;
  p.y -= 26.0 * t * t * (0.25 + aSeed) * uScale * 0.06;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(-mv.z, 0.001);
  vA = (1.0 - smoothstep(0.30, 1.0, t)) * smoothstep(0.0, 0.05, t);
  gl_PointSize = uPix * (1.4 + aSeed * 6.5) * (70.0 / d);
}`

const SPRAY_FRAG = /* glsl */`
uniform float uOpacity;
uniform vec3 uColor;
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float a = exp(-r * r * 20.0) * vA * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
}`

const BUB_VERT = /* glsl */`
attribute float aSeed;
uniform float uRise, uPix, uSpan;
varying float vA;
varying float vS;
void main(){
  vec3 p = position;
  float sp = 0.5 + aSeed * 1.6;
  p.y = mod(p.y + uRise * sp, uSpan) - uSpan * 0.42;
  p.x += sin(uRise * 0.9 + aSeed * 44.0) * (0.12 + aSeed * 0.4);
  p.z += cos(uRise * 0.7 + aSeed * 31.0) * (0.12 + aSeed * 0.4);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(-mv.z, 0.001);
  vA = smoothstep(0.25, 1.6, d) * exp(-d * 0.055);
  vS = aSeed;
  gl_PointSize = uPix * (1.2 + aSeed * 5.0) * (34.0 / d);
}`

const BUB_FRAG = /* glsl */`
uniform float uOpacity;
uniform vec3 uColor;
varying float vA;
varying float vS;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float ring = exp(-pow((r - 0.80) * 5.2, 2.0));
  float body = exp(-r * r * 2.6) * 0.22;
  float glint = exp(-pow(length(c - vec2(-0.14, 0.14)) * 8.0, 2.0)) * 0.8;
  float a = (ring + body + glint) * vA * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
}`

function pts(vert, frag, uniforms, geo, order) {
  const m = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, uniforms,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, fog: false,
  })
  const p = new THREE.Points(geo, m)
  p.frustumCulled = false
  p.renderOrder = order
  return p
}

export function createParticles(scene, { mobile = false } = {}) {
  const nStreak = mobile ? 900 : 2600
  const nSpray = mobile ? 500 : 1500
  const nBub = mobile ? 300 : 850

  // streaks
  const SPAN = 90
  const sPos = new Float32Array(nStreak * 3)
  const sSeed = new Float32Array(nStreak)
  for (let i = 0; i < nStreak; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 1.5 + Math.pow(Math.random(), 0.6) * 26
    sPos[i * 3] = Math.cos(a) * r
    sPos[i * 3 + 1] = Math.random() * SPAN
    sPos[i * 3 + 2] = Math.sin(a) * r
    sSeed[i] = Math.random()
  }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
  sg.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1))
  const streakU = {
    uScroll: { value: 0 }, uPix: { value: 1 }, uSpan: { value: SPAN },
    uSize: { value: 1 }, uStretch: { value: 1 }, uOpacity: { value: 0 },
    uColor: { value: new THREE.Color(0xdfeef7) },
  }
  const streaks = pts(STREAK_VERT, STREAK_FRAG, streakU, sg, 20)
  scene.add(streaks)

  // spray
  const pPos = new Float32Array(nSpray * 3)
  const pDir = new Float32Array(nSpray * 3)
  const pSeed = new Float32Array(nSpray)
  for (let i = 0; i < nSpray; i++) {
    const a = Math.random() * Math.PI * 2
    const u = Math.pow(Math.random(), 0.75)
    const y = 0.12 + u * 0.95
    const r = Math.sqrt(Math.max(0, 1 - Math.min(1, y * y) * 0.55))
    pDir[i * 3] = Math.cos(a) * r
    pDir[i * 3 + 1] = y
    pDir[i * 3 + 2] = Math.sin(a) * r
    pSeed[i] = Math.random()
  }
  const pg = new THREE.BufferGeometry()
  pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  pg.setAttribute('aDir', new THREE.BufferAttribute(pDir, 3))
  pg.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 1))
  const sprayU = {
    uBurst: { value: 0 }, uPix: { value: 1 }, uScale: { value: 9 },
    uOpacity: { value: 1 }, uColor: { value: new THREE.Color(0xe6f7f4) },
  }
  const spray = pts(SPRAY_VERT, SPRAY_FRAG, sprayU, pg, 30)
  scene.add(spray)

  // bubbles
  const BSPAN = 34
  const bPos = new Float32Array(nBub * 3)
  const bSeed = new Float32Array(nBub)
  for (let i = 0; i < nBub; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 0.6 + Math.pow(Math.random(), 0.5) * 14
    bPos[i * 3] = Math.cos(a) * r
    bPos[i * 3 + 1] = Math.random() * BSPAN
    bPos[i * 3 + 2] = Math.sin(a) * r
    bSeed[i] = Math.random()
  }
  const bg = new THREE.BufferGeometry()
  bg.setAttribute('position', new THREE.BufferAttribute(bPos, 3))
  bg.setAttribute('aSeed', new THREE.BufferAttribute(bSeed, 1))
  const bubU = {
    uRise: { value: 0 }, uPix: { value: 1 }, uSpan: { value: BSPAN },
    uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xd6f2ef) },
  }
  const bubbles = pts(BUB_VERT, BUB_FRAG, bubU, bg, 25)
  scene.add(bubbles)

  return {
    streaks, spray, bubbles,
    streakU, sprayU, bubU,
    follow(camPos) {
      streaks.position.copy(camPos)
      bubbles.position.copy(camPos)
    },
    setSprayOrigin(x, z) { spray.position.set(x, 0, z) },
    setPix(p) { streakU.uPix.value = p; sprayU.uPix.value = p; bubU.uPix.value = p },
    update(time) {
      streakU.uScroll.value = time * 46.0
      bubU.uRise.value = time * 1.9
    },
    dispose() {
      ;[sg, pg, bg].forEach(g => g.dispose())
      ;[streaks, spray, bubbles].forEach(p => p.material.dispose())
    },
  }
}

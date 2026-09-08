import * as THREE from 'three'

const VERT = /* glsl */`
uniform float uTime, uScroll, uAspect, uDpr;
uniform float uHandoff;   // 1 at the instant the film lets go, decays to 0
attribute vec3 aSeed;
varying float vA;
varying float vSide;

// hash-based value noise. no external license.
vec3 hash3(vec3 p){
  p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(p)*43758.5453123)*2.0-1.0;
}
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f*f*(3.0-2.0*f);
  float n = mix(mix(mix(dot(hash3(i+vec3(0,0,0)),f-vec3(0,0,0)), dot(hash3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),
                    mix(dot(hash3(i+vec3(0,1,0)),f-vec3(0,1,0)), dot(hash3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
                mix(mix(dot(hash3(i+vec3(0,0,1)),f-vec3(0,0,1)), dot(hash3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),
                    mix(dot(hash3(i+vec3(0,1,1)),f-vec3(0,1,1)), dot(hash3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);
  return n;
}
vec2 curl(vec3 p){
  float e = 0.12;
  float n1 = vnoise(p + vec3(0.0, e, 0.0));
  float n2 = vnoise(p - vec3(0.0, e, 0.0));
  float n3 = vnoise(p + vec3(e, 0.0, 0.0));
  float n4 = vnoise(p - vec3(e, 0.0, 0.0));
  return vec2(n1-n2, -(n3-n4)) / (2.0*e);
}

void main(){
  vec3 s = aSeed;
  float t = uTime * 0.055;

  // base lane position. lanes are the structured state.
  float lane = floor(s.y * 9.0) / 9.0;
  float run = fract(s.x + t * (0.06 + fract(s.z)*0.10));
  // dashes, not continuous rules
  float dash = step(0.34, fract(run * 7.0 + s.z));
  vec2 structured = vec2(run * 2.0 - 1.0, lane * 2.0 - 1.0 + (fract(s.z*13.0)-0.5)*0.012);

  // free state. curl advection around the seed.
  vec2 c = curl(vec3(s.xy * 2.1, t * 0.9 + s.z * 4.0));
  vec2 free = (s.xy * 2.0 - 1.0) + c * 0.30;
  free.x = mod(free.x + 1.0 + t*0.20, 2.0) - 1.0;

  // divider at y = 0. above it structure dominates, below it the field is free.
  float side = step(0.0, structured.y);
  vSide = side;

  float m = smoothstep(0.0, 1.0, uScroll);
  // top half loosens as you scroll, bottom half tightens. they trade behaviour.
  float mixTop = m;
  float mixBot = 1.0 - m;
  float k = mix(mixBot, mixTop, side);

  vec2 pos = mix(structured, free, k);

  // the rule is a hard boundary. nothing crosses it.
  float gap = 0.045;
  pos.y = side > 0.5 ? max(pos.y, gap) : min(pos.y, -gap);

  /* cover, not contain. the points are generated in a [-1,1] square and
     the camera is a fixed [-1,1] ortho box, so multiplying x by aspect
     works only while aspect is above 1. at 390x844 aspect is 0.46 and the
     whole field collapsed into a strip down the middle of the phone.
     scale whichever axis is short instead, and normalise the masks by the
     same factors so the distribution does not change with the viewport. */
  float sx = max(uAspect, 1.0);
  float sy = max(1.0 / max(uAspect, 0.001), 1.0);
  pos.x *= sx;
  pos.y *= sy;

  // text lives in the middle. the field yields to it.
  float edge = smoothstep(0.10, 0.62, abs(pos.x) / sx);
  float band = smoothstep(0.06, 0.55, abs(pos.y) / sy);
  vA = (0.22 + 0.78 * edge) * band * (0.25 + 0.75 * fract(s.z * 7.3));
  vA *= 0.60 + 0.40 * abs(sin(t*1.4 + s.z*20.0));
  vA *= mix(dash, 1.0, k);

  /* the film hands the camera over: for a moment the field still holds
     the shape of the last frame, then it relaxes into its own motion.
     this has to land before modelViewMatrix, it used to run after and so
     only ever moved the alpha. */
  pos.y = mix(pos.y, pos.y * 0.34 + 0.09 * sy, uHandoff);
  vec4 mv = modelViewMatrix * vec4(pos, 0.0, 1.0);

  vA *= mix(1.0, 1.8, uHandoff);
  gl_PointSize = (0.7 + 1.2 * fract(s.z*3.1)) * uDpr * mix(1.0, 1.5, uHandoff);
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */`
precision highp float;
uniform vec3 uInk, uInk2;
varying float vA;
varying float vSide;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d,d);
  if (r > 0.25) discard;
  float a = vA * (1.0 - smoothstep(0.10, 0.25, r));
  vec3 col = mix(uInk2, uInk, vSide);
  gl_FragColor = vec4(col, a * 0.17);
}
`

export function createField(canvas, opts = {}) {
  const COUNT = opts.count ?? 120000
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' })
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(dpr)

  const scene = new THREE.Scene()
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10)
  cam.position.z = 1

  const seeds = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    seeds[i*3+0] = Math.random()
    seeds[i*3+1] = Math.random()
    seeds[i*3+2] = Math.random()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4)

  const uni = {
    uTime:   { value: 0 },
    uScroll: { value: 0 },
    uAspect: { value: 1 },
    uDpr:    { value: dpr },
    uHandoff:{ value: 0 },
    uInk:    { value: new THREE.Color(0x8F2A16) },
    uInk2:   { value: new THREE.Color(0x2A2621) },
  }
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: uni,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.NormalBlending,
  })
  scene.add(new THREE.Points(geo, mat))

  let w = 0, h = 0, raf = 0, running = false
  function resize() {
    const r = canvas.getBoundingClientRect()
    w = Math.max(1, r.width); h = Math.max(1, r.height)
    renderer.setSize(w, h, false)
    uni.uAspect.value = w / h
    cam.left = -1; cam.right = 1; cam.top = 1; cam.bottom = -1
    cam.updateProjectionMatrix()
  }
  const clock = new THREE.Clock()
  function frame() {
    raf = requestAnimationFrame(frame)
    uni.uTime.value = clock.getElapsedTime()
    renderer.render(scene, cam)
  }
  function start(){ if(!running){ running = true; clock.start(); frame() } }
  function stop(){ running = false; cancelAnimationFrame(raf) }

  window.addEventListener('resize', resize, { passive: true })
  resize()

  return {
    start, stop, resize,
    setScroll(v){ uni.uScroll.value = v },
    handoff(v){ uni.uHandoff.value = v },
    dispose(){ stop(); geo.dispose(); mat.dispose(); renderer.dispose() },
  }
}

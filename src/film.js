import gsap from 'gsap'

/* The footage is his. Two cuts from one jump: the fall with the horizon
   bending, then the canopy over farmland. Everything between them is not
   real, it is a shader.

   Raw WebGL, no three.js: this is one fullscreen quad with two video
   textures, and putting a whole scene graph on the critical path to draw
   a quad costs about 600 KB of JS before the first frame. */

const SHOTS = ['own_01_fall', 'own_02_under']

const VS = `
attribute vec2 p; varying vec2 vUv;
void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`

const FS = `
precision highp float;
uniform sampler2D uA, uB;
uniform vec2  uSrc, uRes;
uniform float uMix, uWarp, uTime, uRefract, uLift, uGrade;
uniform vec3  uPage;
varying vec2 vUv;

float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n2(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*n2(p); p*=2.03; a*=0.5; } return v; }

vec2 cover(vec2 uv){
  float ra = uSrc.x / uSrc.y, rb = uRes.x / uRes.y;
  vec2 s = ra > rb ? vec2(rb / ra, 1.0) : vec2(1.0, ra / rb);
  return (uv - 0.5) * s + 0.5;
}

void main(){
  vec2 uv = vUv;

  float front = fbm(vec2(uv.x * 2.6, uv.y * 1.4 + uTime * 0.05));
  float edge  = smoothstep(0.0, 0.62, uMix * 1.62 - uv.x * 0.42 - front * 0.46);

  vec2 flow = vec2(fbm(uv * 3.1 + uTime * 0.16), fbm(uv * 2.7 - uTime * 0.11)) - 0.5;
  float band = edge * (1.0 - edge) * 4.0;
  vec2 push = flow * uWarp * band;

  vec2 ripple = vec2(sin(uv.y * 34.0 + uTime * 3.1), cos(uv.x * 28.0 - uTime * 2.4)) * 0.006 * uRefract;

  vec3 a = texture2D(uA, cover(uv + push + ripple)).rgb;
  vec3 b = texture2D(uB, cover(uv - push + ripple)).rgb;
  float ca = band * uWarp * 1.6;
  a.r = texture2D(uA, cover(uv + push * (1.0 + ca) + ripple)).r;
  b.b = texture2D(uB, cover(uv - push * (1.0 + ca) + ripple)).b;

  vec3 col = mix(a, b, edge);
  col += vec3(0.72, 0.92, 0.94) * band * uWarp * 1.15;

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum), -0.08 * uGrade);
  col *= mix(1.0, 1.06, uGrade);

  vec2 q = uv - 0.5;
  col *= 1.0 - dot(q, q) * 0.52;

  /* the ending. the image lifts into the page ground, keeping the
     waterline longest, so it meets the rule the hero sits on */
  float horizon = smoothstep(0.0, 0.30, abs(uv.y - 0.545));
  col = mix(col, uPage, clamp(smoothstep(0.0, 1.0, uLift) * (0.35 + 0.65 * horizon), 0.0, 1.0));

  col += (h(gl_FragCoord.xy + uTime * 51.0) - 0.5) * 0.016 * (1.0 - uLift);
  gl_FragColor = vec4(col, 1.0);
}`

function compile(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src); gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
  return s
}

function videoTexture(gl, unit) {
  const t = gl.createTexture()
  /* three.js sets texture.flipY by default. raw WebGL does not, and a
     video frame is top-left origin while GL UV is bottom-left, so without
     this every frame comes in upside down. */
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 20, 26, 255]))
  return t
}

/* The instruments. Brackets snap the frame, the slugs cut in, and the
   timecode and the gauge run off the film's own progress rather than off
   a decorative loop, so what they report is true. */
function instruments(tl, host, dur) {
  const T = host.querySelector('.film-type')
  if (!T) return
  const q = (s) => T.querySelector(s)
  const corners = [...T.querySelectorAll('.ft-corner')]
  const tc = q('.ft-tc')
  const fill = q('.ft-gauge i')

  corners.forEach((c, i) => {
    tl.fromTo(c, { opacity: 0, scale: 0.4 },
      { opacity: 1, scale: 1, duration: 0.30, ease: 'power3.out' }, 0.10 + i * 0.055)
  })
  tl.fromTo(q('.ft-cross'), { opacity: 0, scale: 0.2 },
    { opacity: 1, scale: 1, duration: 0.32, ease: 'power3.out' }, 0.30)

  const cut = (el, at, out) => {
    if (!el) return
    tl.fromTo(el, { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.30, ease: 'power3.out' }, at)
    if (out) tl.to(el, { opacity: 0, duration: 0.24, ease: 'power2.in' }, out)
  }
  cut(q('.ft-slug'), 0.42)
  cut(q('.ft-reel'), 0.62)
  cut(q('.ft-meta'), 0.86)
  tl.fromTo(q('.ft-gauge'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.62)

  /* both of these are properties of the film, so they cannot be wrong */
  const clock = { t: 0 }
  tl.to(clock, {
    t: dur, duration: dur, ease: 'none',
    onUpdate() {
      if (!tc) return
      const s = clock.t
      const f = Math.floor((s % 1) * 24)
      tc.textContent = '00:00:' + String(Math.floor(s)).padStart(2, '0') + ':' + String(f).padStart(2, '0')
      if (fill) fill.style.width = ((s / dur) * 100).toFixed(2) + '%'
    },
  }, 0)

  /* everything leaves before the image lifts, so the page is not handed a
     frame with furniture still on it */
  tl.to([...corners, q('.ft-cross'), q('.ft-slug'), q('.ft-reel'), q('.ft-meta'), q('.ft-gauge')],
    { opacity: 0, duration: 0.36, ease: 'power2.in' }, 2.62)
}

export function createFilm(host, { onDone, onSettle, onHandover, quality = '4k', hold = false } = {}) {
  const suffix = quality === '4k' ? '' : '_720'
  const canvas = document.createElement('canvas')
  canvas.className = 'film-cv'
  host.appendChild(canvas)

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
  if (!gl) { onSettle?.(); onHandover?.(); onDone?.(); return { timeline: gsap.timeline(), skip(){}, dispose(){} } }

  const prog = gl.createProgram()
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS))
  gl.linkProgram(prog); gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const U = (n) => gl.getUniformLocation(prog, n)
  const u = {
    uA: U('uA'), uB: U('uB'), uSrc: U('uSrc'), uRes: U('uRes'),
    uMix: U('uMix'), uWarp: U('uWarp'), uTime: U('uTime'),
    uRefract: U('uRefract'), uLift: U('uLift'), uGrade: U('uGrade'), uPage: U('uPage'),
  }
  gl.uniform1i(u.uA, 0); gl.uniform1i(u.uB, 1)
  gl.uniform3f(u.uPage, 0.980, 0.980, 0.980)
  gl.uniform2f(u.uSrc, 1920, 1080)

  const vids = SHOTS.map((id) => {
    const v = document.createElement('video')
    v.src = `/film/${id}${suffix}.mp4`
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.loop = true
    v.setAttribute('aria-hidden', 'true')
    return v
  })
  const texes = vids.map((_, i) => videoTexture(gl, i))

  const dpr = Math.min(devicePixelRatio || 1, 2)
  function resize() {
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr)
    canvas.width = w; canvas.height = h
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px'
    gl.viewport(0, 0, w, h)
    gl.uniform2f(u.uRes, w, h)
  }
  addEventListener('resize', resize, { passive: true }); resize()

  const S = { mix: 0, warp: 0, refract: 0, lift: 0, grade: 0 }
  const t0 = performance.now()
  let raf = 0, dead = false

  function frame() {
    if (dead) return
    raf = requestAnimationFrame(frame)
    vids.forEach((v, i) => {
      if (v.readyState >= 2) {
        gl.activeTexture(gl.TEXTURE0 + i)
        gl.bindTexture(gl.TEXTURE_2D, texes[i])
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v)
      }
    })
    gl.uniform1f(u.uTime, (performance.now() - t0) / 1000)
    gl.uniform1f(u.uMix, S.mix); gl.uniform1f(u.uWarp, S.warp)
    gl.uniform1f(u.uRefract, S.refract); gl.uniform1f(u.uLift, S.lift)
    gl.uniform1f(u.uGrade, S.grade)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  frame()

  const ready = new Promise((res) => {
    let n = 0
    const done = () => { if (++n >= 2) res() }
    vids.forEach((v) => v.readyState >= 3 ? done() : v.addEventListener('canplay', done, { once: true }))
    setTimeout(res, 4000)
  })

  const tl = gsap.timeline({ paused: true, onComplete: () => onDone?.() })

  tl.call(() => vids[0].play().catch(() => {}), null, 0)
    .to(S, { grade: 1, duration: 1.4, ease: 'none' }, 0)

  tl.call(() => vids[1].play().catch(() => {}), null, 0.9)
    .to(S, { refract: 1,    duration: 0.26, ease: 'power2.in' }, 1.05)
    .to(S, { warp: 0.24,    duration: 0.34, ease: 'power2.in' }, 1.05)
    .to(S, { mix: 1,        duration: 1.00, ease: 'power2.inOut' }, 1.10)
    .to(S, { warp: 0,       duration: 0.62, ease: 'power2.out' }, 1.58)
    .to(S, { refract: 0,    duration: 0.95, ease: 'power2.out' }, 1.58)

  instruments(tl, host, 4.30)

  /* The ending used to take the image all the way to paper and then fade a
     white rectangle off the top of the page, which is two dissolves in a row
     and reads as a cut. It does not go to paper any more. The lift stops at
     0.68, which is about where the hero's own scrim already sits over its
     footage, and from there the canvas cross dissolves into the hero. Both
     layers are film with the page closing in at the edges at that moment, so
     what the eye follows is one image continuing rather than a white flash
     between two of them. The build starts inside the dissolve on purpose:
     the top bar and the first line land while the footage is still there.

     The lift itself is two seconds and change. Cutting it to a second and a
     third to make room for the dissolve made the whole ending feel rushed,
     so the dissolve was moved later instead of the lift being made shorter. */
  tl.call(() => onSettle?.(), null, 2.55)
    .to(S, { lift: 0.76, duration: 2.10, ease: 'power2.inOut' }, 2.70)
    .to(host.querySelector('.film-type'), { opacity: 0, duration: 0.4, ease: 'power2.in' }, 2.70)
    .call(() => onHandover?.(), null, 4.25)
    .to(canvas, { opacity: 0, duration: 1.20, ease: 'power2.inOut' }, 4.25)
    .set({}, {}, 5.55)

  /* `hold` is the dev inspector: without it the ready promise would
     immediately override an external pause */
  ready.then(() => { if (!hold) tl.play() })

  return {
    timeline: tl,
    /* what the last frame looked like, so the background layer can pick
       the camera up instead of the film simply ending */
    handoff() {
      return {
        horizon: 0.545,          // where the waterline sat in the frame
        page: [0.980, 0.980, 0.980],
        lift: S.lift,
      }
    },
    skip() { tl.progress(1) },
    dispose() {
      dead = true
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      tl.kill()
      vids.forEach((v) => { v.pause(); v.removeAttribute('src'); v.load() })
      texes.forEach((t) => gl.deleteTexture(t))
      gl.deleteProgram(prog); gl.deleteBuffer(buf)
      canvas.remove()
    },
  }
}

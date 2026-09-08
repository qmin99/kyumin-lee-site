import * as THREE from 'three'

/* The seam between 03 and 05, seen from a deck at dusk.
   The sky is the page's own paper, warming toward the line. The sea is a
   real surface: each pixel casts a ray from an eye at deck height onto the
   water plane, a height field of sharp crested waves gives that point its
   normal, Fresnel mixes the reflected sky into the deep blue, and the low
   sun's specular lobe is the glitter path down the strait. The black rock
   island and the stack are lit surfaces too, their normals built from the
   silhouette's slope and a field of faces and strata, with surf breaking
   at their feet. The foot goes down through navy into 05's ground, with
   05's crimson glow reaching up to meet it. uNight follows the page's
   inverted state. */

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`

const FRAG = /* glsl */`
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform float uScroll;
uniform float uNight;
varying vec2 vUv;

const vec3 PAPER = vec3(0.980, 0.980, 0.980);
const vec3 NIGHT = vec3(0.043, 0.047, 0.047);

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * n2(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; } return v; }

const vec3 SUN   = vec3(1.00, 0.62, 0.34);   /* the low sun's light */
const vec3 SUNW  = vec3(0.690, 0.290, 0.094); /* the site's sun, for the haze */
const vec3 BLUE0 = vec3(0.36, 0.60, 0.86);   /* far water under haze */
const vec3 BLUE1 = vec3(0.05, 0.25, 0.58);   /* the body of the sea */
const vec3 BLUE2 = vec3(0.02, 0.08, 0.24);   /* looking straight down */
const vec3 CRIM  = vec3(0.784, 0.063, 0.180); /* 05's crimson, for the foot */
const float H = 0.55;
const float CAMH = 1.6;

/* ── the sky, by elevation above the line (0 at the line) ─────────── */
vec3 skyAt(float el, float x, float ar, vec3 paper, float t){
  vec3 lo = mix(paper, SUNW, 0.16);
  vec3 c = mix(lo, paper, smoothstep(0.0, 0.42, el));
  /* the afterglow sits over the sun, low and warm */
  float glow = exp(-abs(x - 0.5) * ar * 1.4) * exp(-el * 9.0);
  c = mix(c, mix(paper, SUN, 0.42), glow * 0.55);
  float cl = fbm(vec2(x * ar * 1.3 + t * 0.04, el * 5.0 + 3.0));
  c = mix(c, mix(paper, SUNW, 0.05), cl * 0.45 * smoothstep(0.5, 0.0, el));
  return c;
}

/* ── the sea surface: a height field of sharp crested waves ────────── */
float crestOct(vec2 p){
  p += (vec2(n2(p * 0.7), n2(p * 0.7 + 7.3)) - 0.5) * 1.6;
  float w = 1.0 - abs(sin(p.y + n2(p) * 1.4));
  return pow(w, 2.4);
}
float seaH(vec2 p, float t){
  float h = 0.0, a = 0.55, f = 0.30;
  mat2 R = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++){
    h += a * (crestOct(p * f + vec2(0.0, t * 1.4)) + 0.8 * crestOct((p * f) * R - vec2(t * 0.9, t * 0.3)));
    p = R * p; f *= 1.9; a *= 0.38;
  }
  return h;
}
vec3 seaN(vec2 p, float t, float e){
  float hx = seaH(p + vec2(e, 0.0), t) - seaH(p - vec2(e, 0.0), t);
  float hz = seaH(p + vec2(0.0, e), t) - seaH(p - vec2(0.0, e), t);
  return normalize(vec3(-hx, 2.0 * e * 2.6, -hz));
}

/* ── the rocks ─────────────────────────────────────────────────────── */
float bump(float x, float cx, float w, float a, float k){ float u = abs(x - cx) / w; return a * exp(-pow(u, k)); }
float ridged(float x, float f){ return 1.0 - abs(2.0 * fbm(vec2(x * f, 4.2)) - 1.0); }
float rockA(float x){
  float h = bump(x, 0.27, 0.20, 0.36, 2.3) + bump(x, 0.19, 0.07, 0.10, 1.6) + bump(x, 0.36, 0.06, 0.08, 1.8) + bump(x, 0.11, 0.05, 0.06, 2.0);
  float m = smoothstep(0.0, 0.05, h);
  h += (ridged(x, 18.0) - 0.5) * 0.07 * m + (fbm(vec2(x * 70.0, 9.0)) - 0.5) * 0.03 * m + (fbm(vec2(x * 160.0, 1.0)) - 0.5) * 0.012 * m;
  return max(h, 0.0) * 0.74;
}
float rockB(float x){
  float h = bump(x, 0.78, 0.05, 0.13, 2.6) + bump(x, 0.83, 0.03, 0.06, 2.0);
  float m = smoothstep(0.0, 0.02, h);
  h += (ridged(x, 40.0) - 0.5) * 0.03 * m + (fbm(vec2(x * 160.0, 5.0)) - 0.5) * 0.01 * m;
  return max(h, 0.0);
}
/* the stone as a lit surface: a normal built from the silhouette's slope, the
   distance under the ridge, and a bumped field of faces and strata; then a
   low warm sun from the strait, a cool sky from above, and the haze of distance */
float rockField(vec2 rp){
  vec2 w = vec2(fbm(rp * 6.0), fbm(rp * 6.0 + 11.0)) - 0.5;
  float faces  = fbm(rp * 3.0 + w * 0.8);
  float strata = 0.5 + 0.5 * sin((rp.y * 60.0 + rp.x * 9.0) + w.x * 10.0 + faces * 5.0);
  float crag   = fbm(rp * 12.0 + w * 1.4);
  return faces * 0.55 + smoothstep(0.55, 0.75, strata) * 0.12 + crag * 0.33;
}
vec3 rock(vec2 uv, float top, float slope, float ar, vec3 hazeC, float distFade, float sunSide){
  float yy = uv.y - H;
  float edge = top - uv.y;
  vec2 rp = vec2(uv.x * ar, uv.y);
  /* bump normal from the field */
  float e = 0.0025;
  float f0 = rockField(rp);
  float fx = rockField(rp + vec2(e, 0.0)) - rockField(rp - vec2(e, 0.0));
  float fy = rockField(rp + vec2(0.0, e)) - rockField(rp - vec2(0.0, e));
  /* the big form: the flank faces where the silhouette slopes, the top faces up */
  float upness = smoothstep(0.08, 0.0, edge) * 0.8;
  vec3 n = normalize(vec3(-fx * 7.0 + slope * 0.9, fy * 7.0 + upness + 0.25, 1.0));
  vec3 L = normalize(vec3(sunSide * 0.85, 0.16, 0.5));
  float sun = max(dot(n, L), 0.0);
  float sky = 0.5 + 0.5 * n.y;
  float ao = smoothstep(0.0, 0.5, f0) * 0.5 + 0.5;
  vec3 stone = mix(vec3(0.045, 0.047, 0.050), vec3(0.42, 0.43, 0.44), clamp(f0 * 1.2 - 0.2, 0.0, 1.0));
  vec3 c = stone * (0.12 + 0.78 * sky * ao) * vec3(0.84, 0.90, 1.0);
  c += stone * mix(SUN, vec3(1.0), 0.55) * sun * 0.55 * ao;
  float crack = smoothstep(0.64, 0.74, n2(vec2(uv.x * ar * 110.0 + fx * 30.0, uv.y * 60.0 + fy * 20.0)));
  c *= 1.0 - crack * 0.35;
  c = mix(c, vec3(0.03, 0.032, 0.036), smoothstep(0.05, 0.0, yy));     /* wet at the waterline */
  /* the very edge is not lit from behind by the sky: a hair of dark, then the haze wins with distance */
  c *= 1.0 - smoothstep(0.004, 0.0, edge) * 0.35;
  return mix(c, hazeC, distFade);
}

void main(){
  vec2 uv = vUv;
  float t  = uTime * 0.22;
  float ar = uRes.x / max(uRes.y, 1.0);
  vec3 paper = mix(PAPER, NIGHT, uNight);

  /* ── sky ── */
  vec3 sky = skyAt(max(uv.y - H, 0.0), uv.x, ar, paper, t);

  /* ── sea: a ray from a deck-height eye meets the plane; that point is shaded ── */
  float d = max(H - uv.y, 0.0);
  float dist = CAMH / max(d * 1.55, 0.012);
  float wx = (uv.x - 0.5) * ar * dist * 0.85;
  vec2 wp = vec2(wx, dist);
  float far = smoothstep(4.0, 45.0, dist);
  float eps = 0.02 + dist * 0.012;
  vec3 n = seaN(wp, t * 1.6, eps);
  /* capillary ripple and sparkle, only where it can still be resolved */
  vec2 rip = (vec2(n2(wp * 9.0 + t * 6.0), n2(wp * 9.0 + 31.0 - t * 5.0)) - 0.5) * 0.22 * (1.0 - far);
  n = normalize(vec3(n.x + rip.x, n.y, n.z + rip.y));
  n = normalize(mix(n, vec3(0.0, 1.0, 0.0), far * 0.96));
  vec3 V = normalize(vec3(-wx, CAMH, -dist));
  vec3 Ls = normalize(vec3(0.0, 0.07, 1.0));
  float ndv = max(dot(n, V), 0.0);
  float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
  vec3 refl = reflect(-V, n);
  vec3 skyRef = skyAt(max(refl.y, 0.0) * 0.9, uv.x + refl.x * 0.15, ar, paper, t);
  skyRef = mix(skyRef, skyRef * 0.55 + vec3(0.02, 0.03, 0.05), uNight);
  /* the body: deep blue underfoot, lighter and hazier with distance */
  vec3 body = mix(BLUE2, BLUE1, smoothstep(0.0, 0.35, ndv));
  body = mix(body, BLUE0, smoothstep(2.0, 60.0, dist) * 0.55);
  vec3 sea = mix(body, skyRef * vec3(0.78, 0.86, 1.0), clamp(fres * 0.85, 0.0, 0.85));
  /* the sun on the water: a specular lobe, which is the glitter path */
  vec3 Hv = normalize(Ls + V);
  float spec = pow(max(dot(n, Hv), 0.0), 260.0) * 1.5 + pow(max(dot(n, Hv), 0.0), 70.0) * 0.05;
  sea += SUN * spec * (1.0 - far * 0.6) * smoothstep(1.5, 9.0, dist);
  sea *= mix(1.0, 0.55, uNight);
  /* haze eats the far water into the line */
  vec3 hazeC = mix(paper, SUNW, 0.18);
  vec3 farBlue = BLUE0 * mix(1.0, 0.28, uNight);
  sea = mix(sea, mix(hazeC, farBlue, 0.4), smoothstep(30.0, 130.0, dist) * 0.55);

  /* ── rocks ── */
  float xs = 0.5 + (uv.x - 0.5) * mix(1.0, ar / 2.85, 0.5);
  float e = 0.004;
  float hA = rockA(xs), hB = rockB(xs);
  float sA = (rockA(xs - e) - rockA(xs + e)) / (2.0 * e) * 0.08;
  float sB = (rockB(xs + e) - rockB(xs - e)) / (2.0 * e) * 0.08;
  float aboveH = step(H, uv.y);
  float mA = (1.0 - smoothstep(-0.0012, 0.0012, uv.y - (H + hA))) * aboveH;
  float mB = (1.0 - smoothstep(-0.0012, 0.0012, uv.y - (H + hB))) * aboveH;
  vec3 col = mix(sea, sky, smoothstep(H - 0.0015, H + 0.0015, uv.y));
  col = mix(col, rock(uv, H + hB, sB, ar, hazeC, 0.34, -1.0), mB);
  col = mix(col, rock(uv, H + hA, sA, ar, hazeC, 0.07, 1.0), mA);

  /* ── the rocks in the water: a darkened reflection torn by the waves, and surf at their feet ── */
  float ry = H - uv.y;
  float wob = (n2(vec2(uv.x * 36.0, uv.y * 80.0 + t * 3.0)) - 0.5) * 0.035 + n.x * 0.05;
  float rdepth = mix(0.45, 0.85, smoothstep(1.0, 2.2, ar));
  float tA = rockA(xs + wob) * rdepth, tB = rockB(xs + wob) * rdepth;
  float rA = (1.0 - smoothstep(tA - 0.012, tA, ry)) * (1.0 - smoothstep(0.0, max(tA, 0.001), ry) * 0.55);
  float rB = (1.0 - smoothstep(tB - 0.008, tB, ry)) * (1.0 - smoothstep(0.0, max(tB, 0.001), ry) * 0.55);
  float below = step(0.0001, d);
  float tear = smoothstep(0.35, 0.75, n.y);
  col = mix(col, col * vec3(0.30, 0.34, 0.42), (rA * 0.85 + rB * 0.55) * tear * below * smoothstep(0.0, 0.006, ry));
  float footA = smoothstep(0.02, 0.07, rockA(xs)), footB = smoothstep(0.015, 0.05, rockB(xs));
  float surfN = fbm(vec2(uv.x * ar * 60.0 + t * 4.0, ry * 300.0)) * 0.7 + n2(vec2(uv.x * ar * 220.0 - t * 25.0, ry * 500.0)) * 0.5;
  float surf = (footA + footB * 0.6) * exp(-ry * 170.0) * below * smoothstep(0.62, 0.95, surfN);
  col = mix(col, vec3(0.90, 0.93, 0.96), clamp(surf, 0.0, 1.0) * 0.38);

  /* ── the line: a hair of light where sea meets sky, not under a rock ── */
  float land = max(mA, mB);
  float line = 1.0 - smoothstep(0.0, 0.003, abs(uv.y - H));
  col += mix(paper, SUN, 0.5) * line * 0.22 * (1.0 - land);

  /* ── the foot: the sea goes dark, and 05's crimson glow reaches up from below ── */
  vec3 ground = vec3(0.106, 0.110, 0.078);
  float foot = smoothstep(0.30, 0.0, uv.y);
  col = mix(col, vec3(0.015, 0.03, 0.07), foot * 0.72);
  col = mix(col, ground, pow(foot, 2.6));
  float crim = exp(-abs(uv.x - 0.5) * ar * 1.0) * smoothstep(0.20, 0.0, uv.y);
  col = mix(col, CRIM, crim * 0.18);
  col += (hash(gl_FragCoord.xy + uTime * 37.0) - 0.5) * 0.02;
  gl_FragColor = vec4(col, 1.0);
}`

export function createWater(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
  const dpr = Math.min(devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(dpr)
  const scene = new THREE.Scene()
  const cam = new THREE.Camera()
  const uni = {
    uRes:    { value: new THREE.Vector2(1, 1) },
    uTime:   { value: 0 },
    uScroll: { value: 0 },
    uNight:  { value: 0 },
  }
  scene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uni, depthTest: false }),
  ))

  function resize() {
    const r = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(r.width))
    const h = Math.max(1, Math.round(r.height))
    renderer.setSize(w, h, false)
    uni.uRes.value.set(w * dpr, h * dpr)
  }
  addEventListener('resize', resize, { passive: true })
  resize()

  /* the page's dark state arrives as a class on <html>; the sky follows it
     over about a second, in step with the body's own colour transition */
  const root = document.documentElement
  let night = root.classList.contains('inverted') ? 1 : 0
  const mo = new MutationObserver(() => { night = root.classList.contains('inverted') ? 1 : 0 })
  mo.observe(root, { attributes: true, attributeFilter: ['class'] })

  const clock = new THREE.Clock()
  let raf = 0, running = false
  function frame() {
    raf = requestAnimationFrame(frame)
    uni.uTime.value = clock.getElapsedTime()
    uni.uNight.value += (night - uni.uNight.value) * 0.06
    renderer.render(scene, cam)
  }
  function start() { if (!running) { running = true; frame() } }
  function stop() { running = false; cancelAnimationFrame(raf) }

  return {
    start, stop, resize,
    setScroll(v) { uni.uScroll.value = v },
    dispose() { stop(); mo.disconnect(); removeEventListener('resize', resize); renderer.dispose() },
  }
}

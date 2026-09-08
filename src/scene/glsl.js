/* shared glsl chunks. everything here is written for this project.
   no third party shader code, no shadertoy, no lygia. */

export const NOISE = /* glsl */`
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm3(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++){ v += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

float fbm5(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
`

/* five directional gerstner-ish waves. cheap, analytic, gives a clean
   tangent frame without four extra fbm taps. */
export const RIPPLE = /* glsl */`
vec3 rippleNormal(vec2 p, float t, float amp){
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec2 d0 = vec2( 0.940,  0.342); float f0 = 0.62, s0 = 1.35, a0 = 0.055;
  vec2 d1 = vec2(-0.500,  0.866); float f1 = 0.97, s1 = 1.72, a1 = 0.040;
  vec2 d2 = vec2( 0.259, -0.966); float f2 = 1.61, s2 = 2.31, a2 = 0.026;
  vec2 d3 = vec2(-0.866, -0.500); float f3 = 2.74, s3 = 3.05, a3 = 0.015;
  vec2 d4 = vec2( 0.707,  0.707); float f4 = 4.51, s4 = 4.10, a4 = 0.009;
  n.xz -= d0 * (a0 * f0 * cos(dot(d0, p) * f0 + t * s0));
  n.xz -= d1 * (a1 * f1 * cos(dot(d1, p) * f1 + t * s1));
  n.xz -= d2 * (a2 * f2 * cos(dot(d2, p) * f2 + t * s2));
  n.xz -= d3 * (a3 * f3 * cos(dot(d3, p) * f3 + t * s3));
  n.xz -= d4 * (a4 * f4 * cos(dot(d4, p) * f4 + t * s4));
  n.xz *= amp;
  return normalize(n);
}

float rippleHeight(vec2 p, float t){
  float v = 0.0;
  v += 0.055 * sin(dot(vec2( 0.940,  0.342), p) * 0.62 + t * 1.35);
  v += 0.040 * sin(dot(vec2(-0.500,  0.866), p) * 0.97 + t * 1.72);
  v += 0.026 * sin(dot(vec2( 0.259, -0.966), p) * 1.61 + t * 2.31);
  v += 0.015 * sin(dot(vec2(-0.866, -0.500), p) * 2.74 + t * 3.05);
  return v;
}
`

/* the underwater volume. shared by the dome and by the underside of the
   surface so the fog and the far volume are the same colour by
   construction and the seam is invisible. */
export const VOLUME = /* glsl */`
uniform vec3  uShallow;
uniform vec3  uDeepC;
uniform vec3  uSunUW;
uniform float uShaft;
uniform float uVolTime;
uniform float uCamDepth;

vec3 volumeColor(vec3 d){
  float up = clamp(d.y, -1.0, 1.0);
  vec3 c = mix(uDeepC, uShallow, smoothstep(-0.70, 0.92, up));
  c *= mix(0.30, 1.0, exp(-uCamDepth * 0.020));
  float az    = atan(d.z, d.x);
  float sunAz = atan(uSunUW.z, uSunUW.x);
  float toward = pow(max(0.0, cos(az - sunAz)), 2.2);
  float band  = fbm3(vec2(az * 4.6 + uVolTime * 0.06, up * 2.2 - uVolTime * 0.045));
  float band2 = fbm3(vec2(az * 11.0 - uVolTime * 0.10, up * 3.6 + uVolTime * 0.03));
  float shaft = pow(smoothstep(0.44, 0.96, band), 2.0) * 0.75
              + pow(smoothstep(0.52, 0.99, band2), 3.0) * 0.45;
  shaft *= toward * smoothstep(-0.20, 0.95, up);
  c += vec3(0.58, 0.95, 0.93) * shaft * uShaft;
  return c;
}
`

/* worley cell noise. the caustic filaments come from F2-F1, the cell
   boundary. F1 alone gives fat blobs, which is the classic tell of a
   fake caustic. */
export const WORLEY = /* glsl */`
vec2 wh2(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float causticNet(vec2 uv, float t){
  float f1 = 1e9, f2 = 1e9;
  vec2 b = floor(uv);
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      vec2 g = b + vec2(float(x), float(y));
      vec2 o = wh2(g);
      o = 0.5 + 0.5 * sin(t * 1.2 + 6.2831 * o);
      float d = length(g + o - uv);
      if (d < f1){ f2 = f1; f1 = d; } else if (d < f2){ f2 = d; }
    }
  }
  return 1.0 - smoothstep(0.0, 0.30, f2 - f1);
}
`

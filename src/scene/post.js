import * as THREE from 'three'
import {
  EffectComposer, RenderPass, EffectPass, Effect, BlendFunction,
  BloomEffect, GodRaysEffect, ChromaticAberrationEffect, VignetteEffect,
  NoiseEffect, ToneMappingEffect, ToneMappingMode, SMAAEffect, KernelSize,
} from 'postprocessing'

/* -- exposure. sits in front of the tone mapper so the whole altitude
      arc, night to noon, is one number ------------------------------ */
const EXPOSURE_FRAG = /* glsl */`
uniform float exposure;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
}`

class ExposureEffect extends Effect {
  constructor(value = 1) {
    super('ExposureEffect', EXPOSURE_FRAG, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map([['exposure', new THREE.Uniform(value)]]),
    })
  }
  get exposure() { return this.uniforms.get('exposure') }
}

/* -- radial motion blur. neither postprocessing nor the three addons
      ship a motion blur, and realism-effects does not run on r180. the
      fall is forward linear motion, so a radial smear about the
      vanishing point is the physically right approximation. ---------- */
const RADIAL_FRAG = /* glsl */`
uniform float strength;
uniform vec2  center;
uniform float samples;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  if (strength < 0.0015) { outputColor = inputColor; return; }
  vec2 dir = uv - center;
  vec4 acc = vec4(0.0);
  float total = 0.0;
  for (float i = 0.0; i < 18.0; i += 1.0){
    if (i >= samples) break;
    float t = i / max(samples - 1.0, 1.0);
    vec2 suv = center + dir * (1.0 - strength * t);
    float w = 1.0 - t * 0.62;
    acc += texture2D(inputBuffer, suv) * w;
    total += w;
  }
  outputColor = acc / total;
}`

class RadialBlurEffect extends Effect {
  constructor() {
    super('RadialBlurEffect', RADIAL_FRAG, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map([
        ['strength', new THREE.Uniform(0)],
        ['center', new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ['samples', new THREE.Uniform(1)],
      ]),
    })
  }
  set(strength, cx, cy) {
    this.uniforms.get('strength').value = strength
    this.uniforms.get('center').value.set(cx, cy)
    this.uniforms.get('samples').value = strength > 0.0015 ? 16 : 1
  }
}

/* -- lens. impact flash, water on the glass at the breach, and the final
      fill to paper. last in the chain so the closing frame is exact --- */
const LENS_FRAG = /* glsl */`
uniform float flash;
uniform float paper;
uniform float drops;
uniform vec3  paperColor;
uniform vec3  flashColor;

float dh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void mainUv(inout vec2 uv){
  if (drops > 0.0015) {
    vec2 g  = uv * vec2(8.0, 5.0);
    vec2 id = floor(g);
    vec2 f  = fract(g) - 0.5;
    float r = dh(id);
    vec2 off = vec2(dh(id + 7.1), dh(id + 3.3)) - 0.5;
    vec2 q = (f - off * 0.62) * vec2(1.0, 1.4);
    float d = length(q);
    float rad = 0.09 + r * 0.24;
    float m = smoothstep(rad, rad * 0.18, d) * step(0.40, r);
    uv += normalize(q + 1e-5) * m * 0.040 * drops;
  }
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec3 c = inputColor.rgb;
  c = mix(c, flashColor, clamp(flash, 0.0, 1.0));
  c = mix(c, paperColor, clamp(paper, 0.0, 1.0));
  outputColor = vec4(c, inputColor.a);
}`

class LensEffect extends Effect {
  constructor() {
    super('LensEffect', LENS_FRAG, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map([
        ['flash', new THREE.Uniform(0)],
        ['paper', new THREE.Uniform(0)],
        ['drops', new THREE.Uniform(0)],
        ['paperColor', new THREE.Uniform(new THREE.Color(0xfafafa))],
        ['flashColor', new THREE.Uniform(new THREE.Color(0xfdf7ec))],
      ]),
    })
  }
  u(n) { return this.uniforms.get(n) }
}

export function createPost(renderer, scene, camera, { mobile = false, sun } = {}) {
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: 0,  // SMAA is already in the chain, MSAA on top is redundant
  })
  composer.addPass(new RenderPass(scene, camera))

  const exposure = new ExposureEffect(0.42)

  const godRays = new GodRaysEffect(camera, sun, {
    blendFunction: BlendFunction.SCREEN,
    samples: mobile ? 24 : 44,
    density: 0.965,
    decay: 0.915,
    weight: 0.50,
    exposure: 0.50,
    clampMax: 1.0,
    resolutionScale: mobile ? 0.35 : 0.5,
    blur: true,
    kernelSize: KernelSize.SMALL,
  })
  godRays.blendMode.opacity.value = 0.0
  composer.addPass(new EffectPass(camera, exposure, godRays))

  // its own pass: it samples inputBuffer directly, so it must see the
  // pass input rather than a partially composited colour
  const radial = new RadialBlurEffect()
  composer.addPass(new EffectPass(camera, radial))

  let smaa = null
  if (!mobile) {
    smaa = new SMAAEffect()
    composer.addPass(new EffectPass(camera, smaa))
  }

  const bloom = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    mipmapBlur: true,
    luminanceThreshold: 0.58,
    luminanceSmoothing: 0.26,
    intensity: 1.15,
    radius: 0.72,
  })

  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })

  const ca = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0.0006, 0.0006),
    radialModulation: true,
    modulationOffset: 0.28,
  })

  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 })

  const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true })
  noise.blendMode.opacity.value = 0.08

  const lens = new LensEffect()

  composer.addPass(new EffectPass(camera, bloom, tone, ca, vignette, noise))
  // the lens warps uv, which cannot share a pass with a convolution effect
  composer.addPass(new EffectPass(camera, lens))

  return {
    composer, exposure, godRays, radial, bloom, tone, ca, vignette, noise, lens, smaa,
    setSize(w, h) { composer.setSize(w, h) },
    render(dt) { composer.render(dt) },
    dispose() { composer.dispose() },
  }
}

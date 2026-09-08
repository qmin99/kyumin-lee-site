import * as THREE from 'three'

/* Water.js needs a tiling tangent space normal map. three does not ship
   its example textures in the npm package and every ready made one is
   licence encumbered, so we synthesise a seamless one on a canvas at
   boot. 256px, four octaves, ~4ms. */

function hashP(x, y, per) {
  x = ((x % per) + per) % per
  y = ((y % per) + per) % per
  let n = (x * 374761393 + y * 668265263) | 0
  n = (n ^ (n >>> 13)) | 0
  n = Math.imul(n, 1274126177) | 0
  n = (n ^ (n >>> 16)) >>> 0
  return n / 4294967295
}

function valueTile(u, v, per) {
  const x = u * per, y = v * per
  const xi = Math.floor(x), yi = Math.floor(y)
  let fx = x - xi, fy = y - yi
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  const a = hashP(xi, yi, per)
  const b = hashP(xi + 1, yi, per)
  const c = hashP(xi, yi + 1, per)
  const d = hashP(xi + 1, yi + 1, per)
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy
}

function height(u, v) {
  return 0.50 * valueTile(u, v, 4) +
         0.26 * valueTile(u, v, 9) +
         0.14 * valueTile(u, v, 19) +
         0.07 * valueTile(u, v, 37)
}

export function makeWaterNormals(size = 256) {
  const N = size
  const H = new Float32Array(N * N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) H[y * N + x] = height(x / N, y / N)
  }
  const data = new Uint8Array(N * N * 4)
  const S = 13.0 // gradient to slope strength
  for (let y = 0; y < N; y++) {
    const yp = ((y + 1) % N) * N, ym = ((y - 1 + N) % N) * N, yc = y * N
    for (let x = 0; x < N; x++) {
      const xp = (x + 1) % N, xm = (x - 1 + N) % N
      const dx = (H[yc + xp] - H[yc + xm]) * S
      const dy = (H[yp + x] - H[ym + x]) * S
      // tangent space normal, +z up
      let nx = -dx, ny = -dy, nz = 1.0
      const l = Math.hypot(nx, ny, nz) || 1
      nx /= l; ny /= l; nz /= l
      const i = (y * N + x) * 4
      data[i] = (nx * 0.5 + 0.5) * 255
      data[i + 1] = (ny * 0.5 + 0.5) * 255
      data[i + 2] = (nz * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

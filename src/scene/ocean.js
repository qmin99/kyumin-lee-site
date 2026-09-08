import * as THREE from 'three'
import { Water } from 'three/addons/objects/Water.js'
import { makeWaterNormals } from './textures.js'

/* three's Water: planar reflection of the sky dome plus a scrolling
   normal map. the reflection is what makes the horizon read as real. */

export function createOcean(scene, { mobile = false } = {}) {
  const normals = makeWaterNormals(mobile ? 256 : 1024)
  const geo = new THREE.PlaneGeometry(40000, 40000)
  const water = new Water(geo, {
    textureWidth: mobile ? 512 : 1024,
    textureHeight: mobile ? 512 : 1024,
    waterNormals: normals,
    sunDirection: new THREE.Vector3(0, 1, 0),
    sunColor: 0xffdcab,
    waterColor: 0x07323c,
    distortionScale: 2.6,
    fog: true,
    alpha: 1.0,
  })
  water.rotation.x = -Math.PI / 2
  water.renderOrder = -100
  scene.add(water)

  const u = water.material.uniforms
  u.size.value = 1.7

  return {
    water,
    setSun(dir, color) {
      u.sunDirection.value.copy(dir).normalize()
      u.sunColor.value.copy(color)
    },
    set(k, v) { if (u[k]) u[k].value = v },
    update(dt) { u.time.value += dt },
    dispose() {
      geo.dispose(); water.material.dispose(); normals.dispose()
    },
  }
}

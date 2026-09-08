import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

/* Interaction layer. Every constant here is a measured value from a
   published implementation, not a guess. Sources noted per block. */

/* ------------------------------------------------------------------
   1. scroll velocity skew
   GreenSock, codepen eYpGLYL. clamp(-20,20), decay 0.8 / power3, and
   the "only if more severe" guard, which is what stops the decay tween
   being restarted with a smaller value while it is still running.

   Lenis reports velocity in px per FRAME, not px per second, so the
   canonical -300 divisor does not transfer. Verified against
   lenis 1.3.11 dist/lenis.mjs: velocity = animatedScroll - lastScroll.
   ------------------------------------------------------------------ */
/* The scroll velocity skew has been removed.

   It tilted every marked block by up to nine degrees in the direction of
   travel and relaxed back over 0.8s. Two problems, and the second is why it
   is gone rather than fixed. It never settled during a continuous scroll:
   the decay tween is created with overwrite:true, so each new scroll event
   killed the previous one before its onComplete could run, and a block that
   had been read long ago was still hanging over to the left the whole way
   down the page. And it is a page wide effect that fights every arrival
   animation underneath it, because both are writing transform on the same
   element. The arrivals are the ones worth keeping.

   initVelocitySkew is kept as a no op so mountInteractions does not have to
   change shape, and so that removing it is one line rather than a hunt. */
export function initVelocitySkew() {}

/* ------------------------------------------------------------------
   2. magnetic elements
   GSAP demo azmKBBJ. shell 0.4, inner label 0.24, follow power2.out at
   0.4, release elastic.out(1, 0.4) at 0.7. overwrite:true is required,
   otherwise a stale move tween reclaims x/y after the release finishes
   and the element snaps.
   ------------------------------------------------------------------ */
export function initMagnetic(selector = '[data-magnetic]') {
  if (matchMedia('(hover: none)').matches) return
  document.querySelectorAll(selector).forEach((zone) => {
    const btn = zone.querySelector('[data-magnetic-target]') || zone
    const label = zone.querySelector('[data-magnetic-label]')
    const strength = parseFloat(zone.dataset.magnetic) || 0.4
    const labelStrength = strength * 0.6

    zone.addEventListener('mousemove', (e) => {
      const r = zone.getBoundingClientRect()
      const mx = gsap.utils.mapRange(r.left, r.right, -r.width / 2, r.width / 2, e.clientX)
      const my = gsap.utils.mapRange(r.top, r.bottom, -r.height / 2, r.height / 2, e.clientY)
      gsap.to(btn, { x: mx * strength, y: my * strength, duration: 0.4, ease: 'power2.out', overwrite: true })
      if (label) gsap.to(label, { x: mx * labelStrength, y: my * labelStrength, duration: 0.4, ease: 'power2.out', overwrite: true })
    })
    zone.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,0.4)', overwrite: true })
      if (label) gsap.to(label, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,0.4)', overwrite: true })
    })
  })
}

/* ------------------------------------------------------------------
   3. proximity. elements react before the cursor reaches them.
   Osmo, codepen azzKmwX. radius 150, falloff max(0, 1 - dist/radius),
   distance by hypot on page coordinates, centres cached once and
   recomputed on resize rather than per mousemove.
   ------------------------------------------------------------------ */
export function initProximity(selector = '[data-proximity]', { radius = 170 } = {}) {
  if (matchMedia('(hover: none)').matches) return
  const nodes = [...document.querySelectorAll(selector)]
  if (!nodes.length) return

  let centres = []
  const measure = () => {
    centres = nodes.map((el) => {
      const r = el.getBoundingClientRect()
      return { el, x: r.left + scrollX + r.width / 2, y: r.top + scrollY + r.height / 2 }
    })
  }
  measure()
  addEventListener('resize', measure, { passive: true })
  ScrollTrigger.addEventListener('refresh', measure)

  /* quickTo cannot reset the `scale` shorthand, so drive scaleX and
     scaleY separately and seed a base value first */
  gsap.set(nodes, { scaleX: 1, scaleY: 1, x: 0, y: 0, force3D: true })
  const setters = new Map()
  const get = (el, prop) => {
    const k = el.dataset._k || (el.dataset._k = Math.random().toString(36).slice(2))
    const id = k + prop
    if (!setters.has(id)) setters.set(id, gsap.quickTo(el, prop, { duration: 0.5, ease: 'power3' }))
    return setters.get(id)
  }

  let queued = false
  addEventListener('mousemove', (e) => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      centres.forEach(({ el, x, y }) => {
        const dist = Math.hypot(x - e.pageX, y - e.pageY)
        const t = Math.max(0, 1 - dist / radius)
        const sc = 1 + t * 0.10
        get(el, 'scaleX')(sc); get(el, 'scaleY')(sc)
        get(el, 'x')((e.pageX - x) * t * 0.16)
        get(el, 'y')((e.pageY - y) * t * 0.16)
      })
    })
  }, { passive: true })
}

export function initMotion(lenis, { reduce = false } = {}) {
  if (reduce) return
  initVelocitySkew(lenis)
  initMagnetic()
  initProximity()
}


/* ---- the schools lean toward the pointer ----
   The tilt is written as two custom properties and the transform lives in
   css, so the hover transition owns the easing on the way out and nothing
   has to be animated back to zero in javascript. */
export function initTilt({ reduce = false } = {}) {
  if (reduce || !matchMedia('(min-width: 901px)').matches) return
  if (!matchMedia('(hover: hover)').matches) return
  const MAX = 4.2
  document.querySelectorAll('.edu-row').forEach((row) => {
    row.addEventListener('pointermove', (e) => {
      const r = row.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      row.style.setProperty('--ry', (px * MAX * 2).toFixed(2) + 'deg')
      row.style.setProperty('--rx', (-py * MAX).toFixed(2) + 'deg')
    })
    row.addEventListener('pointerleave', () => {
      row.style.setProperty('--ry', '0deg')
      row.style.setProperty('--rx', '0deg')
    })
  })
}

/* ------------------------------------------------------------------
   The glass.

   The film lifts into the page ground and the camera is out of the
   water, so the water is still on the lens. Drops sit, grow, merge,
   then run off, and the hero is clear about eight seconds later. It
   is the residue of the dive, not a decoration, which is why it
   stops instead of looping.

   Technique from ThreeUI's condensation renderer (Design+Code, MIT):
   the sprite cache keyed on half pixel radius, and the merge that
   conserves area, r = sqrt(r1^2 + r2^2), rather than adding radii.
   https://github.com/MengTo/threeui  src/shaders/condensation

   Canvas 2D on purpose. Three WebGL contexts are already live on this
   page (film, field, water) and a fourth is what pushes a laptop into
   context eviction.
   ------------------------------------------------------------------ */

export function createGlass(host, { onClear } = {}) {
  const canvas = document.createElement('canvas')
  canvas.className = 'glass-cv'
  canvas.setAttribute('aria-hidden', 'true')
  host.appendChild(canvas)

  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) { canvas.remove(); return { start() {}, dispose() {} } }

  let w = 1, h = 1, dpr = 1, floorY = 1
  let maxDrops = 0, seedRate = 0
  let drops = [], trails = []
  let raf = 0, running = false, t0 = 0, dead = false

  const sprites = new Map()
  /* a drop on a pale ground is a soft dark lens with one specular dot.
     cached per half pixel of radius so the fill and two arcs are paid
     once, not once per drop per frame. */
  function sprite(r) {
    const key = Math.max(0.5, Math.round(r * 2) / 2)
    const hit = sprites.get(key)
    if (hit) return hit
    const pad = Math.ceil(3 * dpr)
    const size = Math.ceil(key * 2 + pad * 2)
    const c = document.createElement('canvas')
    c.width = size; c.height = size
    const g = c.getContext('2d')
    const m = size / 2
    const lit = key / (5.0 * dpr)

    /* a water lens on a pale ground reads as three things at once: the
       ground pulled darker and cooler through the middle, a bright rim
       where the meniscus catches the sky, and one hard specular dot.
       drawn in that order so none of them cancels. */
    /* A drop on glass is mostly the thing behind it. Almost all of the
       disc stays clear, the edge darkens where the meniscus bends the
       light away, and one small highlight sits where the sky lands. A
       filled sphere with a big specular reads as a glass marble in
       front of the page instead of water on it. */
    const body = g.createRadialGradient(m, m, key * 0.34, m, m, key)
    body.addColorStop(0.00, 'rgba(255,255,255,0)')
    body.addColorStop(0.58, `rgba(150,190,184,${0.05 + lit * 0.05})`)
    body.addColorStop(0.88, `rgba(46,88,82,${0.16 + lit * 0.10})`)
    body.addColorStop(1.00, `rgba(236,250,247,${0.24 + lit * 0.14})`)
    g.fillStyle = body
    g.beginPath(); g.arc(m, m, key, 0, Math.PI * 2); g.fill()

    g.strokeStyle = `rgba(40,78,73,${0.14 + lit * 0.12})`
    g.lineWidth = Math.max(0.6, key * 0.045) * dpr
    g.stroke()

    g.fillStyle = `rgba(255,255,255,${0.50 + lit * 0.22})`
    g.beginPath()
    g.arc(m - key * .36, m - key * .40, Math.max(0.55 * dpr, key * .14), 0, Math.PI * 2)
    g.fill()

    sprites.set(key, c)
    return c
  }

  function seed(headStart = 0) {
    const m = 10 * dpr
    drops.push({
      x: m + Math.random() * Math.max(1, w - m * 2),
      y: m + Math.random() * Math.max(1, floorY - m * 2),
      r: (1.8 + headStart * 2.4) * dpr,
      rMax: (5.0 + Math.random() * 9.5) * dpr,
      grow: (0.010 + Math.random() * 0.016) * dpr,
      run: false, vy: 0,
    })
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2)
    const r = host.getBoundingClientRect()
    w = canvas.width = Math.max(1, Math.round(r.width * dpr))
    h = canvas.height = Math.max(1, Math.round(r.height * dpr))
    canvas.style.width = r.width + 'px'
    canvas.style.height = r.height + 'px'
    floorY = h - 2 * dpr
    sprites.clear()
  }

  function step(dt, life) {
    /* life goes 1 to 0 over the clear. spawning stops first, then the
       ones still sitting are told to run, so the glass empties from
       the top rather than all at once. */
    if (drops.length < maxDrops && Math.random() < seedRate * life * dt * 60) seed()

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]
      if (!d.run) {
        d.r += d.grow * dt * 60
        /* below a third of the clear, everything left lets go */
        if (d.r >= d.rMax || life < 0.34) { d.run = true; d.vy = 0.3 * dpr }
        continue
      }
      d.vy = Math.min(d.vy + 0.08 * dpr * dt * 60, 5.6 * dpr)
      const prevY = d.y
      d.y += d.vy * dt * 60

      /* a running drop sweeps up what it passes. area is conserved, so
         two 2px drops make one 2.83px drop, not one 4px drop. */
      for (let j = drops.length - 1; j >= 0; j--) {
        const o = drops[j]
        if (o === d || o.run) continue
        if (Math.abs(o.x - d.x) < d.r + o.r + 1.5 * dpr &&
            o.y > d.y - d.r && o.y < d.y + d.vy + d.r) {
          d.r = Math.sqrt(d.r * d.r + o.r * o.r)
          drops.splice(j, 1)
          if (j < i) i--
        }
      }

      /* the wet path it has opened so far, kept as one span rather
         than a pile of segments: a stack of constant alpha segments
         renders as a solid bar with a flat top, which is a bar chart,
         not a streak. */
      if (d.top == null) d.top = prevY

      if (d.y >= floorY) {
        if (d.top != null) trails.push({ x: d.x, top: d.top, y: floorY, r: d.r, a: 1 })
        drops.splice(i, 1)
      }
    }

    /* streaks left behind by drops that have already run off */
    for (let i = trails.length - 1; i >= 0; i--) {
      trails[i].a -= dt * 0.55
      if (trails[i].a <= 0) trails.splice(i, 1)
    }
  }

  /* a streak is widest and wettest at the drop and vanishes at the top,
     which is the direction it actually dries in */
  function streak(x, top, y, r, a) {
    const len = y - top
    if (len < 2) return
    const g = ctx.createLinearGradient(x, top, x, y)
    g.addColorStop(0, 'rgba(146,190,183,0)')
    g.addColorStop(0.55, `rgba(146,190,183,${a * 0.10})`)
    g.addColorStop(1, `rgba(120,170,162,${a * 0.26})`)
    ctx.strokeStyle = g
    ctx.lineWidth = Math.max(1, r * 0.85)
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y); ctx.stroke()
  }

  function draw() {
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'round'
    for (const t of trails) streak(t.x, t.top, t.y, t.r, t.a)
    for (const d of drops) {
      if (d.run && d.top != null) streak(d.x, d.top, d.y, d.r, 1)
    }
    for (const d of drops) {
      const s = sprite(d.r)
      ctx.drawImage(s, d.x - s.width / 2, d.y - s.height / 2)
    }
  }

  /* ?wet holds the glass so a frame can be inspected. dev only. */
  const HOLD = typeof location !== 'undefined' && /[?&]wet/.test(location.search)
  const CLEAR_MS = 8200
  let last = 0
  function frame(now) {
    if (dead) return
    raf = requestAnimationFrame(frame)
    if (!last) last = now
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const life = HOLD ? 1 : Math.max(0, 1 - (now - t0) / CLEAR_MS)
    step(dt, life)
    draw()
    if (life <= 0 && !drops.length && !trails.length) {
      running = false
      cancelAnimationFrame(raf)
      canvas.remove()
      onClear?.()
    }
  }

  const onResize = () => { if (running) resize() }
  addEventListener('resize', onResize, { passive: true })

  return {
    start({ density = 1 } = {}) {
      if (running) return
      running = true
      resize()
      /* the count follows area, so a phone is not asked to draw a
         laptop's worth of drops */
      maxDrops = Math.round(Math.min(86, Math.max(30, (w * h) / (dpr * dpr) / 24000)) * density)
      seedRate = 0.34
      const n = Math.round(maxDrops * 0.72)
      for (let i = 0; i < n; i++) seed(Math.random() * 3)
      t0 = performance.now(); last = 0
      raf = requestAnimationFrame(frame)
    },
    dispose() {
      dead = true
      cancelAnimationFrame(raf)
      removeEventListener('resize', onResize)
      sprites.clear()
      canvas.remove()
    },
  }
}

import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

/* ------------------------------------------------------------------
   THE TURN

   One box, one line count, one baseline grid, two materials. Source
   becomes clause line by line, staggered down the block, so the eye
   reads it as one document changing rather than two documents swapping.

   What stays constant: the bounding box, the line count, the baseline
   positions, the left margin. What changes: the glyphs, the face, the
   accent. That constancy is the argument. Nothing is added and nothing
   is thrown away, the same material is read from the other seat.

   Real characters rather than marks, because a monospace glyph carries
   counters, ascenders and punctuation at 7px and a rectangle of the
   same pixels carries none of it. Two fields of rectangles came out
   indistinguishable from one another, which is exactly why the earlier
   version could not be read.
   ------------------------------------------------------------------ */

export function initTurn({ reduce = false } = {}) {
  const frame = document.querySelector('#s3 .turn-frame')
  const code = frame?.querySelector('.doc-code')
  const clause = frame?.querySelector('.doc-clause')
  if (!frame || !code || !clause) return

  const a = [...code.querySelectorAll('.l')]
  const b = [...clause.querySelectorAll('.l')]
  const N = Math.max(a.length, b.length)

  const sec = frame.closest('section')
  const stateA = sec.querySelector('.st-a')
  const stateB = sec.querySelector('.st-b')
  const lineA = sec.querySelector('.tl-a')
  const lineB = sec.querySelector('.tl-b')

  const set = (el, p) => { if (el) el.style.clipPath = `inset(0 0 ${(100 - p * 100).toFixed(1)}% 0)` }

  if (reduce) {
    /* the same object twice, stacked, rather than a card row */
    clause.style.position = 'static'
    code.style.position = 'static'
    frame.style.position = 'static'
    frame.style.height = 'auto'
    stateA?.classList.add('on'); stateB?.classList.add('on')
    return
  }

  a.forEach((el) => { el.style.willChange = 'clip-path' })
  b.forEach((el) => { el.style.clipPath = 'inset(0 0 100% 0)'; el.style.willChange = 'clip-path' })

  let last = -1
  gsap.to({ q: 0 }, {
    q: 1, ease: 'none',
    scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
    onUpdate() {
      const q = this.targets()[0].q
      if (Math.abs(q - last) < 0.0015) return
      last = q

      /* fifteen percent held at each end, the middle seventy spent on the
         change, and each line lags the one above it by a fraction of a
         line so the swap runs down the block rather than all at once */
      const t = gsap.utils.clamp(0, 1, (q - 0.15) / 0.70)
      const LAG = 0.55
      for (let i = 0; i < N; i++) {
        const at = (i / N) * LAG
        const p = gsap.utils.clamp(0, 1, (t - at) / (1 - LAG))
        if (a[i]) set(a[i], 1 - p)
        if (b[i]) set(b[i], p)
      }

      const flipped = t > 0.5
      stateA?.classList.toggle('on', !flipped)
      stateB?.classList.toggle('on', flipped)
      if (lineA) lineA.style.clipPath = flipped ? 'inset(0 0 100% 0)' : 'inset(0 0 0 0)'
      if (lineB) lineB.style.clipPath = flipped ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)'
      sec.dataset.face = flipped ? 'b' : 'a'
    },
  })

  stateA?.classList.add('on')
  sec.dataset.face = 'a'
}

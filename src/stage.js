import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

/* The three moves the reference site is built on, applied to this one.
   1. type large enough to run off the edge, outlined, moving on scroll
   2. the page inverts between sections instead of fading
   3. footage is scrubbed by the scroll, never autoplayed */

/* ---------- 1. oversized outline type ---------- */
/* ---------- 2. the page inverts ---------- */
export function mountInvert() {
  const root = document.documentElement
  document.querySelectorAll('[data-invert]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 52%',
      end: 'bottom 52%',
      onEnter:     () => root.classList.add('inverted'),
      onEnterBack: () => root.classList.add('inverted'),
      onLeave:     () => root.classList.remove('inverted'),
      onLeaveBack: () => root.classList.remove('inverted'),
    })
  })
}

/* ---------- 3. scrubbed footage ---------- */
export function mountScrub() {
  document.querySelectorAll('video[data-scrub]').forEach((v) => {
    v.pause()
    v.muted = true
    v.playsInline = true
    const seek = { t: 0 }
    const bind = () => {
      const dur = v.duration
      if (!dur || !isFinite(dur)) return
      gsap.to(seek, {
        t: dur, ease: 'none',
        scrollTrigger: {
          trigger: v.closest('[data-scrub-host]') || v,
          start: 'top bottom', end: 'bottom top', scrub: 0.35,
        },
        onUpdate() { if (v.readyState >= 2) v.currentTime = Math.min(seek.t, dur - 0.05) },
      })
    }
    if (v.readyState >= 1) bind()
    else v.addEventListener('loadedmetadata', bind, { once: true })
  })
}

/* ---------- 4. scramble decode ---------- */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>*#'
export function mountScramble() {
  document.querySelectorAll('[data-scramble]').forEach((el) => {
    const target = el.textContent
    const isKo = /[ㄱ-힝]/.test(target)
    /* Korean syllables do not read as noise when swapped for latin, and
       swapping jamo breaks composition. Korean gets a mask wipe instead. */
    if (isKo) {
      gsap.fromTo(el, { clipPath: 'inset(0 100% 0 0)' }, {
        clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      })
      return
    }
    const o = { p: 0 }
    gsap.to(o, {
      p: 1, duration: 1.1, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onUpdate() {
        const n = Math.floor(target.length * o.p)
        let out = target.slice(0, n)
        for (let i = n; i < target.length; i++) {
          out += target[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]
        }
        el.textContent = out
      },
      onComplete() { el.textContent = target },
    })
  })
}

export function initStage({ reduce = false } = {}) {
  if (reduce) return
  mountInvert()
  mountScrub()
  mountScramble()
  ScrollTrigger.refresh()
}

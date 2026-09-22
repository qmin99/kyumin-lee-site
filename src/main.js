import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import SplitText from 'gsap/SplitText'
import CustomEase from 'gsap/CustomEase'
import { initScroll } from './scroll.js'
import { initStage } from './stage.js'
import { initMotion, initTilt } from './motion.js'
import { initMarquee } from './marquee.js'
import { createFilm } from './film.js'
import { createGlass } from './glass.js'
import { env, watchPerf, guardContext, onTierChange } from './env.js'
import * as a11y from './a11y.js'

/* ------------------------------------------------------------------
   Start at the top.

   Browsers restore the previous scroll offset on reload, which on this
   page means the film plays to an audience already halfway down it. The
   restore lands after our own code runs, so setting the offset once is
   not enough: manual restoration has to be declared first, and the reset
   repeated on load and on pageshow, which is the one that fires when the
   page comes back out of the back forward cache.

   A hash is honoured. Someone following #s5 from the hero index means it.
   ------------------------------------------------------------------ */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
const HAS_HASH = location.hash.length > 1

/* Two separate memories have to be cleared, which is why the first attempt
   at this only half worked. The browser keeps one per history entry, and
   ScrollTrigger keeps its own in sessionStorage so a refresh lands where
   the reader was. The second one survives history.scrollRestoration. */
try { ScrollTrigger.clearScrollMemory('manual') } catch (_) {}

/* The page is only a few hundred pixels tall while the film runs, then it
   grows past nine thousand when the stack lands. A restore that clamps to
   zero against the short document can be reapplied against the tall one,
   so the reset is held for the first second rather than fired once. */
let holdTop = !HAS_HASH
function toTop(force) {
  if (HAS_HASH) return
  if (!holdTop && !force) return
  if (window.scrollY !== 0) window.scrollTo(0, 0)
}
toTop(true)
const topGuard = setInterval(() => toTop(), 60)
setTimeout(() => { clearInterval(topGuard); holdTop = false }, 1200)
addEventListener('load', () => toTop(true))
addEventListener('pageshow', (e) => { if (e.persisted) toTop(true) })

/* ------------------------------------------------------------------
   a11y.init must run before anything reads the DOM. it creates <main>
   and moves the sections into it when the markup does not have one.
   ------------------------------------------------------------------ */
a11y.init({ reduceMotion: env.tier === 'static' })
a11y.wireLang({ mode: 'toggle' })
a11y.langBanner({})
if (env.tier === 'static') a11y.staticMode(true)

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase)

/* dev trace. records when each stage actually fires, so the sequence can
   be inspected after the fact instead of raced against a round trip. */
const T0 = performance.now()
const trace = []
const mark = (name) => { trace.push([name, Math.round(performance.now() - T0)]) }
if (import.meta.env?.DEV) window.__trace = trace
CustomEase.create('house', 'M0,0 C0.625,0.05 0,1 1,1')

/* ?slow=N slows every gsap timeline so a single frame of the build can be
   inspected. The round trip on a screenshot is longer than the build, so
   without this the only observable states are "not started" and "done",
   which is exactly the thing that has to be checked. Dev only. */
if (import.meta.env?.DEV) {
  const m = /[?&]slow(?:=([\d.]+))?/.exec(location.search)
  if (m) {
    gsap.globalTimeline.timeScale(Number(m[1]) || 0.2)
    window.__slow = gsap.globalTimeline.timeScale()
  }
}

/* ------------------------------------------------------------------
   Module state, all of it, declared before the first line that can run.

   The functions below are declarations, so they hoist. The bindings they
   close over are `let`, so they do not. The no-intro branch calls
   playHero and stackPage immediately, which is far above where these
   would otherwise sit, and each one that was left behind threw a
   ReferenceError that stopped the page mid-assembly. Adding state here
   is the rule, not next to the function that uses it.
   ------------------------------------------------------------------ */
let heroPlayed = false
let grounded = false
let stacked = false
let released = false
let field = null
let glass = null

let reduce = !a11y.motion.enabled
a11y.motion.subscribe((enabled) => {
  reduce = !enabled
  if (!field) return
  enabled ? field.start() : field.stop()
})

/* single frame loop: lenis raf runs inside the gsap ticker so DOM and
   WebGL read the same snapshot. one frame of desync is what reads cheap. */
/* lerp only. passing duration as well makes lerp dead code: the duration
   branch wins inside Animate.advance(). Award winners run lerp 0.10 to 0.13. */
const lenis = new Lenis({
  lerp: 0.11,
  smoothWheel: env.budget.smoothScroll && !reduce,
})
/* lenis keeps its own scroll value, so the dom reset above has to be
   mirrored or the two disagree and the first wheel event jumps back */
if (!HAS_HASH) {
  lenis.scrollTo(0, { immediate: true, force: true })
  const lenisGuard = setInterval(() => {
    if (lenis.scroll !== 0) lenis.scrollTo(0, { immediate: true, force: true })
  }, 60)
  setTimeout(() => clearInterval(lenisGuard), 1200)
}
/* the mobile address bar showing and hiding retriggers every resize driven
   refresh mid scroll. normalising puts scrolling on the js thread and
   stops it. */
ScrollTrigger.normalizeScroll(true)
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((t) => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(0)

/* ---- cinematic intro ---- */
const introEl = document.getElementById('intro')
const introCanvas = document.getElementById('introcv')
/* in dev the sequence always plays. the once-per-session gate is a
   production behaviour and is switched on at launch, not before. */
const force = /[?&]intro/.test(location.search)
const gated = !import.meta.env?.DEV && !force
if (!gated) sessionStorage.removeItem('introSeen')
const seen = gated && sessionStorage.getItem('introSeen') === '1'

/* ---- the handover ----
   Called from inside the film's own timeline, while its canvas is still on
   screen and dissolving. Everything here has to happen before the canvas is
   gone, because what is underneath it is the hero and the hero is what the
   dissolve is dissolving into: the overlay stops being opaque, the hero's own
   footage is uncovered, and the build starts on top of it. Guarded rather
   than ordered, because skip() jumps the timeline and may reach the end
   without the callback in the middle ever firing. */
let handed = false
function handOver() {
  if (handed) return
  handed = true
  mark('film:handover')
  document.documentElement.classList.remove('intro-on')
  lenis.start()
  if (introEl) {
    /* the overlay's own paper ground has to go first, or the canvas fades
       out onto a white sheet instead of onto the hero */
    introEl.style.background = 'transparent'
    introEl.style.pointerEvents = 'none'
  }
  playHero()
  wetGlass()
  /* the sections below the fold come after the hero has started, so the
     two builds do not run on top of each other */
  gsap.delayedCall(0.45, stackPage)
}

function releaseIntro() {
  if (released) return
  released = true
  mark('film:released')
  handOver()
  a11y.introEnd()
  ScrollTrigger.refresh()
  introEl?.remove()
}

if (introEl && introCanvas && env.budget.intro && !reduce && !seen) {
  document.documentElement.classList.add('intro-on')
  lenis.stop()
  introCanvas.remove()
  const hold = !!(import.meta.env?.DEV && location.search.includes('pause'))
  const intro = createFilm(introEl, {
    hold,
    quality: env.budget.dpr >= 2 && !env.saveData && !env.slowNet ? '4k' : '1080',
    /* the hero types in while the footage is still live, so there is no cut */
    /* Ground only. playHero used to run here, at film time 2.55s, but the
       canvas stays opaque until the lift finishes at 4.25s, so the whole
       build happened behind it and the film dissolved to reveal a hero
       that was already 85 percent assembled. That is the "it just opens
       like something already made" that kept coming back. What settles
       here is the water under the page, which is continuous with the
       footage. The type waits for the film to actually be gone. */
    onSettle: () => {
      mark('film:settle')
      document.documentElement.classList.remove('intro-on')
      lenis.start()
      openGround()
      ScrollTrigger.refresh()
    },
    onHandover: handOver,
    onDone: () => { sessionStorage.setItem('introSeen', '1'); releaseIntro() },
  })
  window.__intro = intro
  /* dev hook: ?pause holds the sequence so frames can be inspected */
  if (hold) intro.timeline.pause(0)
  /* introStart covers Tab, Enter, Space, Escape, wheel, touchmove and click.
     do not add a separate #skip listener, it would fire twice. */
  a11y.introStart(introEl, { onSkip: () => intro.skip() })
} else {
  introEl?.remove()
  playHero()
  stackPage()
}

/* ---- the glass ----
   The camera came out of the water, so the water is still on the lens.
   Drops sit, merge and run off, and the hero is clear about eight
   seconds later. It only ever runs once: a loop would turn the residue
   of the dive into wallpaper. Canvas 2D, so it adds no WebGL context to
   the three already live. */
function wetGlass() {
  if (glass || reduce || env.tier === 'static' || !env.budget.intro) return
  const hero = document.getElementById('s1')
  if (!hero) return
  glass = createGlass(hero, { onClear: () => { glass = null } })
  glass.start({ density: env.isMobile ? 0.55 : 1 })
}

/* ---- hero field ---- */
const canvas = document.getElementById('field')
if (canvas && env.budget.field && !reduce) {
  const { createField } = await import('./field.js')
  field = createField(canvas, { count: env.budget.fieldCount })
  field.start()
  /* the field is a fixed global layer now, so it answers the whole
     document rather than the hero alone */
  ScrollTrigger.create({
    start: 0, end: 'max', scrub: true,
    onUpdate: (self) => field.setScroll(self.progress),
  })
  guardContext(canvas, {
    onLost: () => field.stop(),
    onRestored: () => field.start(),
    onDead: () => { field.dispose(); field = null; canvas.remove() },
  })
  onTierChange(() => {
    if (!field) return
    if (!env.budget.field) { field.stop(); return }
    field.start()
  })
  document.documentElement.classList.add('has-field')
}


/* ---- the water band ---- */
const waterCv = document.getElementById('watercv')
if (waterCv && env.budget.field && !reduce) {
  const { createWater } = await import('./water.js')
  const water = createWater(waterCv)
  new IntersectionObserver(([e]) => (e.isIntersecting ? water.start() : water.stop()),
    { rootMargin: '240px' }).observe(waterCv)
  guardContext(waterCv, { onLost: () => water.stop(), onRestored: () => water.start(),
    onDead: () => { water.dispose(); waterCv.closest('.waterband')?.remove() } })
}

/* ---- section 03, the corridor ----
   Loaded on its own rather than with the bundle: it pulls three and a pair
   of shaders for a section the reader has not reached yet. The piece is
   entirely scroll driven, so unlike the field it has no idle cost and the
   observer here is about the GPU work of a frame that cannot be seen, not
   about an animation running unwatched. */
const corridorCv = document.getElementById('corridor')
const s3 = document.getElementById('s3')
let corridor = null

/* Four hundred vh of pinned scroll only earns its place while something is
   moving inside it. Under reduced motion, or on the static tier where the
   canvas is never built at all, that same budget is four hundred vh of empty
   page with a headline stranded in the middle of it. The old version of this
   section collapsed itself in exactly this case and the collapse has to come
   across with the piece. The four beat labels stay: read as a list they
   still say idea, work, result, which is the whole argument in words. */
const still = reduce || !env.budget.corridor
if (still && s3) s3.dataset.corridor = env.budget.corridor ? 'still' : 'off'

if (corridorCv && env.budget.corridor) {
  const { createCorridor } = await import('./corridor.js')
  corridor = createCorridor(corridorCv, {
    count: env.budget.corridorCount,
    dpr: env.budget.dpr,
    reduce,
  })
  if (corridor) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? corridor.start() : corridor.stop()),
      { rootMargin: '320px' }).observe(corridorCv)
    guardContext(corridorCv, {
      onLost: () => corridor.stop(),
      onRestored: () => corridor.start(),
      onDead: () => { corridor.dispose(); corridor = null; corridorCv.remove() },
    })
    onTierChange(() => {
      if (!corridor) return
      env.budget.corridor ? corridor.start() : corridor.stop()
    })
    a11y.motion.subscribe((enabled) => {
      if (!corridor) return
      if (enabled) { s3?.removeAttribute('data-corridor'); corridor.start() }
      else { s3 && (s3.dataset.corridor = 'still'); corridor.still() }
    })
    ScrollTrigger.refresh()
  }
}

/* ---- runtime frame budget. detect-gpu is not trusted on its own ---- */
const perf = watchPerf(() => {
  if (field && !env.budget.field) field.stop()
  if (corridor && !env.budget.corridor) corridor.stop()
}, { selfDrive: false })
gsap.ticker.add((t) => perf.tick(t * 1000))

/* ---- phase one: the ground ----
   Runs while the film is still lifting. Only the water comes up, because
   it is the same water the footage was shot in and the eye reads it as
   the shot continuing rather than as a new page. Nothing legible arrives
   yet. The hero is empty when the canvas finally clears, which is the
   point: there has to be something to build. */
function openGround() {
  if (grounded) return
  grounded = true
  mark('ground:open')
  document.documentElement.classList.add('entered')
  if (reduce) return
  /* The target comes from --field-op so the phone's lower setting is not
     overwritten. This tween writes an inline opacity, which outranks the
     stylesheet, so hardcoding the number here silently beat the media
     query that tried to calm the rain down on a small screen. */
  const fieldOp = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--field-op')) || 0.5
  gsap.fromTo('#field', { opacity: 0 }, { opacity: fieldOp, duration: 1.6, ease: 'power2.out' })
}

/* ---- phase two: the build ----
   Every piece arrives on its own, out of its own direction, in front of
   the reader. Eight beats over about two seconds. Short throws, not long
   fades: the house ease holds and then snaps, so 0.8s reads as decisive
   where 1.15s reads as a transition someone else already finished. */
function playHero() {
  if (heroPlayed) return
  heroPlayed = true
  mark('hero:start')
  openGround()
  if (reduce) { stackPage(); return }

  const tl = gsap.timeline({
    defaults: { ease: 'house' },
    onComplete: () => { mark('hero:done'); ScrollTrigger.refresh() },
  })

  /* 1. the bar drops in from off the top edge */
  tl.from('.top', { yPercent: -100, duration: 0.5, ease: 'expo.out' }, 0.14)
  /* 2. the name wipes in behind it */
    .from('.top .nm', { clipPath: 'inset(0 100% 0 0)', duration: 0.46 }, 0.34)
  /* 3. the controls clip up one at a time */
    .from('.top .set > *', { clipPath: 'inset(0 0 100% 0)', duration: 0.4, stagger: 0.06 }, 0.44)

  /* 4. the eyebrow runs left to right */
  tl.from('.eyebrow', { clipPath: 'inset(0 100% 0 0)', duration: 0.5 }, 0.66)

  /* 5 and 7. each claim throws up out of its own mask, and the two are
     far enough apart that the rule between them lands in the gap */
  document.querySelectorAll('.hero-l, .hero-r').forEach((el, i) => {
    const vis = [...el.querySelectorAll('span')].find((n) => getComputedStyle(n).display !== 'none') || el
    let split
    try { split = new SplitText(vis, { type: 'lines', mask: 'lines', linesClass: 'ln' }) } catch { return }
    tl.from(split.lines, { yPercent: 118, duration: 0.82, stagger: 0.08 }, i === 0 ? 0.84 : 1.42)
  })

  /* 6. the rule draws across between the two claims */
  tl.from('#s1 .rule', { scaleX: 0, transformOrigin: 'left center', duration: 0.7 }, 1.26)

  /* 8. the hero rail settles last. .idx is deliberately not touched here:
     it already arrives with .top .set, and a second `from` on it made the
     counter appear, disappear and appear again. */
  tl.from('#s1 .horizon', { scaleX: 0, transformOrigin: 'left center', duration: 0.6 }, 1.9)
}

/* The stack runs only once the film has actually left the screen. Running
   it inside playHero put the whole thing behind the still-lifting canvas,
   which is exactly why the page looked finished the moment it appeared. */
function stackPage() {
  if (stacked) return
  stacked = true
  mark('stack:start')
  const stack = gsap.utils.toArray('main > section:not(#s1), .waterband, footer')
  if (reduce || !stack.length) {
    document.documentElement.classList.add('built')
    ScrollTrigger.refresh()
    return
  }
  /* the field takes over the film's last frame, then relaxes. the intro
     did not end, the camera came out of the water. */
  if (field?.handoff) {
    field.handoff(1)
    gsap.to({ v: 1 }, { v: 0, duration: 2.2, ease: 'power2.out',
      onUpdate() { field.handoff(this.targets()[0].v) } })
  }

  gsap.fromTo(stack,
    { yPercent: 5, clipPath: 'inset(0 0 100% 0)' },
    {
      yPercent: 0, clipPath: 'inset(0 0 0% 0)',
      duration: 1.0, ease: 'house', stagger: 0.13,
      onComplete: () => {
        mark('stack:done')
        /* the document just went from short to full height. anything that
           was clamped to zero against the short one can be restored against
           this one, so the top is claimed again before the refresh. */
        toTop(true)
        if (!HAS_HASH) {
          lenis.scrollTo(0, { immediate: true, force: true })
        }
        /* a11y.introEnd moves focus into main so the reader is not left at the
           top of a film that has gone. That also sets the sequential focus
           navigation starting point, which put Skip to content at the 13th tab
           stop and sent the first few tabs to the bottom of the document.
           Releasing it puts the starting point back at the document start. */
        const ae = document.activeElement
        if (ae && ae !== document.body && typeof ae.blur === 'function') ae.blur()
        document.documentElement.classList.add('built')
        gsap.set(stack, { clearProps: 'clipPath,transform' })
        ScrollTrigger.refresh()
        /* the browser's own hash jump ran while body still had overflow
           hidden for the intro, so it clamped to nothing and the link died.
           it is made here instead, and only after the refresh: called before
           it, lenis measures against stale positions and lands at the end of
           the document. */
        if (HAS_HASH) requestAnimationFrame(() => {
          const target = document.querySelector(location.hash)
          if (target) lenis.scrollTo(target, { immediate: true, force: true, offset: -64 })
        })
      },
    })
}

/* scroll behaviour lives in scroll.js */
initScroll({ reduce })
initMarquee({ reduce })
initStage({ reduce })
initMotion(lenis, { reduce })
initTilt({ reduce })
/* section 03 is the corridor now. turn.js is left on disk as the previous
   version of this section and is no longer imported. */

/* ---- the date, where the section counter used to be ----
   The counter said 02 / 07 and rewrote itself on every scroll frame. Its
   denominator came from counting section elements, which is not the same as
   the number of chapters a reader sees, so it was answering a question
   nobody asked with a number that did not quite line up. It is the day
   instead: written once at load, never touched again. Still aria-hidden. */
{
  const idx = document.querySelector('.idx')
  if (idx) {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    idx.textContent = d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate())
  }
}

/* ---- language. a11y.wireLang owns the anchors, this only repaints rows ---- */
document.addEventListener('langchange', (e) => {
  window.renderRows?.()
  a11y.tagSpanLangs?.()
  ScrollTrigger.refresh()
  if (e?.detail?.lang) document.documentElement.setAttribute('data-lang', e.detail.lang)
})



/* ---- unarmed media slots ----
   An empty slot reading PV-03, and a slate reading TRACK TITLE, YYYY over a
   dead play button, are worse than nothing on a page whose argument is that
   the work is finished. The markup stays so a slot arms in one line: drop a
   <video> in place of the .ph, or put a file on the button's data-src. */
document.querySelectorAll('#s6 .slot').forEach((slot) => {
  if (!slot.querySelector('video, img')) slot.hidden = true
})
/* same rule for the service plates: an empty grey rectangle labelled PHOTO
   next to a real photograph reads as work that stopped halfway */
document.querySelectorAll('#s5 .plate').forEach((fig) => {
  if (!fig.querySelector('img, video')) fig.hidden = true
})
{
  const row = document.querySelector('#s5 .plate-row')
  const live = row?.querySelectorAll('.plate:not([hidden])')
  if (row && live && live.length === 1) row.classList.add('solo')
}
{
  const audio = document.querySelector('#s6 .audio')
  const play = audio?.querySelector('.play')
  if (audio && !play?.getAttribute('data-src')) audio.hidden = true
  /* two slots left, so the wide one no longer needs to span the row alone */
  const live = document.querySelectorAll('#s6 .slot:not([hidden])')
  if (live.length === 2) document.querySelector('#s6 .slots')?.classList.add('pair')
}

/* ---- private chapter footage. plays only while on screen, never on load ---- */
const pvs = document.querySelectorAll('video.pv')
if (pvs.length && !reduce) {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause()
  }), { threshold: 0.25 })
  pvs.forEach((v) => io.observe(v))
}

/* ---- the return ----
   The page opened on his canopy over farmland. It closes on the same
   frames, further back and slower, so the end reads as an arrival
   rather than as a stop. podium.global does this with a rock. No new
   asset: it is the file the intro already decoded. */
const ret = document.querySelector('.film-return')
if (ret && !reduce && env.budget.intro) {
  const rv = ret.querySelector('video')
  const foot = document.querySelector('footer')
  ScrollTrigger.create({
    /* the ground flips to the dark palette at 'top 52%' in stage.js. the
       footage used to arrive at 96%, so for 350px of scroll a light scrim
       sat over dark footage while the type was still on the light palette.
       measured at 390 wide: the phone number came out at 1.00 : 1 against
       the ground behind it. the two now start together. */
    trigger: foot, start: 'top 54%', end: 'bottom bottom', scrub: 0.6,
    onUpdate: (self) => {
      const p = self.progress
      gsap.set(ret, { opacity: 0.26 + p * 0.42 })
      gsap.set(rv, { scale: 1.12 - p * 0.12, yPercent: (1 - p) * -5 })
    },
  })
  /* preload only once the footer is in reach, and never decode off screen */
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) { rv.pause(); return }
    if (rv.preload !== 'auto') rv.preload = 'auto'
    rv.play().catch(() => {})
  }, { rootMargin: '300px' }).observe(ret)
}

/* ---- projects disclosure ---- */
const workOpen = document.getElementById('workOpen')
const workPanel = document.getElementById('workPanel')
workOpen?.addEventListener('click', () => {
  const open = workOpen.getAttribute('aria-expanded') === 'true'
  workOpen.setAttribute('aria-expanded', String(!open))
  if (open) {
    workPanel.hidden = true
  } else {
    workPanel.hidden = false
    ScrollTrigger.refresh()
  }
})

/* the #motion button is owned by a11y.motion. no listener here, a second
   one would toggle twice per click and cancel itself out. */

if (import.meta.env?.DEV) {
  /* lenis owns the scroll position, so window.scrollTo is reverted on the
     next frame and cannot be used to inspect a scrubbed section. */
  window.__lenis = lenis
  window.__to = (y) => lenis.scrollTo(y, { immediate: true, force: true })
  window.__env = env
  window.__a11y = a11y
  window.__perf = perf
  console.info('[env]', env.reason ?? env.tier, env.budget)
}

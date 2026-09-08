import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import SplitText from 'gsap/SplitText'
import CustomEase from 'gsap/CustomEase'

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase)

/* The house ease. Osmo Supply's curve, found live in an August 2026 SOTD
   winner. At t=0.25 it is 12.6 percent done where expo.out is already 82.
   It holds, then throws, and that hold is the whole difference. */
CustomEase.create('house', 'M0,0 C0.625,0.05 0,1 1,1')

/* Deliberately absent: opacity 0 plus y 16 plus char stagger. That
   combination is now read as machine output rather than as craft, so
   every reveal below is a mask, a wipe or a scale instead of a fade. */

export function initScroll({ reduce = false } = {}) {
  if (reduce) return

  const mm = gsap.matchMedia()

  /* ---- display lines: a real mask reveal ----
     mask:'lines' makes SplitText wrap each line in an overflow:clip div.
     type 'chars,lines' with mask 'lines' renders 43% fewer nodes than
     mask:'chars' and looks the same. */
  gsap.utils.toArray('.big-line, .pivot, .edu-name').forEach((el) => {
    if (el.closest('#s5') || el.closest('#s7')) return   /* these run their own sequences, below */
    const vis = [...el.querySelectorAll('span')].find((n) => getComputedStyle(n).display !== 'none') || el
    let split
    try { split = new SplitText(vis, { type: 'lines', mask: 'lines', linesClass: 'ln' }) } catch { return }
    gsap.from(split.lines, {
      yPercent: 112, duration: 1.15, ease: 'house', stagger: 0.075,
      scrollTrigger: { trigger: el, start: 'top 86%', once: true },
    })
  })

  /* ---- body copy: a wipe, not a fade. the text is never transparent ---- */
  gsap.utils.toArray('.lead, .cap, .prose p, .edu-meta, .note').forEach((el) => {
    if (el.closest('#s5') || el.closest('#s7') || el.closest('#s8')) return
    gsap.from(el, {
      clipPath: 'inset(0 0 100% 0)', duration: 0.85, ease: 'house',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    })
  })

  /* ---- data lines: the rule under them draws first, the text follows ---- */
  gsap.utils.toArray('.data').forEach((el) => {
    if (el.closest('#s5')) return
    gsap.from(el, {
      clipPath: 'inset(0 100% 0 0)', duration: 0.7, ease: 'house',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    })
  })

  /* ---- section headings: the rule extends, then the label arrives ---- */
  gsap.utils.toArray('.sec-head').forEach((el) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 84%', once: true } })
    tl.from(el.querySelector('.n'), { clipPath: 'inset(0 0 100% 0)', duration: 0.5, ease: 'house' }, 0)
      .from(el.querySelector('.lb'), { scaleX: 0, transformOrigin: 'left center', duration: 0.75, ease: 'house' }, 0.08)
  })

  mm.add('(min-width: 901px)', () => {
    /* ---- the hero object ----
       currentTime is driven straight off the scroll rather than played, so
       the fall belongs to the reader's hand. The seek is written through a
       quickTo: assigning currentTime on every scroll event asks the decoder
       for frames faster than it can answer and the picture stalls. */
    const hf = document.getElementById('scrubfilm')
    if (hf) {
      document.documentElement.classList.add('has-hero-film')
      const state = { t: 0 }
      let dur = 0
      const bind = () => {
        dur = hf.duration
        if (!dur || !isFinite(dur)) return
        gsap.to(state, {
          t: dur, ease: 'none',
          scrollTrigger: {
            trigger: '#s1', start: 'top top', end: 'bottom top', scrub: 0.35,
          },
          onUpdate() {
            if (hf.readyState < 2) return
            const want = Math.min(dur - 0.01, Math.max(0, state.t))
            if (Math.abs(hf.currentTime - want) > 0.016) hf.currentTime = want
          },
        })
        ScrollTrigger.refresh()
      }
      if (hf.readyState >= 1) bind()
      else hf.addEventListener('loadedmetadata', bind, { once: true })
      /* one play/pause primes the decoder, otherwise the first seek on a
         cold element paints nothing */
      hf.play().then(() => hf.pause()).catch(() => {})
    }

    /* ---- hero: the two halves part, and the rule holds ---- */
    gsap.timeline({
      scrollTrigger: { trigger: '#s1', start: 'top top', end: 'bottom top', scrub: 0.6 },
    })
      .to('.hero-l', { yPercent: -30, ease: 'none' }, 0)
      .to('.hero-r', { yPercent: 22, ease: 'none' }, 0)
      .to('.eyebrow', { yPercent: -120, ease: 'none' }, 0)

    /* ---- the water band drifts against the page ---- */
    /* the canvas is removed when the WebGL context dies for good, and a
       fromTo with zero targets throws inside ScrollTrigger.refresh */
    const band = document.querySelector('.waterband')
    const bandCv = band?.querySelector('canvas')
    if (band && bandCv) {
      /* Anchored at the top, and it never travels upwards. The band keeps a
         fixed allowance of sky above the canvas so the head mask has
         something of its own to fade; a parallax that lifted the canvas by
         12% and grew it by 14% put the island's peak back inside that fade. */
      gsap.fromTo(bandCv,
        { yPercent: 0, scale: 1.12 },
        { yPercent: 9, scale: 1.0, ease: 'none', transformOrigin: '50% 0%',
          scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: 0.4 } })

      /* ---- the sea comes up through a developer ----
         04 ends on paper and the water used to begin at an edge. The band is
         pulled up under it and carries a single value, --p, that every
         treatment reads: a veil's opacity, a mask's opening, a blur, or the
         height of the wet line. Driven straight off the band's own position
         rather than through a tween, because four different properties in
         two different layers read it and a scrubbed timeline for each would
         be four triggers doing one trigger's work. */
      let raf = 0
      const drive = () => {
        const r = band.getBoundingClientRect()
        const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 1.05)))
        band.style.setProperty('--p', p.toFixed(3))
        raf = requestAnimationFrame(drive)
      }
      raf = requestAnimationFrame(drive)
    }

    /* ---- 04's case turns with the pointer, and the light turns with it ---- */
    const rig = document.querySelector('.case-rig')
    if (rig) {
      const stage = rig.closest('.case-stage')
      /* Only once the case is genuinely up. Reading the pointer from anywhere
         on the page meant that while you were still two sections above it the
         frame was already craned hard over, and you arrived at a thing that
         had been staring off to one side the whole time. It answers when its
         own stage has come past the lower third of the window, and goes back
         to square the moment it leaves. */
      const neutral = () => {
        rig.style.setProperty('--ry', '0deg')
        rig.style.setProperty('--rx', '0deg')
        rig.style.setProperty('--lx', '50%')
      }
      neutral()
      addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect()
        const live = r.top < innerHeight * 0.66 && r.bottom > 0
        if (!live) { neutral(); return }
        const nx = (e.clientX - r.left) / r.width - 0.5
        const ny = (e.clientY - r.top) / r.height - 0.5
        rig.style.setProperty('--ry', (nx * 15).toFixed(2) + 'deg')
        rig.style.setProperty('--rx', (-ny * 10).toFixed(2) + 'deg')
        rig.style.setProperty('--lx', (50 + nx * 46).toFixed(1) + '%')
      }, { passive: true })
      addEventListener('scroll', () => {
        const r = stage.getBoundingClientRect()
        if (r.top >= innerHeight * 0.66 || r.bottom <= 0) neutral()
      }, { passive: true })
    }

    /* ---- plates: clip open from the bottom edge, no fade ---- */
    gsap.utils.toArray('.plate-row').forEach((row) => {
      if (row.closest('#s5')) return
      gsap.from(row.querySelectorAll('.plate'), {
        clipPath: 'inset(0 0 100% 0)', duration: 1.05, ease: 'house', stagger: 0.08,
        scrollTrigger: { trigger: row, start: 'top 86%', once: true },
      })
    })

    /* ---- 05: the title, its rule, then the two entries ----
       The display line is one word, so it fades up as a block rather than
       splitting into lines; the double rule draws out from the centre the
       way a rule is ruled, and each entry lifts after it. */
    {
      const head = document.querySelector('#s6b .ac-h')
      const dbl = document.querySelector('#s6b .dbl')
      if (head) {
        gsap.timeline({ scrollTrigger: { trigger: head, start: 'top 86%', once: true } })
          .from(head.querySelector('.ac-t'), { yPercent: 26, opacity: 0, duration: 0.95, ease: 'house' }, 0)
          .from(head.querySelector('.orn-b'), { scaleX: 0, opacity: 0, duration: 0.6, ease: 'house' }, 0.34)
          .from(dbl, { scaleX: 0, duration: 0.85, ease: 'house' }, 0.44)
      }
      gsap.utils.toArray('#s6b .ent-i').forEach((row, i) => {
        gsap.timeline({ scrollTrigger: { trigger: row, start: 'top 90%', once: true } })
          .from(row.querySelectorAll('.ent-mk, .ent-b > *'), {
            y: 20, opacity: 0, duration: 0.72, ease: 'house', stagger: 0.07,
          }, 0)
      })
    }

    /* ---- the private chapter runs sideways ----
       The stage is 280vh of scroll. The frame inside it sticks for the
       whole of that, and the track is pulled left by exactly its own
       overflow, so the last clip lands flush against the right edge
       rather than stopping early or running past. */
    const hband = document.querySelector('#s6 .stage')
    const pin = hband?.querySelector('.stage-pin')
    const track = hband?.querySelector('.slots')
    if (hband && pin && track) {
      const travel = () => Math.max(0, track.scrollWidth - pin.clientWidth)
      gsap.fromTo(track, { x: 0 }, {
        x: () => -travel(), ease: 'none',
        scrollTrigger: {
          trigger: hband, start: 'top top', end: 'bottom bottom',
          scrub: 0.55, invalidateOnRefresh: true,
          onUpdate: (self) => pin.style.setProperty('--band', self.progress.toFixed(4)),
        },
      })
    }

    /* ---- the deep chapter takes the chrome with it ---- */
    const deep = document.getElementById('s6')
    if (deep) {
      gsap.timeline({ scrollTrigger: { trigger: deep, start: 'top 70%', end: 'bottom 30%', scrub: 0.5 } })
        .to('.top', { backgroundColor: 'rgba(6,32,31,.94)', ease: 'none' }, 0)
        .to('.top .nm', { color: '#EAF6F3', ease: 'none' }, 0)
        .to('.top', { backgroundColor: 'rgba(250,250,250,1)', ease: 'none' }, 0.8)
        .to('.top .nm', { color: '#0B0C0C', ease: 'none' }, 0.8)
    }
  })

  /* ==================================================================
     Arrivals, driven by the scroll rather than by a clock.

     The first version of these played on a timer the moment the block
     crossed a line near the bottom of the viewport. That works at reading
     pace and fails completely at any speed above it: measured on a
     continuous wheel scroll, 05's sequence started on cue and then ran its
     two and a half seconds out while the reader was already five thousand
     pixels further down. The whole ceremony happened off screen, every
     time, which is why it looked like there was no ceremony at all.

     So the playhead is the scroll now. The timeline is scrubbed across
     roughly half a viewport of travel: slowly and every beat is read, fast
     and it lands finished, which is the correct outcome rather than a
     missed one. Once it reaches the end the trigger is killed, so scrolling
     back up never rewinds a thing that has already happened.
     ================================================================== */
  const arrive = (tl, trigger, { start = 'top 90%', end = 'top 32%', scrub = 0.6 } = {}) => {
    const st = ScrollTrigger.create({
      trigger, start, end, scrub, animation: tl,
      onUpdate: (self) => {
        if (self.progress < 0.999) return
        /* Disabled rather than killed. ScrollTrigger.kill() takes the
           animation with it unless told otherwise, and killing a `from`
           tween drops its targets back to the state they started in: the
           name tag was ending the sequence still clipped to nothing.
           disable() stops it listening and leaves the timeline alone. The
           second progress(1) is after the scrub tween has had its last
           tick, so nothing lands short of the end. */
        requestAnimationFrame(() => { self.disable(false); tl.progress(1) })
      },
    })
    return st
  }

  /* ---- 03, the projects header: the rule runs out to the margin ---- */
  const wh = document.querySelector('.work-head')
  if (wh) {
    arrive(gsap.timeline()
      .from(wh.querySelector('.wh-lb'), { clipPath: 'inset(0 0 100% 0)', duration: 0.5, ease: 'house' }, 0)
      .from(wh.querySelector('.wh-rule'), { scaleX: 0, transformOrigin: 'left center', duration: 0.9, ease: 'house' }, 0.08)
      .from(wh.querySelector('.wh-n'), { clipPath: 'inset(0 0 100% 0)', duration: 0.45, ease: 'house' }, 0.5),
      wh, { start: 'top 94%', end: 'top 60%' })
    arrive(gsap.timeline().from('#s3 .wp-item', {
      clipPath: 'inset(0 0 100% 0)', yPercent: 4, duration: 0.85, ease: 'house', stagger: 0.09,
    }), '#workPanel', { start: 'top 92%', end: 'top 20%' })
  }

  /* ==================================================================
     05 arrives as a ceremony.

     The section is about one object: the red name tag, awarded at a parade
     after the fifth week, the only thing on a marine that is allowed to be
     that colour. So the sequence spends its speed on everything else and
     its silence on that. The lockup assembles, the display line runs, and
     then the timeline simply stops for a stretch before the class patch
     settles, stops again, and the tag is pinned on: it arrives tilted,
     lands flat, and the crimson blooms once around it.

     Every step is a mask, a wipe or a scale, so nothing here is a fade.
     The trigger is .build rather than #s5, because #s5 is several
     viewports tall and its top crosses long before any of this is on
     screen. The travel is longer than the others because the two silences
     are beats and a beat needs room.
     ================================================================== */
  const build = document.querySelector('#s5 .build')
  if (build) {
    const lock = build.querySelector('.lockup')
    const line = build.querySelector('.big-line')
    const vis = line && ([...line.querySelectorAll('span')].find((n) => getComputedStyle(n).display !== 'none') || line)
    let lines = null
    if (vis) { try { lines = new SplitText(vis, { type: 'lines', mask: 'lines', linesClass: 'ln' }).lines } catch {} }
    const tag = build.querySelector('.nametag')

    const tl = gsap.timeline({ paused: true })
    if (lock) {
      tl.from(lock.querySelector('.lockup-seal'), { scale: 0.78, rotate: -14, duration: 0.95, ease: 'house' }, 0)
        .from(lock.querySelector('.lockup-bar'), { scaleY: 0, transformOrigin: 'center', duration: 0.5, ease: 'house' }, 0.14)
        .from(lock.querySelectorAll('.lockup-1, .lockup-2, .lockup-3'), {
          clipPath: 'inset(0 100% 0 0)', duration: 0.6, ease: 'house', stagger: 0.055,
        }, 0.2)
    }
    if (lines) tl.from(lines, { yPercent: 112, duration: 1.05, ease: 'house', stagger: 0.07 }, 0.42)
    /* the two silences are the whole idea: 1.30 and 1.95 are held on purpose */
    tl.from(build.querySelector('.klasstag'), {
      clipPath: 'inset(0 0 100% 0)', yPercent: 22, duration: 0.5, ease: 'house',
    }, 1.30)
    if (tag) {
      tl.from(tag, {
        clipPath: 'inset(0 0 100% 0)', rotate: -5, scale: 1.12, duration: 0.62,
        ease: CustomEase.create('pin', 'M0,0 C0.2,0 0.1,1.06 0.55,1.01 0.78,0.985 0.82,1 1,1'),
      }, 1.95)
    }
    arrive(tl, build, { start: 'top 88%', end: 'top 16%', scrub: 0.7 })
    /* The bloom used to be a callback inside the scrubbed timeline, so how
       long it appeared to last depended on how fast the wheel was turning,
       and on a quick scroll it was over before the tag had settled. It runs
       off its own trigger now: once, in real time, at the point the ceremony
       finishes, so it always plays at full length with the tag on screen. */
    if (tag) {
      ScrollTrigger.create({
        trigger: build, start: 'top 22%', once: true,
        onEnter: () => tag.classList.add('pinned'),
      })
    }
  }

  /* ---- 05's six cells: one grid, its own arrival, the record cell too ---- */
  const m6 = document.querySelector('#s5 .m6')
  if (m6) {
    arrive(gsap.timeline().from(m6.querySelectorAll('.cell'), {
      clipPath: 'inset(0 0 100% 0)', duration: 0.95, ease: 'house', stagger: 0.075,
    }), m6, { start: 'top 92%', end: 'top 34%' })
  }

  /* ---- 06, the wall goes up ----
     In the order a hand would put it there: the pass and the note first,
     then the line under them. The stack on the right drops onto its clip on
     its own trigger, because it sits beside the text rather than under it.
     Scrubbed like every other arrival on the page, so nothing has run
     before the section is actually reached. */
  /* the band across the top draws first, then the display line comes up in
     lines the way 05's does, so the two private sections arrive alike */
  const s6h = document.querySelector('#s6 .sec-head')
  if (s6h) {
    const tl = gsap.timeline({ paused: true })
    tl.from(s6h, { clipPath: 'inset(0 0 100% 0)', duration: 0.52, ease: 'house' }, 0)
    const h = document.querySelector('#s6 .wall-h')
    const vis = h && ([...h.querySelectorAll(':scope > span')].find((n) => getComputedStyle(n).display !== 'none') || h)
    let lines = null
    if (vis) { try { lines = new SplitText(vis, { type: 'lines', mask: 'lines', linesClass: 'ln' }).lines } catch {} }
    if (lines) tl.from(lines, { yPercent: 112, duration: 0.92, ease: 'house', stagger: 0.08 }, 0.24)
    arrive(tl, s6h, { start: 'top 92%', end: 'top 16%' })
  }

  const paper = document.querySelectorAll('#s6 .wall-row > *')
  if (paper.length) {
    /* y and opacity only. both pieces carry a rotate in the stylesheet and
       GSAP writes the whole transform, so naming rotate here would flatten
       the tilt the moment the tween ended. */
    const tl = gsap.timeline({ paused: true })
    tl.from(paper, { y: 28, opacity: 0, duration: 0.72, ease: 'house', stagger: 0.15 }, 0)
    const lbl = document.querySelector('#s6 .wall-lbl')
    if (lbl) tl.from(lbl, { opacity: 0, duration: 0.5, ease: 'power2.out' }, 0.62)
    arrive(tl, '#s6 .wall-row', { start: 'top 96%', end: 'top 28%' })
  }

  const stack = document.querySelector('#s6 .stack')
  if (stack) {
    const tl = gsap.timeline({ paused: true })
    tl.from(stack.querySelector('.bull'), { y: -16, opacity: 0, duration: 0.42, ease: 'back.out(2)' }, 0)
      .from(stack.querySelector('.sh-top'), { y: -26, opacity: 0, duration: 0.8, ease: 'house' }, 0.12)
      .from(stack.querySelectorAll('.sh'), { opacity: 0, duration: 0.5, ease: 'power2.out', stagger: 0.1 }, 0.4)
    arrive(tl, stack, { start: 'top 94%', end: 'top 22%' })
  }

  /* ---- 06, developing: the prints come up in the tray ----
     The ground under them is paper now, so they surface out of white rather
     than out of black. Filter only: the track is scrubbed sideways, and
     anything touching transform here would fight that tween for the same
     property and the print would jump on every refresh. */
  const slots = document.querySelectorAll('#s6 .slot:not([hidden])')
  if (slots.length) {
    arrive(gsap.timeline().fromTo(slots,
      { filter: 'brightness(1.9) saturate(0) contrast(.45)' },
      { filter: 'brightness(1) saturate(1) contrast(1)', duration: 1.2, ease: 'power2.out', stagger: 0.13 }),
      '#s6 .stage', { start: 'top 92%', end: 'top 14%' })
  }

  /* ---- 07, focus pull: the section about aim resolves like a lens ---- */
  const aim = document.querySelector('#s7 .aim')
  if (aim) {
    arrive(gsap.timeline().fromTo(aim.querySelectorAll(':scope > *'),
      { filter: 'blur(13px)', scale: 1.028, opacity: 0, transformOrigin: '50% 60%' },
      { filter: 'blur(0px)', scale: 1, opacity: 1, duration: 0.85, ease: 'power3.out', stagger: 0.13 }),
      aim, { start: 'top 90%', end: 'top 46%' })
  }

  /* ---- 08, roll call again: the last block answers line by line ---- */
  const s8 = document.querySelector('#s8 .sell')
  if (s8) {
    const rows = [
      s8.querySelector('.lead-s8'), s8.querySelector('.addr'),
      s8.querySelector('.tel'), s8.querySelector('.note'), s8.querySelector('.links'),
    ].filter(Boolean)
    arrive(gsap.timeline().from(rows, {
      clipPath: 'inset(0 0 106% 0)', yPercent: 16, duration: 0.62, ease: 'house', stagger: 0.11,
    }), s8, { start: 'top 90%', end: 'top 40%' })
    const rule = document.querySelector('#s8 .horizon .rule')
    if (rule) arrive(gsap.timeline().from(rule, {
      scaleX: 0, transformOrigin: 'left center', duration: 1.2, ease: 'house',
    }), '#s8', { start: 'top 86%', end: 'top 46%' })
  }

  /* ---- the sheet underneath recedes as the next one covers it ----
     Depth is what turns a stack of sections into a sequence of surfaces.
     Only the overlay's opacity moves: transforming a section would make it
     measure its own trigger against a position it is in the middle of
     changing. */
  gsap.utils.toArray('main > section, footer').forEach((sec, i, all) => {
    const next = all[i + 1]
    if (!next) return
    gsap.fromTo(sec, { '--recede': 0 }, {
      '--recede': 1, ease: 'none',
      scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 34%', scrub: 0.5 },
    })
  })

  ScrollTrigger.refresh()
}

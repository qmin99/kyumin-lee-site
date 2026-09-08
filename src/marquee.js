import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

/* Seamless loop, GreenSock helper (docs/v3/HelperFunctions/helpers/seamlessLoop).
   Uses xPercent so it survives resize, and measures each item so copies do
   not have to be pixel identical. Trimmed to the non draggable form. */
function horizontalLoop(items, config = {}) {
  items = gsap.utils.toArray(items)
  const tl = gsap.timeline({
    repeat: config.repeat,
    paused: config.paused,
    defaults: { ease: 'none' },
    onReverseComplete: () => tl.totalTime(tl.rawTime() + tl.duration() * 100),
  })
  const length = items.length
  const startX = items[0].offsetLeft
  const times = []
  const widths = []
  const xPercents = []
  let curIndex = 0
  const pixelsPerSecond = (config.speed || 1) * 100
  const snap = config.snap === false ? (v) => v : gsap.utils.snap(config.snap || 1)

  gsap.set(items, {
    xPercent: (i, el) => {
      const w = (widths[i] = parseFloat(gsap.getProperty(el, 'width', 'px')))
      xPercents[i] = snap(
        (parseFloat(gsap.getProperty(el, 'x', 'px')) / w) * 100 + gsap.getProperty(el, 'xPercent'),
      )
      return xPercents[i]
    },
  })
  gsap.set(items, { x: 0 })

  const totalWidth =
    items[length - 1].offsetLeft +
    (xPercents[length - 1] / 100) * widths[length - 1] -
    startX +
    items[length - 1].offsetWidth * gsap.getProperty(items[length - 1], 'scaleX') +
    (parseFloat(config.paddingRight) || 0)

  for (let i = 0; i < length; i++) {
    const item = items[i]
    const curX = (xPercents[i] / 100) * widths[i]
    const distanceToStart = item.offsetLeft + curX - startX
    const distanceToLoop = distanceToStart + widths[i] * gsap.getProperty(item, 'scaleX')
    tl.to(item, {
      xPercent: snap(((curX - distanceToLoop) / widths[i]) * 100),
      duration: distanceToLoop / pixelsPerSecond,
    }, 0)
      .fromTo(item, {
        xPercent: snap(((curX - distanceToLoop + totalWidth) / widths[i]) * 100),
      }, {
        xPercent: xPercents[i],
        duration: (curX - distanceToLoop + totalWidth - curX) / pixelsPerSecond,
        immediateRender: false,
      }, distanceToLoop / pixelsPerSecond)
      .add('label' + i, distanceToStart / pixelsPerSecond)
    times[i] = distanceToStart / pixelsPerSecond
  }
  tl.times = times
  tl.progress(1, true).progress(0, true)
  if (config.reversed) { tl.vars.onReverseComplete(); tl.reverse() }
  return tl
}

/* ------------------------------------------------------------------
   The overline becomes a marquee that answers the scroll. Direction
   flips with scroll direction, speed rides scroll velocity and eases
   back to 1. Values from GreenSock pens rNGxEvq and wvQYoMy.
   ------------------------------------------------------------------ */
export function initMarquee({ reduce = false } = {}) {
  const hosts = document.querySelectorAll('[data-overline]')
  if (!hosts.length) return

  const loops = []

  hosts.forEach((host) => {
    const text = host.getAttribute('data-overline')
    const dir = host.getAttribute('data-overline-dir') === 'rtl' ? -1 : 1

    /* the rail is position:absolute with width:max-content, so at 390px it
       runs to 4158px and the document scrolls sideways. it gets its own
       clipping parent rather than overflow on the section: overflow-x:clip
       against overflow-y:visible computes the other axis to auto, which
       would turn every section into a scroll container and stop .sec-head
       from sticking to the viewport. */
    const clip = document.createElement('div')
    clip.className = 'overline-clip'
    clip.setAttribute('aria-hidden', 'true')

    const rail = document.createElement('div')
    rail.className = 'overline-rail'
    rail.setAttribute('aria-hidden', 'true')
    clip.appendChild(rail)

    /* enough copies that the track always overflows the viewport */
    const copies = 6
    for (let i = 0; i < copies; i++) {
      const span = document.createElement('span')
      span.className = 'overline-item'
      span.textContent = text
      rail.appendChild(span)
    }
    host.prepend(clip)

    if (reduce) return

    const loop = horizontalLoop(rail.querySelectorAll('.overline-item'), {
      repeat: -1,
      speed: 0.32,
      reversed: dir < 0,
      paddingRight: parseFloat(gsap.getProperty(rail.firstElementChild, 'marginRight', 'px')) || 0,
    })
    loops.push({ loop, base: dir })
  })

  if (reduce || !loops.length) return

  /* one ScrollTrigger drives every rail */
  let lastDir = 1
  ScrollTrigger.create({
    onUpdate(self) {
      const v = Math.abs(self.getVelocity())
      const boost = gsap.utils.clamp(1, 4.5, 1 + v / 900)
      if (self.direction !== lastDir) lastDir = self.direction
      loops.forEach(({ loop, base }) => {
        const sign = base * lastDir
        gsap.to(loop, { timeScale: sign * boost, duration: 0.25, ease: 'power2.out', overwrite: true })
        gsap.to(loop, { timeScale: sign, duration: 1.1, ease: 'power2.out', delay: 0.28, overwrite: false })
      })
    },
  })
}

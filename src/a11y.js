/* a11y.js
 * Accessibility layer. Owner: D1.
 *
 * This module writes to the DOM at runtime because index.html and page.css
 * belong to other agents. Every insertion here is annotated with the markup
 * that should eventually replace it in index.html, so the runtime version can
 * be deleted rather than maintained. Search for MOVE-TO-HTML.
 *
 * R2 found Markup and Accessibility to be the lowest scoring criteria in the
 * Awwwards sample and, at the same time, the two this project depends on most:
 * the bilingual half of the site and its searchability both sit on them.
 *
 * Entry point:
 *   import * as a11y from './a11y.js'
 *   a11y.init()                      // FIRST, before any GSAP or ScrollTrigger
 *   a11y.introStart(introEl, { onSkip })   // when the intro begins
 *   a11y.introEnd()                        // inside releaseIntro()
 */

/* ------------------------------------------------------------------ *
 * Strings. Sourced from C3 appendix A-11 where C3 fixed them.
 * ------------------------------------------------------------------ */

const S = {
  en: {
    skip: 'Skip to content',
    skipIntro: 'Skip intro',
    landmarks: { s1: 'Introduction', s2: 'Range', s3: 'Current work', s4: 'Capability', s5: 'Record', s6: '06', s7: 'Direction', s8: 'Contact' },
    banner: 'Language',
    motionOn: 'Motion on', motionOff: 'Motion off',
    pauseAll: 'Pause all clips', playAll: 'Play all clips',
    play: 'Play', pause: 'Pause', progress: 'Progress',
    record: 'Record',
    langChanged: 'Page language is now English.',
    detect: { text: 'This page is also in English.', link: 'Read in English', close: 'Dismiss' },
  },
  ko: {
    skip: '본문으로 건너뛰기',
    skipIntro: '인트로 건너뛰기',
    landmarks: { s1: '소개', s2: '범위', s3: '하는 일', s4: '할 수 있는 것', s5: '기록', s6: '06', s7: '지향', s8: '연락' },
    banner: '언어',
    motionOn: '모션 켜짐', motionOff: '모션 꺼짐',
    pauseAll: '모든 클립 일시정지', playAll: '모든 클립 재생',
    play: '재생', pause: '일시정지', progress: '진행',
    record: '기록',
    langChanged: '페이지 언어가 한국어로 바뀌었습니다.',
    detect: { text: '한국어 페이지가 있습니다.', link: '한국어로 보기', close: '닫기' },
  },
}

const html = () => document.documentElement
const lang = () => (html().getAttribute('data-lang') === 'ko' ? 'ko' : 'en')
const t = () => S[lang()]

/* ------------------------------------------------------------------ *
 * Injected stylesheet
 * MOVE-TO-HTML: every rule below belongs in page.css. It lives here only so
 * that D1 can ship without editing a file it does not own.
 * ------------------------------------------------------------------ */

const CSS = `
.a11y-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
/* index.html ships <a class="skip-link"> with no rule of its own anywhere in
   the document, so it renders as a permanently visible link above the header.
   Both class names are styled here: the injected one and the authored one. */
.a11y-skip,.skip-link{position:fixed;top:8px;left:8px;z-index:400;
  background:var(--ground,#F4F1EA);color:var(--text,#2A2621);
  border:1px solid var(--rule-strong,#C9C2B6);border-radius:2px;
  font:600 12px/1 var(--mono,ui-monospace,monospace);letter-spacing:.06em;
  padding:11px 14px;text-decoration:none;white-space:nowrap;
  transform:translateY(-180%);transition:transform .14s ease-out}
.a11y-skip:focus,.skip-link:focus{transform:translateY(0)}
/* Focus is never invisible. The page has no focus styles of its own. */
:where(a,button,input,select,textarea,summary,[tabindex]):focus-visible{
  outline:2px solid var(--accent,#AF3520);outline-offset:3px;border-radius:1px}
/* A programmatic landing target must not draw a ring. */
[tabindex="-1"]:focus{outline:none}
/* WCAG 1.4.3: the intro skip control was #5A544C on #0E0D0C, about 2.1:1.
   10.5px text needs 4.5:1. MOVE-TO-HTML, this overrides index.html. */
#skip{color:#B9B2A6}
#skip:focus-visible{outline:2px solid #E4DED2;outline-offset:3px}
/* Korean line breaking. C3 6.8: keep-all is an accessibility item, and
   break-word must not be set alongside it because it cancels keep-all. */
html[data-lang="ko"] body{word-break:keep-all;overflow-wrap:anywhere}
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;
    transition-duration:.01ms!important;scroll-behavior:auto!important}
}
html.no-motion{scroll-behavior:auto}
.a11y-langbar{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;gap:16px;
  align-items:center;justify-content:center;flex-wrap:wrap;
  padding:12px 18px;background:var(--ground-2,#EAE6DC);
  border-top:1px solid var(--rule,#DDD7CB);
  font:400 13px/1.4 var(--lat,system-ui,sans-serif)}
.a11y-langbar a{color:var(--accent,#AF3520)}
.a11y-langbar button{background:none;border:0;cursor:pointer;color:var(--dim,#736B60);
  font:inherit;text-decoration:underline;padding:4px}
`

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

let started = false
let live = null            // polite live region
let skipLink = null
let mainEl = null
let introHandle = null
const motionSubs = new Set()

const LS = {
  get(k) { try { return localStorage.getItem(k) } catch (_) { return null } },
  set(k, v) { try { localStorage.setItem(k, v) } catch (_) {} },
}
const KEY_MOTION = 'd1:motion'
const KEY_LANGBAR = 'd1:langbar-dismissed'

/* ------------------------------------------------------------------ *
 * Public: init
 * ------------------------------------------------------------------ */

/**
 * @param {object} [o]
 * @param {boolean} [o.wrapMain=true]  move sections into a <main> landmark.
 * @param {boolean} [o.landmarkLabels=true]
 * @param {boolean} [o.reduceMotion=false] initial motion policy from env.
 */
export function init(o = {}) {
  if (started) return api
  started = true

  injectStyle()
  live = makeLive()
  mainEl = ensureMain(o.wrapMain !== false)
  skipLink = ensureSkipLink()
  if (o.landmarkLabels !== false) labelLandmarks()
  markDecorative()
  wireMotion(o.reduceMotion === true)
  fixIntroSemantics()
  observeLangAttr()
  return api
}

function injectStyle() {
  if (document.getElementById('a11y-css')) return
  const el = document.createElement('style')
  el.id = 'a11y-css'
  el.textContent = CSS
  document.head.appendChild(el)
}

/* One polite region for the whole page. Never more than one: two live regions
 * on a page produce double announcements in JAWS and NVDA. */
function makeLive() {
  let el = document.getElementById('a11y-live')
  if (el) return el
  el = document.createElement('div')
  el.id = 'a11y-live'
  el.className = 'a11y-sr'
  el.setAttribute('role', 'status')
  el.setAttribute('aria-live', 'polite')
  el.setAttribute('aria-atomic', 'true')
  document.body.appendChild(el)
  return el
}

export function announce(msg) {
  if (!live) return
  live.textContent = ''
  // One frame of clearing, otherwise a repeated identical string is not spoken.
  requestAnimationFrame(() => { live.textContent = msg })
}

/* ------------------------------------------------------------------ *
 * Landmarks
 * ------------------------------------------------------------------ */

/* MOVE-TO-HTML:
 *   <a class="a11y-skip" href="#main">Skip to content</a>
 *   <header class="top" role="banner"> ... </header>
 *   <main id="main"> ...sections 01 to 07... </main>
 *   <footer id="s8"> ... </footer>
 * index.html currently has no main landmark at all, so a screen reader user
 * has no way to jump past the fixed top bar, and the skip link would have
 * nothing to point at. */
function ensureMain(wrap) {
  let m = document.querySelector('main')
  if (m) { if (!m.id) m.id = 'main'; return m }
  if (!wrap) return null

  const sections = [...document.querySelectorAll('body > section')]
  if (!sections.length) return null

  m = document.createElement('main')
  m.id = 'main'
  m.setAttribute('tabindex', '-1')
  sections[0].parentNode.insertBefore(m, sections[0])
  // Static flow elements only. #intro and .top are fixed and stay where they
  // are; the footer stays outside main so it keeps its contentinfo role.
  sections.forEach((s) => m.appendChild(s))

  const top = document.querySelector('.top')
  if (top && !top.getAttribute('role') && top.tagName !== 'HEADER') top.setAttribute('role', 'banner')
  return m
}

/* Adopt an authored skip link if index.html has one, rather than shipping a
 * second. Two skip links is worse than none: the second one reads as noise and
 * the keyboard user cannot tell which does what. */
function ensureSkipLink() {
  let a = document.querySelector('.a11y-skip, .skip-link')
  let authored = Boolean(a)
  if (!a) {
    a = document.createElement('a')
    a.className = 'a11y-skip'
    a.id = 'a11y-skip'
    a.href = '#' + (mainEl ? mainEl.id : 's1')
    a.textContent = t().skip
  }
  a.dataset.a11yAuthored = authored ? '1' : '0'
  a.addEventListener('click', (e) => {
    // A bare hash link moves the visual viewport but not focus in Safari and
    // Firefox. Move focus explicitly or the skip link does nothing for the
    // keyboard user it exists for.
    const target = document.querySelector(a.getAttribute('href'))
    if (!target) return
    e.preventDefault()
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'start', behavior: prefersReduce() ? 'auto' : 'smooth' })
  })
  if (!authored) document.body.insertBefore(a, document.body.firstChild)
  return a
}

/* C3 A-11 fixed the landmark names. A section with no accessible name is not
 * navigable by landmark, which is the main way a screen reader user skims.
 *
 * index.html now carries these names itself and re-applies them from
 * renderRows() on every language switch. Two owners writing the same attribute
 * is how attributes drift, so this only fills gaps and never overwrites. If a
 * section here is silently skipped, index.html already has it right. */
function labelLandmarks() {
  const names = t().landmarks
  for (const id of Object.keys(names)) {
    const el = document.getElementById(id)
    if (!el) continue
    if (el.tagName !== 'SECTION' && el.tagName !== 'FOOTER') continue
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) continue
    el.setAttribute('aria-label', names[id])
  }
  const tbl = document.querySelector('table.ev')
  if (tbl && !tbl.getAttribute('aria-label') && !tbl.querySelector('caption')) tbl.setAttribute('aria-label', t().record)
}

/* Things that must never reach the accessibility tree. */
function markDecorative() {
  // The index counter rewrites itself on every scroll frame. If it is ever
  // wrapped in a live region or read as content it becomes a stream of
  // "02 slash 07" announcements. It is chrome, not content.
  const idx = document.querySelector('.idx')
  if (idx) { idx.setAttribute('aria-hidden', 'true'); idx.setAttribute('role', 'presentation') }
  document.querySelectorAll('canvas').forEach((c) => {
    if (c.id === 'introcv') return  // handled in fixIntroSemantics
    c.setAttribute('aria-hidden', 'true')
    c.setAttribute('role', 'presentation')
  })
  // Decorative rules and the closing dot.
  document.querySelectorAll('hr.rule, .dot').forEach((el) => el.setAttribute('aria-hidden', 'true'))
}

/* ------------------------------------------------------------------ *
 * Intro
 * ------------------------------------------------------------------ */

/* The brief's constraint: the intro is decorative and stays out of the
 * accessibility tree, but the page underneath must not be sealed off while it
 * runs.
 *
 * index.html puts aria-hidden on #intro, which is the wrong node. It hides the
 * canvas (correct) and the Skip button (a bug: the only escape hatch becomes
 * unreachable to a screen reader user). This moves aria-hidden down to the
 * canvas and leaves the control exposed.
 *
 * MOVE-TO-HTML:
 *   <div id="intro">
 *     <canvas id="introcv" aria-hidden="true" role="presentation"></canvas>
 *     <button id="skip" type="button">...</button>
 *   </div>
 */
function fixIntroSemantics() {
  const intro = document.getElementById('intro')
  if (!intro) return
  intro.removeAttribute('aria-hidden')
  const cv = document.getElementById('introcv')
  if (cv) { cv.setAttribute('aria-hidden', 'true'); cv.setAttribute('role', 'presentation') }
  const skip = document.getElementById('skip')
  if (skip) {
    skip.setAttribute('type', 'button')
    skip.setAttribute('aria-label', t().skipIntro)
  }
}

/**
 * introStart(introEl, { onSkip })
 *
 * Call when the intro begins. Returns a disposer.
 *
 * html.intro-on sets overflow:hidden on html and body. That blocks
 * scroll-into-view, which is how a screen reader moves its virtual cursor, and
 * it blocks a keyboard user from reaching anything. The resolution is not to
 * seal the page harder, it is to make the lock end on the first input of any
 * kind: Tab, Enter, Space, Escape, a wheel, a touch drag, or a click. After
 * that the intro cannot trap anyone in any modality.
 */
export function introStart(introEl, { onSkip } = {}) {
  const el = introEl || document.getElementById('intro')
  if (!el || !onSkip) return () => {}

  let done = false
  let how = 'auto'
  const fire = (via) => {
    if (done) return
    done = true
    how = via
    cleanup()
    try { onSkip(via) } catch (_) {}
  }

  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      // Tab must not also move focus into the page behind the overlay.
      if (e.key === 'Tab') e.preventDefault()
      fire('keyboard')
    }
  }
  const onPointer = () => fire('pointer')
  const onWheel = () => fire('pointer')

  addEventListener('keydown', onKey, true)
  addEventListener('wheel', onWheel, { passive: true, once: true })
  addEventListener('touchmove', onWheel, { passive: true, once: true })
  const skipBtn = document.getElementById('skip')
  skipBtn && skipBtn.addEventListener('click', onPointer)

  function cleanup() {
    removeEventListener('keydown', onKey, true)
    removeEventListener('wheel', onWheel)
    removeEventListener('touchmove', onWheel)
    skipBtn && skipBtn.removeEventListener('click', onPointer)
  }

  introHandle = { get how() { return how }, cleanup, fire }
  return cleanup
}

/**
 * introEnd()
 *
 * Call inside releaseIntro(), after the overlay has been removed.
 *
 * Removing a node that holds focus drops focus to <body>. For a keyboard user
 * that means the next Tab starts over from the browser chrome; for a screen
 * reader user the virtual cursor silently resets. Both are the classic "the
 * page ate my place" bug.
 *
 * Where focus should go depends on how the intro ended, which is why
 * introStart records it:
 *  - ended by keyboard: focus the skip link. It is the first focusable node in
 *    the document, so the keyboard user resumes at the natural start and the
 *    next Tab reaches the top bar. It is also visible on focus, which confirms
 *    the input did something.
 *  - ended by pointer or by the timeline finishing: focus <main> with
 *    tabindex="-1" and no ring, so nothing visibly changes for a mouse user
 *    but the reading position is still correct.
 */
export function introEnd() {
  const via = introHandle ? introHandle.how : 'auto'
  if (introHandle) { introHandle.cleanup(); introHandle = null }
  const target = via === 'keyboard' ? (skipLink || mainEl) : (mainEl || skipLink)
  if (!target) return
  if (!target.hasAttribute('tabindex') && target.tagName !== 'A') target.setAttribute('tabindex', '-1')
  try { target.focus({ preventScroll: true }) } catch (_) { target.focus() }
}

/* ------------------------------------------------------------------ *
 * Motion policy
 * ------------------------------------------------------------------ */

function prefersReduce() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const motion = {
  enabled: true,
  subscribe(fn) { motionSubs.add(fn); return () => motionSubs.delete(fn) },
  set(on, { persist = true } = {}) { applyMotion(!!on, persist) },
  toggle() { applyMotion(!motion.enabled, true) },
}

function applyMotion(on, persist) {
  motion.enabled = on
  html().classList.toggle('no-motion', !on)
  if (persist) LS.set(KEY_MOTION, on ? '1' : '0')
  const btn = document.getElementById('motion')
  if (btn) {
    btn.setAttribute('aria-pressed', on ? 'false' : 'true')  // pressed = motion suppressed
    btn.setAttribute('aria-label', on ? t().motionOn : t().motionOff)
  }
  motionSubs.forEach((fn) => { try { fn(on) } catch (_) {} })
}

/* Single source of truth for motion, combining three inputs that index.html
 * and main.js currently treat separately:
 *   the OS preference, read live rather than once at load
 *   the visitor's explicit toggle, which now persists across page views
 *   the caller's tier verdict from env.js
 * An explicit toggle wins over the OS preference in both directions: a visitor
 * who turns motion on after the OS said reduce has asked for it by hand.
 */
function wireMotion(forceReduce) {
  const stored = LS.get(KEY_MOTION)
  const initial = stored !== null ? stored === '1' : !(prefersReduce() || forceReduce)
  applyMotion(initial, false)

  const btn = document.getElementById('motion')
  if (btn) {
    btn.setAttribute('type', 'button')
    btn.addEventListener('click', () => { motion.toggle(); announce(motion.enabled ? t().motionOn : t().motionOff) })
  }

  if (typeof matchMedia === 'function') {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e) => { if (LS.get(KEY_MOTION) === null) applyMotion(!e.matches, false) }
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener && mq.addListener(onChange)
  }
}

/* ------------------------------------------------------------------ *
 * Section 6 media
 * ------------------------------------------------------------------ */

/**
 * wireStage(root)
 *
 * Implements C3 6.5. The rule there is the whole design: what is on screen is
 * exactly what the accessibility tree gets. The two-field slate is all a
 * sighted visitor receives, so a screen reader user receives the same two
 * fields and nothing else. Writing a descriptive alt would be writing the
 * caption C3 forbids; writing none would be a 1.1.1 failure. aria-labelledby
 * pointing at the visible slate is the only construction that satisfies both.
 *
 * Also: the clips carry no audio track, so no caption track is required. That
 * is a property of the asset, not an exemption, and it stops being true the
 * moment a clip ships with sound.
 *
 * MOVE-TO-HTML, per slot:
 *   <figure class="slot">
 *     <video poster="/media/pv-01.jpg" muted playsinline preload="none"
 *            aria-labelledby="slate-pv-01"></video>
 *     <figcaption class="slate" id="slate-pv-01">SEOUL &middot; 2025.08</figcaption>
 *   </figure>
 */
export function wireStage(root) {
  const scope = root || document.getElementById('s6')
  if (!scope) return

  // Video slots. index.html ships .slot > .ph placeholder + span.slate, with a
  // comment saying the <video> replaces .ph later. Wire both shapes.
  const slots = [...scope.querySelectorAll('.slot')]
  slots.forEach((slot, i) => {
    const slate = slot.querySelector('.slate')
    const id = slate ? (slate.id || (slate.id = 'slate-pv-' + String(i + 1).padStart(2, '0'))) : null
    if (slot.tagName !== 'FIGURE' && !slot.getAttribute('role')) slot.setAttribute('role', 'figure')
    if (id) slot.setAttribute('aria-labelledby', id)

    const v = slot.querySelector('video')
    if (v) {
      v.muted = true
      v.setAttribute('muted', '')
      v.setAttribute('playsinline', '')
      // preload="none" is not politeness, it is the iOS canvas and page memory
      // ceiling. Four decoded videos plus a WebGL context is how a tab dies.
      if (!v.getAttribute('preload')) v.setAttribute('preload', 'none')
      if (id) v.setAttribute('aria-labelledby', id)
      v.removeAttribute('alt')   // <video> has no alt. The figure carries the name.
      if (!motion.enabled) { v.removeAttribute('autoplay'); v.autoplay = false; try { v.pause() } catch (_) {} }
    }
    // The placeholder block is scaffolding, never content.
    const ph = slot.querySelector('.ph')
    if (ph) ph.setAttribute('aria-hidden', 'true')
  })

  // The track. In the current markup it is a sibling .audio block, not a .slot.
  const audio = scope.querySelector('.audio')
  if (audio) {
    const slate = audio.querySelector('.slate')
    const id = slate ? (slate.id || (slate.id = 'slate-pa-01')) : null
    if (id && !audio.getAttribute('aria-labelledby')) audio.setAttribute('aria-labelledby', id)

    const btn = audio.querySelector('.play')
    if (btn) {
      btn.setAttribute('type', 'button')
      // C3: the label is Play, never "Play <track title>". The title sits
      // beside it as text; folding it in gives this chapter the one sentence
      // it is not allowed to have.
      btn.setAttribute('aria-label', t().play)
      btn.dataset.a11yRole = 'play'
      // aria-disabled="true" with no source is honest, but it must flip the
      // moment a source is armed or the control is announced as dead forever.
      if (btn.dataset.src) btn.setAttribute('aria-disabled', 'false')
    }

    /* Progress. C3 6.5 asked for input[type=range] or role="slider" labelled
     * Progress. Decision: role="progressbar", not slider. There is no seek
     * interaction in this design, and a slider role promises an operable
     * control that does not exist, which fails 4.1.2 in the other direction.
     * A progressbar is the honest mapping of a read-only elapsed indicator. */
    const wave = audio.querySelector('.wave')
    if (wave) {
      wave.setAttribute('role', 'progressbar')
      wave.setAttribute('aria-label', t().progress)
      wave.setAttribute('aria-valuemin', '0')
      wave.setAttribute('aria-valuemax', '100')
      wave.setAttribute('aria-valuenow', '0')
      wave.querySelectorAll('i, canvas').forEach((el) => el.setAttribute('aria-hidden', 'true'))
    }
  }

  // Global pause. Once autoplaying media runs past five seconds, 2.2.2 requires
  // a mechanism to stop it, and nothing else here stops all four at once.
  ensureGlobalPause(scope)
}

/** Keep the progressbar truthful. Call from the audio timeupdate handler. */
export function setProgress(pct) {
  const wave = document.querySelector('#s6 .wave[role="progressbar"]')
  if (wave) wave.setAttribute('aria-valuenow', String(Math.max(0, Math.min(100, Math.round(pct)))))
}

/** Call when a clip or the track starts or stops, so the label stays truthful. */
export function setPlayState(btn, playing) {
  if (!btn) return
  btn.setAttribute('aria-label', playing ? t().pause : t().play)
}

function ensureGlobalPause(scope) {
  let btn = scope.querySelector('.a11y-pauseall')
  const anyVideo = scope.querySelector('video')
  if (!anyVideo) return null
  if (!btn) {
    btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'a11y-pauseall'
    btn.textContent = t().pause
    btn.setAttribute('aria-label', t().pauseAll)
    scope.insertBefore(btn, scope.firstChild)
    btn.addEventListener('click', () => {
      const vids = [...scope.querySelectorAll('video')]
      const anyPlaying = vids.some((v) => !v.paused)
      vids.forEach((v) => { try { anyPlaying ? v.pause() : v.play() } catch (_) {} })
      btn.textContent = anyPlaying ? t().play : t().pause
      btn.setAttribute('aria-label', anyPlaying ? t().playAll : t().pauseAll)
    })
  }
  return btn
}

/* ------------------------------------------------------------------ *
 * Language
 * ------------------------------------------------------------------ */

/**
 * wireLang({ mode, origin })
 *
 * R3b is unambiguous: the switch must be a real anchor whose href changes the
 * URL, because Googlebot does not click buttons and does not send
 * Accept-Language. index.html ships a <button>, which means the Korean half of
 * the site does not exist as far as search is concerned. That is the same
 * failure R3b documented at plus-ex.com.
 *
 * This replaces the button with the exact C3 5.6 block. In 'toggle' mode the
 * anchors still carry real mirrored hrefs, so the markup is already correct on
 * the day /ko/ ships and the interim click handler is the only thing to
 * delete. In 'route' mode nothing is intercepted and the browser navigates.
 *
 * MOVE-TO-HTML:
 *   <nav aria-label="Language">
 *     <a href="/"    hreflang="en" lang="en" aria-current="page">EN</a>
 *     <span aria-hidden="true">/</span>
 *     <a href="/ko/" hreflang="ko" lang="ko" aria-label="한국어">KO</a>
 *   </nav>
 */
export function wireLang({ mode = 'toggle', origin = '' } = {}) {
  const btn = document.getElementById('lang')
  /* The page is English only for now, so the control is not in the markup.
     Without a button there is nothing to replace, and injecting one into the
     bar anyway would put back exactly what was taken out. */
  if (!btn) return
  const host = btn.parentNode

  const nav = document.createElement('nav')
  nav.id = 'lang'
  nav.setAttribute('aria-label', S.en.banner)
  nav.style.display = 'inline-flex'
  nav.style.gap = '6px'
  nav.style.alignItems = 'center'

  const en = document.createElement('a')
  en.href = origin + enPath()
  en.hreflang = 'en'; en.lang = 'en'; en.textContent = 'EN'
  const sep = document.createElement('span')
  sep.setAttribute('aria-hidden', 'true'); sep.textContent = '/'
  const ko = document.createElement('a')
  ko.href = origin + koPath()
  ko.hreflang = 'ko'; ko.lang = 'ko'; ko.textContent = 'KO'
  ko.setAttribute('aria-label', '한국어')

  nav.append(en, sep, ko)
  if (btn) host.replaceChild(nav, btn); else host.appendChild(nav)

  const paint = () => {
    const cur = lang()
    en.toggleAttribute('aria-current', false); ko.toggleAttribute('aria-current', false)
    ;(cur === 'ko' ? ko : en).setAttribute('aria-current', 'page')
  }
  paint()

  if (mode === 'toggle') {
    const onClick = (e, next) => {
      e.preventDefault()
      setLang(next)
    }
    en.addEventListener('click', (e) => onClick(e, 'en'))
    ko.addEventListener('click', (e) => onClick(e, 'ko'))
  }

  document.addEventListener('a11y:langchange', paint)
  return nav
}

function enPath() {
  const p = location.pathname
  return p.startsWith('/ko/') ? p.slice(3) : (p === '/ko' ? '/' : p)
}
function koPath() {
  const p = location.pathname
  return p.startsWith('/ko/') || p === '/ko' ? p : ('/ko' + (p === '/' ? '/' : p))
}

/**
 * setLang(next)
 *
 * Interim JS switch. Keeps the three attributes that actually matter in sync:
 * data-lang for the CSS, lang on <html> so a screen reader picks the right
 * voice, and per-span lang so the hidden half is never read in the wrong
 * language if CSS fails to load.
 */
export function setLang(next) {
  const h = html()
  h.setAttribute('data-lang', next)
  h.setAttribute('lang', next)
  tagSpanLangs()
  labelLandmarks()
  refreshStrings()
  document.dispatchEvent(new CustomEvent('a11y:langchange', { detail: { lang: next } }))
  announce(t().langChanged)
}

/* [data-en] and [data-ko] spans carry no lang attribute in index.html. Both
 * halves are in the DOM at once; only CSS hides one. If the stylesheet is slow
 * or blocked, a screen reader reads Korean with an English voice. One attribute
 * per span removes the whole class of failure. */
export function tagSpanLangs(root) {
  const scope = root || document
  scope.querySelectorAll('[data-en]').forEach((el) => el.setAttribute('lang', 'en'))
  scope.querySelectorAll('[data-ko]').forEach((el) => el.setAttribute('lang', 'ko'))
}

function refreshStrings() {
  // Only retitle the skip link if this module created it. An authored one has
  // its own [data-en]/[data-ko] spans and index.html owns the swap.
  if (skipLink && skipLink.dataset.a11yAuthored === '0') skipLink.textContent = t().skip
  const wave = document.querySelector('#s6 .wave[role="progressbar"]')
  if (wave) wave.setAttribute('aria-label', t().progress)
  const introSkip = document.getElementById('skip')
  if (introSkip) introSkip.setAttribute('aria-label', t().skipIntro)
  const mBtn = document.getElementById('motion')
  if (mBtn) mBtn.setAttribute('aria-label', motion.enabled ? t().motionOn : t().motionOff)
  document.querySelectorAll('[data-a11y-role="play"]').forEach((b) => b.setAttribute('aria-label', t().play))
  const pauseAll = document.querySelector('.a11y-pauseall')
  if (pauseAll) pauseAll.setAttribute('aria-label', t().pauseAll)
  const tbl = document.querySelector('table.ev')
  if (tbl) tbl.setAttribute('aria-label', t().record)
}

/* If another module flips data-lang directly, keep the a11y attributes honest
 * rather than silently drifting out of sync. */
function observeLangAttr() {
  tagSpanLangs()
  let last = lang()
  new MutationObserver(() => {
    const now = lang()
    if (now === last) return
    last = now
    html().setAttribute('lang', now)
    labelLandmarks()
    refreshStrings()
    document.dispatchEvent(new CustomEvent('a11y:langchange', { detail: { lang: now } }))
  }).observe(html(), { attributes: true, attributeFilter: ['data-lang'] })
}

/**
 * langBanner({ origin })
 *
 * R3b: suggest, never redirect. Googlebot arrives from a United States IP with
 * no Accept-Language, so an automatic redirect gets one language crawled and
 * the other never indexed. C3 5.6 also fixed the rule that the banner is
 * written in the reader's language, not the page's.
 */
export function langBanner({ origin = '' } = {}) {
  if (LS.get(KEY_LANGBAR) === '1') return null
  const nav = (navigator.language || 'en').toLowerCase()
  const cur = lang()
  const wantsKo = nav.startsWith('ko')
  if (cur === 'en' && !wantsKo) return null
  if (cur === 'ko' && wantsKo) return null

  const other = cur === 'en' ? 'ko' : 'en'
  const copy = S[other].detect
  const bar = document.createElement('div')
  bar.className = 'a11y-langbar'
  bar.setAttribute('role', 'region')
  bar.setAttribute('aria-label', S[other].banner)
  bar.lang = other

  const p = document.createElement('span'); p.textContent = copy.text
  const a = document.createElement('a')
  a.href = origin + (other === 'ko' ? koPath() : enPath())
  a.hreflang = other; a.lang = other; a.textContent = copy.link
  const x = document.createElement('button')
  x.type = 'button'; x.textContent = copy.close
  x.addEventListener('click', () => { LS.set(KEY_LANGBAR, '1'); bar.remove() })

  bar.append(p, a, x)
  document.body.appendChild(bar)
  return bar
}

/* ------------------------------------------------------------------ *
 * Static fallback presentation
 * ------------------------------------------------------------------ */

/**
 * staticMode(on)
 *
 * Called when env drops to the static tier. R3 F-5: the reduced version has to
 * read as a different good version, not a broken one. So this removes the
 * canvases outright rather than leaving dead black rectangles, and drops the
 * intro's scroll lock if it is still on.
 */
export function staticMode(on = true) {
  const h = html()
  h.classList.toggle('static-tier', on)
  if (!on) return
  h.classList.remove('intro-on')
  document.getElementById('intro')?.remove()
  document.querySelectorAll('canvas').forEach((c) => c.remove())
  h.classList.remove('has-field')
}

/* ------------------------------------------------------------------ *
 * Audit helper. Used by the Playwright check, not shipped behaviour.
 * ------------------------------------------------------------------ */

export function audit() {
  const problems = []
  if (!document.querySelector('main')) problems.push('no main landmark')
  if (!document.querySelector('.a11y-skip, .skip-link')) problems.push('no skip link')
  if (html().getAttribute('lang') !== lang()) problems.push('html lang out of sync with data-lang')
  document.querySelectorAll('button, a').forEach((el) => {
    const name = (el.getAttribute('aria-label') || el.textContent || '').trim()
    if (!name) problems.push('unnamed control: ' + el.outerHTML.slice(0, 60))
    if (/^(here|link|여기|바로가기)$/i.test(name)) problems.push('meaningless link text: ' + name)
  })
  document.querySelectorAll('img').forEach((im) => {
    if (!im.hasAttribute('alt')) problems.push('img without alt: ' + (im.currentSrc || im.src))
  })
  document.querySelectorAll('canvas').forEach((c) => {
    if (c.getAttribute('aria-hidden') !== 'true') problems.push('canvas not aria-hidden: ' + (c.id || '?'))
  })
  const secs = [...document.querySelectorAll('section, footer')]
  secs.forEach((s) => {
    if (!s.getAttribute('aria-label') && !s.getAttribute('aria-labelledby')) problems.push('unnamed landmark: ' + (s.id || '?'))
  })
  return problems
}

const api = {
  init, announce, introStart, introEnd, motion, wireStage, setPlayState, setProgress,
  wireLang, setLang, tagSpanLangs, langBanner, staticMode, audit,
}
export default api

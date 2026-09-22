/* env.js
 * Environment detection and capability branching.
 * Owner: D1. No DOM writes, no styling, no side effects on import beyond
 * one 1x1 WebGL probe that is released immediately.
 *
 * Contract:
 *   import { env, watchPerf, guardContext, onTierChange, onViewportResize } from './env.js'
 *
 * env is a live object. Read env.tier at call time. Do not destructure and cache.
 *
 * Why this file exists: R4 named the LinkedIn in-app WebView the single most
 * likely failure path for this site. R3 F-2 rejected detect-gpu as a sole
 * signal because its benchmark corpus stopped updating in December 2025, which
 * makes 2026 hardware fall through to FALLBACK and be misread as slow. So the
 * tier here is decided by three things in order: what the browser actually is,
 * whether a WebGL context can actually be created, and then measured frame time.
 */

/* ------------------------------------------------------------------ *
 * 1. User agent
 * ------------------------------------------------------------------ */

const UA = typeof navigator === 'undefined' ? '' : navigator.userAgent || ''

/* Strong signals. Each of these is an app-injected token, verified against
 * captured user agent strings. Order matters: Messenger must be tested before
 * Facebook because FB_IAB / FBAN match both. */
const APP_TOKENS = [
  // Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) ... Safari/604.1 [LinkedInApp]/9.51.6066
  // Mozilla/5.0 (Linux; Android 16; ...; wv) ... Mobile Safari/537.36 [LinkedInApp]/2.309.56
  ['linkedin',  /\[LinkedInApp\]/i],
  // Android: "...Mobile Safari/537.36;KAKAOTALK 2409800" and "...KAKAOTALK/25.4.3 (INAPP)"
  // iOS:     "...Mobile/14B100 KAKAOTALK 5.9.2"
  ['kakaotalk', /kakaotalk/i],
  // Android: "...NAVER(inapp; search; 2000; 12.10.6)"
  ['naver',     /NAVER\(inapp/i],
  ['messenger', /\bFB[\w_]+\/(Messenger|MESSENGER)/],
  // iOS: [FBAN/FBIOS;FBAV/...]   Android: [FBAN/FB4A;...] or FB_IAB/FB4A;FBAV/...
  ['facebook',  /\bFB(?:AN|AV|_IAB|BV|DV|SV)[\/;]/],
  // iOS: "...Mobile/15E148 Instagram 147.0.0.30.121 (iPhone9,3; ...)"
  // Android: "...Mobile Safari/537.36 Instagram 30.0.0.12.95 Android (...)"
  ['instagram', /\bInstagram\b/i],
  ['threads',   /\bBarcelona\b/i],
  ['line',      /\bLine\//i],
  ['twitter',   /\bTwitter(?:Android|for)?/i],
  ['wechat',    /\bMicroMessenger\//i],
  ['tiktok',    /\bBytedanceWebview|musical_ly|\bTikTok\b/i],
  ['snapchat',  /\bSnapchat\b/i],
  ['slack',     /\bSlack\b/i],
  ['discord',   /\bDiscord\b/i],
]

const isIOS =
  /\b(iPhone|iPod|iPad)\b/.test(UA) ||
  // iPadOS 13+ reports as Macintosh. Touch points disambiguate.
  (/\bMacintosh\b/.test(UA) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
const isAndroid = /\bAndroid\b/.test(UA)
const isMobileUA = /\b(iPhone|iPod|iPad|Android|Mobile)\b/i.test(UA)

/* Weak signals. Used only to raise isWebView when no app token matched.
 *
 * Caveat that matters and is easy to get wrong: the classic iOS heuristic
 * "iPhone user agent with no Safari/ token" is NO LONGER reliable. The 2026
 * LinkedIn iOS user agent above carries Safari/604.1. It is caught by the
 * [LinkedInApp] token, not by the shape check. Instagram iOS still omits
 * Safari/, so the shape check is kept as a net for unnamed hosts only. */
const ANDROID_WV = /;\s*wv[;)]/i.test(UA) || /\bWebView\b/i.test(UA)
const IOS_NO_SAFARI = isIOS && !/Safari\//.test(UA)
// mobile Safari defines navigator.standalone (false when not homescreen).
// WKWebView leaves it undefined. Absent on Android entirely, so iOS only.
const IOS_NO_STANDALONE = isIOS && typeof navigator !== 'undefined' && navigator.standalone === undefined

function detectApp() {
  for (const [name, re] of APP_TOKENS) if (re.test(UA)) return name
  return null
}

const webviewApp = detectApp()
const isWebView = Boolean(webviewApp) || ANDROID_WV || IOS_NO_SAFARI || IOS_NO_STANDALONE

/* Apps whose embedded browser is documented as a bad WebGL host, or which are
 * a first-touch surface where a crash costs the most. LinkedIn is the one this
 * whole file was written for. */
const HOSTILE_APPS = new Set(['linkedin', 'kakaotalk', 'instagram', 'facebook', 'messenger', 'threads', 'tiktok', 'snapchat'])

/* Hostile is two separate claims that were being answered with one flag:
 * "thin the point clouds and cap the pixel ratio, this host is short on
 * memory" and "do not hand this host two video textures at once". Only the
 * second one costs the visitor the intro, which is the piece the page is
 * built around, and LinkedIn is where most first visits arrive from.
 *
 * So LinkedIn now keeps every memory protection a hostile host gets, the
 * halved counts and the 1.25 ratio, and plays the intro anyway. If it turns
 * out to blank or drop the tab there, put 'linkedin' back in this set and
 * nothing else has to change. */
const NO_INTRO_APPS = new Set([...HOSTILE_APPS].filter((a) => a !== 'linkedin'))

/* ------------------------------------------------------------------ *
 * 2. WebGL probe
 * ------------------------------------------------------------------ */

/* Probe on a 1x1 canvas and release the context immediately. Safari has a hard
 * cap on live WebGL contexts per page ("Too many active WebGL contexts"), so a
 * probe that holds one is a bug, not a diagnostic. */
export function probeWebGL() {
  const out = { ok: false, version: 0, renderer: '', vendor: '', maxTexture: 0, error: null }
  if (typeof document === 'undefined') return out
  let cv, gl
  try {
    cv = document.createElement('canvas')
    cv.width = cv.height = 1
    const attrs = { failIfMajorPerformanceCaveat: false, antialias: false, depth: false, stencil: false, alpha: true }
    gl = cv.getContext('webgl2', attrs)
    if (gl) out.version = 2
    if (!gl) { gl = cv.getContext('webgl', attrs) || cv.getContext('experimental-webgl', attrs); if (gl) out.version = 1 }
    if (!gl) { out.error = 'no-context'; return out }
    out.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) | 0
    // A context that reports a 0 max texture size is a dead stub. Seen on
    // blocklisted drivers and on some WebViews with GPU access denied.
    if (!out.maxTexture) { out.error = 'dead-context'; return out }
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      if (dbg) {
        out.renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
        out.vendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '')
      }
    } catch (_) { /* privacy-restricted, not an error */ }
    // Software rasterizers render, but not at interactive rates for a
    // fullscreen fragment pass. Treat as no WebGL for tier purposes.
    if (/SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(out.renderer)) {
      out.error = 'software-renderer'
      return out
    }
    out.ok = true
    return out
  } catch (e) {
    out.error = 'threw:' + (e && e.name || 'unknown')
    return out
  } finally {
    try { gl && gl.getExtension('WEBGL_lose_context')?.loseContext() } catch (_) {}
    if (cv) { cv.width = cv.height = 0 }
  }
}

const glProbe = probeWebGL()

/* ------------------------------------------------------------------ *
 * 3. Cheap hardware and preference signals
 * ------------------------------------------------------------------ */

const mqReduce = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false, addEventListener() {} }

const conn = (typeof navigator !== 'undefined' && (navigator.connection || navigator.mozConnection || navigator.webkitConnection)) || null

/* Data Saver. navigator.connection is Chromium only, which means it is absent
 * on every iOS browser (all of them are WebKit) and on Firefox. That asymmetry
 * is the reason it can only ever be a downgrade signal and never a gate: a
 * missing value must mean "no opinion", not "fine". */
function readSaveData() {
  if (!conn) return null
  return conn.saveData === true
}
function readSlowNet() {
  if (!conn || !conn.effectiveType) return null
  return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g'
}

const deviceMemory = (typeof navigator !== 'undefined' && navigator.deviceMemory) || null
const hardwareConcurrency = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || null

/* ------------------------------------------------------------------ *
 * 4. Session memory
 * ------------------------------------------------------------------ */

const SS = {
  get(k) { try { return sessionStorage.getItem(k) } catch (_) { return null } },
  set(k, v) { try { sessionStorage.setItem(k, v) } catch (_) {} },
}
const KEY_DEAD = 'd1:gl-dead'     // context was lost more than once. never try again this session.
const KEY_TIER = 'd1:tier-floor'  // lowest tier reached this session. do not climb back above it on reload.

/* ------------------------------------------------------------------ *
 * 5. Tier and budget
 * ------------------------------------------------------------------ */

const TIER_ORDER = ['static', 'lite', 'full']
const rank = (t) => TIER_ORDER.indexOf(t)

/* Pixel arithmetic behind the DPR caps, so the numbers are auditable.
 *   iPhone 15 Pro  393 x 852 CSS = 334,836 CSS px
 *     DPR 3.0 -> 3,013,524 device px   (2.33x a 1440x900 laptop)
 *     DPR 1.5 ->   753,381            (0.58x)
 *     DPR 1.25->   523,181            (0.40x)
 *   A fullscreen fragment pass costs in proportion to that number every frame.
 *   A point cloud does not: its cost is per vertex, and its fill is a few
 *   thousand small sprites. That difference is why the intro and the field get
 *   different verdicts below. */
function decideTier() {
  if (SS.get(KEY_DEAD) === '1') return { tier: 'static', reason: 'webgl-died-earlier-this-session' }
  if (mqReduce.matches)          return { tier: 'static', reason: 'prefers-reduced-motion' }
  if (!glProbe.ok)               return { tier: 'static', reason: 'webgl-probe:' + (glProbe.error || 'unknown') }
  if (readSlowNet() === true)    return { tier: 'static', reason: 'effective-connection-2g' }
  if (readSaveData() === true)   return { tier: 'lite',   reason: 'save-data' }
  if (isWebView)                 return { tier: 'lite',   reason: 'in-app-webview:' + (webviewApp || 'generic') }
  if (isMobileUA)                return { tier: 'lite',   reason: 'mobile-browser' }
  if (deviceMemory !== null && deviceMemory <= 2) return { tier: 'lite', reason: 'device-memory-' + deviceMemory }
  if (hardwareConcurrency !== null && hardwareConcurrency <= 2) return { tier: 'lite', reason: 'cores-' + hardwareConcurrency }
  return { tier: 'full', reason: 'desktop-webgl' + glProbe.version }
}

/* The budget is the whole point of the tier. main.js should never branch on
 * env.tier directly for numbers; it should read env.budget. That keeps every
 * magic number in one auditable place. */
function budgetFor(tier) {
  if (tier === 'static') {
    return { intro: false, field: false, fieldCount: 0, corridor: false, corridorCount: 0, dpr: 1, postprocessing: false, targetFps: 0, smoothScroll: false }
  }
  if (tier === 'lite') {
    const hostile = isWebView && HOSTILE_APPS.has(webviewApp)
    return {
      /* The intro survives the drop. A single slow frame window writes a
         lite floor, and dropping the intro there meant one dip cost the
         visitor the one thing the page is built around, for the whole of
         the floor's life. It plays here at the smaller encode instead.
         The hosts that go without are the ones in NO_INTRO_APPS, which is
         every hostile app except LinkedIn: see the note on that set. */
      intro: !(isWebView && NO_INTRO_APPS.has(webviewApp)),
      field: true,
      // Vertex-bound work. Halved again inside a hostile in-app WebView.
      fieldCount: hostile ? 12000 : 24000,
      /* The corridor survives the drop. It is section 03's only content and
         the section makes no sense without it, so a lite floor thins the
         point cloud rather than removing the piece. The raymarch itself is
         fill-bound and costs about 2ms measured against an empty frame, so
         the points are what gets cut. */
      corridor: true,
      corridorCount: hostile ? 12000 : 22000,
      dpr: Math.min(devicePixelRatioSafe(), hostile ? 1.25 : 1.5),
      postprocessing: false,
      // R3 F-4: a phone GPU boosts then throttles. Capping at 30 costs little
      // visually and roughly halves the sustained load, which is what stops the
      // "60fps for ten seconds then 25fps forever" pattern.
      targetFps: 30,
      smoothScroll: false,
    }
  }
  return {
    intro: true,
    field: true,
    fieldCount: 130000,
    corridor: true,
    corridorCount: 60000,
    dpr: Math.min(devicePixelRatioSafe(), 2),
    postprocessing: true,
    targetFps: 60,
    smoothScroll: true,
  }
}

function devicePixelRatioSafe() {
  const d = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1
  return d > 0 && isFinite(d) ? d : 1
}

const first = decideTier()

/* A tier floor persisted for the session. If the phone already proved it could
 * not hold the budget on a previous page view, do not make it prove it twice.
 * Every re-proof is another thermal ramp. */
/* The floor expires. Written without one it survives every reload for the
 * whole session, and there is no way back up: a tier of static stops the
 * frame-time watcher, so the recovery path is dead too. One slow window
 * while a video decoded would then leave the visitor on a document with no
 * intro, no field and no smooth scroll until they closed the tab. A device
 * that was hot twenty minutes ago has probably cooled. */
const FLOOR_TTL_MS = 20 * 60 * 1000
function readFloor() {
  const raw = SS.get(KEY_TIER)
  if (!raw) return null
  const [t, at] = String(raw).split('|')
  if (rank(t) === -1) return null
  const ts = Number(at)
  if (!at || !isFinite(ts)) return t          // written by an older build
  return Date.now() - ts < FLOOR_TTL_MS ? t : null
}
const floor = readFloor()
let startTier = first.tier
if (floor && rank(floor) < rank(startTier)) startTier = floor

export const env = {
  // raw
  ua: UA,
  isIOS, isAndroid,
  isMobile: isMobileUA,
  isWebView,
  webviewApp,
  webviewHostile: Boolean(isWebView && HOSTILE_APPS.has(webviewApp)),
  // capability
  canWebGL: glProbe.ok,
  webglVersion: glProbe.version,
  gpu: glProbe.renderer || null,
  maxTexture: glProbe.maxTexture,
  deviceMemory, hardwareConcurrency,
  saveData: readSaveData(),
  slowNet: readSlowNet(),
  lowBattery: null,   // filled in asynchronously, Chromium only. See below.
  // verdict
  tier: startTier,
  reason: startTier === first.tier ? first.reason : 'session-floor:' + floor,
  dpr: budgetFor(startTier).dpr,
  budget: budgetFor(startTier),
  reduceMotion: mqReduce.matches,
}

/* ------------------------------------------------------------------ *
 * 6. Subscriptions
 * ------------------------------------------------------------------ */

const tierSubs = new Set()
const motionSubs = new Set()

export function onTierChange(fn) { tierSubs.add(fn); return () => tierSubs.delete(fn) }
export function onReduceMotionChange(fn) { motionSubs.add(fn); return () => motionSubs.delete(fn) }

/* Downgrades only. There is no public setTier that raises the tier, because
 * every raise is a visible pop and, on a throttling phone, an oscillation.
 * watchPerf can opt into a raise explicitly, see allowUpgrade. */
export function setTier(next, reason) {
  if (rank(next) === -1 || next === env.tier) return env.tier
  const raising = rank(next) > rank(env.tier)
  env.tier = next
  env.reason = reason || 'manual'
  env.budget = budgetFor(next)
  env.dpr = env.budget.dpr
  if (!raising) SS.set(KEY_TIER, next + '|' + Date.now())
  tierSubs.forEach((fn) => { try { fn(next, env) } catch (_) {} })
  return next
}

/* `min` is the floor this particular downgrade is allowed to reach. Frame
 * timing is noisy and a single slow window is not proof of a dead device,
 * so watchPerf passes 'lite' and keeps smooth scroll and the reveals alive.
 * static stays reserved for real failures: no WebGL, two context losses,
 * or the visitor asking for reduced motion. */
export function downgrade(reason, min) {
  const i = rank(env.tier)
  if (i <= 0) return env.tier
  const next = TIER_ORDER[i - 1]
  if (min && rank(next) < rank(min)) return env.tier
  return setTier(next, reason || 'downgrade')
}

try {
  mqReduce.addEventListener('change', (e) => {
    env.reduceMotion = e.matches
    motionSubs.forEach((fn) => { try { fn(e.matches) } catch (_) {} })
    if (e.matches && env.tier !== 'static') setTier('static', 'prefers-reduced-motion')
  })
} catch (_) {
  // Safari below 14 only has the deprecated form.
  if (mqReduce.addListener) mqReduce.addListener((e) => { env.reduceMotion = e.matches })
}

/* Battery. Chromium only: WebKit never shipped it and Gecko removed it, so it
 * is absent on every iOS browser. Treated as a soft downgrade hint and nothing
 * more. A missing battery API must never read as "plenty of power". */
if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
  navigator.getBattery().then((b) => {
    const evaluate = () => {
      const low = !b.charging && b.level <= 0.2
      env.lowBattery = low
      if (low && env.tier === 'full') setTier('lite', 'low-battery')
    }
    b.addEventListener('levelchange', evaluate)
    b.addEventListener('chargingchange', evaluate)
    evaluate()
  }).catch(() => {})
}

/* Data Saver can be toggled mid-session on Android. */
if (conn && conn.addEventListener) {
  conn.addEventListener('change', () => {
    env.saveData = readSaveData()
    env.slowNet = readSlowNet()
    if (env.saveData === true && env.tier === 'full') setTier('lite', 'save-data')
    if (env.slowNet === true) setTier('static', 'effective-connection-2g')
  })
}

/* ------------------------------------------------------------------ *
 * 7. Runtime frame-time adaptation
 * ------------------------------------------------------------------ */

/**
 * watchPerf(onDowngrade, opts)
 *
 * Measures real frame time instead of trusting a GPU database. R3 F-2 is
 * explicit that detect-gpu's benchmark corpus stopped updating in December
 * 2025, so a 2026 phone falls through to FALLBACK and gets misjudged. A rolling
 * median of measured frames has no such blind spot.
 *
 * Robustness details that decide whether this works or fires false alarms:
 *  - median, not mean. One 300ms GC pause must not trigger a downgrade.
 *  - a grace period. Shader compile, first texture upload and font swap all
 *    land in the first frames and are not representative.
 *  - deltas above OUTLIER_MS are discarded, not counted. A tab switch, an
 *    alert, or a devtools breakpoint produces a multi-second "frame".
 *  - sampling pauses while the document is hidden. Background rAF throttling
 *    produces 1000ms frames that would otherwise guarantee a false downgrade.
 *
 * @param {(tier:string, stats:object)=>void} onDowngrade called after env.tier
 *        has already been lowered. Rebuild to env.budget inside it.
 * @param {object} [opts]
 * @param {number} [opts.budgetMs=20]  frame time ceiling. 20ms is ~50fps.
 * @param {number} [opts.window=90]    frames per decision window.
 * @param {number} [opts.grace=40]     frames ignored at the start.
 * @param {boolean}[opts.allowUpgrade=false]
 * @param {boolean}[opts.selfDrive=true] false if you will call .tick() from
 *        your own render loop. Preferred, it avoids a second rAF.
 * @returns {{tick(now?:number):void, stop():void, stats():object}}
 */
export function watchPerf(onDowngrade, opts = {}) {
  const budgetMs = opts.budgetMs ?? (env.budget.targetFps === 30 ? 30 : 20)
  const WINDOW = opts.window ?? 90
  const GRACE = opts.grace ?? 40
  const OUTLIER_MS = opts.outlierMs ?? 300
  const allowUpgrade = opts.allowUpgrade === true
  const selfDrive = opts.selfDrive !== false

  const buf = new Float32Array(WINDOW)
  let n = 0, seen = 0, last = 0, raf = 0, stopped = false
  let cleanWindows = 0
  const stats = { median: 0, p90: 0, windows: 0, downgrades: 0, samples: 0 }

  const sorted = new Float32Array(WINDOW)
  function quantile(q) {
    sorted.set(buf)
    const a = Array.prototype.slice.call(sorted, 0, WINDOW).sort((x, y) => x - y)
    return a[Math.min(WINDOW - 1, Math.floor(q * WINDOW))]
  }

  function evaluate() {
    stats.windows++
    stats.median = quantile(0.5)
    stats.p90 = quantile(0.9)
    const bad = stats.median > budgetMs || stats.p90 > budgetMs * 2
    if (bad) {
      cleanWindows = 0
      const before = env.tier
      const after = downgrade('frame-time median=' + stats.median.toFixed(1) + 'ms budget=' + budgetMs + 'ms', 'lite')
      if (after !== before) {
        stats.downgrades++
        try { onDowngrade && onDowngrade(after, Object.assign({}, stats)) } catch (_) {}
        if (after === 'static') stop()
      }
      // Re-arm at the new budget. Do not judge the next window on the old one.
      seen = 0
      return
    }
    cleanWindows++
    if (allowUpgrade && cleanWindows >= 3 && !env.isMobile && stats.downgrades > 0 && rank(env.tier) < 2) {
      cleanWindows = 0
      const t = TIER_ORDER[rank(env.tier) + 1]
      setTier(t, 'frame-time headroom')
      try { onDowngrade && onDowngrade(t, Object.assign({}, stats)) } catch (_) {}
    }
  }

  function tick(now) {
    if (stopped) return
    const t = typeof now === 'number' ? now : performance.now()
    if (document.visibilityState === 'hidden') { last = 0; return }
    if (!last) { last = t; return }
    const dt = t - last
    last = t
    stats.samples++
    if (stats.samples <= GRACE) return
    if (dt > OUTLIER_MS || dt <= 0) return
    buf[n] = dt
    n = (n + 1) % WINDOW
    if (++seen >= WINDOW) { seen = 0; evaluate() }
  }

  function loop(t) { if (!stopped) { raf = requestAnimationFrame(loop); tick(t) } }
  function stop() { stopped = true; if (raf) cancelAnimationFrame(raf); raf = 0 }

  const onVis = () => { last = 0 }
  document.addEventListener('visibilitychange', onVis)
  const _stop = stop
  stop = function () { document.removeEventListener('visibilitychange', onVis); _stop() }

  if (selfDrive) raf = requestAnimationFrame(loop)

  return { tick, stop, stats: () => Object.assign({}, stats) }
}

/* ------------------------------------------------------------------ *
 * 8. Context loss
 * ------------------------------------------------------------------ */

/**
 * guardContext(canvas, handlers)
 *
 * webglcontextlost must have preventDefault called on it or the context will
 * never be restored. Without this the visitor who switches apps and comes back
 * sees a white rectangle, which is the exact failure mode R3 F-1 flags for iOS
 * and which R4 attributes to the iOS 18.2 and 18.3 reports.
 *
 * Policy: recover once. A second loss in the same session means the device is
 * refusing to hold the context, so the site stops asking and goes static for
 * the rest of the session. That is written to sessionStorage so a reload does
 * not restart the cycle. If a restore does not arrive within the watchdog
 * window, treat it as a hard failure too.
 */
export function guardContext(canvas, handlers = {}) {
  if (!canvas || !canvas.addEventListener) return () => {}
  let losses = 0
  let watchdog = 0

  const onLost = (e) => {
    e.preventDefault()             // required. no preventDefault, no restore.
    losses++
    clearTimeout(watchdog)
    try { handlers.onLost && handlers.onLost(losses) } catch (_) {}
    if (losses >= 2) return hardFail('context-lost-twice')
    watchdog = setTimeout(() => hardFail('context-lost-not-restored'), handlers.watchdogMs ?? 4000)
  }
  const onRestored = () => {
    clearTimeout(watchdog)
    try { handlers.onRestored && handlers.onRestored(losses) } catch (_) {}
  }
  function hardFail(why) {
    SS.set(KEY_DEAD, '1')
    setTier('static', why)
    try { handlers.onDead && handlers.onDead(why) } catch (_) {}
  }

  canvas.addEventListener('webglcontextlost', onLost, false)
  canvas.addEventListener('webglcontextrestored', onRestored, false)
  return () => {
    clearTimeout(watchdog)
    canvas.removeEventListener('webglcontextlost', onLost)
    canvas.removeEventListener('webglcontextrestored', onRestored)
  }
}

/* ------------------------------------------------------------------ *
 * 9. Viewport resize that does not leak on iOS
 * ------------------------------------------------------------------ */

/**
 * onViewportResize(cb, opts)
 *
 * WebKit bug 219780: changing width or height on a live onscreen WebGL canvas
 * leaks memory on iOS. Mobile Safari fires resize every time the address bar
 * collapses or expands, which is a height-only change of roughly 60 to 120 CSS
 * pixels and which happens on the very first scroll. Reacting to it means
 * reallocating the drawing buffer on every scroll direction change, against a
 * device that has a documented canvas memory ceiling.
 *
 * So: ignore height-only changes below a threshold on touch devices, and
 * debounce the rest. Orientation change is passed through immediately because
 * that one is real.
 */
export function onViewportResize(cb, opts = {}) {
  const debounceMs = opts.debounceMs ?? 180
  const barSlop = opts.barSlop ?? 140
  let w = innerWidth, h = innerHeight, t = 0

  function fire(reason) { try { cb({ width: innerWidth, height: innerHeight, reason }) } catch (_) {} }

  function onResize() {
    const nw = innerWidth, nh = innerHeight
    const dw = Math.abs(nw - w), dh = Math.abs(nh - h)
    const heightOnly = dw === 0 && dh > 0
    if (heightOnly && isMobileUA && dh <= barSlop) { h = nh; return }  // address bar
    w = nw; h = nh
    clearTimeout(t)
    t = setTimeout(() => fire('resize'), debounceMs)
  }
  function onOrient() {
    clearTimeout(t)
    // Wait one frame past the rotation so innerWidth/innerHeight have settled.
    t = setTimeout(() => { w = innerWidth; h = innerHeight; fire('orientation') }, 260)
  }

  addEventListener('resize', onResize, { passive: true })
  addEventListener('orientationchange', onOrient, { passive: true })
  return () => {
    clearTimeout(t)
    removeEventListener('resize', onResize)
    removeEventListener('orientationchange', onOrient)
  }
}

/* ------------------------------------------------------------------ *
 * 10. Debug
 * ------------------------------------------------------------------ */

export function describe() {
  return {
    tier: env.tier, reason: env.reason, budget: env.budget,
    isWebView: env.isWebView, webviewApp: env.webviewApp, hostile: env.webviewHostile,
    canWebGL: env.canWebGL, webglVersion: env.webglVersion, gpu: env.gpu,
    dpr: env.dpr, rawDpr: devicePixelRatioSafe(),
    reduceMotion: env.reduceMotion, saveData: env.saveData, slowNet: env.slowNet,
    lowBattery: env.lowBattery, deviceMemory: env.deviceMemory, cores: env.hardwareConcurrency,
  }
}

/* Re-evaluation hook for tests. Not for production use: the module state is
 * built once at import, which is correct, because the environment does not
 * change under a running page. Playwright fakes the user agent before import. */
export const _internals = { detectApp, decideTier, budgetFor, TIER_ORDER, APP_TOKENS }

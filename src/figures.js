/* ============================================================
   figures.js  ·  D4 infographic / data
   Seven inline SVG plates. No images, no chart library, no
   institutional logos, no counterparty names.

   Owns: src/figures.js, src/figures.css, docs/D4_figures.md
   Touches nothing else. Mount points are wired by D1 in index.html.

   Contract
     mountFigures(root = document)   draws every [data-figure="name"]
     FIGURES = { name: fn, ... }     individual access

   Every plate follows the same grammar so the set reads as one
   series: a hairline frame, monospace field labels, tabular
   figures, and exactly one accent per plate carrying the claim.
   ============================================================ */

import './figures.css'

/* ---------- 0. tiny svg builder ---------- */

const NS = 'http://www.w3.org/2000/svg'

function s(name, attrs) {
  const e = document.createElementNS(NS, name)
  if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k])
  return e
}
function add(parent, name, attrs) {
  return parent.appendChild(s(name, attrs))
}
function g(parent, attrs) {
  return add(parent, 'g', attrs)
}
function text(parent, str, attrs) {
  const e = add(parent, 'text', attrs)
  e.textContent = str
  return e
}
function line(parent, x1, y1, x2, y2, attrs) {
  return add(parent, 'line', { x1, y1, x2, y2, ...attrs })
}
function rect(parent, x, y, w, h, attrs) {
  return add(parent, 'rect', { x, y, width: w, height: h, ...attrs })
}

/* deterministic noise. the minimap in the pipeline plate needs line
   lengths that look like source without being source. seeded so the
   same picture comes back on every render and on every reload. */
function rng(seed) {
  let v = seed >>> 0
  return () => ((v = (v * 1664525 + 1013904223) >>> 0) / 4294967296)
}

let uid = 0
const nextId = (p) => `fg-${p}-${++uid}`

/* ---------- 1. bilingual strings ---------- */
/* every visible string in the plates lives here. [en, ko]. */

const STR = {
  /* shared */
  schematic: ['Line lengths are schematic. Counts are measured.',
    '선 길이는 도식입니다. 개수는 실측입니다.'],

  /* pipeline */
  pipeTitle: ['BUILD PIPELINE', '빌드 파이프라인'],
  pipeClaim: ['One pipeline. Three projects. A diff of one line.',
    '파이프라인 하나. 프로젝트 셋. 차이는 한 줄.'],
  project: ['PROJECT', '프로젝트'],
  buildpy: ['build.py · 251 lines', 'build.py · 251줄'],
  diffIs: ['THE DIFF', '차이'],
  oneLine: ['1 line', '한 줄'],
  layerSep: ['THREE LAYERS, HELD APART', '3층 분리'],
  engine: ['ENGINE', '엔진'],
  theme: ['THEME', '테마'],
  content: ['CONTENT', '콘텐츠'],
  identical: ['1 line differs · the project name constant', '1줄 차이 · 프로젝트명 상수'],
  thirtyEight: ['38 lines differ · brand tokens', '38줄 차이 · 브랜드 토큰'],
  wholly: ['different throughout · the deck itself', '전면 상이 · 덱 자체'],
  sameMonths: ['THE SAME MONTHS', '같은 달들'],

  /* audit */
  auditTitle: ['LAYOUT AUDIT', '레이아웃 감사'],
  auditClaim: ['Headless Chrome reads every box on every slide. Four kinds of overflow stop the build.',
    '헤드리스 Chrome이 슬라이드마다 모든 박스를 읽습니다. 넘침 4종에서 빌드가 멈춥니다.'],
  slideArea: ['SLIDE · SAFE AREA', '슬라이드 · 안전 영역'],
  ruleSet: ['FOUR RULES', '규칙 4종'],
  r1: ['above-top', 'above-top'],
  r2: ['right-overflow', 'right-overflow'],
  r3: ['left-overflow', 'left-overflow'],
  r4: ['below-floor', 'below-floor'],
  r1d: ['clears the top edge', '상단을 벗어남'],
  r2d: ['crosses the right margin', '우측 여백 침범'],
  r3d: ['crosses the left margin', '좌측 여백 침범'],
  r4d: ['spills past the footer', '푸터 아래로 흘러넘침'],
  reported: ['reported with its pixel offset', '픽셀 오차와 함께 보고'],
  halted: ['BUILD STOPPED', '빌드 중단'],
  fastLoop: ['--audit runs the same walk as a fast loop while a slide is being fixed.',
    '--audit는 슬라이드를 고치는 동안 같은 검사를 고속 루프로 돌립니다.'],

  /* timeline */
  timeTitle: ['THE OVERLAP', '중첩'],
  timeClaim: ['The business development years and the commit years are the same years.',
    '사업개발을 한 기간과 커밋이 쌓인 기간이 같습니다.'],
  laneWork: ['EMPLOYED', '재직'],
  laneShip: ['SHIPPED ALONGSIDE', '같은 기간에 따로'],
  eng: ['Engineering · San Francisco', '엔지니어링 · 샌프란시스코'],
  bd: ['Business development · Seoul', '사업개발 · 서울'],
  classnote: ['Lesson-material product · live', '수업자료 제품 · 라이브'],
  club: ["Football club site · live", '축구 클럽 사이트 · 라이브'],
  commits162: ['162 commits · 2026.03 to 2026.09', '162커밋 · 2026.03 - 2026.09'],
  commits54: ['54 commits', '54커밋'],
  oneMark: ['one mark, one commit', '표시 하나가 커밋 하나'],
  now: ['NOW', '현재'],
  engShort: ['Engineering', '엔지니어링'],
  bdShort: ['Business dev.', '사업개발'],
  engineShort: ['ENG', '엔진'],

  /* entities */
  entTitle: ['ENTITIES', '법인'],
  entClaim: ['Two overseas entities. Filled means it is in the record. Blank means it is not claimed.',
    '해외 법인 둘. 채워진 칸은 기록에 있는 것, 빈 칸은 주장하지 않는 것.'],
  parent: ['SEOUL · PARENT', '서울 · 모회사'],
  sg: ['SINGAPORE', '싱가포르'],
  vn: ['VIETNAM', '베트남'],
  st1: ['incorporation', '설립'],
  st2: ['paid-in capital', '자본금 납입'],
  st3: ['bank accounts', '은행 계좌'],
  st4: ['local counsel', '현지 로펌 창구'],
  notClaimed: ['not claimed', '주장 없음'],
  verbTitle: ['THE VERB MATCHES THE OWNERSHIP', '동사는 소유권에 맞춘다'],
  v1: ['LED', '주도'],
  v2: ['OWNED', '단독 창구'],
  v3: ['CONTRIBUTED TO', '기여'],
  v4: ['TOOK OVER, CLOSED OUT', '인수 후 종결'],
  v5: ['PROPOSED', '제안'],
  v1d: ['both entity establishments', '법인 설립 두 건'],
  v2d: ['correspondence with local counsel', '현지 로펌과의 모든 왕복'],
  v3d: ['an international financial license application', '국제 금융 라이선스 신청'],
  withheldA: ['The model is the work.', '모델은 제 일입니다.'],
  withheldB: ['The amounts are the company\u2019s.', '금액은 회사의 것입니다.'],
  v4d: ['an in-flight filing', '진행 중이던 건'],
  v5d: ['a cross-border settlement pilot', '국경 간 정산 파일럿'],

  /* scripts */
  scrTitle: ['WRITTEN TO DO THE WORK', '일하려고 쓴 것'],
  scrClaim: ['73 Python files, 23,683 lines. Nobody assigned them. The work needed them the following week.',
    '파이썬 73개 파일 23,683줄. 누가 시킨 것은 없습니다. 다음 주에 필요했을 뿐입니다.'],
  fold1: ['analysis/', 'analysis/'],
  fold2: ['ppt_strategy/', 'ppt_strategy/'],
  fold3: ['deck pipelines', '덱 파이프라인'],
  fold1d: ['46 files · document and sheet generators', '46개 · 문서와 시트 생성기'],
  fold2d: ['15 files · one generator, thirteen versions', '15개 · 생성기 하나, 열세 버전'],
  fold3d: ['12 files · three deck pipelines', '12개 · 덱 파이프라인 셋'],
  imports: ['WHAT THEY DRIVE', '무엇을 돌리는가'],
  pptx: ['python-pptx', 'python-pptx'],
  docx: ['python-docx', 'python-docx'],
  pil: ['PIL', 'PIL'],
  lineage: ['v01 to v13, one lineage', 'v01 - v13, 한 계보'],

  /* revenue */
  revTitle: ['REVENUE MODEL', '매출 모델'],
  revClaim: ['Four engines, five years. The structure is mine to show. The figures are not.',
    '4엔진 5개년. 구조는 보여드릴 수 있고 금액은 아닙니다.'],
  assumptions: ['UNIT ASSUMPTIONS', '단위 가정'],
  sourceSheet: ['source sheet attached', '근거 시트 첨부'],
  engineN: ['ENGINE', '엔진'],
  yearN: ['Y', 'Y'],
  total: ['TOTAL', '합계'],
  withheld: ['FIGURES WITHHELD', '금액 비공개'],

  /* jurisdictions */
  jurTitle: ['REGULATORY COVERAGE', '규제 커버리지'],
  jurClaim: ['Eight jurisdictions, read in the primary law rather than the commentary on it.',
    '관할 여덟 곳. 해설이 아니라 1차 법령으로 읽었습니다.'],
  eight: ['EIGHT JURISDICTIONS', '관할 여덟 곳'],
  namesHeld: ['names withheld', '관할명 비공개'],
  notSource: ['the summary of it', '그것의 요약본'],
  notSourceTag: ['not the source', '원본이 아님'],
  whatIOpen: ['WHAT I OPEN', '제가 여는 것'],
  p1: ['statute', '법령 원문'],
  p2: ['licensing guideline', '라이선스 가이드라인'],
  p3: ['regulator filing format', '감독당국 제출 양식'],
  p4: ['issuer attestation report', '발행사 준비금 증명 리포트'],
  collected: ['COLLECTED AND READ IN THE ORIGINAL', '원문으로 수집해 판독'],
  c1: ['regulatory originals', '규제 원문'],
  c2: ['attestation reports', '준비금 증명 리포트'],
  c3: ['regulator interface captures', '감독당국 인터페이스 캡처'],
}

/* ---------- 2. plate scaffold ---------- */

function ctxOf(root) {
  const h = document.documentElement
  const reduce =
    h.classList.contains('no-motion') ||
    (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  return {
    lang: h.getAttribute('data-lang') === 'ko' ? 'ko' : 'en',
    reduce,
    root: root || document,
  }
}

/**
 * plate(host, ctx, opt) builds the shared chrome and returns the svg
 * to draw into.
 *
 * opt.n      two digit plate number, drawn like a section number
 * opt.title  [en, ko] field label
 * opt.claim  [en, ko] one sentence. what the plate asserts
 * opt.vb     [w, h] viewBox for the current breakpoint
 * opt.alt    [en, ko] concise aria-label on the svg
 * opt.desc   array of [en, ko] lines. the long text alternative
 * opt.note   [en, ko] optional footnote under the plate
 */
function plate(host, ctx, opt) {
  const T = (pair) => (Array.isArray(pair) ? pair[ctx.lang === 'ko' ? 1 : 0] : pair)

  host.textContent = ''
  host.classList.add('fg-host')

  const fig = document.createElement('figure')
  fig.className = 'fg'

  const head = document.createElement('div')
  head.className = 'fg-head'
  const n = document.createElement('span')
  n.className = 'fg-n'
  n.textContent = opt.n
  n.setAttribute('aria-hidden', 'true')
  const lb = document.createElement('span')
  lb.className = 'fg-lb'
  lb.textContent = T(opt.title)
  lb.setAttribute('lang', ctx.lang)
  head.append(n, lb)

  const claim = document.createElement('p')
  claim.className = 'fg-claim'
  claim.textContent = T(opt.claim)
  claim.setAttribute('lang', ctx.lang)

  const descId = nextId('d')
  const svg = s('svg', {
    class: 'fg-svg',
    viewBox: `0 0 ${opt.vb[0]} ${opt.vb[1]}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': T(opt.alt),
  })

  /* The long text alternative. Offscreen, but in the reading order right
     after the plate it describes, so it is read once and does not depend on
     description support. The aria-label says what the picture is, this says
     what it holds. */
  const desc = document.createElement('ul')
  desc.className = 'fg-sr'
  desc.id = descId
  desc.setAttribute('lang', ctx.lang)
  for (const d of opt.desc || []) {
    const li = document.createElement('li')
    li.textContent = T(d)
    desc.appendChild(li)
  }

  fig.append(head, claim, svg, desc)

  if (opt.note) {
    const cap = document.createElement('figcaption')
    cap.className = 'fg-note'
    cap.textContent = T(opt.note)
    cap.setAttribute('lang', ctx.lang)
    fig.appendChild(cap)
  }

  host.appendChild(fig)
  return { svg, T, fig }
}

/* diagonal hatch, one def per plate that needs it */
function hatch(svg, color, opacity) {
  const id = nextId('h')
  const defs = add(svg, 'defs')
  const p = add(defs, 'pattern', {
    id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)',
  })
  add(p, 'line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: color, 'stroke-width': 1, opacity: opacity ?? 1 })
  return `url(#${id})`
}

/* a run of unit marks. quantity as structure, never as a big number. */
function marks(parent, x, y, count, opt) {
  const o = { per: 27, pitch: 8, w: 4, h: 9, gap: 9, cls: 'fg-mark', ...opt }
  const gr = g(parent, { class: 'fg-marks' })
  for (let i = 0; i < count; i++) {
    const col = i % o.per
    const row = (i / o.per) | 0
    rect(gr, x + col * o.pitch, y + row * (o.h + o.gap), o.w, o.h, { class: o.cls })
  }
  return gr
}

/* ---------- 3. plate 01. build pipeline ---------- */

const MINIMAP = (() => {
  const r = rng(20260903)
  const out = []
  for (let i = 0; i < 251; i++) {
    const blank = r() < 0.11
    out.push({
      ind: blank ? 0 : [0, 0, 1, 1, 2, 2, 3][(r() * 7) | 0],
      len: blank ? 0 : 0.28 + r() * 0.72,
    })
  }
  return out
})()

const DIFF_ROW = 20 /* line 21, one based, the project name constant */

function figPipeline(host, ctx) {
  const narrow = host.clientWidth > 0 && host.clientWidth < 560
  const vb = narrow ? [360, 750] : [1040, 540]
  const { svg, T } = plate(host, ctx, {
    n: 'F1',
    title: STR.pipeTitle,
    claim: STR.pipeClaim,
    vb,
    alt: [
      'Three near identical code maps side by side, one line marked in red across all three.',
      '거의 동일한 코드 맵 셋이 나란히 있고, 한 줄만 세 곳 모두에서 표시돼 있습니다.',
    ],
    desc: [
      ['The same 251 line build script runs three separate deck projects.',
        '251줄짜리 같은 빌드 스크립트가 세 개의 덱 프로젝트를 돌립니다.'],
      ['The difference between the three copies is one line, the project name constant.',
        '세 사본의 차이는 한 줄, 프로젝트명 상수입니다.'],
      ['Engine, build.py, identical. Theme, css.py, 38 lines differ. Content, slides.py, different throughout.',
        '엔진 build.py는 동일. 테마 css.py는 38줄 차이. 콘텐츠 slides.py는 전면 상이.'],
    ],
    note: STR.schematic,
  })

  const sheetW = narrow ? 88 : 124
  const sheetH = narrow ? 300 : 400
  const gap = narrow ? 22 : 42
  const x0 = narrow ? 14 : 44
  const y0 = narrow ? 64 : 78
  const pitch = sheetH / 251

  const sheets = g(svg, { class: 'fg-anim', style: '--i:0' })

  for (let k = 0; k < 3; k++) {
    const sx = x0 + k * (sheetW + gap)
    text(sheets, `${T(STR.project)} 0${k + 1}`, { x: sx, y: y0 - 16, class: 'fg-lab' })
    rect(sheets, sx - 7, y0 - 7, sheetW + 14, sheetH + 14, { class: 'fg-frame' })

    for (let i = 0; i < 251; i++) {
      const ln = MINIMAP[i]
      if (!ln.len) continue
      const ix = sx + ln.ind * (narrow ? 4 : 7)
      const w = Math.max(2, (sheetW - ln.ind * (narrow ? 4 : 7)) * ln.len)
      if (i === DIFF_ROW) continue
      rect(sheets, ix, y0 + i * pitch, w, 1, { class: 'fg-code' })
    }
  }

  /* the one line. drawn last so it sits above every other mark. */
  const dy = y0 + DIFF_ROW * pitch
  const diff = g(svg, { class: 'fg-anim fg-diff', style: '--i:3' })
  for (let k = 0; k < 3; k++) {
    const sx = x0 + k * (sheetW + gap)
    const w = sheetW * [0.62, 0.58, 0.66][k]
    rect(diff, sx, dy - 0.5, w, 2, { class: 'fg-code-diff' })
  }
  const lastRight = x0 + 2 * (sheetW + gap) + sheetW + 7
  line(diff, x0 - 7, dy + 0.5, lastRight, dy + 0.5, { class: 'fg-tie' })

  if (narrow) {
    text(diff, `${T(STR.diffIs)} · ${T(STR.oneLine)}`, {
      x: x0 + sheetW * 3 + gap * 2 + 7, y: y0 + sheetH + 26, class: 'fg-key fg-acc', 'text-anchor': 'end',
    })
  } else {
    text(diff, T(STR.diffIs), { x: lastRight + 14, y: dy - 8, class: 'fg-lab fg-acc' })
    text(diff, T(STR.oneLine), { x: lastRight + 14, y: dy + 12, class: 'fg-key fg-acc' })
  }

  text(svg, T(STR.buildpy), { x: x0, y: y0 + sheetH + 26, class: 'fg-num' })

  /* three layers held apart */
  const ly = narrow ? y0 + sheetH + 78 : 110
  const lx = narrow ? 14 : 700
  const lw = narrow ? 300 : 300
  const layers = g(svg, { class: 'fg-anim', style: '--i:5' })
  text(layers, T(STR.layerSep), { x: lx, y: ly - 26, class: 'fg-lab' })
  line(layers, lx, ly - 18, lx + lw, ly - 18, { class: 'fg-hair' })

  const rows = [
    { k: STR.engine, f: 'build.py', d: STR.identical, count: 1 },
    { k: STR.theme, f: 'css.py', d: STR.thirtyEight, count: 38 },
    { k: STR.content, f: 'slides.py', d: STR.wholly, all: true },
  ]
  const hp = hatch(svg, 'currentColor', 1)

  rows.forEach((r, i) => {
    const ry = ly + i * (narrow ? 116 : 140)
    text(layers, T(r.k), { x: lx, y: ry, class: 'fg-lab' })
    text(layers, r.f, { x: lx + 104, y: ry, class: 'fg-key' })
    const by = ry + 16
    if (r.all) {
      rect(layers, lx, by, lw, 13, { class: 'fg-strip' })
      rect(layers, lx, by, lw, 13, { class: 'fg-strip-fill', fill: hp })
    } else {
      marks(layers, lx, by, r.count, { per: 19, pitch: 8, w: 3, h: 13, gap: 5, cls: 'fg-mark-on' })
    }
    text(layers, T(r.d), { x: lx, y: by + (r.count === 38 ? 52 : 32), class: 'fg-sm' })
  })
}

/* ---------- 4. plate 02. layout audit ---------- */

function figAudit(host, ctx) {
  const narrow = host.clientWidth > 0 && host.clientWidth < 560
  const vb = narrow ? [360, 620] : [1040, 500]
  const { svg, T } = plate(host, ctx, {
    n: 'F2',
    title: STR.auditTitle,
    claim: STR.auditClaim,
    vb,
    alt: [
      'A slide frame with a safe area. Four blocks break out of it, each numbered and named.',
      '안전 영역이 그려진 슬라이드 프레임. 네 개의 블록이 그 밖으로 나가고 각각 번호와 이름이 붙어 있습니다.',
    ],
    desc: [
      ['Every element on every slide is measured in headless Chrome against the safe area.',
        '슬라이드의 모든 요소를 헤드리스 Chrome에서 안전 영역과 대조해 측정합니다.'],
      ['Four classes of overflow are reported with a pixel offset: above-top, right-overflow, left-overflow, below-floor.',
        '넘침 4종을 픽셀 오차와 함께 보고합니다. above-top, right-overflow, left-overflow, below-floor.'],
      ['Any one of them stops the build before the deck reaches a counterparty.',
        '하나라도 걸리면 덱이 상대에게 가기 전에 빌드가 멈춥니다.'],
    ],
    note: STR.fastLoop,
  })

  const fx = narrow ? 12 : 44
  const fy = narrow ? 54 : 74
  const fw = narrow ? 336 : 596
  const fh = Math.round((fw * 9) / 16)
  const pad = narrow ? 20 : 32

  const frame = g(svg, { class: 'fg-anim', style: '--i:0' })
  text(frame, T(STR.slideArea), { x: fx, y: fy - 14, class: 'fg-lab' })
  rect(frame, fx, fy, fw, fh, { class: 'fg-frame-strong' })
  rect(frame, fx + pad, fy + pad, fw - pad * 2, fh - pad * 2, { class: 'fg-safe' })

  /* four offenders. each crosses exactly one guide. */
  const sx = fw / 596
  const sy = fh / 335
  const boxes = [
    { id: 1, x: 96, y: 6, w: 148, h: 48, dir: 'up' },
    { id: 2, x: 392, y: 92, w: 190, h: 40, dir: 'right' },
    { id: 3, x: 8, y: 172, w: 130, h: 38, dir: 'left' },
    { id: 4, x: 180, y: 274, w: 228, h: 52, dir: 'down' },
  ]

  const off = g(svg, { class: 'fg-anim fg-bad', style: '--i:2' })
  boxes.forEach((b) => {
    const bx = fx + b.x * sx
    const by = fy + b.y * sy
    const bw = b.w * sx
    const bh = b.h * sy
    rect(off, bx, by, bw, bh, { class: 'fg-block' })

    /* the part that is out of bounds, drawn solid */
    const L = fx + pad, R = fx + fw - pad, Tp = fy + pad, B = fy + fh - pad
    let ox = bx, oy = by, ow = bw, oh = bh
    if (b.dir === 'up') { oh = Math.max(0, Tp - by) }
    if (b.dir === 'down') { oy = B; oh = Math.max(0, by + bh - B) }
    if (b.dir === 'left') { ow = Math.max(0, L - bx) }
    if (b.dir === 'right') { ox = R; ow = Math.max(0, bx + bw - R) }
    rect(off, ox, oy, ow, oh, { class: 'fg-block-out' })

    /* the offset the audit reports, drawn as a measure across the spill */
    const mg = g(off, { class: 'fg-measure' })
    if (b.dir === 'up' || b.dir === 'down') {
      const mx = b.dir === 'up' ? bx - 10 : bx + bw + 10
      line(mg, mx, oy, mx, oy + oh, { class: 'fg-tie' })
      line(mg, mx - 3, oy, mx + 3, oy, { class: 'fg-tie' })
      line(mg, mx - 3, oy + oh, mx + 3, oy + oh, { class: 'fg-tie' })
    } else {
      const my = by - 10
      line(mg, ox, my, ox + ow, my, { class: 'fg-tie' })
      line(mg, ox, my - 3, ox, my + 3, { class: 'fg-tie' })
      line(mg, ox + ow, my - 3, ox + ow, my + 3, { class: 'fg-tie' })
    }

    const cx = b.dir === 'left' ? bx + bw + 14 : b.dir === 'right' ? bx - 14 : bx + bw + 14
    const cy = by + bh / 2
    add(off, 'circle', { cx, cy, r: 9, class: 'fg-badge' })
    text(off, String(b.id), { x: cx, y: cy + 4, class: 'fg-badge-t', 'text-anchor': 'middle' })
  })

  /* the rule list */
  const lx = narrow ? 12 : 700
  const ly = narrow ? fy + fh + 46 : 88
  const list = g(svg, { class: 'fg-anim', style: '--i:4' })
  text(list, T(STR.ruleSet), { x: lx, y: ly - 22, class: 'fg-lab' })

  const rl = [
    [1, STR.r1, STR.r1d],
    [2, STR.r2, STR.r2d],
    [3, STR.r3, STR.r3d],
    [4, STR.r4, STR.r4d],
  ]
  rl.forEach(([id, name, dsc], i) => {
    const ry = ly + i * (narrow ? 58 : 64)
    add(list, 'circle', { cx: lx + 9, cy: ry - 4, r: 9, class: 'fg-badge' })
    text(list, String(id), { x: lx + 9, y: ry, class: 'fg-badge-t', 'text-anchor': 'middle' })
    text(list, T(name), { x: lx + 28, y: ry, class: 'fg-key' })
    text(list, T(dsc), { x: lx + 28, y: ry + 18, class: 'fg-sm' })
    line(list, lx, ry + 30, lx + (narrow ? 336 : 300), ry + 30, { class: 'fg-hair' })
  })

  const hy = ly + 4 * (narrow ? 58 : 64) + (narrow ? 8 : 12)
  const stop = g(svg, { class: 'fg-anim', style: '--i:6' })
  text(stop, T(STR.reported), { x: lx, y: hy, class: 'fg-sm' })
  text(stop, T(STR.halted), { x: lx, y: hy + 26, class: 'fg-lab fg-acc' })
  line(stop, lx, hy + 34, lx + (narrow ? 336 : 300), hy + 34, { class: 'fg-tie' })
}

/* ---------- 5. plate 03. the overlap ---------- */

function figTimeline(host, ctx) {
  const narrow = host.clientWidth > 0 && host.clientWidth < 560
  const vb = narrow ? [360, 520] : [1040, 400]
  const { svg, T } = plate(host, ctx, {
    n: 'F3',
    title: STR.timeTitle,
    claim: STR.timeClaim,
    vb,
    alt: [
      'A three year axis. An employment band and a shipping band run over the same span, with the commits drawn as a grid of marks.',
      '3년 축 위에 재직 구간과 출시 구간이 같은 기간에 걸쳐 있고, 커밋은 표시 격자로 그려져 있습니다.',
    ],
    desc: [
      ['2024 to 2025, engineering in San Francisco. 2026 to now, business development in Seoul.',
        '2024-2025 샌프란시스코에서 엔지니어링. 2026-현재 서울에서 사업개발.'],
      ['162 commits to a lesson-material product between 2026.03 and 2026.09, inside the business development period.',
        '수업자료 제품에 2026.03부터 2026.09까지 162커밋. 사업개발 기간 안입니다.'],
      ['54 commits to a football club site during the engineering period. Both sites are live.',
        '축구 클럽 사이트에 54커밋, 엔지니어링 기간 중. 두 사이트 모두 라이브.'],
    ],
    note: [
      'One mark is one commit. Commit counts are read from the public repository API.',
      '표시 하나가 커밋 하나. 커밋 수는 공개 저장소 API에서 읽었습니다.',
    ],
  })

  const ax = narrow ? 14 : 56
  const aw = narrow ? 332 : 940
  const years = ['2024', '2025', '2026']
  const seg = aw / 3

  const ay = narrow ? 42 : 46
  const l1 = ay + 34
  const l2 = l1 + (narrow ? 78 : 62)
  const brY = l2 + 46
  const cy0 = brY + 54

  const axis = g(svg, { class: 'fg-anim', style: '--i:0' })
  line(axis, ax, ay, ax + aw, ay, { class: 'fg-hair-strong' })
  years.forEach((y, i) => {
    line(axis, ax + i * seg, ay, ax + i * seg, ay - 7, { class: 'fg-hair-strong' })
    text(axis, y, { x: ax + i * seg + 6, y: ay - 12, class: 'fg-lab' })
  })
  line(axis, ax + aw, ay, ax + aw, ay - 7, { class: 'fg-hair-strong' })
  text(axis, T(STR.now), { x: ax + aw, y: ay - 12, class: 'fg-lab', 'text-anchor': 'end' })

  /* lane 1. employment, at year granularity */
  const lane1 = g(svg, { class: 'fg-anim', style: '--i:2' })
  text(lane1, T(STR.laneWork), { x: ax, y: l1 - 10, class: 'fg-lab' })
  rect(lane1, ax, l1, seg * 2, 30, { class: 'fg-band' })
  rect(lane1, ax + seg * 2, l1, seg, 30, { class: 'fg-band-on' })
  if (narrow) {
    /* the bands are too short to hold their own labels at this width */
    text(lane1, T(STR.engShort), { x: ax, y: l1 + 46, class: 'fg-sm' })
    text(lane1, T(STR.bdShort), { x: ax + seg * 2, y: l1 + 46, class: 'fg-sm fg-acc' })
  } else {
    text(lane1, T(STR.eng), { x: ax + 12, y: l1 + 20, class: 'fg-key' })
    text(lane1, T(STR.bd), { x: ax + seg * 2 + 12, y: l1 + 20, class: 'fg-key fg-acc' })
  }

  /* lane 2. what shipped over the same span */
  const clubX = ax + seg * 1.42
  const clubW = seg * 0.46
  const cnX = ax + seg * 2.2
  const cnW = seg * 0.72
  const lane2 = g(svg, { class: 'fg-anim', style: '--i:3' })
  text(lane2, T(STR.laneShip), { x: ax, y: l2 - 10, class: 'fg-lab' })
  line(lane2, ax, l2 + 13, ax + aw, l2 + 13, { class: 'fg-hair' })
  rect(lane2, clubX, l2, clubW, 26, { class: 'fg-band' })
  rect(lane2, cnX, l2, cnW, 26, { class: 'fg-band-on' })

  /* the bracket. the claim is the span the two lanes share. */
  const br = g(svg, { class: 'fg-anim', style: '--i:4' })
  rect(br, cnX, l1, cnW, l2 + 26 - l1, { class: 'fg-overlap' })
  line(br, cnX, brY, cnX + cnW, brY, { class: 'fg-tie' })
  line(br, cnX, brY - 7, cnX, brY, { class: 'fg-tie' })
  line(br, cnX + cnW, brY - 7, cnX + cnW, brY, { class: 'fg-tie' })
  text(br, T(STR.sameMonths), {
    x: narrow ? ax + aw : cnX + cnW / 2, y: brY + 17,
    class: 'fg-lab fg-acc', 'text-anchor': narrow ? 'end' : 'middle',
  })

  /* the counts, as unit marks, never as a headline numeral */
  const cnt = g(svg, { class: 'fg-anim', style: '--i:6' })
  const blocks = [
    { x: narrow ? ax : clubX, name: STR.club, sub: STR.commits54, n: 54, per: 18, on: false },
    { x: narrow ? ax : cnX, name: STR.classnote, sub: STR.commits162, n: 162, per: 27, on: true },
  ]
  let lastY = cy0
  blocks.forEach((b, i) => {
    const by = narrow ? cy0 + i * 126 : cy0
    text(cnt, T(b.name), { x: b.x, y: by, class: b.on ? 'fg-key fg-acc' : 'fg-key' })
    text(cnt, T(b.sub), { x: b.x, y: by + 16, class: 'fg-sm' })
    marks(cnt, b.x, by + 26, b.n, {
      per: b.per, pitch: 6, w: 3, h: 7, gap: 4, cls: b.on ? 'fg-mark-on' : 'fg-mark',
    })
    if (b.on) lastY = by + 26 + Math.ceil(b.n / b.per) * 11
  })
  text(cnt, T(STR.oneMark), { x: narrow ? ax : cnX, y: lastY + 14, class: 'fg-sm' })
}

/* ---------- 6. plate 04. entities ---------- */

function figEntities(host, ctx) {
  const narrow = host.clientWidth > 0 && host.clientWidth < 560
  const vb = narrow ? [360, 740] : [1040, 400]
  const { svg, T } = plate(host, ctx, {
    n: 'F4',
    title: STR.entTitle,
    claim: STR.entClaim,
    vb,
    alt: [
      'A parent in Seoul over two overseas entities, each with a four step ladder, and a staircase of verbs beside it.',
      '서울 모회사 아래 해외 법인 둘, 각각 네 단계 사다리가 붙어 있고 옆에 동사 계단이 있습니다.',
    ],
    desc: [
      ['Singapore: incorporation led, correspondence with local counsel owned. Paid-in capital and bank accounts are not claimed.',
        '싱가포르: 설립 주도, 현지 로펌 창구 단독. 자본금 납입과 은행 계좌는 주장하지 않습니다.'],
      ['Vietnam: incorporation, paid-in capital, bank accounts, and local counsel, run end to end.',
        '베트남: 설립, 자본금 납입, 은행 계좌, 현지 로펌 창구까지 처음부터 끝까지.'],
      ['The verbs, in descending order of ownership: led both entities, owned the counsel correspondence, contributed to an international financial license application, took over and closed out an in-flight filing, proposed a cross-border settlement pilot.',
        '소유권 순서로 본 동사: 법인 두 건 주도, 로펌 왕복 단독 창구, 국제 금융 라이선스 신청 기여, 진행 중이던 건 인수 후 종결, 국경 간 정산 파일럿 제안.'],
    ],
  })

  const cw = narrow ? 158 : 236
  const x1 = narrow ? 12 : 44
  const x2 = narrow ? 12 + 174 : 44 + 272
  const py = narrow ? 30 : 44

  const tree = g(svg, { class: 'fg-anim', style: '--i:0' })
  rect(tree, x1, py, cw, 44, { class: 'fg-node' })
  text(tree, T(STR.parent), { x: x1 + 14, y: py + 27, class: 'fg-key' })

  const cy = py + 44 + (narrow ? 44 : 56)
  line(tree, x1 + 24, py + 44, x1 + 24, cy - 18, { class: 'fg-hair-strong' })
  line(tree, x1 + 24, cy - 18, x2 + 24, cy - 18, { class: 'fg-hair-strong' })
  line(tree, x1 + 24, cy - 18, x1 + 24, cy, { class: 'fg-hair-strong' })
  line(tree, x2 + 24, cy - 18, x2 + 24, cy, { class: 'fg-hair-strong' })

  const cols = [
    { x: x1, name: STR.sg, on: [1, 0, 0, 1] },
    { x: x2, name: STR.vn, on: [1, 1, 1, 1] },
  ]
  const stages = [STR.st1, STR.st2, STR.st3, STR.st4]

  cols.forEach((c, ci) => {
    const gr = g(svg, { class: 'fg-anim', style: `--i:${2 + ci}` })
    rect(gr, c.x, cy, cw, 40, { class: 'fg-node' })
    text(gr, T(c.name), { x: c.x + 14, y: cy + 25, class: 'fg-key' })
    stages.forEach((st, i) => {
      const sy2 = cy + 40 + 30 + i * 34
      const on = c.on[i]
      rect(gr, c.x + 14, sy2 - 11, 13, 13, { class: on ? 'fg-cell-on' : 'fg-cell-off' })
      text(gr, T(st), { x: c.x + 36, y: sy2, class: on ? 'fg-num' : 'fg-num-off' })
      if (!on) text(gr, T(STR.notClaimed), { x: c.x + 36, y: sy2 + 14, class: 'fg-sm-off' })
    })
  })

  /* the verb staircase. indent encodes descending ownership. */
  const vx = narrow ? 16 : 606
  const vy = narrow ? cy + 40 + 30 + 4 * 34 + 56 : 66
  const verbs = g(svg, { class: 'fg-anim', style: '--i:5' })
  text(verbs, T(STR.verbTitle), { x: vx, y: vy - 22, class: 'fg-lab' })
  const vlist = [
    [STR.v1, STR.v1d],
    [STR.v2, STR.v2d],
    [STR.v3, STR.v3d],
    [STR.v4, STR.v4d],
    [STR.v5, STR.v5d],
  ]
  const step = narrow ? 8 : 10
  const rowH = narrow ? 62 : 66
  line(verbs, vx, vy - 8, vx, vy - 8 + vlist.length * rowH - 24, { class: 'fg-hair' })
  vlist.forEach(([v, d], i) => {
    const ry = vy + i * rowH
    const ix = vx + 14 + i * step
    line(verbs, vx, ry - 6, ix - 6, ry - 6, { class: 'fg-hair' })
    text(verbs, T(v), { x: ix, y: ry, class: i === 0 ? 'fg-lab fg-acc' : 'fg-lab' })
    text(verbs, T(d), { x: ix, y: ry + 19, class: 'fg-sm' })
  })
}

/* ---------- 7. plate 05. the scripts ---------- */

function figScripts(host, ctx) {
  const narrow = host.clientWidth > 0 && host.clientWidth < 560
  const vb = narrow ? [360, 580] : [1040, 390]
  const { svg, T } = plate(host, ctx, {
    n: 'F5',
    title: STR.scrTitle,
    claim: STR.scrClaim,
    vb,
    alt: [
      'Seventy three squares in three groups, one square for each Python file.',
      '세 그룹으로 묶인 73개의 사각형. 사각형 하나가 파이썬 파일 하나입니다.',
    ],
    desc: [
      ['73 Python files, 23,683 lines in total.',
        '파이썬 73개 파일, 합계 23,683줄.'],
      ['46 in the analysis folder, 15 in the deck strategy folder, 12 across three deck pipelines.',
        'analysis 폴더 46개, 덱 전략 폴더 15개, 덱 파이프라인 세 곳에 12개.'],
      ['Of the 46, 26 drive python-pptx, 14 drive python-docx, 6 drive PIL.',
        '46개 중 26개가 python-pptx, 14개가 python-docx, 6개가 PIL을 씁니다.'],
      ['13 of the 15 are successive versions of a single executive deck generator.',
        '15개 중 13개가 임원 덱 생성기 한 종의 연속된 버전입니다.'],
    ],
    note: [
      'One square is one file. Counted directly in the source tree. The code itself is not public.',
      '사각형 하나가 파일 하나. 소스 트리에서 직접 셌습니다. 코드 자체는 비공개입니다.',
    ],
  })

  const cell = narrow ? 12 : 15
  const gapc = narrow ? 4 : 5
  const pitch = cell + gapc

  /* one square is one file. the lineage is marked by a bracket, not by
     colour, so every square keeps the same weight. */
  const groups = [
    { n: 46, per: 12, name: STR.fold1, d: STR.fold1d },
    { n: 15, per: 15, name: STR.fold2, d: STR.fold2d, lineage: 13 },
    { n: 12, per: 12, name: STR.fold3, d: STR.fold3d },
  ]

  const wOf = (grp) => grp.per * pitch - gapc
  const gx = []
  if (narrow) {
    groups.forEach(() => gx.push(12))
  } else {
    let cur = 44
    groups.forEach((grp) => { gx.push(cur); cur += wOf(grp) + 62 })
  }
  const gy = narrow ? [58, 210, 330] : [78, 78, 78]
  const rowsOf = (grp) => Math.ceil(grp.n / grp.per)
  const deepest = narrow ? 0 : Math.max(...groups.map(rowsOf))

  groups.forEach((grp, k) => {
    const gr = g(svg, { class: 'fg-anim', style: `--i:${k}` })
    const bx = gx[k]
    const by = gy[k]
    text(gr, T(grp.name), { x: bx, y: by - 12, class: 'fg-key' })
    for (let i = 0; i < grp.n; i++) {
      const cx = bx + (i % grp.per) * pitch
      const cyy = by + ((i / grp.per) | 0) * pitch
      rect(gr, cx, cyy, cell, cell, { class: 'fg-cell' })
    }
    const foot = narrow
      ? by + rowsOf(grp) * pitch + (grp.lineage ? 52 : 32)
      : by + deepest * pitch + 22
    text(gr, T(grp.d), { x: bx, y: foot, class: 'fg-sm' })

    if (grp.lineage) {
      const ry = by + cell + 9
      const lw2 = grp.lineage * pitch - gapc
      line(gr, bx, ry, bx + lw2, ry, { class: 'fg-tie' })
      line(gr, bx, ry, bx, ry - 5, { class: 'fg-tie' })
      line(gr, bx + lw2, ry, bx + lw2, ry - 5, { class: 'fg-tie' })
      text(gr, T(STR.lineage), { x: bx, y: ry + 16, class: 'fg-sm fg-acc' })
    }
  })

  /* what the scripts drive. counted inside the analysis folder only. */
  const iy = narrow ? 424 : 232
  const ix = narrow ? 12 : 44
  const imp = g(svg, { class: 'fg-anim', style: '--i:4' })
  text(imp, T(STR.imports), { x: ix, y: iy - 14, class: 'fg-lab' })
  const rowsI = [[STR.pptx, 26], [STR.docx, 14], [STR.pil, 6]]
  const mx0 = ix + (narrow ? 104 : 130)
  const mp = narrow ? 7 : 8
  rowsI.forEach(([nm, n], i) => {
    const ry = iy + i * 30
    text(imp, T(nm), { x: ix, y: ry + 10, class: 'fg-num' })
    marks(imp, mx0, ry, n, { per: 27, pitch: mp, w: 3, h: 12, gap: 6 })
    text(imp, String(n), { x: mx0 + 27 * mp + 12, y: ry + 10, class: 'fg-num' })
  })

  const ty = iy + 3 * 30 + (narrow ? 22 : 28)
  const tot = g(svg, { class: 'fg-anim', style: '--i:6' })
  line(tot, ix, ty - 18, ix + (narrow ? 336 : 476), ty - 18, { class: 'fg-hair-strong' })
  text(tot, '73', { x: ix, y: ty + 4, class: 'fg-key fg-acc' })
  text(tot, T(['files · 23,683 lines', '파일 · 23,683줄']), { x: ix + 32, y: ty + 4, class: 'fg-num' })
}

/* ---------- 8. plate 06. revenue model ---------- */

function figRevenue(host, ctx) {
  const narrow = host.clientWidth > 0 && host.clientWidth < 560
  const vb = narrow ? [360, 410] : [1040, 340]
  const { svg, T } = plate(host, ctx, {
    n: 'F6',
    title: STR.revTitle,
    claim: STR.revClaim,
    vb,
    alt: [
      'A lattice of four engine rows by five year columns, every cell hatched rather than filled with a number.',
      '엔진 4행과 연차 5열의 격자. 모든 칸이 숫자 대신 빗금으로 채워져 있습니다.',
    ],
    desc: [
      ['A five year revenue model on four engines, built from unit assumptions with the source sheet attached.',
        '4엔진 5개년 매출 모델. 단위 가정에서 쌓고 근거 시트를 첨부했습니다.'],
      ['The structure of the model is shown. The figures are withheld because they belong to the company.',
        '모델의 구조만 보입니다. 금액은 회사의 것이므로 공개하지 않습니다.'],
    ],
    note: [
      'Built from unit assumptions with the source sheet attached to it. Shown on request.',
      '단위 가정에서 쌓고 근거 시트를 붙였습니다. 요청 시 제시.',
    ],
  })

  const hp = hatch(svg, 'currentColor', 0.9)

  /* unit assumptions feeding the lattice */
  const ax = narrow ? 12 : 44
  const ay = narrow ? 60 : 100
  const asm = g(svg, { class: 'fg-anim', style: '--i:0' })
  text(asm, T(STR.assumptions), { x: ax, y: ay - 14, class: 'fg-lab' })
  const seeds = [0.92, 0.64, 0.78, 0.45, 0.86, 0.58]
  seeds.forEach((f, i) => {
    rect(asm, ax, ay + i * 11, (narrow ? 120 : 132) * f, 3, { class: 'fg-code' })
  })
  text(asm, T(STR.sourceSheet), { x: ax, y: ay + seeds.length * 11 + 16, class: 'fg-sm' })

  /* the lattice */
  const cw = narrow ? 45 : 70
  const ch = narrow ? 34 : 42
  const gp = narrow ? 5 : 8
  const lx = narrow ? 46 : 282
  const ly = narrow ? ay + seeds.length * 11 + 64 : 100
  const th = 4 * (ch + gp) - gp

  /* the assumptions feed the whole lattice. the arrow lands in the gutter
     between the second and third row label, so nothing is crossed out. */
  if (!narrow) {
    const spine = g(svg, { class: 'fg-anim', style: '--i:1' })
    const my2 = ly + th / 2
    line(spine, ax + 6, my2, lx - 18, my2, { class: 'fg-hair' })
    line(spine, lx - 26, my2 - 5, lx - 18, my2, { class: 'fg-hair' })
    line(spine, lx - 26, my2 + 5, lx - 18, my2, { class: 'fg-hair' })
  }

  const lat = g(svg, { class: 'fg-anim', style: '--i:2' })
  for (let c = 0; c < 5; c++) {
    text(lat, `${T(STR.yearN)}${c + 1}`, {
      x: lx + c * (cw + gp) + cw / 2, y: ly - 12, class: 'fg-lab', 'text-anchor': 'middle',
    })
  }
  if (narrow) {
    text(lat, T(STR.engineShort), { x: lx - 8, y: ly - 12, class: 'fg-lab', 'text-anchor': 'end' })
  }
  for (let r = 0; r < 4; r++) {
    const ry = ly + r * (ch + gp)
    text(lat, narrow ? `0${r + 1}` : `${T(STR.engineN)} 0${r + 1}`, {
      x: lx - (narrow ? 8 : 14), y: ry + ch / 2 + 4, class: 'fg-lab', 'text-anchor': 'end',
    })
    for (let c = 0; c < 5; c++) {
      const cx = lx + c * (cw + gp)
      rect(lat, cx, ry, cw, ch, { class: 'fg-cell-void' })
      rect(lat, cx, ry, cw, ch, { class: 'fg-cell-hatch', fill: hp })
    }
  }

  /* the total column, held apart */
  const tx = lx + 5 * (cw + gp) + (narrow ? 8 : 26)
  const tw = narrow ? 46 : 86
  const tot = g(svg, { class: 'fg-anim', style: '--i:4' })
  text(tot, T(STR.total), {
    x: tx + tw / 2, y: ly - 12, class: 'fg-lab fg-acc', 'text-anchor': 'middle',
  })
  rect(tot, tx, ly, tw, th, { class: 'fg-cell-void-acc' })
  rect(tot, tx, ly, tw, th, { class: 'fg-cell-hatch-acc', fill: hp })

  if (narrow) {
    text(tot, T(STR.withheld), {
      x: tx + tw, y: ly + th + 20, class: 'fg-lab fg-acc', 'text-anchor': 'end',
    })
  } else {
    const wx = tx + tw + 24
    text(tot, T(STR.withheld), { x: wx, y: ly + th / 2 - 12, class: 'fg-lab fg-acc' })
    text(tot, T(STR.withheldA), { x: wx, y: ly + th / 2 + 10, class: 'fg-sm' })
    text(tot, T(STR.withheldB), { x: wx, y: ly + th / 2 + 26, class: 'fg-sm' })
  }
}

/* ---------- 9. plate 07. regulatory coverage ---------- */

function figJurisdictions(host, ctx) {
  const narrow = host.clientWidth > 0 && host.clientWidth < 560
  const vb = narrow ? [360, 620] : [1040, 400]
  const { svg, T } = plate(host, ctx, {
    n: 'F7',
    title: STR.jurTitle,
    claim: STR.jurClaim,
    vb,
    alt: [
      'A bracket over eight unnamed slots, a chain of four primary sources beneath it, and three rows of collected artifacts.',
      '이름 없는 슬롯 여덟 개 위의 괄호, 그 아래 1차 자료 네 단계 사슬, 그리고 수집한 자료 세 줄.',
    ],
    desc: [
      ['Eight jurisdictions read in the primary law rather than the commentary on it. The jurisdiction names are withheld.',
        '해설이 아니라 1차 법령으로 읽은 관할 여덟 곳. 관할명은 공개하지 않습니다.'],
      ['What gets opened: the statute, the licensing guideline, the regulator filing format, the issuer attestation report.',
        '여는 것은 법령 원문, 라이선스 가이드라인, 감독당국 제출 양식, 발행사 준비금 증명 리포트입니다.'],
      ['Collected and read in the original: 4 regulatory originals, 24 attestation reports, 27 regulator interface captures.',
        '원문으로 수집해 판독: 규제 원문 4종, 준비금 증명 리포트 24건, 감독당국 인터페이스 캡처 27건.'],
    ],
    note: [
      'Jurisdiction names and the conclusions drawn from them stay out of this page. The method is the claim.',
      '관할명과 거기서 나온 결론은 이 페이지에 쓰지 않습니다. 주장하는 것은 방법입니다.',
    ],
  })

  /* the bracket. eight slots, unnamed. */
  const bx = narrow ? 12 : 44
  const bw = narrow ? 336 : 952
  const by = narrow ? 46 : 52
  const br = g(svg, { class: 'fg-anim', style: '--i:0' })
  line(br, bx, by, bx + bw, by, { class: 'fg-hair-strong' })
  for (let i = 0; i < 8; i++) {
    const tx = bx + (bw / 8) * (i + 0.5)
    line(br, tx, by, tx, by + 12, { class: 'fg-hair-strong' })
    text(br, `0${i + 1}`, { x: tx, y: by + 26, class: 'fg-lab', 'text-anchor': 'middle' })
  }
  text(br, T(STR.eight), { x: bx, y: by - 12, class: 'fg-lab fg-acc' })
  text(br, T(STR.namesHeld), { x: bx + bw, y: by - 12, class: 'fg-sm', 'text-anchor': 'end' })


  /* the path not taken, connected to the chain and struck through */
  const mx = bx
  const my = narrow ? by + 78 : by + 92
  const meth = g(svg, { class: 'fg-anim', style: '--i:2' })
  const rw = narrow ? 196 : 232
  rect(meth, mx, my - 18, rw, 30, { class: 'fg-node-off' })
  text(meth, T(STR.notSource), { x: mx + 12, y: my + 2, class: 'fg-num-off' })
  text(meth, T(STR.notSourceTag), { x: mx + rw + 14, y: my + 2, class: 'fg-sm-off' })

  /* the chain of four */
  const chy = my + (narrow ? 54 : 62)
  const chain = g(svg, { class: 'fg-anim', style: '--i:3' })
  const jx = mx + rw / 2
  line(meth, jx, my + 12, jx, chy - (narrow ? 12 : 0), { class: 'fg-hair-strong', 'stroke-dasharray': '3 4' })
  line(meth, jx - 7, my + 24, jx + 7, my + 38, { class: 'fg-tie' })
  line(meth, jx + 7, my + 24, jx - 7, my + 38, { class: 'fg-tie' })

  text(chain, T(STR.whatIOpen), { x: jx + 26, y: chy - 14, class: 'fg-lab' })
  const items = [STR.p1, STR.p2, STR.p3, STR.p4]
  if (narrow) {
    items.forEach((it, i) => {
      const ry = chy + i * 34
      rect(chain, mx, ry, 10, 10, { class: 'fg-cell' })
      text(chain, T(it), { x: mx + 20, y: ry + 9, class: 'fg-num' })
      if (i < 3) line(chain, mx + 5, ry + 10, mx + 5, ry + 34, { class: 'fg-hair-strong' })
    })
  } else {
    const nw = 214
    items.forEach((it, i) => {
      const nx = mx + i * (nw + 26)
      rect(chain, nx, chy, nw, 40, { class: 'fg-node' })
      text(chain, T(it), { x: nx + 12, y: chy + 25, class: 'fg-num' })
      if (i < 3) line(chain, nx + nw, chy + 20, nx + nw + 26, chy + 20, { class: 'fg-hair-strong' })
    })
  }

  /* what was collected, three columns across the plate */
  const cy = narrow ? chy + 4 * 34 + 44 : chy + 88
  const col = g(svg, { class: 'fg-anim', style: '--i:5' })
  text(col, T(STR.collected), { x: mx, y: cy - 14, class: 'fg-lab' })
  const rowsC = [[STR.c1, 4], [STR.c2, 24], [STR.c3, 27]]
  rowsC.forEach(([nm, n], i) => {
    const cx = narrow ? mx : mx + i * 320
    const ry = narrow ? cy + i * 76 : cy
    text(col, T(nm), { x: cx, y: ry + 10, class: 'fg-num' })
    text(col, String(n), { x: cx + (narrow ? 264 : 264), y: ry + 10, class: 'fg-key', 'text-anchor': 'end' })
    marks(col, cx, ry + 22, n, { per: 14, pitch: 9, w: 4, h: 12, gap: 6 })
  })
}

/* ---------- 10. registry, mount, and repaint ---------- */

export const FIGURES = {
  pipeline: figPipeline,
  audit: figAudit,
  timeline: figTimeline,
  entities: figEntities,
  scripts: figScripts,
  revenue: figRevenue,
  jurisdictions: figJurisdictions,
}

let hosts = []

/* Reveal. An IntersectionObserver alone is not enough here: a jump to an
   anchor, or a fast flick, can move a plate from below the fold to above it
   without ever crossing a threshold, and the plate would stay at opacity 0.
   A rAF throttled position check catches both cases and detaches itself
   once every plate has been shown. */
const pending = new Set()
let scanning = false
let listening = false

function scan() {
  scanning = false
  const h = innerHeight || 800
  for (const fig of [...pending]) {
    if (!fig.isConnected) { pending.delete(fig); continue }
    const r = fig.getBoundingClientRect()
    if (r.top < h * 0.92) { fig.classList.add('is-in'); pending.delete(fig) }
  }
  if (!pending.size && listening) {
    removeEventListener('scroll', queue)
    removeEventListener('resize', queue)
    listening = false
  }
}
function queue() {
  if (scanning) return
  scanning = true
  requestAnimationFrame(scan)
}

function reveal(fig, reduce) {
  if (reduce) { fig.classList.add('is-in'); return }
  /* the hidden state is only applied once JS has taken responsibility for
     revealing it. a plate is never left invisible by a failure here. */
  fig.classList.add('fg-armed')
  pending.add(fig)
  if (!listening) {
    addEventListener('scroll', queue, { passive: true })
    addEventListener('resize', queue, { passive: true })
    listening = true
  }
  queue()
}

function draw(host) {
  const name = host.getAttribute('data-figure')
  const fn = FIGURES[name]
  if (!fn) {
    if (import.meta.env?.DEV) console.warn('[figures] no plate named', name)
    return
  }
  const ctx = ctxOf()
  fn(host, ctx)
  const fig = host.querySelector('.fg')
  if (fig) reveal(fig, ctx.reduce)
}

/**
 * mountFigures(root)
 *
 * Finds every [data-figure] under root and draws it. Safe to call
 * more than once: each call clears its host before drawing.
 * Repaints on language change and on a width change that crosses
 * the narrow breakpoint.
 */
export function mountFigures(root = document) {
  const found = [...(root.querySelectorAll?.('[data-figure]') || [])]
  for (const h of found) {
    if (!hosts.includes(h)) hosts.push(h)
    draw(h)
  }
  wire()
  return found
}

let wired = false
function wire() {
  if (wired) return
  wired = true

  const repaint = () => { for (const h of hosts) if (h.isConnected) draw(h) }

  /* language. a11y.js dispatches a11y:langchange, main.js listens for
     langchange. neither is guaranteed, so watch the attribute itself. */
  let lastLang = document.documentElement.getAttribute('data-lang')
  new MutationObserver(() => {
    const now = document.documentElement.getAttribute('data-lang')
    if (now !== lastLang) { lastLang = now; repaint() }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang', 'class'] })

  document.addEventListener('a11y:langchange', repaint)
  document.addEventListener('langchange', repaint)

  /* width. only repaint when the breakpoint is actually crossed. */
  let wasNarrow = null
  const check = () => {
    const h = hosts.find((x) => x.isConnected)
    if (!h) return
    const n = h.clientWidth > 0 && h.clientWidth < 560
    if (wasNarrow === null) { wasNarrow = n; return }
    if (n !== wasNarrow) { wasNarrow = n; repaint() }
  }
  check()
  let t
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(check, 180) }, { passive: true })
}

export default mountFigures

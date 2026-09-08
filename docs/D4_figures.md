# D4. 도판 배선 지침

작성 2026-09-03. 소유 파일 `src/figures.js`, `src/figures.css`, 이 문서, `test-figures.html`.
건드리지 않은 파일: `index.html`, `src/page.css`, `src/main.js`, `src/intro.js`, `src/scene/`, `src/field.js`, `src/env.js`, `src/a11y.js`.

---

## 0. 세 줄 요약

1. 도판 7개. 전부 인라인 SVG, 외부 이미지 0, 차트 라이브러리 0, 로고 0, 상대사명 0.
2. 배선은 `<div data-figure="이름"></div>` 하나를 원하는 자리에 넣고 `mountFigures()`를 한 번 호출하는 것이 전부다.
3. 팔레트는 `page.css` 변수만 참조한다. 새 색을 만들지 않았다. 전폭 괘선도 만들지 않았으므로 C1의 "전폭 선 정확히 세 번" 규칙은 그대로 유지된다.

---

## 1. 배선

### 1.1 main.js

```js
import { mountFigures } from './figures.js'
```

`a11y.init()` 다음, `ScrollTrigger` 설정 전후 어디든 한 번 호출한다.

```js
mountFigures()
```

- **CSS는 모듈이 스스로 가져온다.** `figures.js` 상단에 `import './figures.css'`가 있다. `index.html`에 `<link>`를 추가하지 마라.
- 개별 접근이 필요하면 `import { FIGURES } from './figures.js'` 후 `FIGURES.pipeline(hostEl, ctx)`.
- 두 번 이상 호출해도 안전하다. 호출할 때마다 호스트를 비우고 다시 그린다.

### 1.2 자체적으로 처리하는 것 (main.js에서 추가 작업 불필요)

| 항목 | 처리 방식 |
|---|---|
| EN/KO 전환 | `html[data-lang]` 속성을 `MutationObserver`로 직접 감시한다. `a11y:langchange`와 `langchange` 이벤트도 같이 듣는다. 셋 중 무엇이 와도 다시 그린다 |
| 브레이크포인트 | 호스트 폭 560px를 경계로 데스크톱 조판과 모바일 조판이 다르다. `resize`에서 경계를 실제로 넘었을 때만 다시 그린다 |
| 등장 애니메이션 | 자체 rAF 스캔. `IntersectionObserver`만 쓰면 앵커 점프나 빠른 플릭에서 임계값을 안 넘고 지나쳐 투명한 채로 남는다. 이 경우가 실측으로 재현됐고 그래서 위치 검사 방식으로 바꿨다 |
| `prefers-reduced-motion` / `html.no-motion` | 애니메이션 없이 최종 상태로 그린다 |
| JS 실패 | 숨김 상태(`opacity:0`)는 JS가 `.fg-armed`를 붙인 뒤에만 적용된다. 등장 처리가 실패해도 도판이 투명한 채로 남지 않는다 |

### 1.3 하지 말 것

- 호스트 요소에 `data-reveal`을 붙이지 마라. GSAP 리빌과 도판 자체 리빌이 겹쳐 두 번 페이드된다.
- `#s6`(어두운 스테이지) 안에 넣지 마라. 도판의 색은 밝은 지면(`--sand`) 전용 토큰이다. 어두운 배경에서는 대비가 무너진다.
- `#s1`(히어로) 안에 넣지 마라. 첫 화면은 문장이 LCP다.
- 호스트에 `overflow:hidden`을 주지 마라. SVG는 `overflow:visible`로 그린다.

---

## 2. 도판 목록과 배치

호스트는 전부 이 형태다. `style`의 `grid-column`은 섹션의 정렬 축을 따른다.

```html
<div class="wrap grid">
  <div data-figure="이름" style="grid-column:4 / span 9"></div>
</div>
```

| 순위 | `data-figure` | 섹션 | 정확한 자리 | `grid-column` | 무엇을 주장하는가 |
|---|---|---|---|---|---|
| P0 | `pipeline` | **04 Capability** | `.build` 블록 바로 뒤, `.horizon` 앞. 카피 `→ 73 scripts. One pipeline, three projects, a diff of one line.`가 이 도판의 캡션이다 | `1 / span 10` | 251줄 파이프라인이 세 프로젝트에서 문자 그대로 재사용됐고 서로의 차이가 한 줄이다 |
| P0 | `audit` | **04 Capability** | `pipeline` 바로 뒤, `.horizon` 앞 | `1 / span 10` | 영업 산출물에 CI식 품질 게이트가 붙어 있다. 넘침 4종에서 빌드가 멈춘다 |
| P0 | `timeline` | **05 Record** | `.side` 문단 바로 뒤 (`.side`가 이 도판의 리드다) | `4 / span 9` | 사업개발을 한 기간과 커밋이 쌓인 기간이 같다. 이 중첩 자체가 주장이다 |
| P1 | `entities` | **03 Current work** | 2번째 문단(`Two entities so far, Singapore and Vietnam...`) 뒤. 문단을 쪼개기 어려우면 `.sell.prose` 블록 전체 뒤 | `4 / span 9` | 해외 법인 둘. 채워진 칸은 기록에 있는 것, 빈 칸은 주장하지 않는 것. 동사는 소유권에 맞춘다 |
| P1 | `jurisdictions` | **03 Current work** | 4번째 문단(`... Eight jurisdictions so far.`) 뒤 | `4 / span 9` | 관할 여덟 곳을 해설이 아니라 1차 법령으로 읽었다. 관할명과 결론은 페이지에 올리지 않는다 |
| P2 | `scripts` | **05 Record** | 증거 표(`.ev`)와 `.side` 사이 | `4 / span 9` | 없는 도구는 만든다. 파일 하나가 사각형 하나 |
| P2 | `revenue` | **03 Current work** | 4번째 문단 뒤, `jurisdictions` 다음. 또는 05로 이동 | `4 / span 9` | 4엔진 5개년 모델의 구조는 보일 수 있고 금액은 아니다 |

**페이싱 권고.** 한 섹션에 도판 2개를 넘기지 마라. P2 둘은 밀도가 과해지면 잘라도 논지가 무너지지 않는다. **P0 셋은 자르지 마라.** `pipeline`은 S2가 지목한 최강 물증이고, `timeline`은 유일하게 방문자가 링크로 검증 가능한 A+P 자산이다.

### 2.1 04 Capability 삽입 예시

```html
    <div class="build" data-reveal>
      ... 기존 카피 ...
    </div>
  </div>

  <div class="wrap grid">
    <div data-figure="pipeline" style="grid-column:1 / span 10"></div>
  </div>
  <div class="wrap grid">
    <div data-figure="audit" style="grid-column:1 / span 10"></div>
  </div>

  <div class="horizon"><hr class="rule" aria-hidden="true" role="presentation"></div>
```

도판 사이 세로 여백은 섹션 쪽에서 준다. `figures.css`는 호스트에 마진을 주지 않는다.

---

## 3. 각 도판이 쓰는 수치와 출처

전부 `W2/S2_evidence.md` 4장 블록 1-2-3에서 왔다. **블록 4의 조건부 수치와 블록 5의 회사 귀속 수치는 한 개도 쓰지 않았다.**

| 도판 | 수치 | S2 위치 | 등급 |
|---|---|---|---|
| `pipeline` | `build.py` 251줄 / 3개 프로젝트 / diff 1줄 / `css.py` 38줄 차이 / `slides.py` 전면 상이 | 4-2 | A · L |
| `audit` | 규칙 4종 (below-floor, right-overflow, left-overflow, above-top), 헤드리스 Chrome, `--audit` 고속 루프 | 4-2, 3-4 발견 2 | A · L |
| `timeline` | ClassNote 162커밋 2026.03.16-2026.09.01 / 24FC 54커밋 / 라이브 | 4-1 | **A · P** |
| `entities` | 법인 2 (싱가포르, 베트남) / 단계 4 / 동사 5단 | 4-3, 2-4 (5)(6) | A-B · L |
| `scripts` | 73파일 23,683줄 / analysis 46 · ppt_strategy 15 · deck 12 / pptx 26 · docx 14 · PIL 6 / 생성기 13버전 | 4-2 | A · L |
| `revenue` | 4엔진 5개년, 금액 없음 | 4-3 (B16) | B · L |
| `jurisdictions` | 관할 8 / 규제 원문 4종 · 준비금 증명 리포트 24 · 인터페이스 캡처 27 | 4-2, 4-4 | A(자료) · C(관할 수) |

### 3.1 의도적으로 없는 것

| 없는 것 | 근거 |
|---|---|
| 라이트닝 채널 100+, 40 BTC, 12만 건, USD 150M, 연매출, 특허 | S2 4-5 블록 5. 회사 귀속. M3 확정 전 캔버스 금지 |
| 관할 8곳의 실제 이름, PoR 의무화 4곳 결론 | S2 V-5. 결론을 단정하면 규제 해석 논쟁으로 들어간다. **방법만 주장한다** |
| 5개년 모델의 금액, 엔진 실제 이름 | S2 B16, 8-2 비공개 목록 |
| 220개사 / 122계정 / 25개국 / 505건 / 46일 26통 | S2 4-4 삭제 및 조건부 항목 |
| 상대사명, 자사 제품명, 코드 원문, 파일 트리 | S2 R-5. 코드 28개 파일에 실명이 하드코딩돼 있다 |
| 기관 로고 (대학, 군, 회사) | 상표. 데이터로만 그렸다 |
| ClassNote 커밋 메시지, 저장소 커밋 목록 | S2 R-3. 커밋 메시지에 학생 실명이 있다. **수(162)만 쓴다** |

### 3.2 도식과 실측의 구분

`pipeline`의 코드 미니맵은 **251줄이라는 개수만 실측이고 각 줄의 길이는 도식이다.** 실제 소스가 아니다(그리면 상대사명이 노출된다). 이 사실을 도판 각주에 EN/KO로 명시했다. 문구를 지우지 마라.

`revenue`의 격자도 마찬가지로 4x5라는 구조만 사실이고 칸은 비어 있다. 빗금은 "숨겼다"는 표시이지 값이 아니다.

---

## 4. 접근성

| 장치 | 구현 |
|---|---|
| `role="img"` + `aria-label` | 모든 SVG. 그림이 무엇인지 한 문장 |
| 인접 텍스트 대체 | SVG 바로 뒤에 화면에서 감춘 `<ul class="fg-sr">`. **수치는 여기에 있다.** `aria-describedby`를 쓰지 않았다. 설명 지원이 불안정한 리더에서 내용이 통째로 사라지는 것보다, 읽기 순서 안에 한 번 놓이는 편이 안전하다 |
| 언어 | `<figure>` 안의 텍스트 노드마다 `lang` 속성을 EN/KO에 맞춰 붙인다. 감춘 대체 텍스트도 포함 |
| 대비 | `--ink` 13.99, `--muted` 7.81, `--dim` 5.39, `--sun-deep` 7.13 (전부 `--sand` 기준, D2 측정치). 비텍스트 구분선은 `--hair` / `--hair-2` |
| 모션 | `prefers-reduced-motion`과 `html.no-motion` 양쪽에서 최종 상태로 정지 |
| 인쇄 | `break-inside: avoid`, 애니메이션 상태 해제 |

**KO 조판.** `.fg-lab` 등 등폭 라벨은 `html[data-lang="ko"]`에서 한글 폰트와 좁은 자간으로 바뀐다. 대문자 변환은 라틴에만 걸린다.

---

## 5. 검증

`test-figures.html`(D4 소유)이 7개를 한 페이지에 세우고 EN/KO 토글과 모션 토글을 붙인 프루프 시트다. 개발 서버에서 `/test-figures.html`.

실측 결과:

| 항목 | 결과 |
|---|---|
| `npx vite build` | 통과 |
| `esbuild` 단독 번들 | 47.7 KB (의존성 0) |
| 1440x900 데스크톱 | `docs/d4-proof/D4-final-1440.png` |
| 390x844 모바일 | `docs/d4-proof/D4-final-390.png` |
| 콘솔 에러 | 0 |
| SVG 콘텐츠가 자기 viewBox를 벗어남 | 0건 (`getBBox()` 대조) |
| 페이지 하단 점프 후 미노출 도판 | 0개 |

**배선 후 재확인이 필요한 것 하나.** 본 페이지에서는 `.wrap`이 `min(92vw,1320px)`이고 도판이 9-10칼럼을 쓰므로 실제 렌더 폭이 프루프 시트(1320px 전폭)보다 좁다. 좁아지면 SVG가 균일하게 축소될 뿐 레이아웃은 바뀌지 않지만, 등폭 라벨이 11px 아래로 내려가면 읽기 어렵다. **배선 직후 1440에서 라벨 크기를 한 번 눈으로 확인하라.** 필요하면 `grid-column`을 한 칼럼 넓히는 것으로 해결된다.

---

## 6. 남은 결정

| # | 항목 | 필요한 판단 |
|---|---|---|
| D4-1 | `revenue`와 `scripts`의 최종 포함 여부 | 페이싱. 잘라도 논지는 선다 |
| D4-2 | `jurisdictions`에 관할명을 넣을 것인가 | 현재는 전부 비공개 처리. S2 4-4가 "관할명 노출은 별도 판단"이라 했고 V-5가 결론 단정을 경고했다. **마스터마인드 결정 전까지 비공개 유지** |
| D4-3 | `entities`의 모회사 노드 라벨 | 지금은 `SEOUL · PARENT`. 회사명을 넣을지 여부는 `index.html`이 아이브로우에서 사명을 뺀 결정과 맞춰야 한다 |
| D4-4 | 회사 귀속 수치(블록 5) 도판 | S2 M3 미결. 확정 전에는 만들지 않는다 |

# D1. UX / IA 판단 근거

모바일, 접근성, 링크드인 인앱 WebView 대응.
작성일 2026-09-02. 소유 파일 `src/env.js`, `src/a11y.js`, 이 문서.

---

## 0. 세 줄 요약

1. **인앱 WebView는 감지된다.** 앱이 주입하는 토큰 기준으로 링크드인, 카카오톡, 인스타그램, 페이스북, 메신저, 네이버, 라인, 트위터, 위챗, 틱톡, 스냅챗을 잡는다. 실측 UA 문자열로 검증했고 12종 픽스처 전부 통과했다.
2. **모바일 인트로는 생략한다. 축소가 아니라 생략이다.** 근거는 3절.
3. **detect-gpu에 의존하지 않는다.** 런타임 프레임 시간 롤링 중앙값으로 하향한다. 하향은 즉시, 상향은 기본 꺼짐.

---

## 1. WebView UA 실측 조사

### 1.1 확인된 토큰

| 앱 | 토큰 | 실측 문자열 | 출처 |
|---|---|---|---|
| LinkedIn | `[LinkedInApp]` | iOS: `Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1 [LinkedInApp]/9.51.6066`<br>Android: `... ; wv) ... Mobile Safari/537.36 [LinkedInApp]/2.309.56` | WhatIsMyBrowser LinkedIn App 컬렉션 |
| KakaoTalk | `KAKAOTALK` | Android: `... Mobile Safari/537.36 KAKAOTALK/25.4.3 (INAPP)`, 구버전 `...;KAKAOTALK 2409800`<br>iOS: `... Mobile/14B100 KAKAOTALK 5.9.2` | Kakao Developers 공식 문서, UserAgents.io 파싱 레코드, WhatMyUserAgent |
| Instagram | `Instagram` | iOS: `... Mobile/15E148 Instagram 147.0.0.30.121 (iPhone9,3; iOS 12_4_1; ...)`<br>Android: `... Mobile Safari/537.36 Instagram 30.0.0.12.95 Android (...)` | WhatIsMyBrowser, f2etw/detect-inapp |
| Facebook | `FBAN/` `FBAV/` `FB_IAB/` | iOS: `[FBAN/FBIOS;FBAV/157.0.0.42.96;FBBV/...;FBDV/iPhone9,1;...]`<br>Android: `[FBAN/FB4A;FBAV/294.0.0.39.118;...]`, `FB_IAB/FB4A;FBAV/...` | thadafinser UA 코퍼스, UserAgents.io |
| Messenger | `FB*/(Messenger\|MESSENGER)` | `[FBAN/MessengerForiOS;...]`, `FB_IAB/MESSENGER` | f2etw/detect-inapp |
| Naver | `NAVER(inapp` | `... NAVER(inapp; search; 2000; 12.10.6)` | WhatIsMyBrowser Naver In App Search |
| Line | `Line/` | f2etw/detect-inapp 정규식 | f2etw/detect-inapp |
| Twitter / X | `Twitter` | 동일 | 동일 |
| WeChat | `MicroMessenger/` | 동일 | 동일 |

출처 링크
- https://explore.whatismybrowser.com/useragents/explore/software_name/linkedin-app/
- https://developers.kakao.com/docs/latest/en/kakaologin/utilize
- https://useragents.io/uas/mozilla-5-0-linux-android-15-sm-s938n-...-kakaotalk-25-4-3-inapp_dffd98617879617b50a5e467952bd086
- https://github.com/juunini/detect-kakaotalk-in-app-browser
- https://explore.whatismybrowser.com/useragents/explore/software_name/naver-in-app-search/9
- https://github.com/f2etw/detect-inapp (`src/inapp.js`)
- https://github.com/luizcieslak/am-i-inapp-browser

### 1.2 조사에서 나온 가장 중요한 발견

**iOS 인앱 판별의 통설 휴리스틱이 링크드인에서 깨진다.**

널리 쓰이는 f2etw/detect-inapp의 iOS 규칙은 `(iPhone|iPod|iPad)(?!.*Safari\/)`, 즉 "아이폰 UA인데 `Safari/` 토큰이 없으면 WebView"다. 그런데 2026년 링크드인 iOS UA에는 `Safari/604.1`이 **들어 있다**. 이 휴리지스틱만 쓰면 이 프로젝트가 가장 두려워하는 단 하나의 환경을 정확히 놓친다.

인스타그램 iOS는 여전히 `Safari/`가 없어서 이 규칙에 걸린다. 그래서 형태 기반 규칙을 버리지는 않았고, **이름 붙은 토큰을 1차 판별로 두고 형태 규칙은 이름 없는 호스트를 잡는 그물로만** 남겼다. 판정 순서가 이 파일의 설계다.

### 1.3 분류 결과

`env.webviewApp`이 앱 이름을, `env.webviewHostile`이 "WebGL 호스트로 문제가 보고된 앱 또는 첫 접촉 비용이 가장 큰 앱"인지를 준다. hostile 집합은 linkedin, kakaotalk, instagram, facebook, messenger, threads, tiktok, snapchat이다. 네이버는 인앱이지만 hostile에서 뺐다. 검색 경유 유입이고 R4가 지목한 위험 경로가 아니다.

Playwright 검증 결과 12종 전부 기대대로 분기했다. `naver_ios`만 tier lite / count 24000, hostile 8종은 tier lite / count 12000 / DPR 캡 1.25.

---

## 2. 티어와 예산

### 2.1 판정 순서 (`decideTier`)

내려가는 조건만 있고 올라가는 조건은 없다. 위에서부터 처음 걸리는 것이 답이다.

| 순서 | 조건 | 티어 | 이유 |
|---|---|---|---|
| 1 | 이번 세션에서 컨텍스트가 두 번 죽었음 | static | 세 번째를 시도할 이유가 없다 |
| 2 | `prefers-reduced-motion: reduce` | static | WCAG 2.3.3, W3C C39 |
| 3 | WebGL 컨텍스트 생성 실패 또는 소프트웨어 래스터라이저 | static | 그릴 수 없거나, 그려도 인터랙티브하지 않다 |
| 4 | `effectiveType` 이 2g 또는 slow-2g | static | 에셋이 도착하지 않는다 |
| 5 | `saveData === true` | lite | 명시적 의사 표시 |
| 6 | 인앱 WebView | lite | R4 최대 리스크 |
| 7 | 모바일 브라우저 | lite | 3절 |
| 8 | `deviceMemory <= 2` 또는 코어 2개 이하 | lite | |
| 9 | 나머지 | full | |

### 2.2 예산 (`env.budget`)

`main.js`는 `env.tier`로 숫자를 분기하지 말고 `env.budget`을 읽는다. 매직 넘버를 한 곳에 모아 감사 가능하게 하기 위한 것이다.

| | full | lite | lite (hostile WebView) | static |
|---|---|---|---|---|
| `intro` | true | false | false | false |
| `field` | true | true | true | false |
| `fieldCount` | 130,000 | 24,000 | 12,000 | 0 |
| `dpr` 상한 | 2 | 1.5 | 1.25 | 1 |
| `postprocessing` | true | false | false | false |
| `targetFps` | 60 | 30 | 30 | 0 |
| `smoothScroll` | true | false | false | false |

### 2.3 DPR 캡의 산술

R3이 준 숫자를 그대로 검산했다. iPhone 15 Pro는 393 x 852 CSS 픽셀이다.

| DPR | 디바이스 픽셀 | 노트북 1440x900 대비 |
|---|---|---|
| 3.0 (기본) | 3,013,524 | 2.33배 |
| 1.5 (모바일 캡) | 753,381 | 0.58배 |
| 1.25 (hostile 캡) | 523,181 | 0.40배 |

풀스크린 프래그먼트 패스는 이 숫자에 정비례해서 **매 프레임** 비싸다. 포인트 클라우드는 그렇지 않다. 비용이 정점 수에 붙고 필 코스트는 작은 스프라이트 몇 천 개뿐이다. **이 차이가 인트로와 필드에 서로 다른 판정을 내리는 근거 전부다.**

---

## 3. 모바일 인트로 판단

### 결론: 모바일에서 인트로를 **생략한다.** 축소하지 않는다.

`env.budget.intro`가 lite와 static에서 false다. 즉 데스크톱 full 티어에서만 재생된다.

### 근거 다섯

**1. 인트로는 보상이 아니라 게이트로 구현돼 있다.**
현재 `intro.js` 타임라인은 5.75초이고, 그동안 `main.js`가 `lenis.stop()`을 걸고 `html.intro-on`이 `overflow:hidden`을 건다. 스크롤이 잠긴다. R4 §5는 "3D는 게이트가 아니라 보상이어야 한다"고 판정했다. 데스크톱에서는 5.75초를 쓸 이유가 있지만 모바일에서는 없다.

**2. 첫 10초 중 5.75초를 정보 0으로 쓴다.**
R4가 채택한 Microsoft 연구(20억 건 체류시간, 205,873개 페이지)는 이탈이 첫 10초에 가장 가혹하다고 본다. R4 §4.5는 모바일 방문자가 **반드시 성공해야 하는 것 셋**을 못박았다. (1) 3초 내 이름과 정체성과 연락처 도달, (2) 크래시와 프리즈 없음, (3) 배터리와 발열 없음. 5.75초 전체 화면 셰이더는 셋 다 정면으로 침해한다.

**3. 이 셰이더는 모바일 GPU에서 가장 나쁜 형태의 부하다.**
`intro.js`의 프래그먼트 셰이더는 5옥타브 fbm을 프레임당 여러 번 호출하는 풀스크린 패스다. 필 레이트 100%이고 비용이 픽셀 수에 정비례한다. R3 F-4가 "후처리 패스 하나를 빼는 것이 파티클 수를 줄이는 것보다 대개 효과가 크다"고 한 것과 같은 이유다. 반면 `field.js`는 포인트 클라우드이고 정점 바운드다. **그래서 필드는 모바일에서 살리고 인트로는 죽인다.** 이 비대칭이 자의적이지 않은 이유가 2.3절의 산술이다.

**4. 축소본은 원본보다 나쁘다.**
인트로의 내용은 낙하와 입수와 부상이고, 그 전부가 지속 시간으로 성립한다. 1.5초로 줄이면 장면이 아니라 깜빡임으로 읽힌다. R3 F-5의 원칙 그대로다. **감축 모드는 열화된 버전이 아니라 다른 좋은 버전이어야 한다.** 잘라낸 시네마틱은 "다른 좋은 버전"이 아니다.

**5. 모바일에서는 세션당 한 번이 아니라 매번이다.**
`sessionStorage.introSeen`이 재생을 세션당 1회로 제한한다. 데스크톱 세션은 여러 페이지뷰를 포함하지만 모바일 첫 접촉 세션은 대개 단일 페이지뷰다. 즉 데스크톱 방문자는 5.75초를 한 번 내고 모바일 방문자는 매 방문마다 낸다. 비용 분포가 정확히 거꾸로다.

### 모바일이 대신 받는 것

`#field` 파티클 필드가 남는다. 24,000개(hostile WebView 12,000개), DPR 1.5 상한, 30fps 상한. 스크롤을 막지 않고 히어로 텍스트 뒤에서 돈다. **보상이지 게이트가 아니다.** R4의 명제 그대로, 모바일은 읽히는 곳이 아니라 처음 열리는 곳이므로 모바일이 받아야 할 것은 "볼 만한 사이트라는 증거"이지 "감상"이 아니다.

인트로 자리에는 CSS 전환으로 충분하다. `main.js`가 `intro` 예산이 false일 때 `playHero()`를 바로 부르면 된다. 지금 코드가 이미 그 형태다.

### 데스크톱에서도 죽는 경우

`watchPerf`가 full 티어의 실측 프레임 시간을 보고 있다가 예산 초과가 지속되면 lite로 내린다. 저사양 노트북과 통합 그래픽 데스크톱이 여기서 걸린다.

---

## 4. detect-gpu를 쓰지 않는 이유와 대안

R3 F-2가 확보한 결정적 단서: **detect-gpu README 자체가 벤치마크 데이터 소스의 2025년 12월 갱신 중단을 명시한다.** 2026년 기기는 GPU 매칭에 실패해 `FALLBACK` 타입으로 떨어진다. 즉 최신 폰을 저사양으로 오판한다. 이 프로젝트의 독자가 최신 아이폰을 쓸 확률이 높다는 점을 생각하면 오판 방향이 최악이다.

대안은 `watchPerf()`다. 기기 데이터베이스를 참조하지 않고 실제 프레임 시간을 측정한다.

### 오판을 막는 네 가지 처리

이 네 개가 없으면 이 방식은 오히려 detect-gpu보다 나쁘다.

| 처리 | 없을 때 생기는 일 |
|---|---|
| 평균이 아니라 **중앙값** | GC 한 번에 300ms 프레임이 뜨고 즉시 강등된다 |
| **grace 40프레임 무시** | 셰이더 컴파일, 첫 텍스처 업로드, 폰트 스왑이 전부 초반에 몰린다. 대표성이 없다 |
| **300ms 초과 델타 폐기** | 탭 전환, alert, 디버거 정지가 다초 프레임으로 기록된다 |
| **`visibilityState === 'hidden'`이면 표집 중단** | 백그라운드 rAF 스로틀링이 1000ms 프레임을 만든다. 강등이 확정된다 |

### 이력 규칙

- **하향 즉시, 상향 기본 꺼짐.** R3 F-2는 상향도 권했으나 기본값은 끈다. 스크롤 중 상향은 눈에 보이는 팝이고, 열 제약으로 클럭이 오르내리는 폰에서는 진동한다. `allowUpgrade: true`를 넘기면 켜지되 연속 3윈도 정상 + 데스크톱 + 이번 세션에 하향 이력 있음을 전부 만족해야 한다.
- **세션 바닥(`sessionStorage['d1:tier-floor']`).** 한 번 못 버틴 기기에 두 번 증명시키지 않는다. 증명 한 번이 발열 램프 한 번이다.

검증: 40프레임 grace(8ms) 후 90프레임 40ms를 먹였더니 `full -> lite`(중앙값 40.0ms, 예산 20ms), 다시 90프레임 40ms에 `lite -> static`. 5000ms 단일 프레임은 표본에 들어가지 않았다.

---

## 5. 컨텍스트 손실

R3 F-1과 R4 §4.3이 iOS 18.2, 18.3의 WebGL 컨텍스트 손실 크래시를 개발자 1차 보고로 축적하고 있다고 기록했다. 확인한 스레드: https://developer.apple.com/forums/thread/778735, https://discourse.threejs.org/t/ios-18-2-causing-webgl-error/75143.

`guardContext(canvas, handlers)`의 정책.

1. `webglcontextlost`에 **반드시 `preventDefault()`**. 안 부르면 컨텍스트가 영원히 복구되지 않고, 앱 전환 후 돌아온 방문자는 흰 사각형을 본다. 정확히 R3 F-1이 지목한 실패 형태다.
2. 1회 손실은 복구를 기다린다. `webglcontextrestored`에서 호출자가 씬을 재구성한다.
3. **2회 손실은 세션 종료.** `sessionStorage['d1:gl-dead'] = '1'`을 쓰고 static으로 내린다. 새로고침해도 다시 시도하지 않는다. "크래시 후 Safari가 캐시 삭제나 재부팅 전까지 WebGL을 표시하지 못한다"는 보고가 있는 상황에서 재시도 루프는 방문자를 백지에 가둔다.
4. **워치독 4초.** 복구 이벤트가 오지 않으면 하드 실패로 간주한다.

**iOS 버전으로 차단하지 않기로 했다.** 18.2와 18.3만 막으면 다음 회귀에 무방비이고, 지금 그 버전에서 멀쩡히 도는 기기까지 강등된다. 관측된 실패에 반응하는 편이 버전 문자열을 믿는 것보다 정확하다.

### 리사이즈 누수

WebKit 버그 219780: 살아 있는 온스크린 WebGL 캔버스의 width/height 변경이 iOS에서 메모리를 누수한다. 그런데 모바일 사파리는 주소창이 접히고 펴질 때마다 resize를 쏘고, 그 일은 첫 스크롤에서 바로 일어난다. 즉 순진한 `addEventListener('resize', resize)`는 **스크롤 방향이 바뀔 때마다 드로잉 버퍼를 재할당**하는 코드다. 캔버스 메모리 상한이 있는 기기를 상대로.

`onViewportResize(cb)`가 터치 기기에서 **폭 변화 없는 140px 이하 높이 변화를 무시**하고 나머지를 180ms 디바운스한다. `orientationchange`는 진짜이므로 260ms 후 통과시킨다.

검증: 844 -> 760 -> 844 높이 변화는 콜백 0회. 폭이 바뀌는 회전은 resize 3연발에도 콜백 1회.

**현재 `intro.js`와 `field.js`가 각각 `addEventListener('resize', resize)`를 직접 걸고 있다.** 두 파일 다 내 소유가 아니므로 여기서 고치지 않았다. 8절 인계 항목이다.

---

## 6. 데이터 세이버와 배터리

판단: **둘 다 하향 힌트로만 쓰고, 게이트로는 절대 쓰지 않는다.**

이유는 지원 분포의 비대칭이다.

- `navigator.connection` (`saveData`, `effectiveType`)은 Chromium 전용이다. iOS 브라우저는 전부 WebKit이므로 **아이폰에서는 항상 없다.** 파이어폭스도 없다.
- Battery Status API (`navigator.getBattery`)도 Chromium 전용이다. WebKit은 도입한 적이 없고 Gecko는 제거했다.

즉 이 프로젝트에서 가장 중요한 기기군(아이폰, 링크드인 iOS WebView)에서 두 신호 모두 `null`이다. **값이 없는 것은 "여유 있다"가 아니라 "의견 없음"이어야 한다.** 그래서 있으면 내리고 없으면 아무 일도 하지 않는다.

구체적으로
- `saveData === true` -> lite (명시적 의사 표시이므로 존중한다)
- `effectiveType`이 2g 또는 slow-2g -> static
- 배터리 20% 이하 + 미충전 -> full이면 lite로. `levelchange`와 `chargingchange`를 계속 듣는다
- 셋 다 없으면 판정에 영향 0

---

## 7. 접근성 판단

### 7.1 인트로 중 스크린리더 사용자

브리프의 제약은 "인트로는 `aria-hidden`이지만 그동안 페이지 접근이 막혀 있으면 안 된다"였다. 세 가지 결정을 했다.

**(a) `aria-hidden`이 잘못된 노드에 걸려 있었다.**
`index.html`은 `#intro`(컨테이너)에 `aria-hidden="true"`를 건다. 캔버스를 숨기는 것은 맞지만 **`#skip` 버튼까지 숨긴다.** 스크린리더 사용자에게 유일한 탈출구가 사라진다. `fixIntroSemantics()`가 `aria-hidden`을 `#introcv`(캔버스)로 내리고 컨트롤은 노출한다.

**(b) 밑의 페이지를 `inert`로 봉하지 않았다.**
모달 오버레이의 교과서 처방은 배경을 `inert`로 만드는 것이다. 여기서는 하지 않는다. 그 처방은 브리프의 제약과 정면 충돌한다.

**(c) 그래서 대신, 어떤 입력이든 인트로를 끝낸다.**
(b)를 하지 않으면 키보드 포커스가 불투명한 오버레이 뒤로 갈 수 있다는 새 문제가 생긴다. 해법은 봉하는 것이 아니라 **잠금 자체를 1회 입력 수명으로 줄이는 것**이다. `introStart()`가 Tab, Enter, Space, Escape, wheel, touchmove, 그리고 Skip 클릭을 전부 스킵으로 연결한다. Tab은 `preventDefault`해서 뒤쪽으로 포커스가 새지 않게 한다. Cmd와 Ctrl과 Alt 조합은 무시한다(Cmd+R이 인트로를 스킵하면 안 된다).

결과: `html.intro-on`의 `overflow:hidden`이 스크린리더의 scroll-into-view를 막는 시간은 **최대 입력 하나**다. 어떤 입력 방식으로도 갇히지 않는다.

검증: 키보드(Tab), Escape, 포인터 클릭, 터치 스크롤 4경로 전부 스킵 발동. Cmd+Tab은 무시됨.

### 7.2 인트로가 끝났을 때 포커스가 어디로 가는가

`releaseIntro()`가 `introEl.remove()`를 한다. **포커스를 가진 노드를 지우면 포커스는 `<body>`로 떨어진다.** 키보드 사용자는 다음 Tab이 브라우저 크롬에서 다시 시작되고, 스크린리더 사용자는 가상 커서가 조용히 리셋된다. "페이지가 내 위치를 먹었다" 버그의 고전형이다.

**어디로 보낼지는 인트로가 어떻게 끝났느냐에 달렸다.** 그래서 `introStart()`가 종료 방식을 기록하고 `introEnd()`가 그것을 읽는다.

| 종료 방식 | 포커스 대상 | 이유 |
|---|---|---|
| 키보드 | 스킵 링크 | 문서의 첫 포커서블이다. 키보드 사용자가 자연스러운 시작점에서 재개하고 다음 Tab이 상단 바에 닿는다. 포커스 시 보이므로 입력이 먹혔다는 확인도 된다 |
| 포인터 또는 타임라인 완주 | `<main>` (`tabindex="-1"`, 링 없음) | 마우스 사용자 눈에는 아무 변화가 없으면서 읽기 위치는 정확하다 |

검증: 키보드 경로에서 `document.activeElement === .skip-link`, 포인터 경로에서 `=== main`.

### 7.3 스킵 링크

`index.html`이 `<a class="skip-link" href="#s1">`을 갖게 됐다(작업 중 다른 에이전트가 추가). 두 가지가 비어 있었다.

1. **`.skip-link`에 CSS 규칙이 문서 어디에도 없다.** 즉 헤더 위에 항상 보이는 링크로 렌더된다. `a11y.js`의 주입 스타일시트가 `.a11y-skip`과 `.skip-link` 양쪽을 스타일링한다. 포커스 전 `translateY(-180%)`, 포커스 시 0.
2. **맨 해시 링크는 사파리와 파이어폭스에서 포커스를 옮기지 않는다.** 뷰포트만 움직인다. 스킵 링크가 존재하는 이유인 그 사용자에게 아무 일도 안 한다는 뜻이다. 클릭 핸들러가 대상에 `tabindex="-1"`을 걸고 명시적으로 `focus()`한다.

**스킵 링크를 두 개 만들지 않는다.** `ensureSkipLink()`가 기존 것을 발견하면 채택하고 핸들러만 붙인다. 두 개의 스킵 링크는 없는 것보다 나쁘다.

### 7.4 랜드마크

작업 시작 시점에 `index.html`에 `<main>`이 없었다. 지금은 다른 에이전트가 넣었고 C3 A-11 랜드마크 이름도 인라인 스크립트(`renderRows()`)가 언어별로 적용한다.

`a11y.js`는 **빈 자리만 채우고 덮어쓰지 않는다.** 같은 속성을 두 주체가 쓰면 그것이 속성이 어긋나기 시작하는 방식이다. `<main>`이 없으면 만들어 `body > section`을 옮겨 담고, 있으면 그대로 쓴다. `<footer>`는 `<main>` 밖에 둔다. 그래야 `contentinfo` 역할을 유지한다.

### 7.5 인덱스 카운터

`.idx`가 스크롤 프레임마다 `01 / 07`을 다시 쓴다. 라이브 리전 안에 들어가거나 콘텐츠로 읽히면 **"02 슬래시 07" 낭독 스트림**이 된다. `aria-hidden="true"` + `role="presentation"`. 크롬이지 콘텐츠가 아니다.

### 7.6 섹션 6 미디어

C3 6.5를 그대로 집행한다. 그 절의 규칙이 설계 전부다. **화면에 보이는 텍스트가 정확히 접근성 텍스트다.** 슬레이트 2필드가 시각 사용자가 받는 전부이므로 스크린리더 사용자도 그것만 받는다. 서술적 alt를 쓰면 C3가 금지한 캡션이 되고, 안 쓰면 WCAG 1.1.1 실패다. 보이는 슬레이트를 가리키는 `aria-labelledby`만이 둘을 동시에 만족시킨다.

구현 결정 넷.

1. **`.slot`을 `role="figure"`로 올리고 `aria-labelledby`를 `.slate`에 건다.** id가 없으면 `slate-pv-01` 형식으로 생성한다. `<video>`가 들어오면 같은 id를 가리키게 하고 `alt`는 제거한다(`<video>`에 `alt`는 없다).
2. **`preload="none"`을 강제한다.** 이것은 예의가 아니라 iOS 캔버스와 페이지 메모리 상한 문제다. 디코드된 영상 4개 + WebGL 컨텍스트가 탭이 죽는 방식이다.
3. **파형 진행 표시는 `role="progressbar"`로 정했다.** C3 6.5는 `<input type="range">` 또는 `role="slider"`에 라벨 `Progress` / `진행`을 제안했다. 이 디자인에는 탐색(seek) 인터랙션이 없다. slider 역할은 존재하지 않는 조작 가능 컨트롤을 약속하고, 그것은 반대 방향으로 4.1.2 실패다. 읽기 전용 경과 표시의 정직한 매핑은 progressbar다. `setProgress(pct)`가 `aria-valuenow`를 갱신한다.
4. **재생 버튼 라벨은 `Play` / `재생`만.** C3가 못박은 대로 곡 제목을 넣지 않는다. 제목은 옆에 텍스트로 있고, 라벨에 넣으면 이 챕터에 유일하게 문장 비슷한 것이 생긴다. `aria-disabled="true"`는 소스가 없을 때만 유지하고 `data-src`가 채워지면 `false`로 뒤집는다. 안 뒤집으면 영원히 죽은 컨트롤로 낭독된다.
5. 자동 재생 영상이 5초를 넘으면 WCAG 2.2.2가 정지 수단을 요구한다. `<video>`가 하나라도 있으면 전역 일시정지 버튼을 만든다. 라벨은 C3 표대로 `Pause all clips` / `모든 클립 일시정지`.

### 7.7 언어 전환

R3b가 명확하다. **전환은 URL을 바꾸는 진짜 앵커여야 한다.** Googlebot은 버튼을 클릭하지 않고 `Accept-Language`도 보내지 않는다. `index.html`은 `<button id="lang">`을 실어 보내고 있고, 그 말은 검색 입장에서 **이 사이트의 한국어 절반이 존재하지 않는다**는 뜻이다. R3b가 plus-ex.com에서 기록한 실패와 같다.

`wireLang()`이 그 버튼을 C3 5.6 블록으로 교체한다.

```html
<nav aria-label="Language">
  <a href="/"    hreflang="en" lang="en" aria-current="page">EN</a>
  <span aria-hidden="true">/</span>
  <a href="/ko/" hreflang="ko" lang="ko" aria-label="한국어">KO</a>
</nav>
```

- **순서 EN / KO 고정.** 현재 언어에 따라 바꾸지 않는다.
- **활성 표시는 `aria-current="page"`.** 취소선 안 쓴다.
- **href는 경로 미러링으로 계산한다.** `/x` <-> `/ko/x`. 홈으로 보내지 않는다.
- `mode: 'toggle'`(현재 과도기)에서는 클릭을 가로채 `data-lang`을 바꾸되 **앵커의 href는 진짜다.** `/ko/`가 나가는 날 지울 것은 클릭 핸들러 한 줄뿐이다.

부수적으로 고친 것: `[data-en]`과 `[data-ko]` 스팬에 `lang` 속성이 없었다. 양쪽 언어가 동시에 DOM에 있고 CSS만 한쪽을 숨긴다. 스타일시트가 늦거나 막히면 **스크린리더가 한국어를 영어 음성으로 읽는다.** 스팬당 속성 하나로 이 실패 계열 전체가 사라진다.

**감지 배너는 제안만 하고 리다이렉트하지 않는다.** R3b 그대로다. Googlebot은 미국 IP에서 `Accept-Language` 없이 온다. 자동 리다이렉트를 걸면 한 언어만 크롤링되고 다른 언어는 영원히 색인되지 않는다. 배너 문구는 C3 5.6대로 **읽는 사람의 언어로** 쓴다. 영문 페이지에서 한국어 사용자에게 영어로 안내하면 안내가 아니다. 닫으면 `localStorage`에 기록되고 다시 뜨지 않는다.

### 7.8 모션 정책

지금 세 곳이 따로 논다. OS 설정을 `main.js`가 로드 시 한 번 읽고, `#motion` 버튼이 별도로 클래스를 토글하며 그 선택은 저장되지 않는다. `a11y.js`의 `motion`이 단일 진실원이 된다.

- OS 설정을 `matchMedia` **change 이벤트로 계속** 듣는다. 한 번 읽고 끝내지 않는다.
- 명시적 토글은 `localStorage`에 저장되고 **양방향으로 OS 설정을 이긴다.** OS가 reduce인데 손으로 켠 사람은 손으로 요청한 것이다.
- 버튼에 `aria-pressed`가 붙는다(눌림 = 모션 억제). 원래 없었다.
- 주입 CSS가 `prefers-reduced-motion`에서 `html{scroll-behavior:auto}`로 되돌린다. `index.html`의 `scroll-behavior:smooth`가 그대로 두면 감축 모드에서도 스무스 스크롤을 한다.

### 7.9 그 밖에 고친 것

| 항목 | 문제 | 처리 |
|---|---|---|
| `#skip` 대비 | `#5A544C` on `#0E0D0C` = 약 2.1:1. 10.5px 텍스트는 4.5:1 필요. WCAG 1.4.3 실패 | 주입 CSS가 `#B9B2A6`으로 올림 |
| 포커스 링 | 문서에 `:focus-visible` 규칙이 하나도 없었다 | `--accent` 2px 아웃라인, 오프셋 3px |
| 국문 줄바꿈 | C3 6.8. `keep-all` 누락 시 국문이 아무 데서나 끊긴다 | `word-break:keep-all; overflow-wrap:anywhere`. `break-word`는 병기하지 않는다. `keep-all`을 취소시킨다 |
| 캔버스 | `#introcv`가 접근성 트리에 노출 | `aria-hidden` + `role="presentation"` |
| 라이브 리전 | 없음 | polite 하나만. 두 개면 JAWS와 NVDA가 두 번 읽는다 |

---

## 8. main.js 배선 지점

`main.js`는 내 소유가 아니므로 호출 지점만 명시한다.

### 8.1 파일 최상단, 다른 어떤 초기화보다 먼저

```js
import { env, watchPerf, guardContext, onTierChange, onViewportResize } from './env.js'
import * as a11y from './a11y.js'

a11y.init({ reduceMotion: env.tier === 'static' })   // 반드시 GSAP·ScrollTrigger 생성 전
a11y.wireLang({ mode: 'toggle' })                    // /ko/ 나가면 mode: 'route'
a11y.langBanner({})
if (env.tier === 'static') a11y.staticMode(true)
```

`a11y.init()`이 GSAP보다 **먼저** 와야 하는 이유: `<main>`이 없으면 만들어 섹션을 옮긴다. ScrollTrigger가 오프셋을 계산한 뒤에 노드를 옮기면 어긋난다. `<main>`이 이미 있으면 아무것도 옮기지 않지만, 순서는 그대로 지키는 편이 안전하다.

### 8.2 `reduce` 상수 교체

```js
// 삭제: const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const reduce = !a11y.motion.enabled
a11y.motion.subscribe((on) => { on ? field?.start() : field?.stop() })
```

지금 `#motion` 버튼 핸들러가 `main.js` 맨 아래에 따로 있다. `a11y.js`가 이미 그 버튼을 잡고 있으므로 **중복 리스너를 제거해야 한다.** 남겨두면 클릭 한 번에 두 번 토글돼서 아무 일도 안 일어난다.

### 8.3 인트로 블록

```js
if (introEl && introCanvas && env.budget.intro && !seen) {
  document.documentElement.classList.add('intro-on')
  lenis.stop()
  const intro = createIntro(introCanvas, { onDone: () => { sessionStorage.setItem('introSeen','1'); releaseIntro() } })
  window.__intro = intro
  a11y.introStart(introEl, { onSkip: () => intro.skip() })   // 기존 click과 Escape 리스너를 대체한다
  guardContext(introCanvas, { onDead: () => { intro.skip(); a11y.staticMode(true) } })
} else {
  introEl?.remove()
  playHero()
}
```

`env.budget.intro`가 `!reduce && !mobile && !webview`를 한꺼번에 대신한다.
기존의 `#skip` click 리스너와 `keydown` Escape 리스너 두 줄은 **지운다.** `a11y.introStart()`가 그 둘을 포함해 여섯 경로를 덮는다.

### 8.4 `releaseIntro()` 안, `introEl.remove()` 직후

```js
function releaseIntro(){
  document.documentElement.classList.remove('intro-on')
  introEl?.remove()
  a11y.introEnd()          // <-- 여기. remove() 다음, playHero() 전
  lenis.start()
  ScrollTrigger.refresh()
  playHero()
}
```

### 8.5 필드 생성

```js
if (canvas && env.budget.field) {
  field = createField(canvas, { count: env.budget.fieldCount, dpr: env.budget.dpr })
  field.start()
  guardContext(canvas, {
    onLost: () => field.stop(),
    onRestored: () => field.start(),
    onDead: () => { field.dispose(); a11y.staticMode(true) },
  })
  onTierChange((tier) => {
    if (tier === 'static') { field.dispose(); field = null; a11y.staticMode(true) }
    else { field.dispose(); field = createField(canvas, { count: env.budget.fieldCount, dpr: env.budget.dpr }); field.start() }
  })
}
```

`createField`는 현재 `dpr` 옵션을 받지 않고 내부에서 `Math.min(devicePixelRatio, 1.5)`를 한다. `field.js`는 내 소유가 아니므로 옵션 추가는 소유자에게 넘긴다. 추가 전까지는 `count`만 넘겨도 대부분의 이득을 얻는다.

### 8.6 프레임 감시. GSAP 티커에 얹는 것을 권한다

```js
const perf = watchPerf(
  (tier) => { if (tier === 'static') a11y.staticMode(true) },
  { selfDrive: false }
)
gsap.ticker.add((t) => perf.tick(t * 1000))
```

`selfDrive: true`(기본)로 두면 자체 rAF를 하나 더 돈다. 동작하지만 티커 하나로 통일하는 편이 R3의 "단일 프레임 루프" 원칙과 맞는다.

### 8.7 리사이즈

`intro.js`와 `field.js`가 각각 `addEventListener('resize', resize)`를 직접 건다. 5절의 iOS 누수 문제 때문에 두 곳 다 `onViewportResize(cb)`로 바꿔야 한다. 두 파일 다 내 소유가 아니라 못 고쳤다. 소유자에게 넘긴다.

```js
onViewportResize(() => field?.resize())
```

### 8.8 섹션 6

미디어가 실물로 들어오는 시점에 한 번 호출한다.

```js
a11y.wireStage()                       // DOM 준비 후
a11y.setPlayState(playBtn, playing)    // 재생 상태가 바뀔 때마다
a11y.setProgress(pct)                  // 오디오 timeupdate에서
```

---

## 9. 검증 기록

Playwright, 뷰포트 390x844, `http://localhost:5199`. **콘솔 에러 0건, 경고 0건.** `npx vite build` 통과. 두 파일에 em dash와 en dash 0개.

| 검증 | 결과 |
|---|---|
| UA 12종 분기 | 링크드인 iOS/Android, 카카오 iOS/Android, 인스타 iOS, 페이스북 iOS/Android, 메신저 iOS, 네이버 iOS, 사파리 iOS, 크롬 Android, 데스크톱. 전부 기대대로 |
| DPR 3 + 링크드인 WebView | DPR 1.25로 캡. 523,181 디바이스 픽셀. 원본 대비 17% |
| `prefers-reduced-motion` | static, intro false, field false |
| `saveData: true` | lite |
| `effectiveType: '2g'` | static |
| WebGL 생성 실패 | static, `webgl-probe:no-context`, 예산 전부 0 |
| 프로브 컨텍스트 누수 | 연속 40회 프로브 전부 성공. 컨텍스트를 잡고 있지 않음 |
| `watchPerf` 하향 | 40ms 지속에서 full -> lite -> static. 5000ms 단일 프레임은 표본 제외 |
| `guardContext` | `preventDefault` 호출됨, 1회 손실 복구, 2회 손실에 static + `d1:gl-dead` 기록 |
| 세션 바닥 | 새 모듈 인스턴스가 static으로 시작, 사유 `webgl-died-earlier-this-session` |
| `onViewportResize` | 주소창 84px 높이 변화 콜백 0회. 회전 resize 3연발 콜백 1회 |
| 인트로 탈출 경로 | Tab, Escape, 클릭, touchmove 전부 발동. Cmd+Tab 무시 |
| 인트로 후 포커스 | 키보드 종료 -> 스킵 링크, 포인터 종료 -> `<main>`. `<body>`로 안 떨어짐 |
| 스킵 링크 | 1개만 존재(중복 없음), 포커스 전 화면 밖, 클릭 시 포커스 이동 |
| 언어 nav | `<nav aria-label="Language">`, 앵커 2개, `/`와 `/ko/`, EN/KO 순서 고정, `aria-current` 정확 |
| 언어 전환 후 | `html lang`, `data-lang`, 랜드마크 국문, 스킵 링크 문구 전부 동기 |
| 감지 배너 | 한국어 브라우저 + 영문 페이지에서 국문 배너, `/ko/` 링크, 리다이렉트 없음, 닫기 저장 |
| 섹션 6 | 슬롯 3개 `role="figure"` + `aria-labelledby`, 오디오 블록 라벨, `.wave` progressbar + `Progress` |
| 모션 토글 | `aria-pressed` 뒤집힘, `html.no-motion` 적용, `localStorage` 저장 |
| `audit()` | 0건 |

---

## 10. 남은 위험

**1. 실기기 검증이 없다.** 헤드리스 크롬에서 UA를 위조한 것과 실제 링크드인 앱 WebView에서 도는 것은 다르다. UA 분기는 확실하지만 **분기 이후 lite 티어가 실제 인앱 WebView에서 30fps를 지키는지는 미확인**이다. R4 §5.4가 "인앱 브라우저에서 반드시 테스트할 것"이라고 한 항목이 그대로 열려 있다. 실기기 아이폰에 링크드인 앱을 깔고 프로필 Website 필드를 눌러보는 것 외에 대안이 없다.

**2. UA는 언제든 바뀐다.** 링크드인이 2026년 iOS UA에 `Safari/`를 넣기 시작한 것이 이미 그 증거다. 토큰 기반 판별은 앱이 토큰을 유지하는 동안만 정확하다. 완화책으로 형태 기반 그물(`; wv)`, iOS에 `Safari/` 없음, `navigator.standalone` 미정의)을 남겼지만 이름 없는 새 호스트가 세 그물 전부를 빠져나갈 수 있다. **`watchPerf`와 `guardContext`가 최종 안전망**인 이유가 이것이다. 감지가 틀려도 측정은 틀리지 않는다.

**3. `watchPerf` 예산 20ms에 실증 근거가 없다.** R3 F-2가 정직하게 고백한 대로 중급 안드로이드와 아이폰의 실제 fps를 신뢰할 1차 출처가 없다. 20ms(약 50fps)는 60fps 목표에서 한 프레임 여유를 준 값이고 판단이다. 실기기 로그가 쌓이면 조정해야 한다.

**4. static 티어의 대체 이미지가 아직 없다.** R3 F-3은 "3D 씬의 고품질 정적 렌더 이미지(AVIF/WebP)"를 준비하라고 했다. 지금 `staticMode()`는 캔버스를 지우기만 한다. 지워진 자리가 비어 보이면 R3 F-5의 "다른 좋은 버전" 원칙을 못 지킨다. **에셋 준비는 C1과 B1 몫이고, 준비되면 `staticMode()`에 삽입 지점을 만들면 된다.**

**5. `a11y.js`가 런타임에 DOM을 쓴다.** JS가 실패하면 스킵 링크 스타일, 포커스 링, 언어 앵커가 전부 사라진다. `index.html`과 `page.css`가 내 소유가 아니라서 그렇다. 파일 안 `MOVE-TO-HTML` 주석이 옮겨야 할 마크업을 전부 적어놨다. **옮기고 나면 런타임 버전은 유지 대상이 아니라 삭제 대상이다.**

**6. `renderRows()`와 랜드마크 라벨 이중 소유.** 지금은 `a11y.js`가 빈 자리만 채우도록 양보했다. 두 곳 중 하나로 정리하는 편이 낫다. C3 A-11 문자열이 양쪽에 복제돼 있는 상태이므로 캐치프레이즈나 랜드마크 이름이 바뀌면 두 군데를 고쳐야 한다.

**7. `intro.js`와 `field.js`의 리사이즈 리스너.** 5절 문제가 그대로 남아 있다. 소유자가 `onViewportResize`로 바꾸기 전까지 iOS 주소창 스크롤마다 드로잉 버퍼를 재할당한다.

**8. 세션 바닥이 너무 끈질길 수 있다.** 한 번 static으로 떨어진 세션은 새로고침해도 올라오지 않는다. 일시적 원인(다른 탭이 GPU를 먹고 있었다)으로 떨어진 경우 방문자가 탭을 닫기 전까지 복구되지 않는다. 의도한 트레이드오프다. 잘못 강등된 비용보다 반복 크래시의 비용이 크다고 봤다.

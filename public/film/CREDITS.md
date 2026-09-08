# public/film 출처와 라이선스

전부 Mixkit. Mixkit Free License(평생 상업 이용, 저작자 표시 불필요).
원본을 그대로 재배포하지 않고 트리밍·인코딩해서 사이트에 삽입한 형태이므로 허용 범위 안이다.

| 파일 | Mixkit ID | 원본 | 내용 |
|---|---|---|---|
| `01_horizon` | 44370 | 3840x2160 | 수평선 위 일몰. 태양이 수면에 닿는 순간 |
| `02_rush` | 42498 | 3840x2160 | 청록 바다와 백사장 위 항공 촬영 |
| `03_dive` | 3171 | 3840x2160 | 입수. 수중 커스틱 |
| `04_shore` | 44378 | 3840x2160 | 야자수 해안선 저공 비행 |

각 파일은 4K, 1080 대체본, 포스터 JPG 세 벌로 존재한다.

## Technique credit

`src/glass.js` (the condensation on the hero after the intro lifts) adapts two
things from ThreeUI's condensation renderer by Design+Code, MIT licensed:
the sprite cache keyed on half pixel radius, and the drop merge that conserves
area, `r = sqrt(r1^2 + r2^2)`, rather than adding radii.

- Source: https://github.com/MengTo/threeui  `src/shaders/condensation/condensationRenderer.ts`
- Licence: MIT (ThreeUI Community). https://github.com/MengTo/threeui/blob/main/LICENSE
- Catalogue: https://threeui.com

No ThreeUI code, asset, font or preview media is redistributed here. The
renderer in `glass.js` is written against this site's own palette and its own
lifecycle: it runs once when the film hands the page over, then clears.

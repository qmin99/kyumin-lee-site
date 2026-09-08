# public/marks 출처와 라이선스

| 파일 | 출처 | 라이선스 | 저작자 |
|---|---|---|---|
| `umn.svg` | Wikimedia Commons, University of Minnesota Logo.svg | **Public domain** | University of Minnesota |
| `rokmc-seal.svg` | Wikimedia Commons, Seal of the Republic of Korea Marine Corps.svg | **South Korea-Gov** (대한민국 공공저작물) | 대한민국 해병대 |
| `rokmc-ega.svg` | Wikimedia Commons, `Eagle, Star, and Anchor.svg` | **Public domain** | 대한민국 해병대, 벡터화 Jetijones |
| `rokmc-sergeant.svg` | Wikimedia Commons, ROKMC-OR-5.svg (병장 계급장) | **CC BY-SA 4.0** | Wikimedia 기여자 |

`rokmc-sergeant.svg`는 CC BY-SA 4.0이므로 사이트 어딘가에 저작자 표시가 필요하다.
푸터의 크레딧 줄에 넣거나, 사용하지 않는 편이 간단하다.
나머지 둘은 표시 의무가 없다.


## `rokmc-ega.svg` 편집 내역

원본은 독수리 부리에 "정의와 자유를 위하여" 리본이 물려 있다. 락업에서
쓰는 124px 높이에서 리본 글자는 2px라 흰 얼룩으로만 읽히고, 리본 오른쪽
끝의 검은 쐐기는 벡터화 아티팩트다. 리본과 그에 딸린 끈, 모토 글자 패스를
제거해 독수리·별·닻만 남겼다. 이 형태 자체가 해병대 모자 휘장의 정식
형태이므로 임의로 만든 도안이 아니다.

- svgo로 편집기 잔여물 제거: 243K → 92K, 리본 제거 후 85K
- 제거한 노드: 리본 본체와 끈(#fff 3개), 접힌 부분(#4d4d4d), 모토 글자 그룹(#cc101f), 뷰박스 밖 잔여 패스 1개
- 현재 씰(`rokmc-seal.svg`)은 쓰지 않는다. 락업 활자가 REPUBLIC OF KOREA /
  MARINE CORPS / 대한민국 해병대를 이미 말하는데 씰의 원형 띠가 같은 세 마디를
  반복해서 중복이었고, 반전 구간에서 검은 띠가 배경에 묻혀 붉은 원반만 떠 보였다.

## `baengnyeongdo.svg`

백령도 해안선. OpenStreetMap Overpass API에서 `natural=coastline` way를 받아
섬의 평균 위도를 기준으로 등장방형 투영해 SVG path로 변환했다. 본섬 1개와
부속 도서 12개, 총 13개 링.

- 데이터: © OpenStreetMap contributors, **ODbL 1.0** (출처 표시 필수)
- 표시 위치: 섹션 05 로케이터 캡션의 `© OpenStreetMap`
- 좌표계: 등장방형, lat0 = 37.949, 뷰박스 1000 x 664

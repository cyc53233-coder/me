# cyc53233-coder/me

핫딜 큐레이션 사이트(저장소 루트·`v2/`)와 **생활비 가계부**(`ledger/`)가 한 저장소에 있다. 두 배포 대상이 서로 다른 주소로 나가므로 섞지 않는다.

## 배포 지도

| 무엇 | 어디로 | 무엇이 트리거하나 |
|---|---|---|
| 저장소 루트 정적 사이트 | `cyc53233-coder.github.io/me/` | `main` 푸시 → GitHub Pages 자동 |
| 저장소 루트 정적 사이트 (같은 내용) | `todays-hotdeal.pickuping.workers.dev` | `main` 푸시 → **Cloudflare 대시보드가 저장소를 직접 감시**(Workers Builds) → `npx wrangler deploy` (`wrangler.jsonc` · `.assetsignore`) |
| **가계부** `ledger/` | 같은 Pages 주소의 `/me/ledger/` | 위와 동일 |
| 가계부 (선택) | `dani-yongcheol.web.app` | `main`의 `ledger/**` 푸시 → `firebase-hosting.yml` |

**Workers 배포는 `.github/workflows/cloudflare.yml`이 하지 않는다.** 2026-09-20에 Cloudflare 대시보드로 저장소를 직접 연결했고(프로젝트 `todays-hotdeal` · Deploy command `npx wrangler deploy` · Root `/` · 작업 브랜치 빌드 꺼짐), 그쪽이 `main`을 감시해 배포한다. 그래서 `cloudflare.yml`은 시크릿이 없는 채로 **매 `main` 푸시마다 "건너뜀"으로 초록 종료한다 — 알려진 정상 상태다.** 시크릿을 넣으면 두 경로가 같은 워커에 배포하므로 넣지 말 것. 대시보드 프로젝트 이름과 `wrangler.jsonc`의 `name`이 다르면 배포가 이름 불일치로 실패한다.

**계정 서브도메인은 `pickuping`이다** (2026-09-20에 `cyc53233`에서 바꿨다). 워커 이름 `todays-hotdeal`은 `wrangler.jsonc`의 `name`과 Cloudflare 프로젝트 이름이 **같아야** 하고, 서브도메인을 또 바꾸면 위 표의 주소와 README 를 같이 고칠 것.

**「딜 등록 · 마감」 워크플로가 빨갛게 끝나는 것은 대개 고장이 아니다.** 가격을 안 적었거나 링크를 못 찾은 이슈는 `scripts/add-deal.mjs`가 답글을 남기고 exit 1 로 끝내며, 그래야 이슈가 닫히지 않고 고쳐서 다시 열 수 있다. 실행 로그보다 **이슈 답글**을 먼저 볼 것 — 답글이 링크에서 무엇을 읽었는지(상품명·사진·가격, 또는 차단 사유)까지 알려 준다.

**Firebase Hosting 워크플로는 저장소 시크릿 `FIREBASE_SERVICE_ACCOUNT`가 없으면 실패한다.** 없는 상태에서도 GitHub Pages 배포는 정상이므로, 그 주소로 쓰는 한 이 실패는 무시해도 되는 알려진 상태다 — 실패를 볼 때마다 새로 진단하지 말 것.

## 핫딜 사이트 손볼 때

저장소 루트의 `index.html` · `about.html` · `add.html` · `assets/` · `data/` 가 사이트다.
고쳤으면 **커밋 전에 `cd site-test && npm test`** — 폰 폭(390px)에서 실제 브라우저로 열어
칩이 한 줄인지, 카드 전체가 링크인지, 입장 버튼이 푸터를 가리지 않는지, 가로 넘침이 없는지를 본다.
처음이면 `npm install` 먼저. 이 폴더는 `.assetsignore` 로 배포에서 빠진다.

`npm install` 로 받은 playwright 가 이 컨테이너에 미리 깔린 크롬과 빌드가 어긋나
`Executable doesn't exist` 로 죽는 일이 있다. 검사 스크립트가 그때 `PLAYWRIGHT_BROWSERS_PATH`
의 크롬으로 알아서 넘어가니 **`npx playwright install` 을 돌리지 말 것** — 어느 크롬을 골랐는지
첫 줄에 찍어 준다. 다른 크롬을 쓰려면 `CHROMIUM_PATH` 로 짚어 준다.

검사는 **자체 딜 픽스처를 `data/deals.js` 자리에 물린다.** 실제 딜이 올라와도 검사가 깨지지 않고,
배포되는 데이터에 검사용 가짜 딜을 넣을 이유도 없다.

**등급은 할인율이 아니라 가성비로 매긴다.** 화면의 `%` 를 그대로 옮기지 말 것 — 정가를 부풀려
놓은 상품이 많다. 보는 것은 **단위당 가격이 평소 시장가 대비 얼마나 싼가**, 실제로 쓰는 물건인가,
그리고 **배송비 조건**이다 (100원인데 배송비 5,000원인 상품이 실제로 있었다).

목표 분포는 **무지성급 20% · 대박 60% · 추천 20%**. 절대 기준이 아니라 상대 기준이라,
딜을 새로 넣을 때마다 전체 목록을 다시 보고 분포를 맞춘다. 전부 대박이면 배지가 의미를 잃는다.

**쇼핑몰이 내주는 것** (2026-09-20 실제 등록으로 확인, #19 · #20):

| 쇼핑몰 | 상품명 | 사진 | 가격 |
|---|---|---|---|
| 토스 `toss.im/_m/…` | 읽음 | **읽음** | 없음 |
| 쿠팡 `link.coupang.com/a/…` | 없음 | 없음 | 없음 |

상품명은 붙여넣은 공유 문구에서 갈라내므로 쿠팡도 등록은 된다. **가격은 어느 쪽도 안 내주니
사람이 적어야 한다** — 지어내지 말 것. 사이트가 "안내된 가격과 다를 경우 구매를 권하지 않습니다"라고
약속하고 있다. 쿠팡 딜의 사진은 이슈에 첨부하면 그 사진을 쓴다.

## 가계부 배포 절차

1. `main`에서 브랜치를 딴다 (`git checkout -B <branch> origin/main`). 이전 브랜치가 이미 머지됐다면 재사용하지 말고 새로 판다
2. `ledger/index.html`을 고친다 — 단일 파일 웹앱이라 마크업·CSS·JS가 전부 여기 있다
3. **`cd ledger && npm test`** — 계산기 엔진, 결제 문자 파싱, 브라우저 체크(아티팩트 변형·호스팅 변형·Firebase 실패 진단)를 모두 돌린다. 처음이면 `npm install` 먼저
4. 커밋 → 푸시 → PR(초안으로 생성) → 준비 완료 전환 → 머지
5. 머지 후 GitHub Pages 실행이 `success`인지 확인. 사용자에게는 **`Ctrl+Shift+R`** 로 열어보라고 안내한다 (Pages CDN 캐시 때문에 옛 파일이 보일 수 있다)

`ledger/artifact.html`은 생성물이고 gitignore된다. 손으로 고치지 말고 `npm run build`로 만든다.

## claude.ai 아티팩트 발행

같은 앱을 아티팩트로도 발행해 왔다 (URL은 `/artifacts`에서 확인). `index.html`은 정식 HTML 문서이고 아티팩트 CSP는 외부 스크립트(Firebase SDK)를 막으므로, **반드시 `npm run build`가 만든 `artifact.html`을 발행한다.** 어떤 줄을 빼는지는 `build-artifact.mjs`의 `DROP` 목록이 유일한 기준이고, 문서 스켈레톤이나 Firebase 스크립트 줄을 고치면 목록도 함께 고쳐야 한다 (`npm run check`가 어긋남을 잡는다).

## Firebase — 막혔을 때 추측하지 말고 여기서 확인

프로젝트 `dani-yongcheol` · Realtime Database 싱가포르(`asia-southeast1`).

페이지가 "이 기기에만 저장 중"이면 아래 요청 하나로 **원인이 확정된다.** 사용자에게 화면을 보라고 요청하기 전에 이걸 먼저 돌린다:

```bash
curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=<웹앱 apiKey>" \
  -H "Content-Type: application/json" -d '{"returnSecureToken":true}'
```

| 응답 | 뜻 | 사용자가 할 일 |
|---|---|---|
| `idToken` 반환 | 익명 로그인 정상 | 남은 건 데이터베이스 규칙 |
| `CONFIGURATION_NOT_FOUND` | **Authentication이 시작된 적 없음** | 콘솔 > Authentication > 시작하기 > 익명 > 사용 설정 > 저장 |
| `ADMIN_ONLY_OPERATION` | 익명 제공업체만 꺼짐 | 위와 동일 |

**이 환경의 도달성**: `identitytoolkit.googleapis.com`은 나가지만 `*.firebasedatabase.app`은 차단(HTTP 000)이다. 그래서 로그인은 여기서 검증되지만 **규칙은 브라우저에서만 확인된다.** 데이터베이스가 안 된다고 단정하지 말 것.

콘솔에서 흔히 빠뜨리는 두 가지 — 둘 다 "입력했지만 적용 안 된" 상태로 보인다:
- Authentication 익명 토글을 켜고 **저장**을 안 누름
- 규칙을 붙여넣고 **게시**를 안 누름 (파란 "게시되지 않은 변경사항" 띠가 남아 있다)

적용된 규칙:

```json
{ "rules": { "ledgers": { "$ledger": { ".read": "auth != null", ".write": "auth != null" } } } }
```

보호는 "익명 로그인 + 추측 불가능한 22자 가계부 코드" 조합이다. 코드는 초대 링크(`#l=<코드>`)에만 들어 있고 `ledgers` 루트에는 읽기 권한이 없어 열거되지 않는다.

## 가계부 구조에서 알아둘 것

- **저장소 3단계 폴백** — claude.ai 아티팩트 내장 `db` → Firebase RTDB → 기기별 localStorage. `connectSharedStore()`가 요구하는 인터페이스만 맞추면 어댑터를 갈아끼울 수 있다 (`rtdbAdapter()` 참고)
- **연결 실패는 조용히 넘기지 않는다** — `initFirebase()`가 실패 이유를 `fbFailReason`에 담아 화면 하단에 띄운다. 새 실패 코드를 만나면 `FB_ERR_MSG`에 사람이 읽을 문구로 추가한다
- **공유 데이터는 신뢰하지 않는다** — 렌더는 전부 `textContent`. 사용자 문자열에 `innerHTML`을 쓰지 않는다
- **계산 엔진은 `eval()`을 쓰지 않는다** (`/*CALC_START*/` 구간). 계산 결과가 공유 저장소를 거쳐 상대방 화면에도 렌더되기 때문이다
- 사진 인식은 아티팩트에서는 Claude(`sample`), 그 밖에서는 브라우저 OCR로 동작한다. CSV 내보내기는 `downloads` 캐퍼빌리티가 없으면 Blob 다운로드로 폴백하고, **CSV 가져오기**(`parseCsv`, `/*CSV_START*/` 구간)는 어디서나 된다 — 이미 있는 기록·파일 안 중복은 미리보기에서 체크 해제된 채로 보여 준다

## 커밋·PR

커밋 메시지는 무엇이 왜 바뀌었는지를 산문으로 쓴다 (`git log` 참고). PR은 초안으로 열고, 검증 결과를 본문에 남긴다.

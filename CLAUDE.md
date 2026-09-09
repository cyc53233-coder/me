# cyc53233-coder/me

핫딜 큐레이션 사이트(저장소 루트·`v2/`)와 **생활비 가계부**(`ledger/`)가 한 저장소에 있다. 두 배포 대상이 서로 다른 주소로 나가므로 섞지 않는다.

## 배포 지도

| 무엇 | 어디로 | 무엇이 트리거하나 |
|---|---|---|
| 저장소 루트 정적 사이트 | `cyc53233-coder.github.io/me/` | `main` 푸시 → GitHub Pages 자동 |
| **가계부** `ledger/` | 같은 Pages 주소의 `/me/ledger/` | 위와 동일 |
| 가계부 (선택) | `dani-yongcheol.web.app` | `main`의 `ledger/**` 푸시 → `firebase-hosting.yml` |

**Firebase Hosting 워크플로는 저장소 시크릿 `FIREBASE_SERVICE_ACCOUNT`가 없으면 실패한다.** 없는 상태에서도 GitHub Pages 배포는 정상이므로, 그 주소로 쓰는 한 이 실패는 무시해도 되는 알려진 상태다 — 실패를 볼 때마다 새로 진단하지 말 것.

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
- 사진 인식·CSV 내보내기는 아티팩트 캐퍼빌리티(`sample`·`downloads`)에 의존해 **외부 호스팅에서는 숨겨진다**

## 커밋·PR

커밋 메시지는 무엇이 왜 바뀌었는지를 산문으로 쓴다 (`git log` 참고). PR은 초안으로 열고, 검증 결과를 본문에 남긴다.

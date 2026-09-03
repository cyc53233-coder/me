# 다니랑 생활비 통장

둘이서 함께 쓰는 생활비통장 가계부 — 단일 파일 웹앱(`index.html`).

배포 주소: **https://dani-yongcheol.web.app**

## 구성

- **통장 규칙** 카드가 페이지 최상단 (편집 가능, 공유 저장)
- **월별 요약 타일**: 이번 달 입금 / 지출 / 남은 돈 / 통장 누적 잔액
- **생활비 입금** 기록 (금액·내용·누가·날짜)
- **지출 내역** 기록 (금액·카테고리·내용·누가·날짜, 두 번 탭 삭제)
- **분석**: 카테고리별·사람별 지출 막대
- **자동화**
  - 결제 알림 스크린샷/영수증 **사진으로 등록** (AI 인식 → 폼 자동 채움 → 확인 후 저장, claude.ai 아티팩트에서만)
  - **결제 문자 붙여넣기** 인식 (정규식 파싱, 실패 시 AI 폴백)
  - 가맹점 키워드·과거 기록 기반 **카테고리 자동 추천**
  - **고정지출** 템플릿 → 매달 원탭 채우기 배너
- **계산기**
  - 금액 칸에 `12000+3500-2000` 같은 **수식을 그대로 입력** — 아래에 결과가 미리 보이고, 칸을 벗어나면 계산된 금액으로 확정된다
  - 금액 칸 옆 **계산기 패드** — 숫자 버튼으로 계산해 "이 금액 넣기"로 반영. `Esc`나 배경 탭으로 닫는다
  - 계산 엔진은 `eval()` 없이 직접 파싱한다 (`/*CALC_START*/` 마커 구간). 계산 결과가 공유 저장소를 거쳐 상대방 화면에도 렌더되므로 문자열 실행 경로를 만들지 않는다
- 전체 내역 **CSV 내보내기** (claude.ai 아티팩트에서만)

## 저장소 3단계 폴백

같은 파일 하나가 환경에 따라 저장소를 고른다:

1. **claude.ai 아티팩트** — 내장 공유 저장소(db 캐퍼빌리티). 같은 claude.ai 계정/조직 뷰어끼리 실시간 공유
2. **외부 호스팅 + Firebase Realtime Database** — 초대 링크(`#l=코드`)를 아는 사람끼리 같은 가계부에 실시간 연결
3. **둘 다 아니면** — 기기별 localStorage (헤더에 "이 기기에만 저장 중" 표시)

공유 모드로 처음 연결될 때 이 기기에만 있던 기록이 있으면 "올릴까요?" 배너로 이사를 제안한다.

데이터는 `ledgers/<가계부 코드>/` 아래에 들어간다 — `entries/`(입금·지출), `meta/rules`, `meta/settings`, `meta/recurring`.

## Firebase 설정

프로젝트: `dani-yongcheol` · Realtime Database 위치: 싱가포르(asia-southeast1)

1. **Realtime Database > 규칙** 탭에 붙여넣고 게시:

   ```json
   {
     "rules": {
       "ledgers": {
         "$ledger": { ".read": "auth != null", ".write": "auth != null" }
       }
     }
   }
   ```

   접근 보호는 "익명 로그인 + 추측 불가능한 가계부 코드" 조합이다 — 초대 링크를 아는 사람만 해당 가계부를 읽고 쓸 수 있다.
2. **Authentication > 로그인 방법 > 익명** 사용 설정
3. **프로젝트 설정 > 일반 > 내 앱**에서 웹 앱(`</>`) 등록 후 `apiKey`·`appId`를 `index.html`의 `FIREBASE_CONFIG`에 채운다 (웹 구성 값은 공개값이라 커밋해도 된다)

## 배포

`main`에 `ledger/` 변경이 푸시되면 [`firebase-hosting.yml`](../.github/workflows/firebase-hosting.yml)이 Firebase Hosting에 자동 배포한다. 저장소 시크릿 **`FIREBASE_SERVICE_ACCOUNT`** 가 필요하다 — Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성으로 받은 JSON 전체를 Settings > Secrets and variables > Actions 에 등록한다. (이 JSON은 비밀이므로 커밋하거나 채팅에 붙여넣지 말 것.)

호스팅 루트는 `ledger/`라서 가계부가 도메인 최상단에서 열린다. 저장소 루트의 핫딜 사이트와 섞이지 않는다.

## claude.ai 아티팩트로 발행할 때

`index.html`은 정식 HTML 문서다. 아티팩트 발행 도구가 문서 스켈레톤을 대신 씌우고, 아티팩트 CSP는 외부 스크립트(Firebase SDK)를 차단하므로 변형본을 만들어 발행한다:

```
node ledger/build-artifact.mjs      # → ledger/artifact.html (gitignore됨)
```

이 스크립트가 어떤 줄을 빼는지가 유일한 기준이다 — 문서 스켈레톤이나 Firebase 스크립트 줄을 고치면 스크립트의 `DROP` 목록도 함께 고쳐야 하고, 어긋나면 오류로 알려 준다. CI에서도 `--check`로 검증한다.

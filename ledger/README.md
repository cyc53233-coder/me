# 다니랑 생활비 통장

둘이서 함께 쓰는 생활비통장 가계부 — 단일 파일 웹앱(`index.html`).

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
- 전체 내역 **CSV 내보내기** (claude.ai 아티팩트에서만)

## 저장소 3단계 폴백

같은 파일 하나가 환경에 따라 저장소를 고른다:

1. **claude.ai 아티팩트** — 내장 공유 저장소(db 캐퍼빌리티). 같은 claude.ai 계정/조직 뷰어끼리 실시간 공유
2. **외부 호스팅 + Firebase** — 아래 설정을 마치면 Firestore로 실시간 공유. **초대 링크**(`#l=코드`)를 아는 사람끼리 같은 가계부에 연결
3. **둘 다 아니면** — 기기별 localStorage (헤더에 "이 기기에만 저장 중" 표시)

공유 모드로 처음 연결될 때 이 기기에만 있던 기록이 있으면 "올릴까요?" 배너로 이사를 제안한다.

## Firebase 설정 (외부 URL로 둘이 쓰려면)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 열기 (v2에서 쓰던 프로젝트 재사용 가능)
2. **빌드 > Firestore Database > 데이터베이스 만들기** (프로덕션 모드)
3. Firestore **규칙** 탭에 붙여넣고 게시:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /ledgers/{ledger}/{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

   접근 보호는 "로그인(익명) + 추측 불가능한 가계부 코드" 조합이다 — 초대 링크를 아는 사람만 해당 가계부를 읽고 쓸 수 있다.
4. **빌드 > Authentication > 시작하기 > 로그인 방법 > 익명** 사용 설정
5. **프로젝트 설정 > 일반 > 내 앱**에서 웹 앱 추가(</>) 후 구성 값을 `index.html`의 `FIREBASE_CONFIG`에 붙여넣기 (웹 구성 값은 공개값이라 커밋해도 된다)
6. 정적 호스팅 아무 데나 올리기 — GitHub Pages(저장소 Settings > Pages), Netlify, Firebase Hosting 모두 가능
7. 페이지를 처음 열면 가계부 코드가 만들어진다 — **설정 > 다니 초대하기**에서 링크를 복사해 보내면 끝

## 아티팩트 발행 시

`index.html`은 정식 HTML 문서다. claude.ai 아티팩트로 발행할 때는 발행 도구가 문서 스켈레톤을 대신 씌우므로, 다음 줄들만 제거한 사본을 발행한다: `<!doctype html>`, `<html lang="ko">`, `<head>`, charset/viewport `<meta>` 2줄, `</head>`, `<body>`, `</body>`, `</html>`, 그리고 Firebase SDK `<script>` 3줄과 그 주석 1줄 (아티팩트 CSP가 gstatic을 차단하므로 어차피 동작하지 않는다).

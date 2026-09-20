# 브라우저 검사

핫딜 사이트(저장소 루트의 `index.html` · `about.html` · `add.html`)를 폰 폭에서
실제 브라우저로 열어 보는 검사입니다. 사이트를 고쳤으면 커밋 전에 돌리세요.

```bash
cd site-test
npm install      # 처음 한 번
npm test
```

스스로 정적 서버를 띄우고 Chromium 으로 확인한 뒤 서버를 내립니다. 화면 캡쳐는
`site-test/shots/` 에 남고 gitignore 됩니다.

**딜 데이터는 검사 안에 들어 있습니다.** 배포되는 `data/deals.js` 를 가로채서
자체 픽스처를 물리므로, 실제 딜이 올라와도 검사가 깨지지 않습니다.

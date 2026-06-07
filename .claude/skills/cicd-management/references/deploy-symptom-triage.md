# 배포 환경 증상 → 레포 밖 원인 트리아지 체크리스트 (FE)

배포 환경에서만 재현되는 증상(로컬은 정상)을 추적할 때, **레포 코드만 보면 놓치는 "레포 밖" 원인**을 빠짐없이 점검하기 위한 체크리스트다. fe-harness가 "배포 증상 디버깅" 작업을 라우팅하면, 보고 단계에서 이 파일을 로드해 **증상에 해당하는 항목만** 골라 사용자에게 체크리스트로 제시한다.

## 사용 원칙
- 레포 안에서 고친 것과 **레포 밖에서 확인해야 할 것**을 분리해 보고한다. 레포 밖 항목은 내가 못 고치므로 "사용자 확인 필요" 액션으로 명시한다.
- 증상별로 관련 항목만 추린다(전체 나열 금지). 각 항목에 **확인 명령/위치**와 **정상 기준**을 함께 적는다.

## 증상 → 점검 매트릭스

### A. WebSocket/실시간(영상통화·시그널링)이 안 됨 — REST는 정상
가장 흔한 "레포 밖" 원인. REST(`/api`)는 되는데 WS(`/socket`)만 안 되면 거의 프록시 문제다.
- [ ] **호스트 nginx `/socket` Upgrade 헤더**: `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_http_version 1.1;` 존재? 없으면 WS 핸드셰이크가 101로 안 올라간다. → 브라우저 Network 탭에서 `/socket/...` 요청이 101 Switching Protocols인지 확인.
- [ ] **`proxy_read_timeout`**: 기본 60s면 유휴 시 끊긴다. WS는 길게(예: 3600s) 잡혀 있나?
- [ ] **TLS 스킴 일치**: HTTPS 페이지면 WS도 `wss://`로 가야 함. FE는 상대경로(`/socket/...`)를 쓰므로 브라우저가 페이지 스킴 따라 자동 승격 — 호스트 nginx가 443에서 `/socket`을 받는지 확인.
- [ ] **`.env.production`의 `VITE_WS_BASE_URL`**: 상대경로 모델이면 비어 있어야 정상(호스트 nginx가 프록시). 절대 URL이 굳어 있으면 환경 불일치.

### B. NAT/방화벽 뒤 피어 간 미디어가 안 흐름 — 시그널링(offer/answer)은 교환됨
- [ ] **ICE 서버**: 현재 STUN only(`stun.l.google.com:19302`). 양쪽이 Symmetric NAT/기업 방화벽 뒤면 STUN으로 불충분 → **TURN 서버**(coturn 등) 필요. `RTCConfiguration.iceServers`에 TURN 자격증명 추가 여부.
- [ ] **ICE 연결 상태**: `pc.oniceconnectionstatechange`가 `failed`/`disconnected`로 가는지(코드에 로깅 추가해 확인 가능).

### C. API 호출 자체가 실패(CORS/404/혼합콘텐츠)
- [ ] **호스트 nginx `/api` 프록시**: 경로·업스트림 정상? `/api` rewrite 규칙이 BE 컨텍스트와 맞나?
- [ ] **CORS**: BE `application-prod.yml`/CorsConfig의 허용 오리진에 실제 배포 도메인이 포함됐나(이건 BE 레포 소관 — 관제탑/be-harness로 넘김).
- [ ] **Mixed content**: HTTPS 페이지에서 HTTP 절대 URL 호출 시 브라우저 차단. `.env.production`이 상대경로(빈 baseURL)인지 확인.

### D. 정적 자산/라우팅(새로고침 404, 빈 화면)
- [ ] **SPA fallback**: 컨테이너 nginx `try_files $uri $uri/ /index.html;` 존재(딥링크 새로고침 404 방지). → `nginx/default.conf` 확인(이건 레포 안).
- [ ] **GHCR 이미지 태그**: 배포된 이미지가 최신 빌드인가? `docker compose` 이미지 태그가 의도한 버전인지(배포서버에서 확인).

### E. 배포는 됐는데 옛 버전이 뜸
- [ ] **브라우저/CDN 캐시**: `assets/` 해시 파일명 immutable 캐시. index.html은 no-cache여야 새 번들 참조. 강력 새로고침으로 구분.
- [ ] **러너 pull 여부**: deploy 잡이 GHCR에서 새 이미지를 실제 pull & `up -d` 했나(self-hosted 러너 로그).

## 보고 형식 (체크리스트 자동 생성)
디버깅 보고 말미에 아래처럼 출력한다:

```
## 레포 밖 점검 항목 (내가 못 고침 — 사용자 확인 필요)
증상 분류: <A/B/C/D/E 중>
- [ ] <항목> — 확인: `<명령/위치>` — 정상 기준: <…>
...
다음 행동: <위 중 어떤 것부터 확인하면 되는지>
```

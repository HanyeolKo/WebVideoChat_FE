# WebVideoChat FE↔BE 계약 명세 (FE 거울 / 기준선)

> 이 문서는 FE `contract-qa`가 검증 기준선으로 쓰는 계약 명세다. **상위 관제탑 정본의 거울(mirror)** 이다 — 단일 진실은 `WebVideoChat/.claude/skills/contract-sync/references/contract-spec.canonical.md`이고, 이 파일은 그 사본이다.
> 계약 변경 시 **이 거울만 고치지 마라.** 관제탑 `contract-steward`(또는 `contract-sync` 스킬)를 통해 **정본 먼저 → FE·BE 두 거울 동기화 → 양쪽 contract-qa 재검증** 순서로 진행한다. 관제탑 없이 레포 단독 실행 중이면 거울을 갱신하되 "정본·BE 거울 동기화 필요"를 보고에 명시한다.
> 최종 확인: 2026-06-06 (관제탑 정본 도입, 거울로 역할 명시). 데이터 기준선은 2026-06-04 강제 분리 직후 상태.

## 1. REST API

베이스 URL: FE는 `VITE_API_BASE_URL`(dev: `http://localhost:8080`), BE는 8080 포트.

| 메서드 | 경로 | 요청 body | 응답 body | 상태코드 |
|--------|------|----------|----------|---------|
| GET | `/api/rooms` | — | `RoomSummary[]` | 200 |
| POST | `/api/rooms` | `CreateRoomPayload` | `RoomEnterResponse` | 201 Created |
| POST | `/api/rooms/enter` | `EnterRoomPayload` | `RoomEnterResponse` | 200 / 404(없음) / 401(비번틀림) |

### 데이터 타입

```
RoomSummary        { id: string, title: string, content: string }
RoomEnterResponse  { roomId: string, roomName: string, participantCount: number }
CreateRoomPayload  { title: string, password: string, content: string }
EnterRoomPayload   { roomId: string, password: string }
```

- `participantCount`: 응답 시점의 현재 접속 참가자 수. `createRoom`=0(신규 방), `enterRoom`=기존 접속 피어 수(이 사용자의 WS 연결 직전 스냅샷). BE 인메모리 `chatUsers` 크기 기준, null-safe(미초기화 시 0).
- BE 매핑: `RoomSummaryResponse(id, title, content)`, `RoomEnterResponse(roomId, roomName, participantCount)`, `CreateRoomRequest(title, password, content)`, `EnterRoomRequest(roomId, password)`.
- ✅ 현재 FE 인터페이스(`roomApi.ts`)와 BE DTO 필드명 일치 확인됨.
- ✅ **상태코드 처리 확인됨**: `enter`의 404(없는 방)/401(비번 불일치)을 FE `LoginPage.handleEnterConfirm`에서 `err.response.status`로 분기해 사용자 alert로 처리한다.

## 2. WebSocket (시그널링)

- 경로: `{VITE_WS_BASE_URL}/socket/{roomId}` (dev: `ws://localhost:8080/socket/{roomId}`).
- BE 등록: `/socket/{roomId}`, `setAllowedOriginPatterns("*")`, 최대 메시지 1MB.
- BE는 같은 방의 **다른 피어에게 메시지를 그대로 중계**(구조 변환 없음). 따라서 시그널링 봉투는 **FE끼리의 합의**가 실질 계약이다.

### 시그널링 메시지 봉투 (FE↔FE 계약)

```
{ event: 'offer'    , data: RTCSessionDescriptionInit }
{ event: 'answer'   , data: RTCSessionDescriptionInit }
{ event: 'candidate', data: RTCIceCandidateInit | null }
{ event: 'closed'   , data?: undefined }
```

- 정의 위치: FE `src/hooks/useWebRTC.ts`(`createOffer`/`handleMessage`/`endCall`). 모든 피어가 이 봉투를 동일하게 사용해야 함. 한쪽만 `event`명/구조를 바꾸면 연결이 깨진다.
- STUN: `stun:stun.l.google.com:19302`. TURN 없음 → 대칭형 NAT 환경에서 연결 실패 가능(INFO, 향후).

## 3. CORS / 오리진

- dev: BE가 `http://localhost:5173`(Vite 기본) 허용.
- prod: BE `CorsConfig`가 `cors.allowed-origins` 프로퍼티(기본 `localhost:5173`)를 읽음. `allowCredentials(true)`이므로 와일드카드 불가 — 명시 오리진 필요.
- 허용 메서드: GET/POST/PUT/DELETE/OPTIONS.

## 4. 환경변수 / 배포 매핑 (2026-06-04 갱신 — GHCR + 상대경로 모델)

| 구분 | 값/경로 |
|------|--------|
| FE dev | `.env.development`: `VITE_API_BASE_URL=http://localhost:8080`, `VITE_WS_BASE_URL=ws://localhost:8080` |
| FE prod | `.env.production`: **의도적으로 비움**. 상대경로 사용 → 호스트 nginx(443)가 `/api`·`/socket`을 BE로 프록시 |
| 배포(공통) | build-and-push 잡(클라우드)이 GHCR(`:latest`/`:<tag>`) push → deploy 잡(배포서버 self-hosted 러너)이 `docker compose pull && up -d` |
| GHCR 인증 | Actions: 빌트인 `GITHUB_TOKEN`(시크릿 불필요). 서버: PAT `read:packages` |
| BE CORS | `CORS_ALLOWED_ORIGINS`(서버 `.env`) → `application-prod.yml` `cors.allowed-origins: ${CORS_ALLOWED_ORIGINS:기본값}` → `CorsConfig` |

## 알려진 경계 리스크 / 상태

1. ✅ **해소**: FE→BE 연결을 상대경로 + 호스트 nginx 프록시 모델로 확정(`.env.production` 비움이 의도된 설계). 단, **호스트 nginx에 `/api`·`/socket` → BE 프록시 설정이 반드시 있어야 함**(서버 측, README 예시).
2. ✅ **해소**: FE `$IMAGE_TAG` 미정의 버그 → SSH 배포 단계 제거(GHCR push 모델)로 소멸.
3. ✅ **해소**: BE prod CORS 매핑 추가(`application-prod.yml`, 폴백 기본값 포함).
4. BE 인메모리 상태 → 재시작/다중 인스턴스 시 방 소실(INFO, 향후 MSA 과제).
5. STUN-only(TURN 없음) → NAT 환경 따라 P2P 실패 가능(INFO).
6. 배포: GHCR + self-hosted 러너(repo별)로 확정. ⚠️ **public 레포이므로** 워크플로우에 `pull_request` 트리거 금지 + deploy 잡 `if`(기본브랜치 push/dispatch) 유지 필수. 🔜 헬스체크 자동 롤백은 다음 단계.

# WebVideoChat FE↔BE 계약 명세 (기준선)

> 이 문서는 FE와 BE 사이의 현재 계약을 기록한 **기준선**이며, 이 FE 레포 하네스의 단일 기준(source of truth)이다. 계약이 바뀌면 이 문서를 갱신한다.
> BE는 **별도 git 레포**다. 같은 내용의 사본이 BE 레포(`WebVideoChat_BE/.claude/skills/contract-verification/references/`)에도 있으나, 자동 동기화되지 않는다 — 계약 변경 시 **양쪽 레포의 명세를 수동으로 함께 갱신**해야 한다.
> 최종 확인: 2026-06-04 (초기 작성, 강제 분리 직후 상태 기준).

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
RoomEnterResponse  { roomId: string, roomName: string }
CreateRoomPayload  { title: string, password: string, content: string }
EnterRoomPayload   { roomId: string, password: string }
```

- BE 매핑: `RoomSummaryResponse(id, title, content)`, `RoomEnterResponse(roomId, roomName)`, `CreateRoomRequest(title, password, content)`, `EnterRoomRequest(roomId, password)`.
- ✅ 현재 FE 인터페이스(`roomApi.ts`)와 BE DTO 필드명 일치 확인됨.
- ⚠️ **상태코드**: `enter`는 404/401을 반환할 수 있다. FE는 이를 사용자 피드백(없는 방/비번 오류)으로 처리해야 한다. (FE 핸들링 여부 확인 대상.)

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

## 4. 환경변수 매핑

| FE | BE / 배포 |
|----|----------|
| `VITE_API_BASE_URL` | BE REST 호스트 (빌드 시점 번들에 박힘) |
| `VITE_WS_BASE_URL` | BE WS 호스트 (빌드 시점 번들에 박힘) |
| (FE prod 배포) | GHCR 이미지 + 서버 `.env`의 `IMAGE_TAG` |
| (BE prod 배포) | `CORS_ALLOWED_ORIGINS` 시크릿 → 서버 `.env` → `cors.allowed-origins` |

## 알려진 경계 리스크 (점진적으로 해소)

1. FE `.env.production`의 `VITE_API_BASE_URL`/`VITE_WS_BASE_URL`이 **비어 있음** → prod 빌드가 BE 호스트를 못 가리킬 수 있다(WARN). nginx 프록시로 상대경로 처리하는지 확인.
2. FE `deploy.yml`이 `$IMAGE_TAG`를 참조하나 정의되지 않음 → 서버 `.env`에 빈 태그 기록(BLOCKER, 배포). `github.ref_name` 의도로 추정.
3. BE prod CORS 환경변수 매핑(`cors.allowed-origins: ${CORS_ALLOWED_ORIGINS}`) 누락 가능성 → 매핑 부재 시 prod CORS가 `localhost:5173`로 고정.
4. BE 인메모리 상태 → 재시작/다중 인스턴스 시 방 소실(INFO, 향후 MSA 과제).
5. STUN-only → NAT 환경 따라 P2P 실패 가능(INFO).
6. FE `enter` 실패 상태코드(404/401) 처리 여부(WARN, UX 경계).

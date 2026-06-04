---
name: contract-verification
description: WebVideoChat FE↔BE 경계면(계약) 정합성 검증 방법론(FE 관점). FE의 API 클라이언트·WebSocket 훅이 기대하는 shape이 BE 실제 엔드포인트·응답과 일치하는지 교차 비교한다. FE/BE 강제 분리로 생긴 경계 버그를 잡을 때, 계약 변경 영향 평가 시 반드시 사용. contract-qa 에이전트가 참조.
---

# Contract Verification — 경계면 정합성 검증 (FE 관점)

FE와 BE를 한 프로젝트에서 강제 분리했기 때문에, 둘 사이 계약 불일치가 가장 흔한 버그 원인이다. 이 스킬은 그 경계면을 교차 비교하는 방법을 정의한다.

## 핵심 원칙: 교차 비교

"FE에 API 함수가 존재한다"는 검증이 아니다. **FE가 실제로 기대하는 shape**과 **BE가 실제로 내놓는 shape**을 나란히 놓고 1:1 대조해야 한다. 한쪽만 보면 경계 버그를 놓친다.

기준선(baseline)은 `references/contract-spec.md`에 있다. **이 FE 하네스는 레포 단독으로 완결된다** — BE는 별도 git 레포이며 함께 클론돼 있다는 보장이 없으므로, 검증은 **`contract-spec.md`(기준선) ↔ FE 실제 코드** 대조를 기본으로 한다. 명세와 코드가 다르면 어느 쪽이 낡았는지 판단해 보고한다. BE 실코드는 읽지 않는 것을 전제한다.

## 검증 절차

1. **기준선 로드**: `references/contract-spec.md`(= BE가 제공하는 shape의 기록).
2. **FE 측 읽기**: `src/api/roomApi.ts`(경로·인터페이스), `src/api/axiosInstance.ts`(baseURL), `src/hooks/useWebSocket.ts`(WS URL), `src/hooks/useWebRTC.ts`(시그널링 봉투), `.env.*`.
3. **대조표 작성**: 경계면마다 FE 실제 shape ↔ 명세(BE 제공) shape ↔ 일치 여부.
4. **등급 부여 & 보고.** 계약을 깨는 변경이면 `contract-spec.md`를 갱신하고, BE 레포에도 동기화가 필요함을 보고에 명시한다.

## 검증 대상 4개 경계면

### 1. REST 계약
- 경로/메서드: FE `axiosInstance.get/post` 경로 == BE `@RequestMapping`+매핑.
- 요청/응답 필드명: FE `*Payload`/응답 인터페이스 == BE `*Request`/`*Response` DTO 필드.
- **흔한 버그**: 필드명 케이스 불일치, 누락/추가 필드, 타입 불일치, 상태코드 미처리(`enter`의 404/401).

### 2. WebSocket 계약
- 경로: FE `${wsBase}/socket/${roomId}` == BE `/socket/{roomId}`.
- 시그널링 봉투: FE `useWebRTC`가 `send`하는 `{ event, data }` == BE가 그대로 중계 == 다른 피어 FE의 `handleMessage` 파싱. BE는 구조를 강제하지 않으므로 **FE↔FE 합의가 실질 계약**. 한쪽 FE만 봉투를 바꾸면 피어 연결이 깨진다.

### 3. CORS / 오리진
- FE 실제 오리진(dev `localhost:5173`, prod 배포 도메인)이 BE `CorsConfig` 허용 목록에 포함되는지. `allowCredentials(true)`라 와일드카드 불가.

### 4. 환경변수 계약
- FE `VITE_API_BASE_URL`/`VITE_WS_BASE_URL`이 BE 호스트/포트를 가리키는지. **빌드 시점에 번들에 박히므로** 배포 환경별 빌드 일관성 확인.

## 등급
- **BLOCKER**: 런타임에 반드시 깨짐(경로 불일치, 필수 필드 오타, WS 봉투 불일치).
- **WARN**: 상황에 따라(상태코드 미처리, 오리진 누락, prod env 공백).
- **INFO**: 잠재 위험(MSA 분리 시 깨질 결합).

## 출력 형식

각 불일치는 **양쪽 위치(파일:라인)** + **양쪽 shape** + **수정 방향**을 포함한다. 검증자는 수정하지 않고 보고만 한다(수정은 engineer/BE에 위임). 검증 불가 구간은 명시한다.

> 계약이 바뀌면 `references/contract-spec.md`를 갱신하라. 명세가 항상 최신 기준선이어야 한다.

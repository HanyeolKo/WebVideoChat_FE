---
name: react-feature-dev
description: WebVideoChat 프론트엔드(React 19 / TypeScript / Vite / Zustand / react-router) 코드 작성·수정 컨벤션과 점진적 개발 원칙. 컴포넌트·커스텀 훅·Zustand 스토어·API 클라이언트·WebRTC 시그널링 작성 시 사용. FE 코드를 만지는 모든 작업에서 참조.
---

# React Feature Development — 프론트엔드 구현 가이드

WebVideoChat 프론트엔드 코드 작성·수정 컨벤션이다. fe-engineer가 참조한다.

## 스택 & 구조

- React 19, TypeScript ~6, Vite 8, pnpm. Zustand(상태), react-router-dom 7(라우팅), axios(HTTP).
- 폴더: `api/`(axios + 도메인 API), `hooks/`(커스텀 훅), `store/`(Zustand), `components/`, `pages/`, `styles/`, `router.tsx`.

## 핵심 아키텍처

- **API 레이어**: `axiosInstance.ts`가 단일 인스턴스(`baseURL = VITE_API_BASE_URL`). 도메인 함수는 `roomApi.ts`. BE가 MSA로 쪼개지면 서비스별 인스턴스로 분리할 자리(현재는 단일 유지).
- **시그널링 흐름**: `useWebSocket`(WS 연결·송수신) → `useWebRTC`(RTCPeerConnection·offer/answer/candidate). 메시지 봉투는 `{ event: 'offer'|'answer'|'candidate'|'closed', data }`. BE는 같은 방의 다른 피어로 **그대로 중계**만 하므로 이 봉투 구조는 **FE끼리의 계약**이다 — 한쪽만 바꾸면 깨진다.
- **상태**: `roomStore`(roomId/roomName), `streamStore`(미디어 스트림). Zustand `create`로 정의.

## 점진적 개발 원칙

> 한 번에 크게 바꾸지 않는다. 오류 시 되돌리기 어렵다.

1. **한 스텝 = 빌드 통과 + 동작 유지 + 롤백 가능.** 변경 후 `pnpm build`(`tsc -b && vite build`) + `pnpm lint`.
2. **BE 계약을 깨는 변경은 격리하라.** `roomApi.ts` 경로·인터페이스, WS 메시지 봉투는 BE/피어와 묶여 있다. 가능하면 유지, 불가피하면 명시.
3. **TS 타입 ≠ BE 실응답.** 인터페이스는 FE의 기대다. 강제 분리로 BE 실제 응답과 다를 수 있으니 새 필드는 contract-qa로 확인.

## 코드 컨벤션

- **함수형 컴포넌트 + 커스텀 훅.** 부수효과는 `useEffect`, 콜백은 `useCallback`으로 안정화(기존 훅 패턴 따름).
- **파일 헤더 주석**: 훅 파일은 상단에 한글 JSDoc 설명을 둔다(기존 `useWebRTC`/`useWebSocket` 양식).
- **타입**: API 요청/응답은 `*Payload`/`*Response` 인터페이스로 `api/`에 정의. `any` 지양, 불가피하면 좁은 단언.
- **스타일**: `styles/`의 기존 CSS 파일 컨벤션을 따름.
- **들여쓰기/세미콜론**: 기존 파일 스타일(2-space, 세미콜론 없음 — eslint 설정 확인)을 따른다.

## 빌드 & 검증

```
pnpm install            # corepack enable 후 (Node 22)
pnpm dev                # 로컬 개발 (Vite, 기본 5173)
pnpm build              # tsc -b && vite build
pnpm lint               # eslint
```

- 환경변수: `.env.development`(localhost:8080 BE), `.env.production`(비어 있음 — 배포 시 주입/프록시 필요).
- `VITE_*`는 **빌드 시점에 번들에 박힌다.** 런타임 변경 불가.
- 빌드가 원래 깨져 있을 수 있다. baseline 빌드로 회귀를 구분한다.

## 하지 말 것

- WS 메시지 봉투 구조를 한쪽만 변경(피어 전체가 동일해야 함).
- `roomApi.ts` 계약 변경을 contract-qa 검증 없이 머지.
- 미디어 스트림/PeerConnection 정리(cleanup) 누락 — 기존 훅의 `useEffect` cleanup 패턴 유지.

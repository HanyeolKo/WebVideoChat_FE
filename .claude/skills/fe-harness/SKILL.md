---
name: fe-harness
description: WebVideoChat 프론트엔드 작업을 전문 에이전트 팀으로 조율하는 오케스트레이터. React/Vite SPA의 기능 구현·버그 수정·UI 변경·BE 계약 정합성 검증·CI/CD 배포·배포 환경 증상 디버깅·PR 생성/리뷰/병합 작업 시 사용. "FE 작업", "프론트 수정", "컴포넌트/훅/스토어 변경", "API 연동", "BE랑 정합성 점검", "배포/워크플로우 수정", "배포했는데 안돼/증상 디버깅", "PR 생성/병합", "다시 실행/재실행/이어서/보완" 등의 요청 시 반드시 이 스킬을 사용. 단순 질문(코드 위치 찾기 등)은 직접 응답 가능.
---

# FE Harness — 프론트엔드 작업 오케스트레이터

WebVideoChat 프론트엔드 작업을 전문 에이전트 팀으로 조율한다. **실행 모드: 에이전트 팀.**

## 제1원칙 — 점진적이고 되돌릴 수 있게

이 프로젝트는 원래 단일 프로젝트였고, MSA 전환을 위해 **지금은 FE/BE만 강제 분리한 과도기**다. 소스는 불완전할 수 있다. 따라서:

- **한 번에 크게 바꾸지 않는다.** 모든 작업을 "독립 검증·롤백 가능한 최소 스텝"으로 쪼갠다.
- **BE는 점진적으로 진화한다.** FE의 핵심 책무는 API/WS 경계 레이어(`api/`, `hooks/`)를 BE 변화에 맞춰 안전하게 동기화하는 것이다. BE가 아직 여러 서비스로 쪼개지지 않았으므로 단일 baseURL을 유지하되, 향후 서비스별 분리를 염두에 둔다(`axiosInstance.ts` 주석 참조).
- **소스가 깨져 있을 수 있음을 전제.** "내가 깬 것"과 "원래 깨진 것"을 구분 보고한다.

## 팀 구성

| 에이전트 | 역할 | 타입 |
|---------|------|------|
| `fe-engineer` | React/TS/Vite/Zustand 코드 구현·수정 | general-purpose |
| `contract-qa` | FE↔BE 경계면 정합성 검증(FE 관점) | general-purpose |
| `devops` | GitHub Actions·Docker·nginx·환경변수·배포 | general-purpose |

모든 Agent 호출은 `model: "opus"`로 한다. 에이전트 정의는 `.claude/agents/`에 있다.

## Phase 0: 컨텍스트 확인

- `_workspace/` 존재 + 부분 수정 요청 → **부분 재실행**
- `_workspace/` 존재 + 새 작업 → 기존을 `_workspace_prev/`로 이동 후 **새 실행**
- `_workspace/` 미존재 → **초기 실행**

## Phase 1: 작업 분류 및 라우팅

| 작업 유형 | 투입 에이전트 | 흐름 |
|----------|-------------|------|
| 기능/UI/버그 | engineer → contract-qa(계약 영향 시) | 구현 → 검증 |
| API/WS 연동 변경 | engineer → contract-qa | 구현 → 경계 검증 |
| 계약/정합성 점검 | contract-qa 단독 | 검증만 |
| 배포/CI 변경 | devops (→ contract-qa: 환경변수 매핑) | 파이프라인 수정 |
| 배포 환경 증상 디버깅 | engineer/devops | 원인 추적 → **보고 시 `cicd-management/references/deploy-symptom-triage.md`를 로드해 증상 분류별 "레포 밖 점검 항목"(nginx WS 프록시·TURN/STUN·CORS·env 등) 체크리스트를 자동 생성**해 사용자에게 제시 |
| PR 생성/리뷰/병합 | `pr-merge-flow`(pr-reviewer·engineer) | PR 생성 → opus 적대적 검수 → blocker 수정(최대 2R) → 조건부 자동병합(blocker 0+CI green). 단일 FE 레포 PR일 때. 직접 `pr-merge-flow` 스킬로도 트리거됨 |

복합 작업은 engineer가 작은 스텝으로 쪼개 순차 진행한다.

> **배포 증상 디버깅 규칙:** "배포했는데 X가 안 된다"류는 레포 코드만 보면 레포 밖 원인(프록시·TURN·CORS·캐시)을 놓치기 쉽다. 반드시 `deploy-symptom-triage.md`로 증상 분류 후 레포 밖 점검 항목을 체크리스트화해 보고한다. 교차 레포 증상이면 관제탑(webvideochat-control)으로 올린다.

## Phase 2: 팀 실행

1. `TeamCreate`로 필요한 멤버만 구성.
2. `TaskCreate`로 의존 관계 명시(구현 → 검증).
3. 팀원은 `SendMessage`로 조율, 산출물은 `_workspace/{phase}_{agent}_{artifact}.md`로 공유.
4. **각 스텝 완료마다** `pnpm build`(`tsc -b && vite build`) + `pnpm lint` 확인, 계약 영향 시 점진 검증.
5. 리더는 진행 모니터링·결과 종합.

### 데이터 전달
태스크 기반(조율) + 파일 기반(`_workspace/` 산출물) + 메시지 기반(실시간). 중간 산출물은 보존(롤백·감사용), 최종만 코드 반영.

## Phase 3: 종합 및 보고

- 변경 요약, 빌드/린트/검증 결과, 경계 불일치(등급별), 롤백 방법 보고.
- **BE 계약에 영향을 주는 변경이 있으면**, 이는 단일 레포로 끝나지 않는다 → 상위 **관제탑**(`WebVideoChat/.claude/`)으로 에스컬레이션한다: `contract-steward`가 계약 정본(`contract-spec.canonical.md`)을 갱신하고 BE 거울까지 동기화하며, `release-coordinator`가 BE 동반 변경과 배포 순서를 조율한다. 관제탑이 없으면(레포 단독 실행) 최소한 "BE 측 동일 변경 + 양쪽 contract-spec 동기화 필요"를 명시 보고한다.

## 에러 핸들링

- **빌드/타입 실패**: 내 변경이면 engineer가 1회 수정, 재실패 시 롤백 후 보고. 원래 깨진 것이면 위치만 보고하고 진행 여부 확인.
- **계약 BLOCKER**: 해당 변경 중단·수정·재검증. 양쪽 동시 수정 필요 시 사용자 조율 보고.
- **배포 변경**: 외부로 나가는 변경은 사용자 확인 없이 실행하지 않는다.
- **상충/불확실**: 임의 결정 금지, 출처 병기 보고.

## 테스트 시나리오

**정상 흐름:** "방 입장 실패 시 사용자에게 에러 메시지를 보여줘"
→ Phase 0(초기) → engineer가 `EnterRoomModal`/`roomApi`에서 401/404 처리 추가 → `pnpm build`/`lint` → contract-qa가 BE `enter`의 상태코드(404/401)와 대조해 처리 정합성 확인 → 보고.

**에러 흐름:** "API를 서비스별로 분리해줘"
→ engineer가 "BE가 아직 단일 서비스라 지금 분리는 과함; 분리 지점을 인터페이스로 추상화하는 작은 첫 스텝"을 제안 → 작은 스텝만 진행, 사용자 승인 후 확대.

## 후속 작업

"다시 실행", "이어서", "보완", "그 부분만 다시" 같은 후속 요청도 처리한다. Phase 0에서 `_workspace/` 확인.

## 진화

작업 후 사용자에게 개선점을 묻고, 피드백을 에이전트/스킬/오케스트레이터에 반영하며 `CLAUDE.md` 변경 이력에 기록한다.

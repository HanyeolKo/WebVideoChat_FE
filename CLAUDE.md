# WebVideoChat 프론트엔드

원래 단일 프로젝트였으나 MSA 전환을 위해 FE/BE로 분리한 **과도기** 상태. 스택: React 19 / TypeScript / Vite / Zustand / react-router, axios HTTP + WebRTC/WebSocket 시그널링, pnpm.

> **작업 철학 — 점진적 + 되돌리기 쉽게.** 한 번에 크게 바꾸지 않고, 독립 검증·롤백 가능한 최소 스텝으로 진행한다. BE는 점진적으로 진화하므로 API/WS 경계 레이어(`api/`, `hooks/`)를 BE 변화에 맞춰 안전하게 동기화한다. 소스가 불완전할 수 있음을 전제하고 "내가 깬 것"과 "원래 깨진 것"을 구분한다.

## 하네스: 프론트엔드 작업 자동화

**목표:** React/Vite SPA의 기능·UI·API 연동·계약 검증·배포를 전문 에이전트 팀으로 안전하고 점진적으로 수행한다.

**트리거:** FE 코드 구현/수정, UI 변경, API/WS 연동, FE↔BE 계약 정합성 점검, GitHub Actions·Docker·배포 변경 요청 시 `fe-harness` 스킬을 사용하라. 단순 질문(코드 위치 등)은 직접 응답 가능.

**구성:** 에이전트 팀 모드. 에이전트는 `.claude/agents/`, 스킬은 `.claude/skills/`에서 관리(상세는 거기서 확인).

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-04 | 초기 구성 (fe-engineer/contract-qa/devops + fe-harness 오케스트레이터 + react-feature-dev/contract-verification/cicd-management 스킬) | 전체 | FE/BE 강제 분리 과도기 지원, 점진적 개발·계약 정합성·CI/CD 관리 |
| 2026-06-04 | CI/CD를 GHCR push 모델로 재구성: deploy.yml(SSH 제거, GITHUB_TOKEN+GHCR, metadata-action), .env.production 상대경로 모델 명시, README(호스트 nginx /api·/socket 프록시). cicd-management/contract-spec 동기화 | 워크플로우·env·README + 하네스 스킬 | 배포 방식을 GHCR+온프레미스 자동트리거로 전환, FE→BE 상대경로 프록시 확정 |
| 2026-06-04 | 배포를 self-hosted 러너 모델로 확정: deploy.yml에 deploy 잡(self-hosted, pull&up) 추가 + public 레포 보안 가드(pull_request 미트리거, if=기본브랜치/dispatch), README 러너 설치/보안 안내 | 워크플로우·README + 스킬 | self-hosted 러너로 SSH/webhook 제거, public+self-hosted 보안 대응 |

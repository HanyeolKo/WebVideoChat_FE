---
name: pr-merge-flow
description: WebVideoChat 프론트엔드의 PR 생성→검수→수정→병합을 자동화하는 오케스트레이터. "PR 생성", "PR 올려", "풀리퀘스트", "병합", "merge", "PR 리뷰받고 합쳐줘", "리뷰 후 병합" 요청 시 반드시 이 스킬을 사용. gh CLI로 PR을 만들고, pr-reviewer(opus) 에이전트가 적대적 검수하며, blocker를 fe-engineer가 수정(최대 2라운드)하고, 조건부 자동병합(blocker 0 + CI green)한다. 교차 레포 PR은 관제탑(release-coordinator)이 조율하므로 단일 FE 레포 PR일 때 사용.
---

# PR Merge Flow — PR 생성·검수·병합 자동화 (FE)

PR을 만들고, 최고 수준 모델로 검수하고, 지적을 고쳐, 안전 조건이 충족될 때만 병합한다. **실행 모드: 생성–검증 + 조건부 게이트.**

> **왜 게이트가 필요한가.** 이 레포는 `main` 병합 시 self-hosted 러너가 **운영 자동배포**한다(`.github/workflows/deploy.yml`). 즉 병합 = 되돌리기 어려운 운영 배포다. 그래서 검수·수정은 자동으로 끝까지 돌리되, **병합만큼은 안전 조건**(blocker 0 + CI green)을 통과할 때만 자동 수행하고, 아니면 멈추고 사용자에게 넘긴다.

## 안전 게이트 (확정 정책)
- **자동 병합 조건**: pr-reviewer `verdict: PASS`(blocker 0건) **그리고** `gh pr checks` 전부 green. 둘 다여야 자동 병합.
- **수정 루프 상한**: 리뷰→수정→재리뷰 **최대 2라운드**. 2라운드 후에도 blocker가 남으면 병합하지 않고 사용자에게 보고·핸드오프.
- **계약 위반(contract_touched: yes)**: 단일 레포로 끝낼 수 없음 → 즉시 중단하고 관제탑(`contract-steward`/`release-coordinator`)으로 에스컬레이션. 자동 병합 금지.
- 사용자가 특정 실행에서 다른 수위를 지시하면(예: "이번엔 병합 전 꼭 물어봐") 그 지시가 이 기본 정책을 덮어쓴다.

## 팀 / 자원
| 자원 | 역할 |
|------|------|
| `pr-reviewer` (opus) | PR diff·CI 적대적 검수, blocker/suggestion 등급화 판정 |
| `fe-engineer` (opus) | blocker 수정 구현 |
| gh CLI | PR 생성·체크 조회·병합 |

## Phase 0: 컨텍스트 확인
- `_workspace/` 존재 + "그 PR 이어서/재리뷰" → 기존 verdict 라운드 이어서.
- 새 PR 요청 → 기존 `_workspace/`를 `_workspace_prev/`로 이동 후 새 실행.
- 선행 점검: `gh auth status`로 인증 확인. 실패면 사용자에게 `gh auth login` 안내(이 세션에서 `! gh auth login`).

## Phase 1: PR 생성
1. **브랜치 정리**: 변경이 `main` 작업트리에 있으면 feature 브랜치로 옮긴다 — `git switch -c feat/<요약>` 후 관련 파일만 스테이징. 운영배포 트리거인 `main`에 직접 커밋·푸시하지 않는다.
2. **커밋**: 의미 단위 커밋. 메시지 말미에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
3. **푸시 & PR 생성**: `git push -u origin <branch>` → `gh pr create --base main --title "<제목>" --body "<요약 + 변경 파일 + 검증 결과 + 🤖 Generated with Claude Code>"`.
4. PR 번호를 `_workspace/pr_meta.md`에 기록.
5. **사용자 확인 경계**: PR 생성(외부로 나가는 행위)은 진행하되, 직전에 한 줄로 무엇을 올리는지 보고한다. 새 원격 브랜치/PR이 처음이면 사용자에게 알린다.

## Phase 2: 검수 → 수정 루프 (최대 2라운드)
각 라운드:
0. **보안 전용 패스**: `/security-review` 스킬을 이 PR의 변경(현재 브랜치 pending diff)에 돌려 보안 발견을 수집한다 → `_workspace/{round}_security-review.md`.
1. `pr-reviewer`(opus)를 띄워 PR을 검수하되 **0의 security-review 결과를 입력으로 함께 전달**한다. pr-reviewer가 일반 검토 + 보안 발견 등급화를 합쳐 판정 → `_workspace/{round}_pr-reviewer_verdict.md`.
2. 판정 분기:
   - `contract_touched: yes` (계약 위반) → **루프 중단**, 관제탑 에스컬레이션(Phase 4의 계약 경로).
   - `verdict: PASS` + CI green → Phase 3(병합)로.
   - `verdict: PASS` + CI 미green → 병합 보류, CI 결과 보고(Phase 4).
   - `CHANGES_REQUESTED` → blocker를 `fe-engineer`에 전달해 수정 구현 → `pnpm build`(tsc) + `pnpm lint` 통과 확인 → 커밋·푸시(PR 자동 갱신) → 다음 라운드.
3. 2라운드 후에도 blocker 잔존 → 루프 종료, Phase 4(보고)로.

> suggestion(비-blocker)은 병합을 막지 않는다. 시간이 허락하면 반영하되, 자동 병합 조건 판단에는 포함하지 않는다.

## Phase 3: 조건부 자동 병합
안전 게이트(blocker 0 + CI green)를 통과한 경우에만:
1. 최종 CI 재확인: `gh pr checks <num>` 전부 green.
2. 병합: `gh pr merge <num> --squash --delete-branch`(기본 squash). 
3. **병합 = 운영 배포 트리거**임을 보고에 명시하고, 배포 워크플로우(deploy.yml) 진행을 안내. 가능하면 `gh run watch`로 배포 잡 상태를 한 번 확인.
4. 결과를 `_workspace/merge_report.md`에 기록.

## Phase 4: 종합 및 보고
- 생성한 PR(URL), 검수 라운드별 blocker/해소 내역, CI 상태, 병합 여부와 이유를 보고.
- **병합 안 한 경우**(blocker 잔존 / CI 실패 / 계약 위반): 무엇이 막았는지, 남은 blocker 목록과 각 `fix` 지시, 다음 행동(사용자가 직접 검토 후 `gh pr merge`, 또는 관제탑 경로)을 명시.
- **계약 위반**: 단일 레포로 끝낼 수 없음 → 관제탑(`WebVideoChat/.claude/`)의 `contract-steward`(정본 갱신)+`release-coordinator`(BE 동반·배포 순서) 경로로 넘긴다. 관제탑 부재 시 "BE 동반 변경 + 양쪽 contract-spec 동기화 필요" 명시.

## 에러 핸들링
- **gh 인증/권한 실패**: 중단하고 사용자에게 `gh auth login` 안내. 임의 우회 금지.
- **푸시 충돌/리베이스 필요**: 강제 푸시 금지. 사용자에게 상태 보고 후 지시 대기.
- **CI 영구 실패(내 변경 무관)**: 원래 깨진 것인지 구분해 보고, 자동 병합 보류.
- **리뷰어/엔지니어 1회 실패**: 1회 재시도, 재실패 시 해당 라운드 결과 없이 보고.

## 테스트 시나리오
**정상 흐름:** "이번 WebRTC 수정 PR 올리고 리뷰받고 합쳐줘"
→ Phase 0(인증 OK) → Phase 1(feat 브랜치·커밋·`gh pr create`) → R1: pr-reviewer가 candidate 큐 누수 1건 blocker → fe-engineer 수정·푸시 → R2: PASS + CI green → Phase 3 squash 병합 → "운영 배포 트리거됨" 보고.

**게이트 정지 흐름:** R1·R2 모두 blocker 잔존(또는 CI red)
→ 자동 병합 안 함 → 남은 blocker·fix 지시·CI 로그 위치를 보고하고 사용자에게 핸드오프.

**계약 위반 흐름:** PR이 WS 봉투를 바꿈(contract_touched: yes)
→ 루프 즉시 중단 → 관제탑 contract-steward/release-coordinator로 에스컬레이션, BE 동반·배포 순서 조율 안내.

## 후속 작업
"그 PR 다시 리뷰", "수정 반영하고 다시", "이제 병합해" 같은 후속도 처리한다. Phase 0에서 `_workspace/` verdict 라운드를 확인해 이어서 진행한다.

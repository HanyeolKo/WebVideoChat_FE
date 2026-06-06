# WebVideoChat_FE

React 19 + Vite 화상채팅 프론트엔드. Nginx 컨테이너에서 정적 파일로 서빙한다.

## 배포 구조 (GHCR + self-hosted 러너)

```
push(main) ─▶ build-and-push 잡(GitHub 클라우드 러너): 빌드 → GHCR :latest
                       │ needs
                       ▼
              deploy 잡(배포서버의 self-hosted 러너): docker compose pull && up -d
push(v*)   ─▶ build-and-push 잡: GHCR :<tag> 보관 (배포는 안 함 / 롤백 대상)
```

- **build-and-push**(클라우드 러너): 이미지를 빌드해 GHCR(`ghcr.io/hanyeolko/webvideochat-fe`)에 push.
- **deploy**(배포서버의 self-hosted 러너): GHCR에서 pull 후 `DEPLOY_DIR`(`/home/deploy/frontend`)에서 `docker compose pull && up -d`. **SSH·webhook·Watchtower 불필요.**
- GHCR 로그인은 빌트인 `GITHUB_TOKEN`(+ `packages: write`)을 사용하므로 **별도 시크릿/계정이 필요 없다.**
- 롤백: 서버 `DEPLOY_DIR`에서 `IMAGE_TAG=<이전태그> docker compose up -d` (서버 compose가 `image: ghcr.io/hanyeolko/webvideochat-fe:${IMAGE_TAG:-latest}` 참조하도록 구성).

### self-hosted 러너 설치 (배포서버, 1회)
1. repo → Settings → Actions → Runners → **New self-hosted runner** 안내대로 다운로드·`config`(등록 토큰).
2. 서비스로 상주: `sudo ./svc.sh install && sudo ./svc.sh start`.
3. 서버 요건: Docker + compose 플러그인, 러너 계정을 `docker` 그룹에 추가.
4. `DEPLOY_DIR`(`/home/deploy/frontend`)에 `docker-compose.yml`(`app`은 `image: ghcr.io/hanyeolko/webvideochat-fe:${IMAGE_TAG:-latest}`, `3000:80` 매핑) 배치.

### ⚠️ public 레포 보안 (필수 하드닝)
- 이 워크플로우는 `pull_request`에서 트리거되지 않으며, deploy 잡은 기본 브랜치 push/수동 실행에서만 동작한다(포크 PR이 self-hosted 러너를 못 건드림).
- repo Settings → Actions → General에서 **fork PR 워크플로우 승인 필요**로 제한할 것.

## 프론트엔드 ↔ 백엔드 연결 (상대경로 + 호스트 nginx 프록시)

FE는 API/WS를 **상대경로**로 호출한다(`.env.production`의 `VITE_*`는 비워 둠). 동일 도메인의 **호스트 nginx(443)**가 `/api`·`/socket`을 백엔드로 프록시한다 → CORS 불필요, FE 이미지 환경 무관 재사용.

### 호스트 Nginx(443) 예시
```nginx
server {
    listen 443 ssl;
    server_name your.domain;

    ssl_certificate     /etc/letsencrypt/live/your.domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain/privkey.pem;

    # API → 백엔드
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 시그널링 → 백엔드
    location /socket/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # 그 외 → 프론트엔드 컨테이너(정적)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 서버 준비물 (레포 밖)
- 서버에 GHCR **read 권한 PAT**(`read:packages`)로 `docker login ghcr.io`.
- `/home/deploy/frontend`의 `docker-compose.yml`이 `image: ghcr.io/hanyeolko/webvideochat-fe:${IMAGE_TAG:-latest}`를 참조(3000:80 매핑).
- 호스트 nginx(443)에 `/api`·`/socket` → BE 프록시 설정(위 예시). (self-hosted 러너가 push 후 직접 pull&up 하므로 Watchtower/webhook은 불필요.)

## 로컬 개발
```
pnpm install      # corepack enable (Node 22)
pnpm dev          # http://localhost:5173 (BE: http://localhost:8080)
pnpm build        # tsc -b && vite build
pnpm lint
```

---

## AI 주도개발 하네스 (Claude Code)

이 레포는 Claude Code가 프론트엔드를 **안전하고 점진적으로** 진화시키도록 전문 에이전트 팀 하네스를 갖췄다. 하네스는 `harness-setting` 브랜치에서 버전 관리되며, `.claude/agents/`(누가)와 `.claude/skills/`(어떻게)로 구성된다.

### 구성

| 구분 | 이름 | 역할 |
|------|------|------|
| 오케스트레이터 | `fe-harness` (스킬) | 요청을 분류해 필요한 에이전트만 팀으로 투입·조율 |
| 에이전트 | `fe-engineer` | React/TS/Vite/Zustand 코드 구현·수정 (`react-feature-dev` 스킬 참조) |
| 에이전트 | `contract-qa` | FE↔BE 경계면 정합성 검증 (FE 관점, `contract-verification` 스킬 참조) |
| 에이전트 | `devops` | GitHub Actions·Docker·nginx·환경변수·배포 (`cicd-management` 스킬 참조) |
| 스킬 | `react-feature-dev` | 프론트엔드 코드 컨벤션 + 점진적 개발 원칙 |
| 스킬 | `contract-verification` | 경계면 교차 비교 방법론 (계약 명세 거울 보유) |
| 스킬 | `cicd-management` | GHCR + self-hosted 러너 배포 파이프라인 관리 |

**실행 모드: 에이전트 팀.** 모든 에이전트는 `model: opus`. 산출물은 `_workspace/`에 단계별로 보존(감사·롤백).

### 핵심 철학 — 점진적 + 되돌리기 쉽게

원래 단일 프로젝트였고 MSA 전환을 위해 FE/BE를 강제 분리한 과도기다. **한 번에 크게 바꾸지 않는다.** BE는 점진적으로 진화하므로 API/WS 경계 레이어(`api/`, `hooks/`)를 BE 변화에 맞춰 안전하게 동기화한다. WS 시그널링 봉투(`{ event, data }`)는 **FE끼리의 계약**이라 한쪽만 바꾸면 깨진다 — 변경 시 contract-qa 검증 필수.

### 상위 통합 관제 하네스 연동 (선택적)

> **이 레포 하네스는 독립적으로 완전히 동작한다.** 이 레포만 클론해서 `fe-harness`로 기능·UI·계약 검증·배포를 모두 처리할 수 있다. 아래의 관제탑은 **선택적 상위 층**일 뿐이며, 없어도 하네스는 그대로 쓸 수 있다(관련 포인터는 모두 "관제탑이 있으면 위임, 없으면 자체 처리·보고"로 분기한다).

두 레포가 함께 클론된 환경(`WebVideoChat/`)에서는 그 위에 **통합 관제 하네스**(관제탑)가 있어, 계약 변경·교차 레포 작업을 조율한다:

- **계약(REST·WS·CORS·env)을 바꾸는 변경**은 단일 레포로 끝나지 않는다. 관제탑의 `contract-steward`가 **계약 정본**(`WebVideoChat/.claude/skills/contract-sync/references/contract-spec.canonical.md`)을 갱신하고, 이 레포의 `contract-spec.md`(거울)와 BE 거울을 동기화한다. 즉 이 레포의 계약 명세는 **정본의 거울**이다.
- **BE와 동시/순서 배포**가 필요하면 관제탑의 `release-coordinator`가 순서(보통 BE 먼저 → FE)와 롤백을 조율한다.
- 관제탑 없이 이 레포만 단독으로 작업할 때는, 계약 변경 시 "BE 측 동반 변경 + 양쪽 contract-spec 동기화 필요"를 명시 보고한다.

### 사용법

작업 디렉토리에서 Claude Code를 실행하고 자연어로 요청하면 트리거된다.
- "입장 실패 시 에러 메시지 표시" → fe-harness가 engineer→contract-qa로 처리.
- "API 서비스별 분리" → engineer가 "BE가 아직 단일 서비스라 지금은 과함, 작은 첫 스텝"으로 응답.
- "BE랑 정합성 점검" → contract-qa가 거울 ↔ FE 실코드 대조.

---
name: cicd-management
description: WebVideoChat 프론트엔드의 GitHub Actions·Docker·nginx·Vite 빌드·환경변수 관리 방법론. 워크플로우(.github/workflows/deploy.yml) 수정, Dockerfile·nginx/default.conf·.env.* 변경, GHCR 이미지/시크릿/환경변수 매핑 점검 시 반드시 사용. GitHub Actions는 이 하네스를 통해 관리한다. devops 에이전트가 참조.
---

# CI/CD Management — 프론트엔드 배포 파이프라인 가이드

WebVideoChat 프론트엔드의 CI/CD와 인프라 파일을 관리한다. **GitHub Actions는 이 스킬·devops 에이전트를 통해 관리한다.** devops 에이전트가 참조한다.

## 배포 아키텍처 (GHCR + self-hosted 러너)

> 빌드와 배포를 잡으로 분리한다. **build-and-push**는 GitHub 클라우드 러너(`ubuntu-latest`)에서 이미지를 빌드해 GHCR에 push, **deploy**는 배포서버의 **self-hosted 러너**에서 `docker compose pull && up -d`를 수행한다. SSH·webhook·Watchtower 불필요.

```
push(main) → build-and-push(클라우드): docker 빌드(pnpm build) → GHCR :latest
           → deploy(self-hosted): cd $DEPLOY_DIR && docker compose pull && up -d
push(v*)   → build-and-push: GHCR :<tag> 보관 (배포 안 함 / 롤백 대상)
```

### 보안 — public 레포 + self-hosted 러너 (필수)
- 포크 PR이 self-hosted 러너에서 임의 코드를 실행하지 못하도록:
  - 워크플로우에 **`pull_request` 트리거를 절대 두지 않는다.**
  - deploy 잡에 **`if`로 "기본 브랜치 push 또는 workflow_dispatch"** 조건을 건다.
- 이 두 가지가 깨지면 public 레포에서 서버가 노출된다. 변경 시 반드시 유지.

## 하네스·문서 변경은 배포하지 않는다 (paths-ignore)
하네스(`.claude/**`)와 문서(`**.md`)는 앱이 아니다 → main에 들어가도 **운영 배포를 트리거하면 안 된다.** 그래서 `deploy.yml`의 `on.push`에 `paths-ignore: ['.claude/**', '**.md']`를 둔다.
- `paths-ignore`는 푸시의 **모든** 변경 파일이 목록에 들어갈 때만 skip → 하네스만 바뀐 푸시=배포 안 함, **앱+하네스 혼합 푸시=정상 배포**(앱이 바뀌었으니).
- `.github/**`(워크플로우 자체)는 일부러 무시 목록에서 뺀다 — 워크플로우 변경은 배포로 검증돼야 하므로.

### 브랜치/하네스 운용 규칙 (확정)
- **하네스 정본은 main에 둔다**(동기 모델). feature 브랜치는 main에서 따므로 항상 최신 하네스를 상속한다 — 별도 merge 의식 불필요.
- **앱 PR에는 `.claude/**`·`CLAUDE.md`를 포함하지 않는다.** 작업 중 하네스를 만졌다면 그 변경은 앱 커밋에서 제외한다(스테이징에서 뺀다).
- **하네스만 갱신할 때**: main에서 `harness-setting` 브랜치를 임시로 떠 하네스 변경만 커밋 → PR → main 병합. `paths-ignore` 덕에 이 병합은 배포를 안 돈다. 병합 후 브랜치 삭제(ephemeral).
- 이렇게 하면 "하네스 변경이 배포를 트리거"하는 문제가 트리거 레벨에서 원천 차단되고, 브랜치마다 하네스가 표류하지도 않는다.

## 현재 파이프라인 (`.github/workflows/deploy.yml`)

- 트리거: `main` push(→`:latest`), `v*` 태그(→`:<tag>`), `workflow_dispatch`.
- `permissions: packages: write` + 빌트인 `GITHUB_TOKEN`으로 GHCR 로그인 → **별도 GHCR 시크릿 불필요.**
- `docker/metadata-action`으로 태그 결정, `build-push-action`으로 push.
- 이미지: `ghcr.io/hanyeolko/webvideochat-fe`.
- **deploy 잡**: `runs-on: [self-hosted]`, `needs: build-and-push`, `env.DEPLOY_DIR=/home/deploy/frontend`. GHCR 로그인(GITHUB_TOKEN) → `docker compose pull && up -d`.

## 인프라 파일

- `Dockerfile` — 멀티스테이지: `node:22-alpine`로 `pnpm install --frozen-lockfile && pnpm build` → `nginx:1.27-alpine`에 `dist/` + `nginx/default.conf` 복사. EXPOSE 80.
- `nginx/default.conf` — **FE 컨테이너** nginx: SPA 정적 서빙 + history fallback(`try_files ... /index.html`). API/WS 프록시는 여기 두지 않는다(호스트 nginx 담당).
- `.env.development`(BE localhost:8080), `.env.production`(**의도적으로 비움** — 상대경로 사용).

## FE↔BE 연결 (상대경로 + 호스트 nginx 프록시)

- FE는 API/WS를 **상대경로**로 호출(`VITE_*` 비움). 동일 도메인의 **호스트 nginx(443)**가 `/api`·`/socket`을 BE로 프록시.
- 장점: `VITE_*`가 빌드 시점에 번들에 박히는데, 상대경로면 **동일 이미지를 환경 무관 재사용** 가능. BE 주소 변경은 호스트 nginx만 수정.
- WebSocket도 상대 URL(`/socket/{roomId}`)로 연결되며 브라우저가 page origin 기준 ws/wss로 해석한다.

## 변경 시 점검 항목

1. **상대경로 모델 유지**: `.env.production`의 `VITE_*`를 함부로 절대 URL로 채우지 말 것(이미지 재사용성 상실). 절대 URL이 필요하면 Dockerfile build-arg로 주입하고 모델 전환을 명시.
2. **SPA fallback**: `nginx/default.conf`에 history fallback 유지(없으면 `/room/123` 직접 접근 404).
3. **호스트 nginx 프록시**: `/api`·`/socket` location이 BE로 가는지(README 예시 참조). `/socket`은 WebSocket 업그레이드 헤더 필수.
4. **lockfile 동기화**: Dockerfile `--frozen-lockfile` → `package.json` 변경 시 `pnpm-lock.yaml`도 커밋.
5. **이미지명/태그 일관성**: 워크플로우 `IMAGE_NAME` ↔ 서버 compose `image:`. 감지 에이전트는 `:latest` watch.
6. **GHCR 인증**: Actions는 `GITHUB_TOKEN`. 서버는 별도 PAT(`read:packages`)로 login.

## 작업 원칙

- **작게, 한 번에 하나.** YAML/Dockerfile 한 줄이 배포를 막는다.
- **정적 + 로컬 검증.** YAML 파싱, 가능하면 로컬 `docker build`. 실배포(태그/머지)는 사용자 확인.
- **롤백 절차 동반.** `:latest`는 롤백 없음 → `:<tag>` 이미지로 서버에서 되돌린다.
- **비밀 노출 금지.** 시크릿은 이름만.
- **서버 설정 임의 생성 금지.** 호스트 nginx·감지 에이전트·인증서·`.env`는 레포 밖. README/문서로 절차만 제시.

## 서버 준비물 (레포 밖)
- repo Settings → Actions → Runners에 **self-hosted 러너 등록**(repo별 1개), 서비스 상주.
- Docker + compose, 러너 계정 `docker` 그룹.
- `$DEPLOY_DIR`(`/home/deploy/frontend`)에 compose(`image: ghcr.io/hanyeolko/webvideochat-fe:${IMAGE_TAG:-latest}`, 3000:80) 배치.
- 호스트 nginx(443)에 `/api`·`/socket` → BE 프록시(README 예시).

## 다음 단계 (미완)
- deploy 잡에 **헬스체크 + 자동 롤백** 보강.
- PR/푸시용 **CI 검증 워크플로우**(install·lint·typecheck·build) — 후순위.

## 검증 명령

```
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"   # YAML 문법
docker build -t webvideochat-fe:test .                                          # 로컬 이미지 빌드
pnpm build                                                                       # 번들 생성 확인
```

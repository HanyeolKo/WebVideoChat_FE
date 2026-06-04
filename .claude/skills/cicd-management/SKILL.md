---
name: cicd-management
description: WebVideoChat 프론트엔드의 GitHub Actions·Docker·nginx·Vite 빌드·환경변수 관리 방법론. 워크플로우(.github/workflows/deploy.yml) 수정, Dockerfile·nginx/default.conf·.env.* 변경, 시크릿/환경변수 매핑 점검 시 반드시 사용. GitHub Actions는 이 하네스를 통해 관리한다. devops 에이전트가 참조.
---

# CI/CD Management — 프론트엔드 배포 파이프라인 가이드

WebVideoChat 프론트엔드의 CI/CD와 인프라 파일을 관리한다. **GitHub Actions는 이 스킬·devops 에이전트를 통해 관리한다.** devops 에이전트가 참조한다.

## 현재 파이프라인 (`.github/workflows/deploy.yml`)

트리거: `v*` 태그 push 또는 `workflow_dispatch`. 권한: `packages: write`(GHCR).

```
deploy job:
  checkout → Docker Buildx → GHCR 로그인(GHCR_USERNAME/GHCR_TOKEN)
  → docker build & push → ghcr.io/hanyeolko/webvideochat-fe:{tag}, :latest
  → SSH로 서버: .env에 IMAGE_TAG 기록 → docker compose down/build/up
```

시크릿: `GHCR_USERNAME`, `GHCR_TOKEN`, `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_PORT`.

## 인프라 파일

- `Dockerfile` — 멀티스테이지: `node:22-alpine`로 `corepack enable && pnpm install --frozen-lockfile && pnpm build` → `nginx:1.27-alpine`에 `dist/` + `nginx/default.conf` 복사. EXPOSE 80.
- `nginx/default.conf` — SPA 정적 서빙. react-router 사용이므로 `try_files ... /index.html`(history fallback)이 있어야 새로고침 404 안 남. API/WS는 BE로 직접 또는 프록시.
- `.env.development`(BE localhost:8080), `.env.production`(현재 비어 있음).
- `.dockerignore` — `.env` 제외됨(빌드 시 `.env.production`은 포함되어야 Vite가 읽음 — 확인 대상).

## 변경 시 점검 항목

1. ⚠️ **`$IMAGE_TAG` 미정의 버그**: 배포 스크립트 `printf "IMAGE_TAG=%s\n" "$IMAGE_TAG"`의 `$IMAGE_TAG`가 워크플로우에 정의되지 않음 → 서버 `.env`에 **빈 값** 기록. 의도는 `${{ github.ref_name }}`(태그)로 추정. 수정 시 `env: IMAGE_TAG: ${{ github.ref_name }}`를 deploy step에 추가하거나 ssh `envs`로 전달.
2. **빌드타임 환경변수**: `VITE_*`는 `pnpm build` 시점에 번들에 박힌다. 런타임 주입 불가. prod 호스트가 비어 있으면 빌드 시점에 주입(빌드 인자/`.env.production`)하거나 nginx에서 상대경로 프록시로 처리해야 한다. 둘 중 무엇인지 확정하고 일관되게.
3. **SPA fallback**: `nginx/default.conf`에 history fallback이 있는지. 없으면 `/room/123` 직접 접근 시 404.
4. **이미지명 일관성**: 워크플로우 `IMAGE_NAME`(`ghcr.io/hanyeolko/webvideochat-fe`) ↔ 서버 compose 이미지 참조.
5. **lockfile 동기화**: Dockerfile이 `--frozen-lockfile` 사용 → `package.json` 변경 시 `pnpm-lock.yaml`도 커밋해야 빌드 성공.

## 작업 원칙

- **작게, 한 번에 하나.** YAML/Dockerfile 한 줄이 배포를 막는다.
- **정적 + 로컬 검증.** YAML 파싱, 가능하면 로컬 `docker build`까지. 실배포는 사용자 태그 push로 확인 안내.
- **롤백 절차 동반.**
- **비밀 노출 금지.** 시크릿은 이름만.
- **부재 파일 임의 생성 금지.** `docker-compose.yml`이 레포에 없음(서버 측 추정) — 임의 생성 말고 사용자 확인.

## 검증 명령

```
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"   # YAML 문법
docker build -t webvideochat-fe:test .                                          # 로컬 이미지 빌드
pnpm build                                                                       # 번들 생성 확인
```

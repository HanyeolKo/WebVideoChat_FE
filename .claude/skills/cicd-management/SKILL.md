---
name: cicd-management
description: WebVideoChat 프론트엔드의 GitHub Actions·Docker·nginx·Vite 빌드·환경변수 관리 방법론. 워크플로우(.github/workflows/deploy.yml) 수정, Dockerfile·nginx/default.conf·.env.* 변경, GHCR 이미지/시크릿/환경변수 매핑 점검 시 반드시 사용. GitHub Actions는 이 하네스를 통해 관리한다. devops 에이전트가 참조.
---

# CI/CD Management — 프론트엔드 배포 파이프라인 가이드

WebVideoChat 프론트엔드의 CI/CD와 인프라 파일을 관리한다. **GitHub Actions는 이 스킬·devops 에이전트를 통해 관리한다.** devops 에이전트가 참조한다.

## 배포 아키텍처 (GHCR + 온프레미스 자동 트리거)

> **GitHub Actions의 책임은 "이미지 빌드 → GHCR push"까지다.** 서버에 SSH로 접속하지 않는다. 서버 배포는 온프레미스 서버의 감지 에이전트(Watchtower 또는 자체 webhook 수신기)가 새 `:latest`를 감지해 `docker compose pull && up -d`로 수행한다(서버 설정, 레포 밖).

```
push(main) → Actions: docker 빌드(pnpm build) → GHCR :latest → [서버 감지] → pull&재기동
push(v*)   → Actions: 빌드 → GHCR :<tag>  (버전 스냅샷 / 롤백 대상)
```

## 현재 파이프라인 (`.github/workflows/deploy.yml`)

- 트리거: `main` push(→`:latest`), `v*` 태그(→`:<tag>`), `workflow_dispatch`.
- `permissions: packages: write` + 빌트인 `GITHUB_TOKEN`으로 GHCR 로그인 → **별도 GHCR 시크릿 불필요.**
- `docker/metadata-action`으로 태그 결정, `build-push-action`으로 push.
- 이미지: `ghcr.io/hanyeolko/webvideochat-fe`.

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

## 다음 단계 (미완)

- 서버 측 **webhook 수신기 + rollback `deploy.sh`** 구성(롤백 유지). 서버 URL/시크릿/롤백 정책 확정 후.
- PR/푸시용 **CI 검증 워크플로우**(install·lint·typecheck·build) 신설 — 후순위.

## 검증 명령

```
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"   # YAML 문법
docker build -t webvideochat-fe:test .                                          # 로컬 이미지 빌드
pnpm build                                                                       # 번들 생성 확인
```

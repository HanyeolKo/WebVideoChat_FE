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
- `/home/deploy/frontend`의 `docker-compose.yml`이 `image: ghcr.io/hanyeolko/webvideochat-fe:latest`를 참조(3000:80 매핑).
- 감지 에이전트(Watchtower/webhook) 상주.

## 로컬 개발
```
pnpm install      # corepack enable (Node 22)
pnpm dev          # http://localhost:5173 (BE: http://localhost:8080)
pnpm build        # tsc -b && vite build
pnpm lint
```

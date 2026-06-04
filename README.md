# WebVideoChat_FE

React 19 + Vite 화상채팅 프론트엔드. Nginx 컨테이너에서 정적 파일로 서빙한다.

## 배포 구조 (GHCR + 온프레미스 자동 트리거)

```
git push (main) ──▶ GitHub Actions ──▶ GHCR(:latest) ──▶ [서버 감지 에이전트] ──▶ pull & 재기동
git push (v*)   ──▶ GitHub Actions ──▶ GHCR(:<tag>)  (버전 스냅샷 / 롤백 대상)
```

- **GitHub Actions**(`.github/workflows/deploy.yml`)는 이미지를 빌드해 GHCR(`ghcr.io/hanyeolko/webvideochat-fe`)에 push까지만 한다. 서버에 SSH로 접속하지 않는다.
- GHCR 로그인은 빌트인 `GITHUB_TOKEN`(+ `permissions: packages: write`)을 사용하므로 **별도 시크릿이 필요 없다.**
- 서버 배포는 온프레미스 서버의 **감지 에이전트(Watchtower 또는 자체 webhook 수신기)**가 새 `:latest`를 감지해 `docker compose pull && up -d`로 수행한다. (서버 설정, 이 레포 밖)

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

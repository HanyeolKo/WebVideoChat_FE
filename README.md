# WebVideoChat_FE

## On-premise 배포 (Ubuntu 24.04.2 LTS, docker compose, 태그 기준)

### 1) 애플리케이션 구조
- Vite 빌드 산출물(`dist`)을 Nginx 컨테이너에서 정적 파일로 서빙
- 호스트 Nginx(443 리버스 프록시)가 `127.0.0.1:3000`으로 프록시
- 컨테이너 실행 경로: `/home/deploy/frontend`

### 2) 서버 준비
- 서버에 `deploy` 계정으로 SSH 접속 가능해야 함
- 서버에 Docker / Docker Compose 플러그인 설치 필요
- `/home/deploy/frontend` 경로에 docker-compose 파일이 위치함

### 3) GitHub Secrets 설정
- `DEPLOY_HOST`: 온프레미스 서버 주소
- `DEPLOY_PORT`: SSH 포트(예: 22)
- `DEPLOY_USERNAME`: `deploy`
- `DEPLOY_SSH_KEY`: deploy 계정 개인키
- `GHCR_USERNAME`: GHCR 접근 계정
- `GHCR_TOKEN`: GHCR 패키지 read/write 권한 토큰

### 4) 태그 배포
- `v*` 형식 태그 푸시 시 `.github/workflows/deploy-tag.yml` 실행
- 워크플로우가 Docker 이미지를 GHCR에 푸시하고, 서버에서 `docker compose pull && up -d` 수행

### 5) 호스트 Nginx(443) 리버스 프록시 예시
```nginx
server {
    listen 443 ssl;
    server_name your.domain;

    ssl_certificate     /etc/letsencrypt/live/your.domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

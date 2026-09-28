#!/usr/bin/env bash
# rfa_webfront 를 고정 포트(ports.json → web)에 프로덕션 모드로 (재)배포한다.
# 사용: npm run deploy
set -euo pipefail
cd "$(dirname "$0")/.."

WEB_PORT=$(node -p "require('./ports.json').web")
DIST_DIR=.next-prod           # `npm run dev`(.next) 와 겹치지 않게 별도 빌드 폴더
LOG=logs/webfront.log
mkdir -p logs

# 1) 같은 포트의 이전 webfront(next-server)만 내린다. 다른 프로세스가 잡고 있으면 중단.
for pid in $(lsof -tiTCP:"$WEB_PORT" -sTCP:LISTEN 2>/dev/null || true); do
  cmd=$(ps -o command= -p "$pid" 2>/dev/null || true)
  case "$cmd" in
    *next-server*|*"next start"*) echo "이전 webfront(pid $pid) 종료"; kill "$pid" || true ;;
    *) echo "포트 $WEB_PORT 를 다른 프로세스가 쓰고 있습니다 (pid $pid: $cmd). 중단." >&2; exit 1 ;;
  esac
done
for _ in $(seq 1 20); do lsof -tiTCP:"$WEB_PORT" -sTCP:LISTEN >/dev/null 2>&1 || break; sleep 0.5; done

# 2) 빌드
NEXT_DIST_DIR="$DIST_DIR" npx next build

# 3) 기동 (백그라운드, 로그는 logs/webfront.log)
NEXT_DIST_DIR="$DIST_DIR" nohup npx next start -p "$WEB_PORT" >>"$LOG" 2>&1 &
disown || true

# 4) 헬스 체크
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "http://127.0.0.1:$WEB_PORT/"; then
    echo "webfront 기동: http://localhost:$WEB_PORT  (로그: $LOG)"
    exit 0
  fi
  sleep 1
done
echo "webfront 가 올라오지 않았습니다. $LOG 를 확인하세요." >&2
exit 1

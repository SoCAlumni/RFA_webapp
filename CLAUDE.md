@AGENTS.md

# 포트 고정 (변경 금지)

- 배포(웹앱): **3200**, 개발: **3100** — 단일 출처는 `ports.json`. **3000 은 Langfuse** 가 쓰므로 절대 쓰지 않는다.
- 배포는 `npm run deploy`(scripts/deploy.sh: 이전 서버 종료 → `.next-prod` 빌드 → 3200 기동 → 헬스체크). 개발은 `npm run dev`.
- `.claude/hooks/guard-port.mjs`(PreToolUse) 가 Next 서버를 다른 포트(또는 포트 없이)로 띄우는 명령, package.json/ports.json/훅/deploy.sh 의 포트 변경, 3000 프로세스 종료를 차단한다. 우회하려 하지 말 것. 포트를 바꾸는 결정은 사용자만 내릴 수 있다(사용자가 직접 파일을 고치거나 `RFA_PORT_UNLOCK=1` 로 세션을 띄운다).

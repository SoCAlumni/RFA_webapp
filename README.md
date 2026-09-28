# RFA 웹앱 · 결재함 + 비서 채팅

외부(GitHub 이슈 · Slack DM)에서 들어온 문의에 태스크 에이전트가 답변 초안을 쓰고,
사람이 결재함에서 고쳐서 바로 응답하거나 재생성을 요청하는 앱입니다.
비서 에이전트에게 물으면 맞는 담당 에이전트를 찾아 확인하고, 그 과정을 그대로 보여 줍니다.

디자인 기준: `ui_ref.html` / [claude.ai 아티팩트 (UI ref)](https://claude.ai/artifact/LFD3Utajj2ahC9wv45MbAg)

## 호스팅

- 데모 주소: <[https://this-resorts-keyboards-theaters.trycloudflare.com](https://includes-assets-registrar-mines.trycloudflare.com/)> (Cloudflare Tunnel, `/chat` 으로 이동)

## 실행

rfa_mas 프런트 API(`make serve`, 기본 `http://127.0.0.1:8799`)에 붙어 실제 데이터로 동작합니다. mock 은 없습니다.

```bash
cp .env.example .env.local   # RFA_API_URL, RFA_ASK_TOKEN(= rfa_mas .env.dev 의 RFA_ASK_TOKEN)
npm install
npm run dev                  # http://localhost:3100  (→ /chat)   ※ 3000 은 Langfuse 가 쓴다
npm run deploy               # 프로덕션 빌드(.next-prod) 후 http://localhost:3200 에 (재)기동 — 포트는 ports.json 에 고정
```

| 환경 변수 | 뜻 |
|---|---|
| `RFA_API_URL` | rfa_mas 주소. 기본 `http://127.0.0.1:8799` |
| `RFA_ASK_TOKEN` | 소유자 토큰. 비우면 모두 게스트. 서버 쪽 프록시만 읽고 브라우저에는 보내지 않는다 |
| `RFA_OWNER_REMOTE` | `1` 이면 원격(터널 · 다른 기기) 요청에도 소유자 토큰을 붙인다. **기본은 이 컴퓨터에서 연 화면만 소유자** |

- 권한은 서버가 `GET /me` 로 정합니다. 이 컴퓨터에서 열면 소유자, 터널 · 다른 기기에서 열면 게스트입니다.
- 게스트로 보기: 처음 여는 주소에 `?role=guest` 를 붙입니다.

## 구조 — 화면 ↔ API

브라우저 → `/api/rfa/*`(Next 서버 프록시, `src/app/api/rfa/[...path]/route.ts`) → rfa_mas.
rfa_mas 에 CORS 가 없고 토큰을 숨겨야 해서 같은 origin 프록시를 둡니다. SSE 는 버퍼링 없이 그대로 흘려 보내고,
「중지」로 브라우저가 끊으면 위로도 끊습니다.

| 화면 | API (rfa_mas `docs/FE_API_GUIDE.md`, `docs/FE_APPROVAL_API_PLAN.md`) |
|---|---|
| 앱 시작 · 사이드바 | `GET /me`, `/tasks`, `/agents`, `/inbox/summary`, (관리자) `/admin/agents`, `/admin/sandboxes` |
| 비서 대화 | `GET /conversations?agentId=`, `GET /conversations/{id}`, `POST /chat` (SSE). 새 대화 id 는 브라우저가 만들고 소유자면 첫 질문 때 서버가 저장. 게스트는 `history` 를 보낸다 |
| 태스크 추가 | `POST /tasks` (SSE, 진행 화면) → 끊기면 `GET /tasks/{id}` 5초 폴링(최대 6분) |
| 결재함 | `GET /inbox`(15초마다), `GET /inbox/{id}`(작성 · 재생성 · 게시 중이면 3초마다), `POST /inbox/{id}/respond {draft}`, `POST /inbox/{id}/regenerate {request}` |
| 소스 | `GET/POST /tasks/{id}/sources`, `DELETE /tasks/{id}/sources/{sourceId}` |
| 관리 · 에이전트 | `GET /admin/agents/{id}`, `POST …/compact` · `…/clear-memory`(확인 후), `GET/PUT …/prompt`, `PATCH …/sources/{id}` |
| 관리 · 샌드박스 | `GET /admin/sandboxes/{id}`, `PATCH /admin/sandboxes/{id}`(바뀐 필드만, 제공자 변경은 확인 후) |

타입은 서버 OpenAPI 그대로 `src/lib/api/types.ts`, 호출은 `src/lib/api/http.ts`(인터페이스 `src/lib/api/client.ts`).

### 초안을 고쳐서 보내기

「바로 응답」은 화면의 초안을 `respond {draft}` 로 보냅니다. 고친 초안은 RFA_module 결재 서버 v0.3.0 이상이면
rfa_mas 가 등급 검사를 거쳐 그 글로 게시하고(rfa_mas `docs/proposals/RFA_MODULE_DRAFT_EDIT.md`), 옛 서버면
409 「수정한 초안은 아직 보낼 수 없습니다」가 초안 카드에 보입니다.

## 화면 · 주소

| 주소 | 화면 |
|---|---|
| `/chat` | 비서 에이전트와 대화 |
| `/chat/:agentId` | 태스크 에이전트와 대화 (`GET /agents` 의 id) |
| `/inbox` | 결재함 전체 |
| `/inbox/:taskId` | 태스크별 결재함 |
| `/inbox/:scope/:itemId` | 결재 상세 — 원본 화면(GitHub 이슈 · Slack 스레드) + 답변 초안 (`scope` = `all` 또는 태스크 id) |

관리(에이전트 · 샌드박스)는 소유자에게만 보이는 사이드바 **관리** 메뉴에서 팝업으로 엽니다. `Ctrl/⌘ K` 는 비서 대화로 이동합니다.

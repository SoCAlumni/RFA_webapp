# RFA 웹앱 · 결재함 + 비서 채팅

외부(GitHub 이슈 · Slack DM)에서 들어온 문의에 태스크 에이전트가 답변 초안을 쓰고,
사람이 결재함에서 고쳐서 바로 응답하거나 재생성을 요청하는 앱입니다.
비서 에이전트에게 물으면 맞는 담당 에이전트를 찾아 확인하고, 그 과정을 그대로 보여 줍니다.

디자인 기준: `ui_ref.html` / [claude.ai 아티팩트 (UI ref)](https://claude.ai/artifact/LFD3Utajj2ahC9wv45MbAg)

## 호스팅

- 데모 주소: <https://this-resorts-keyboards-theaters.trycloudflare.com> (Cloudflare Tunnel, `/chat` 으로 이동)

## 실행

```bash
npm install
npm run dev          # http://localhost:3000  (→ /chat)
npm run build && npm start
```

데모 권한 전환: 처음 여는 주소에 `?role=guest` 를 붙이면 게스트(볼 수만 있음)로 봅니다.

## 화면 · 주소

| 주소 | 화면 |
|---|---|
| `/chat` | 비서 에이전트와 대화 |
| `/chat/:taskId` | 태스크 에이전트와 대화 (`training` · `inference` · `automation` · `npu` · 새로 만든 태스크) |
| `/inbox` | 결재함 전체 |
| `/inbox/:taskId` | 태스크별 결재함 |
| `/inbox/:scope/:approvalId` | 결재 상세 — 원본 화면 + 답변 초안 (`scope` = `all` 또는 태스크 id) |

관리(에이전트 · 샌드박스)는 사이드바 아래 **관리** 메뉴에서 팝업으로 엽니다. `Ctrl/⌘ K` 는 비서 대화로 이동합니다.

## mock ↔ 실제 API

화면 코드는 `src/lib/api/client.ts` 의 `RfaApi` 인터페이스만 씁니다. 구현은 환경 변수로 고릅니다.

| `NEXT_PUBLIC_API_MODE` | 동작 |
|---|---|
| `mock` (기본) | 브라우저 안 mock 백엔드(`src/lib/api/mock`). 새로고침하면 처음 상태로 돌아갑니다 |
| `http` | `NEXT_PUBLIC_API_BASE_URL` 로 REST + SSE 호출(`src/lib/api/http.ts`). 기본값 `/api/v1` 은 이 앱에 들어 있는 mock 서버 |

실제 백엔드로 바꾸려면:

```bash
NEXT_PUBLIC_API_MODE=http
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com/api/v1
```

백엔드가 지켜야 할 계약(엔드포인트 · 대화 스트림 이벤트)은 [docs/API.md](docs/API.md) 에 있습니다.
`NEXT_PUBLIC_` 변수는 빌드할 때 들어가므로 바꾼 뒤 다시 빌드 · 배포해야 합니다.

## 구조

```
src/
  app/
    (app)/layout.tsx             사이드바 · 대화 · 관리 팝업이 있는 틀
    (app)/chat/[[...agent]]      대화(틀이 늘 띄워 두어 화면을 옮겨도 답변이 이어짐)
    (app)/inbox/[[...slug]]      결재함
    api/v1/[...path]/route.ts    API 계약을 따르는 mock 서버
  components/
    shell/        AppShell · Sidebar
    inbox/        목록 · 상세(GitHub/Slack 원본) · 답변 초안 카드
    chat/         대화 상대 레일 · 대화창 · 진행 과정 카드
    admin/        관리 팝업(에이전트 · 소스 · 샌드박스)
    dialogs/      태스크 추가 등
  lib/api/        타입 · 인터페이스 · mock · http 구현
  lib/chat/       대화 스트림 이벤트 → 화면 상태 reducer
  store/          화면 전체 상태(API 호출을 감쌈)
```

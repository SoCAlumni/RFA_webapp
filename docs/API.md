# RFA 백엔드 API 계약

화면은 `src/lib/api/client.ts` 의 `RfaApi` 인터페이스만 사용합니다.
`NEXT_PUBLIC_API_MODE=http` 이면 아래 REST + SSE 계약으로 `NEXT_PUBLIC_API_BASE_URL` 을 호출합니다.
타입 정의는 모두 `src/lib/api/types.ts` 에 있습니다(요청 · 응답 JSON 이 이 타입과 같아야 합니다).

이 저장소 안의 `src/app/api/v1/[...path]/route.ts` 가 같은 계약을 따르는 mock 서버라서,
실제 백엔드를 만들 때 그대로 참고하거나 대조 테스트에 쓸 수 있습니다.

## 공통

- 본문은 JSON, 문자 인코딩 UTF-8
- 인증은 쿠키(`credentials: "include"`)를 가정합니다. 데모용으로 `X-RFA-Role: owner | guest` 헤더를 함께 보냅니다
  — 실제 백엔드는 세션에서 권한을 판단하고 이 헤더는 무시해도 됩니다.
- 실패하면 4xx/5xx 와 `{ "error": "사람이 읽을 메시지" }` 를 돌려주세요. 화면이 이 메시지를 그대로 알림으로 띄웁니다.
- 게스트가 바꾸는 요청을 보내면 `403`

## 엔드포인트

| 메서드 · 경로 | 본문 | 응답 | 설명 |
|---|---|---|---|
| `GET /session` | | `Session` | 로그인한 사용자 · 권한 · 대화 안내문 |
| `GET /tasks` | | `Task[]` | 사이드바 태스크 |
| `POST /tasks` | `NewTaskInput` | `201 { task, agent, adminAgent }` | 태스크 + 태스크 에이전트를 1:1로 만든다. 이름이 겹치면 `409` |
| `GET /agents` | | `ChatAgent[]` | 대화 상대(비서 · 검열 · 태스크 에이전트). 비서의 `suggestions` 가 첫 화면 추천 질문 |
| `GET /inbox` | | `InboxItem[]` | 결재함 목록(최신 순) |
| `GET /approvals/:approvalId` | | `ApprovalDetail` | 원본 화면 + 답변 초안. 상세가 없는 안건은 `404` |
| `POST /approvals/:approvalId/regenerate` | `{ request }` | `DraftState` | 피드백을 붙여 초안을 다시 만든다(오래 걸려도 됨) |
| `POST /approvals/:approvalId/reply` | `{ text }` | `{ item, draft }` | 고친 글로 원래 채널(GitHub 댓글 · Slack 답장)에 응답. 이미 응답했으면 `409` |
| `GET /admin/agents` | | `AdminAgent[]` | 관리 · 에이전트 목록(컨텍스트 · 호출 통계 포함) |
| `POST /admin/agents/:id/compact` | | `AdminAgent` | 대화 기록 압축 |
| `POST /admin/agents/:id/clear-memory` | | `AdminAgent` | 기억과 노트 비우기 |
| `PUT /admin/agents/:id/system-prompt` | `{ prompt }` | `AdminAgent` | 시스템 프롬프트 저장 |
| `GET /tasks/:taskId/sources` | | `Source[]` | 태스크에 문의가 들어오는 곳 |
| `POST /tasks/:taskId/sources` | `NewSourceInput` | `201 Source` | 소스 연결. 처음엔 `status: "connecting"` 이어도 되고, 화면이 0.6초마다 다시 물어 `connected` 로 바뀌는 걸 반영한다 |
| `DELETE /tasks/:taskId/sources/:sourceId` | | `204` | 소스 떼기 |
| `GET /sandboxes` | | `Sandbox[]` | 샌드박스(등급별) |
| `GET /sandboxes/options` | | `SandboxOptions` | 고를 수 있는 모델 · 컨텍스트 길이 · 게이트웨이 |
| `PATCH /sandboxes/:id` | `SandboxSettings` | `Sandbox` | 설정 적용 |
| `GET /chat/seeds` | | `ChatSeed[]` | 지난 대화(대화 상대별 내역에 보여 줌) |
| `POST /chat/stream` | `ChatRequest` | `text/event-stream` | 비서 에이전트 질의 · 아래 참고 |

## 비서 대화 스트림 (`POST /chat/stream`)

요청:

```json
{ "text": "ORBIT 관련해서 기다리는 안건 알려줘", "role": "owner", "agentId": "inference", "history": [] }
```

- `agentId` 가 있으면 그 태스크 에이전트와의 대화(비서가 그 담당자에게 확인)
- `history` 는 이 대화창의 이전 메시지(`ChatMessage[]`)

응답은 SSE 입니다. 이벤트마다 `data: <ChatEvent JSON>\n\n` 한 줄씩 보내고, 끝나면 연결을 닫습니다.
사용자가 **중지**하면 화면이 요청을 abort 하므로 서버는 연결 종료를 감지해 작업을 멈추면 됩니다.

이벤트 순서(화면의 “진행 과정” 카드가 이 순서를 그대로 그립니다):

```
run.start          { runId, ts }
assistant.delta    { text }                  요청 파악 문장(토큰 단위로 여러 번)
agents.search      { query, candidates[] }   담당자 탐색 결과(없으면 빈 배열 → 비서가 직접 답함)
agents.select      { selected[], skipped[] } (선택)
delegate.start     { callId, agentId, task } 담당자 호출 시작(여러 명 병렬 가능)
delegate.log       { callId, text }          담당자 작업 로그
delegate.end       { callId, status: ok|none|blocked|error, summary?, refs?, durationMs? }
guard.start        { level: public|team|company }  등급 검사 시작
guard.end          { status: pass|redacted|blocked, note?, redactions? }
answer.delta       { text }                  최종 답변(토큰 단위로 여러 번)
run.end            { status: done|stopped|error, durationMs?, error? }
```

`refs` 의 `kind: "approval"` 칩을 누르면 화면이 해당 결재 상세로 이동합니다.

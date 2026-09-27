# API

이 앱은 rfa_mas 프런트 API 를 그대로 씁니다. 계약 원본은 rfa_mas 저장소에 있습니다.

- 필드 정의: `rfa_mas/docs/openapi.yaml` (서버 `GET /openapi.json`, `/docs`)
- 화면 ↔ API 대응 · 주의점: `rfa_mas/docs/FE_API_GUIDE.md`
- 결재함 · 소스: `rfa_mas/docs/FE_APPROVAL_API_PLAN.md`
- 초안 수정 게시: `rfa_mas/docs/proposals/RFA_MODULE_DRAFT_EDIT.md`

이 저장소의 대응 코드: 타입 `src/lib/api/types.ts`, 호출 `src/lib/api/http.ts`, 프록시 `src/app/api/rfa/[...path]/route.ts`.

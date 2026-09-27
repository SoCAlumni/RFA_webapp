import type { RfaApi } from "./client";
import { createHttpApi } from "./http";
import type { Role } from "./types";

export type { RfaApi } from "./client";
export { ApiError, errorText } from "./client";

/**
 * 브라우저는 같은 origin 의 프록시(/api/rfa → RFA_API_URL, 기본 http://127.0.0.1:8799)를 부른다.
 * 다른 주소를 직접 부르려면 NEXT_PUBLIC_API_BASE_URL (그쪽에 CORS 와 인증이 있어야 한다).
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/rfa";

let role: Role | null = null;

/**
 * 게스트로 보기: 처음 연 주소에 ?role=guest 가 있으면 프록시가 토큰을 붙이지 않는다.
 * 실제 권한은 서버가 GET /me 로 정한다(토큰이 맞으면 owner).
 */
export function requestedRole(): Role {
  if (role) return role;
  if (typeof window === "undefined") return "owner";
  role =
    new URLSearchParams(window.location.search).get("role") === "guest" ? "guest" : "owner";
  return role;
}

let instance: RfaApi | null = null;

export function getApi(): RfaApi {
  return (instance ??= createHttpApi(BASE_URL, requestedRole));
}

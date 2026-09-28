/**
 * /owner — 이 브라우저를 소유자로 전환한다 (검증 단계용 임시 입구).
 * 터널 · 다른 기기에서 연 화면은 원래 게스트다(프록시가 토큰을 붙이지 않음). 이 주소로 한 번 들어오면
 * 쿠키(OWNER_COOKIE)를 심고, 프록시는 그 쿠키가 있는 요청에 소유자 토큰을 붙인다.
 * `/owner?off` 는 쿠키를 지워 게스트로 되돌린다. 토큰 자체는 브라우저에 가지 않는다.
 */
import { OWNER_COOKIE } from "@/lib/owner";

export const dynamic = "force-dynamic";

const MAX_AGE = 60 * 60 * 24 * 30; // 30일

export async function GET(request: Request) {
  const off = new URL(request.url).searchParams.has("off");
  const cookie = off
    ? `${OWNER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
    : `${OWNER_COOKIE}=1; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax`;
  return new Response(null, {
    status: 303,
    headers: { location: "/chat", "set-cookie": cookie, "cache-control": "no-store" },
  });
}

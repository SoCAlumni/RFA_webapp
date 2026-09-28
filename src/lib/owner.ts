/** /owner 로 들어온 브라우저에 심는 쿠키. 프록시(api/rfa)가 보고 소유자 토큰을 붙인다. */
export const OWNER_COOKIE = "rfa_owner";

export function hasOwnerCookie(req: Request): boolean {
  return (req.headers.get("cookie") ?? "")
    .split(";")
    .some((part) => part.trim() === `${OWNER_COOKIE}=1`);
}

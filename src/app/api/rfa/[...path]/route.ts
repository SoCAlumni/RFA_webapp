/**
 * rfa_mas 프런트 API 프록시.
 * - rfa_mas 는 CORS 가 없고 루프백에서만 받으므로(FE_API_GUIDE §0.1) 같은 origin 에서 전달한다.
 * - 소유자 토큰(RFA_ASK_TOKEN)은 여기서만 붙여 브라우저에 드러나지 않게 한다.
 *   이 컴퓨터(루프백)에서 연 화면에만 붙이고, 터널 · 다른 기기에서 온 요청은 게스트로 둔다
 *   (RFA_OWNER_REMOTE=1 이면 원격에도 붙인다). `X-RFA-Role: guest` 요청에도 붙이지 않는다.
 *   /owner 로 한 번 들어온 브라우저(쿠키 rfa_owner=1)는 원격이어도 소유자다 — 검증 단계용 임시 입구.
 * - SSE(`POST /chat`, `POST /tasks`)는 버퍼링 없이 그대로 흘려 보내고, 브라우저가 끊으면(중지) 위로도 끊는다.
 */
import { hasOwnerCookie } from "@/lib/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPSTREAM = (process.env.RFA_API_URL ?? "http://127.0.0.1:8799").replace(/\/$/, "");
const TOKEN = process.env.RFA_ASK_TOKEN ?? "";
/** 1 이면 원격(터널 · 다른 기기) 요청에도 소유자 토큰을 붙인다. 기본은 이 컴퓨터에서 온 요청만 */
const TRUST_REMOTE = process.env.RFA_OWNER_REMOTE === "1";

const LOOPBACK = /^(127\.|::1$|::ffff:127\.|localhost$)/;

/**
 * 이 컴퓨터(루프백)에서 연 화면인지. 터널(cloudflared 등)은 cf-connecting-ip · x-forwarded-for 에
 * 실제 접속자 주소를 싣는다 — 그런 요청이 소유자 권한을 얻지 못하게 한다.
 */
function isLocal(req: Request) {
  if (req.headers.has("cf-connecting-ip") || req.headers.has("cf-ray")) return false;
  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain.some((ip) => !LOOPBACK.test(ip))) return false;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").replace(/:\d+$/, "");
  return host === "localhost" || LOOPBACK.test(host) || host === "[::1]";
}

/** 프런트가 쓰는 경로만 연다 (/ask, /teams 등 desk·CLI 용은 막는다) */
const ALLOWED = /^(me|agents|tasks|conversations|chat|inbox|admin)(\/|$)/;

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  const sub = path.map(encodeURIComponent).join("/");
  if (!ALLOWED.test(sub) || sub === "chat/sync")
    return Response.json({ code: "not_found", message: "없는 경로입니다." }, { status: 404 });

  const url = `${UPSTREAM}/${sub}${new URL(req.url).search}`;
  const headers = new Headers();
  for (const h of ["content-type", "accept"]) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (
    TOKEN &&
    req.headers.get("x-rfa-role") !== "guest" &&
    (TRUST_REMOTE || isLocal(req) || hasOwnerCookie(req))
  )
    headers.set("authorization", `Bearer ${TOKEN}`);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      signal: req.signal,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return Response.json(
      {
        code: "upstream_unavailable",
        message: `rfa_mas 서버(${UPSTREAM})에 연결할 수 없습니다. make serve 로 서버를 켜 주세요.`,
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  const out = new Headers();
  const type = upstream.headers.get("content-type");
  if (type) out.set("content-type", type);
  if (type?.includes("text/event-stream")) {
    out.set("cache-control", "no-cache, no-transform");
    out.set("x-accel-buffering", "no");
    out.set("connection", "keep-alive");
  } else {
    out.set("cache-control", "no-store");
  }
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

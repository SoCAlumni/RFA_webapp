#!/usr/bin/env node
// PreToolUse 훅: rfa_webfront 의 고정 포트(ports.json)를 바꾸려는 시도를 막는다.
// - `next start`/`next dev` 를 다른 포트(또는 포트 없이 = 3000 Langfuse 충돌)로 띄우는 Bash
// - package.json / ports.json / 이 훅 / .claude/settings.json / scripts/deploy.sh 의 포트 관련 수정
// - 3000 포트(Langfuse)의 프로세스를 죽이는 Bash
// 사람이 의도적으로 바꿀 때: 파일을 직접 고치거나 RFA_PORT_UNLOCK=1 로 세션을 띄운다.
import fs from "node:fs";
import path from "node:path";

if (process.env.RFA_PORT_UNLOCK === "1") process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const portsFile = path.join(root, "ports.json");
let ports;
try {
  ports = JSON.parse(fs.readFileSync(portsFile, "utf8"));
} catch {
  process.exit(0); // ports.json 이 없는 저장소면 이 훅은 관여하지 않는다
}
const WEB = Number(ports.web);
const DEV = Number(ports.dev);
const LANGFUSE = 3000;

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const tool = input.tool_name || "";
const ti = input.tool_input || {};

function deny(reason) {
  const msg =
    `[guard-port] 차단: ${reason}\n` +
    `rfa_webfront 포트는 고정입니다 — 배포 ${WEB}, 개발 ${DEV} (ports.json). ` +
    `3000 은 Langfuse 가 쓰고 있습니다. 배포는 \`npm run deploy\`, 개발은 \`npm run dev\` 를 그대로 쓰세요. ` +
    `정말 바꿔야 하면 사용자가 직접 ports.json/package.json 을 고치거나 RFA_PORT_UNLOCK=1 로 세션을 띄워야 합니다.`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: msg,
      },
    })
  );
  process.exit(0);
}

const rel = (p) => path.relative(root, path.resolve(root, p)).split(path.sep).join("/");
const isPkg = (r) => r === "package.json";
const isPorts = (r) => r === "ports.json";
const isHook = (r) => r === ".claude/hooks/guard-port.mjs";
const isSettings = (r) => r === ".claude/settings.json";
const isDeploy = (r) => r === "scripts/deploy.sh";
const isGuarded = (r) => isPkg(r) || isPorts(r) || isHook(r) || isSettings(r) || isDeploy(r);

// ---------- 파일 내용 검사 ----------
function checkContent(r, content) {
  if (isPorts(r)) return deny("ports.json 은 에이전트가 수정할 수 없습니다.");
  if (isHook(r)) return deny("포트 보호 훅(guard-port.mjs) 은 에이전트가 수정할 수 없습니다.");
  if (isSettings(r)) {
    if (!/guard-port\.mjs/.test(content))
      return deny(".claude/settings.json 에서 guard-port 훅을 제거할 수 없습니다.");
    return;
  }
  if (isDeploy(r)) {
    if (!/ports\.json/.test(content) || /-p\s+\d{2,5}\b/.test(content) || /--port[= ]\d{2,5}\b/.test(content))
      return deny("scripts/deploy.sh 는 포트를 ports.json 에서 읽어야 하며 포트 숫자를 하드코딩할 수 없습니다.");
    return;
  }
  if (isPkg(r)) {
    let pkg;
    try {
      pkg = JSON.parse(content);
    } catch {
      return deny("package.json 이 올바른 JSON 이 아닙니다.");
    }
    const s = pkg.scripts || {};
    if (s.dev !== `next dev -p ${DEV}`) return deny(`package.json scripts.dev 는 "next dev -p ${DEV}" 로 고정입니다.`);
    if (s.start !== `next start -p ${WEB}`) return deny(`package.json scripts.start 는 "next start -p ${WEB}" 로 고정입니다.`);
    if (s.deploy !== "bash scripts/deploy.sh") return deny('package.json scripts.deploy 는 "bash scripts/deploy.sh" 로 고정입니다.');
  }
}

function applyEdit(content, e) {
  const { old_string = "", new_string = "", replace_all } = e;
  if (!old_string) return content + new_string;
  return replace_all ? content.split(old_string).join(new_string) : content.replace(old_string, () => new_string);
}

if (tool === "Write" || tool === "Edit" || tool === "MultiEdit") {
  const fp = ti.file_path || "";
  if (!fp) process.exit(0);
  const r = rel(fp);
  if (!isGuarded(r)) process.exit(0);
  let content;
  if (tool === "Write") content = String(ti.content ?? "");
  else {
    try {
      content = fs.readFileSync(path.resolve(root, fp), "utf8");
    } catch {
      content = "";
    }
    const edits = tool === "Edit" ? [ti] : ti.edits || [];
    for (const e of edits) content = applyEdit(content, e);
  }
  checkContent(r, content);
  process.exit(0);
}

// ---------- Bash 검사 ----------
if (tool === "Bash") {
  const cmd = String(ti.command || "");

  // 1) next start / next dev 를 직접 띄우는 경우: 포트가 고정값과 같아야 한다
  const re = /\bnext\s+(start|dev)\b([^|;&\n]*)/g;
  let m;
  while ((m = re.exec(cmd))) {
    const kind = m[1];
    const rest = m[2];
    const pm = /(?:^|\s)(?:-p|--port)(?:=|\s+)(\S+)/.exec(rest);
    const want = kind === "dev" ? DEV : WEB;
    if (!pm) deny(`\`next ${kind}\` 를 포트 없이 띄우면 3000(Langfuse) 과 충돌합니다.`);
    const val = pm[1].replace(/^["']|["']$/g, "");
    if (/^\d+$/.test(val) && Number(val) !== want) deny(`\`next ${kind} -p ${val}\` — 고정 포트는 ${want} 입니다.`);
    if (!/^\d+$/.test(val) && !/ports\.json|\$\{?WEB_PORT|\$\{?DEV_PORT/.test(cmd))
      deny(`\`next ${kind}\` 의 포트는 숫자 ${want} 또는 ports.json 에서 읽은 값만 허용됩니다.`);
  }
  if (/\bPORT=(\d+)/.test(cmd)) {
    const v = Number(/\bPORT=(\d+)/.exec(cmd)[1]);
    if (/\b(next|npm\s+(run\s+)?(start|dev|deploy))\b/.test(cmd) && v !== WEB && v !== DEV)
      deny(`PORT=${v} 로 웹앱을 띄울 수 없습니다.`);
  }

  // 2) 보호 파일을 셸로 고치는 경우
  const guardedNames = /(package\.json|ports\.json|guard-port\.mjs|\.claude\/settings\.json|scripts\/deploy\.sh)/;
  const writer = /(\bsed\s+-[a-zA-Z]*i|\bperl\s+-[a-zA-Z]*i|\btee\b|(?<![0-9&])>(?!&)|\bmv\b|\bcp\b|\brm\b|\bnpm\s+pkg\s+(set|delete)|\btruncate\b|\bchmod\b)/;
  if (guardedNames.test(cmd) && writer.test(cmd))
    deny("포트 설정 파일(package.json/ports.json/guard-port.mjs/.claude/settings.json/scripts/deploy.sh) 을 셸로 고칠 수 없습니다.");

  // 3) 3000 포트(Langfuse) 프로세스 종료
  const kill3000 =
    /(\bkill\b|\bpkill\b|\bfuser\s+-k|docker\s+(stop|rm|kill)|docker\s+compose\s+(down|stop|rm)|xargs\s+kill)/.test(cmd) &&
    new RegExp(`(^|[^0-9])${LANGFUSE}([^0-9]|$)`).test(cmd);
  if (kill3000) deny("3000 포트는 Langfuse 입니다. 종료/변경할 수 없습니다.");

  process.exit(0);
}

process.exit(0);

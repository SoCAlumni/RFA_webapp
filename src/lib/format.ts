/** 서버 시각(unix 초)을 화면 문구로 */

const pad = (n: number) => String(n).padStart(2, "0");
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function dayDiff(d: Date, now = new Date()) {
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 864e5);
}

/** 목록 오른쪽 시각: 오늘 08:40 / 어제 / 09-25 */
export function listTime(sec: number | null | undefined) {
  if (!sec) return "";
  const d = new Date(sec * 1000);
  const diff = dayDiff(d);
  if (diff === 0) return hm(d);
  if (diff === 1) return "어제";
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 「… 들어옴 · 오늘 08:40」 */
export function dayTime(sec: number | null | undefined) {
  if (!sec) return "";
  const d = new Date(sec * 1000);
  const diff = dayDiff(d);
  const day = diff === 0 ? "오늘" : diff === 1 ? "어제" : `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${day} ${hm(d)}`;
}

/** GitHub 원본 화면처럼 영어 상대 시각 */
export function ago(sec: number | null | undefined) {
  if (!sec) return "";
  const s = Math.max(0, Math.round(Date.now() / 1000 - sec));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** Slack 메시지 시각: 오후 5:20 */
export function clock(sec: number | null | undefined) {
  if (!sec) return "";
  const d = new Date(sec * 1000);
  const h = d.getHours();
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${pad(d.getMinutes())}`;
}

export const seconds = (ms?: number | null) => (ms == null ? "" : `${(ms / 1000).toFixed(1)}초`);

export const fmtNum = (n: number) => n.toLocaleString("ko-KR");

/** 이름에서 두 글자 이니셜 */
export function initialsOf(name: string) {
  const words = name.match(/[A-Za-z0-9]+/g);
  if (words) return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].slice(0, 2).toUpperCase();
  return name.slice(0, 2);
}

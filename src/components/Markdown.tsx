"use client";

import { memo, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  // 외부 글의 이미지는 크기를 넘치지 않게
  img: ({ src, alt }) =>
    typeof src === "string" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" />
    ) : null,
};

type MdNode = { type: string; value?: string; children?: MdNode[]; data?: Record<string, unknown> };

/** 글 안의 문장을 <mark> 로 표시하는 remark 플러그인(주입 의심 문장) */
function remarkMark(sentences: string[]) {
  const needles = sentences.map((s) => s.trim()).filter(Boolean);
  return () => (tree: MdNode) => {
    if (!needles.length) return;
    const walk = (node: MdNode) => {
      if (!node.children || node.type === "code" || node.type === "inlineCode") return;
      const out: MdNode[] = [];
      for (const child of node.children) {
        if (child.type !== "text" || !child.value) {
          walk(child);
          out.push(child);
          continue;
        }
        let rest = child.value;
        for (;;) {
          let hit = -1;
          let needle = "";
          for (const n of needles) {
            const i = rest.indexOf(n);
            if (i >= 0 && (hit < 0 || i < hit)) {
              hit = i;
              needle = n;
            }
          }
          if (hit < 0) break;
          if (hit > 0) out.push({ type: "text", value: rest.slice(0, hit) });
          out.push({
            type: "emphasis",
            data: { hName: "mark", hProperties: { title: "주입 의심 문장" } },
            children: [{ type: "text", value: needle }],
          });
          rest = rest.slice(hit + needle.length);
        }
        if (rest) out.push({ type: "text", value: rest });
      }
      node.children = out;
    };
    walk(tree);
  };
}

/**
 * GitHub 글에 흔한 접기 블록 <details><summary>제목</summary>본문</details> 만 골라 낸다.
 * 다른 HTML 은 여전히 그리지 않는다. 요약은 태그를 벗긴 글자로, 본문은 같은 마크다운으로 그린다.
 */
const DETAILS = /<details[^>]*>\s*(?:<summary[^>]*>([\s\S]*?)<\/summary>)?([\s\S]*?)<\/details>/gi;

type Part = { kind: "md"; text: string } | { kind: "details"; summary: string; body: string };

function splitDetails(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(DETAILS)) {
    if (m.index > last) parts.push({ kind: "md", text: text.slice(last, m.index) });
    const summary = (m[1] ?? "").replace(/<[^>]*>/g, "").trim() || "자세히";
    parts.push({ kind: "details", summary, body: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "md", text: text.slice(last) });
  return parts;
}

/**
 * 답변 · 원본 글의 마크다운(GFM: 표 · 목록 · 코드).
 * 외부에서 온 글이라 HTML 은 그리지 않는다(react-markdown 기본값). 예외는 위의 접기 블록뿐.
 */
export const Markdown = memo(function Markdown({
  text,
  className,
  tail,
  mark,
}: {
  text: string;
  className?: string;
  /** 마지막에 붙일 것(스트리밍 커서 등) */
  tail?: ReactNode;
  /** 강조할 문장들 */
  mark?: string[];
}) {
  const key = mark?.join("\u0000") ?? "";
  const plugins = useMemo(
    () => (key ? [remarkGfm, remarkMark(key.split("\u0000"))] : [remarkGfm]),
    [key],
  );
  const parts = useMemo(() => splitDetails(text), [text]);
  const render = (md: string, k: number | string) => (
    <ReactMarkdown key={k} remarkPlugins={plugins} components={components}>
      {md}
    </ReactMarkdown>
  );
  return (
    <div className={`md ${className ?? ""}`}>
      {parts.map((p, i) =>
        p.kind === "md" ? (
          render(p.text, i)
        ) : (
          <details key={i}>
            <summary>{p.summary}</summary>
            {render(p.body, `${i}-body`)}
          </details>
        ),
      )}
      {tail}
    </div>
  );
});

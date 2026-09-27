"use client";

import { memo, type ReactNode } from "react";
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

/**
 * 답변 · 원본 글의 마크다운(GFM: 표 · 목록 · 코드).
 * 외부에서 온 글이라 HTML 은 그리지 않는다(react-markdown 기본값).
 */
export const Markdown = memo(function Markdown({
  text,
  className,
  tail,
}: {
  text: string;
  className?: string;
  /** 마지막에 붙일 것(스트리밍 커서 등) */
  tail?: ReactNode;
}) {
  return (
    <div className={`md ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
      {tail}
    </div>
  );
});

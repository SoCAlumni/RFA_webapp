"use client";

import type { DraftState, PipelineStep } from "@/lib/api/types";
import { useApp } from "@/store/app-store";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const sec = (ms: number) => `${(ms / 1000).toFixed(1)}초`;

const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);
const Chevron = () => (
  <svg className="dc-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const Regen = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 11a8 8 0 0 0-14.9-3.9L4 9" />
    <path d="M4 4v5h5" />
    <path d="M4 13a8 8 0 0 0 14.9 3.9L20 15" />
    <path d="M20 20v-5h-5" />
  </svg>
);
const Send = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 4l17 8-17 8 3-8-3-8z" />
  </svg>
);

type StepState = "done" | "running" | "pending";

function Step({
  step,
  state,
  open,
  onToggle,
  index,
}: {
  step: PipelineStep;
  state: StepState;
  open: boolean;
  onToggle: () => void;
  index: number;
}) {
  const running = state === "running";
  return (
    <li className="dc-step" data-state={state}>
      <button
        type="button"
        className="dc-step-row"
        onClick={onToggle}
        disabled={state === "pending"}
        aria-expanded={state === "pending" ? undefined : open}
      >
        <span className="dc-step-mark" aria-hidden="true">
          {state === "done" ? <Check /> : running ? <span className="dc-spin" /> : index + 1}
        </span>
        <b>{step.title}</b>
        <span className="dc-step-sum">
          {state === "pending"
            ? "대기"
            : running
              ? step.key === "rag"
                ? "문서를 찾는 중…"
                : step.key === "verify"
                  ? "공개 범위를 검사하는 중…"
                  : "초안을 쓰는 중…"
              : step.summary}
        </span>
        <span className="dc-step-ms">{state === "done" ? sec(step.ms) : ""}</span>
        {state !== "pending" && <Chevron />}
      </button>
      {open && state !== "pending" && (
        <ul className="dc-details">
          {step.details.map((d, i) => (
            <li key={i} data-tone={d.tone}>
              <span>{d.label}</span>
              {d.meta && <em>{d.meta}</em>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const QUICK = ["더 짧게", "더 정중하게", "수치 언급은 빼고", "다음 안내 시점을 덧붙여서"];

function RegenModal({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);
  const submit = () => {
    if (text.trim()) onSubmit(text.trim());
  };
  return createPortal(
    <div
      className="dc-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="dc-modal" role="dialog" aria-modal="true" aria-labelledby="dc-regen-title">
        <h2 id="dc-regen-title">재생성 요청</h2>
        <p>초안을 어떻게 바꿀지 적어 주세요. 적은 내용이 피드백으로 함께 전달되어 새 초안을 만듭니다.</p>
        <label className="dc-field">
          <span>요청 내용</span>
          <textarea
            ref={ref}
            rows={4}
            value={text}
            maxLength={400}
            placeholder="예: 수치 언급 없이 더 짧게, 다음 안내 시점을 함께 적어 줘"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <div className="dc-quick" aria-label="자주 쓰는 요청">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setText((t) => (t.trim() ? `${t.trim()}, ${q}` : q))}>
              {q}
            </button>
          ))}
        </div>
        <div className="dc-modal-actions">
          <button type="button" className="dc-btn" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="dc-btn dc-btn-primary" onClick={submit} disabled={!text.trim()}>
            <Regen />
            재생성 요청
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 에이전트가 올린 답변 초안: 뒷단 단계 · 편집 · 재생성 · 바로 응답 */
export function DraftCard({ draft, readOnly }: { draft: DraftState; readOnly?: boolean }) {
  const { setDraftText, regenerateDraft, postReply } = useApp();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [asking, setAsking] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const regenBtn = useRef<HTMLButtonElement>(null);
  const phase = draft.phase;
  const text = draft.text;

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 320)}px`;
  }, [text]);

  const edited = text !== draft.original;
  const busy = phase !== "ready";
  const status =
    phase === "regenerating" ? "재생성 중" : phase === "posted" ? "응답함" : phase === "posting" ? "보내는 중" : "승인 대기";
  const where = draft.channel === "github" ? "이 이슈에 댓글로" : "이 대화로";
  const lastRequest = draft.requests[draft.requests.length - 1];

  return (
    <section className="dc-card" aria-label={`결재 ${draft.approvalId} 답변 초안`} aria-busy={phase === "regenerating"}>
      <header className="dc-head">
        <div>
          <span className="dc-kicker">
            결재 {draft.approvalId} · {draft.agent} 에이전트가 답변 초안을 올렸습니다
          </span>
          <h3>{phase === "posted" ? "이 답변으로 응답했습니다" : "이 초안으로 응답할까요?"}</h3>
        </div>
        <span className="dc-grade" data-grade={draft.audience} title="결재 대상 등급">
          {draft.audience}
        </span>
        <span className="dc-status" data-phase={phase}>
          {(phase === "regenerating" || phase === "posting") && <span className="dc-spin" />}
          {status}
        </span>
      </header>
      <div className="dc-pipeline">
        <div className="dc-pipeline-head">
          <span>뒷단에서 진행한 단계</span>
          {draft.round > 1 && <span className="dc-round">재생성 {draft.round - 1}회</span>}
        </div>
        <ol>
          {draft.steps.map((s, i) => (
            <Step
              key={s.key}
              step={s}
              index={i}
              state="done"
              open={!!open[s.key]}
              onToggle={() => setOpen((o) => ({ ...o, [s.key]: !o[s.key] }))}
            />
          ))}
        </ol>
        {lastRequest && (
          <p className="dc-request">
            <b>재생성 요청</b>
            <span>{lastRequest}</span>
          </p>
        )}
      </div>
      <div className="dc-draft">
        <div className="dc-draft-head">
          <label htmlFor={`dc-text-${draft.approvalId}`}>
            답변 초안{" "}
            <span>
              {phase === "posted"
                ? `${where} 보냈습니다`
                : phase === "regenerating"
                  ? "새 초안을 기다리는 중"
                  : readOnly
                    ? "게스트는 볼 수만 있어요"
                    : "바로 고쳐 쓸 수 있어요"}
            </span>
          </label>
          <span className="dc-count">
            {edited && phase !== "posted" && <b>수정함 · </b>}
            {text.length}자 · {draft.audience}로 나감
          </span>
        </div>
        <textarea
          id={`dc-text-${draft.approvalId}`}
          ref={textRef}
          value={text}
          onChange={(e) => setDraftText(draft.approvalId, e.target.value)}
          readOnly={busy || readOnly}
          data-waiting={phase === "regenerating" || undefined}
          rows={5}
          spellCheck={false}
        />
      </div>
      {phase === "posted" ? (
        <p className="dc-posted">
          <Check /> 응답했습니다 · <span>{draft.postedUrl}</span>
        </p>
      ) : (
        <div className="dc-actions">
          <button type="button" className="dc-btn" ref={regenBtn} onClick={() => setAsking(true)} disabled={busy || readOnly}>
            <Regen />
            재생성 요청
          </button>
          <button
            type="button"
            className="dc-btn dc-btn-primary"
            onClick={() => postReply(draft.approvalId)}
            disabled={busy || readOnly || !text.trim()}
          >
            {phase === "posting" ? <span className="dc-spin dc-spin-light" /> : <Send />}
            바로 응답
          </button>
        </div>
      )}
      {asking && (
        <RegenModal
          onCancel={() => {
            setAsking(false);
            regenBtn.current?.focus();
          }}
          onSubmit={(req) => {
            setAsking(false);
            regenerateDraft(draft.approvalId, req);
          }}
        />
      )}
    </section>
  );
}

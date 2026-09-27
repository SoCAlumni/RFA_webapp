"use client";

import { IconCheck } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { STAGES, useApp, type StageState } from "@/store/app-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const sec = (ms?: number | null) => (ms ? `${(ms / 1000).toFixed(1)}초` : "");

function elapsedText(ms: number) {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`;
}

type Cap = { id?: string; label?: string };
type Member = { agentId?: string; role?: string };

/** 단계마다 서버가 주는 세부(역량 칩 · 팀 구성 · 적용 결과) */
function StageDetail({ stage, detail }: { stage: string; detail: Record<string, unknown> }) {
  if (stage === "analyze") {
    const caps = (detail.capabilities as Cap[] | undefined) ?? [];
    if (!caps.length) return null;
    return (
      <div className="tp-chips">
        {caps.map((c, i) => (
          <span key={c.id ?? i}>{c.label ?? c.id}</span>
        ))}
      </div>
    );
  }
  if (stage === "design") {
    const members = (detail.members as Member[] | undefined) ?? [];
    return (
      <div className="tp-team">
        {typeof detail.supervisor === "string" && (
          <div>
            <b>{detail.supervisor}</b>
            <span>대표(supervisor)</span>
          </div>
        )}
        {members.map((m, i) => (
          <div key={m.agentId ?? i}>
            <b>{m.agentId}</b>
            <span>{m.role}</span>
          </div>
        ))}
        {typeof detail.sandbox === "string" && <em>{detail.sandbox} 샌드박스</em>}
      </div>
    );
  }
  if (stage === "spawn" && detail.agentsApply)
    return (
      <div className="tp-chips">
        <span>agents apply · {String(detail.agentsApply)}</span>
        {detail.seeded != null && <span>초기 자료 {String(detail.seeded)}건</span>}
      </div>
    );
  return null;
}

function Stage({ stageKey, label, index, state }: { stageKey: string; label: string; index: number; state: StageState }) {
  const mark =
    state.status === "done" ? (
      <IconCheck size={12} strokeWidth={3} />
    ) : state.status === "running" ? (
      <span className="dc-spin" />
    ) : state.status === "error" ? (
      "!"
    ) : (
      index + 1
    );
  return (
    <li className="dc-step tp-stage" data-state={state.status === "waiting" ? "pending" : state.status === "error" ? "error" : state.status}>
      <div className="dc-step-row" style={{ cursor: "default" }}>
        <span className="dc-step-mark" aria-hidden="true">
          {mark}
        </span>
        <b>{label}</b>
        <span className="dc-step-sum">
          {state.status === "waiting"
            ? "대기"
            : state.status === "running"
              ? "진행 중…"
              : state.status === "error"
                ? "실패"
                : "완료"}
        </span>
        <span className="dc-step-ms">{state.status === "done" ? sec(state.ms) : ""}</span>
        <span />
      </div>
      {(state.logs.length > 0 || state.detail) && (
        <div className="tp-body">
          {state.detail && <StageDetail stage={stageKey} detail={state.detail} />}
          {state.logs.length > 0 && (
            <ul className="cp-call-log">
              {state.logs.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** 태스크 추가 진행 화면(시안에 없어 새로 만든 화면). POST /tasks 스트림을 그대로 보여 준다 */
export function TaskProgress() {
  const router = useRouter();
  const { creation, closeCreation } = useApp();
  const [now, setNow] = useState(() => Date.now());
  const running = !!creation && !creation.done && !creation.error;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  // 다 만들면 새 에이전트와의 대화로 옮긴다
  const doneAgent = creation?.done?.agent.id;
  useEffect(() => {
    if (!doneAgent) return;
    const t = setTimeout(() => {
      router.push(`/chat/${doneAgent}`);
      closeCreation();
    }, 900);
    return () => clearTimeout(t);
  }, [doneAgent, router, closeCreation]);

  if (!creation?.open) return null;
  const c = creation;
  const status = c.done ? "만들었습니다" : c.error ? "만들지 못했습니다" : c.polling ? "연결이 끊겨 상태를 확인하는 중" : "만드는 중";

  return (
    <Modal label="태스크 만드는 중" className="rfa-dialog tp" onClose={closeCreation}>
      <div className="tp-head">
        <div>
          <span className="dc-kicker">태스크 추가 · {c.agentName}</span>
          <h2>
            「{c.name}」 {status}
          </h2>
        </div>
        <span className="dc-status" data-phase={c.done ? "posted" : c.error ? "error" : "running"}>
          {running && <span className="dc-spin" />}
          {elapsedText(Math.max(0, now - c.startedAt))}
        </span>
      </div>
      <p>
        요구사항을 분석해 팀을 설계하고 에이전트를 만듭니다. 에이전트 생성은 최대 5분 걸릴 수 있어요. 창을 닫아도 서버에서
        계속 만들고, 왼쪽 목록에 「만드는 중」으로 보입니다.
      </p>
      <div className="dc-pipeline">
        <ol>
          {STAGES.map((s, i) => (
            <Stage key={s.key} stageKey={s.key} label={s.label} index={i} state={c.stages[s.key]} />
          ))}
        </ol>
      </div>
      {c.error && (
        <p className="rfa-error" role="alert" style={{ marginTop: 12 }}>
          {c.error.message}
        </p>
      )}
      <div className="rfa-actions" style={{ marginTop: 14 }}>
        {c.done ? (
          <button
            type="button"
            className="rfa-btn rfa-btn-primary"
            data-autofocus
            onClick={() => {
              router.push(`/chat/${c.done!.agent.id}`);
              closeCreation();
            }}
          >
            {c.done.agent.name}와 대화
          </button>
        ) : (
          <button type="button" className="rfa-btn" data-autofocus onClick={closeCreation}>
            {c.error ? "닫기" : "창 닫기(계속 만듦)"}
          </button>
        )}
      </div>
    </Modal>
  );
}

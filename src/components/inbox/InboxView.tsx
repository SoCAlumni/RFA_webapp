"use client";

import { AgentIcon } from "@/components/icons";
import type { Task } from "@/lib/api/types";
import { useApp, useData } from "@/store/app-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApprovalView } from "./ApprovalView";
import { InboxList, filterItems, type ListView } from "./InboxList";

function EmptyDetail({ task, pastCount }: { task: Task; pastCount: number }) {
  return (
    <div className="empty-detail">
      <span className="empty-face" style={{ background: task.color.bg, color: task.color.fg }}>
        {task.custom ? (
          <b style={{ fontSize: 18 }}>{task.initials}</b>
        ) : (
          <AgentIcon name={task.icon} size={26} />
        )}
      </span>
      <h2>{task.label}</h2>
      <p>
        {task.agentName} · {task.agentShort}
      </p>
      <p className="empty-note">
        {pastCount
          ? `결재가 필요한 안건이 없습니다. 지난 안건 ${pastCount}건은 목록에서 볼 수 있어요.`
          : "아직 들어온 문의가 없습니다. 문의가 들어오면 답변 초안과 함께 여기에 올라옵니다."}
      </p>
      <Link className="rfa-btn" href={`/chat/${task.id}`}>
        에이전트와 대화
      </Link>
    </div>
  );
}

// 화면을 옮겨 다녀도 목록 보기 설정은 유지한다
let savedView: ListView = { tab: "all", grade: "all", newestFirst: true };

/** 결재함: 요청 목록 + 선택한 결재의 상세 */
export function InboxView({ scope, approvalId }: { scope: string; approvalId?: string }) {
  const router = useRouter();
  const { details, drafts, loadApproval, data } = useApp();
  const { inbox, tasks, session } = useData();
  const [view, setViewState] = useState<ListView>(savedView);
  const setView = (v: ListView) => {
    savedView = v;
    setViewState(v);
  };

  const task = tasks.find((t) => t.id === scope);
  const validScope = scope === "all" || !!task;

  useEffect(() => {
    if (!validScope) router.replace("/inbox");
  }, [validScope, router]);

  // 고른 결재가 없으면 목록에서 상세가 있는 첫 안건을 보여 준다
  const inScope = inbox.filter((i) => scope === "all" || i.taskId === scope);
  const visible = filterItems(inbox, scope, view);
  const selected =
    (approvalId && inbox.find((i) => i.approvalId === approvalId && i.hasDetail)) ||
    visible.find((i) => i.hasDetail) ||
    inScope.find((i) => i.hasDetail);
  const selectedId = selected?.approvalId;

  useEffect(() => {
    if (selectedId && !details[selectedId]) loadApproval(selectedId);
  }, [selectedId, details, loadApproval]);

  // 한 칸짜리(휴대폰) 화면에서 결재를 고르면 상세로 내려 준다
  useEffect(() => {
    if (approvalId && matchMedia("(max-width: 719px)").matches)
      document.querySelector(".detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [approvalId]);

  if (!validScope || !data) return null;

  const detail = selectedId ? details[selectedId] : undefined;
  const draft = selectedId ? drafts[selectedId] : undefined;

  return (
    <>
      <InboxList scope={scope} selectedId={selectedId} view={view} onView={setView} />
      <main className="detail" aria-label="결재 상세">
        {!selected && task ? (
          <EmptyDetail task={task} pastCount={inScope.length} />
        ) : !selected ? (
          <div className="loading">결재함이 비었습니다</div>
        ) : detail && draft ? (
          <ApprovalView detail={detail} draft={draft} readOnly={session.role !== "owner"} />
        ) : (
          <div className="loading">
            <span className="spin" aria-hidden="true" />
            결재 {selectedId}를 불러오는 중
          </div>
        )}
      </main>
    </>
  );
}

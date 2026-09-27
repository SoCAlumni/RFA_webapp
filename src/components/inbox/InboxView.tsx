"use client";

import { AgentIcon } from "@/components/icons";
import type { TaskView } from "@/lib/api/types";
import { useApp, useData } from "@/store/app-store";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApprovalView } from "./ApprovalView";
import { InboxList, filterItems, type ListView } from "./InboxList";
import { hasHangul } from "./parts";

function EmptyDetail({ task, pastCount }: { task?: TaskView; pastCount: number }) {
  if (!task)
    return (
      <div className="empty-detail">
        <h2>결재함이 비었습니다</h2>
        <p className="empty-note">문의가 들어오면 답변 초안과 함께 여기에 올라옵니다.</p>
      </div>
    );
  const text = task.icon === "generic" ? task.initials : null;
  return (
    <div className="empty-detail">
      <span className="empty-face" style={{ background: task.color.bg, color: task.color.fg }}>
        {text ? (
          <b style={{ fontSize: hasHangul(text) ? 15 : 18 }}>{text}</b>
        ) : (
          <AgentIcon name={task.icon} size={26} />
        )}
      </span>
      <h2>{task.name}</h2>
      <p>
        {task.agentName} · {task.desk}
      </p>
      <p className="empty-note">
        {task.status === "applying"
          ? "태스크를 만드는 중입니다. 다 만들어지면 문의를 받을 수 있어요."
          : pastCount
            ? `결재가 필요한 안건이 없습니다. 지난 안건 ${pastCount}건은 목록에서 볼 수 있어요.`
            : "아직 들어온 문의가 없습니다. 문의가 들어오면 답변 초안과 함께 여기에 올라옵니다."}
      </p>
      <Link className="rfa-btn" href={`/chat/${task.agentId}`}>
        에이전트와 대화
      </Link>
    </div>
  );
}

// 화면을 옮겨 다녀도 목록 보기 설정은 유지한다
let savedView: ListView = { tab: "all", grade: "all", newestFirst: true };

/** 결재함: 요청 목록 + 선택한 결재의 상세. scope = all | 태스크 id */
export function InboxView({ scope, itemId }: { scope: string; itemId?: string }) {
  const { details, loadItem } = useApp();
  const { inbox, tasks, me } = useData();
  const [view, setViewState] = useState<ListView>(savedView);
  const setView = (v: ListView) => {
    savedView = v;
    setViewState(v);
  };

  const task = tasks.find((t) => t.id === scope);
  const inScope = inbox.filter((i) => scope === "all" || i.task?.id === scope);
  const visible = filterItems(inbox, scope, view);
  // 고른 결재가 없으면 목록의 첫 안건을 보여 준다
  const selectedId = itemId ?? visible[0]?.id ?? inScope[0]?.id;
  const known = !!selectedId && (inbox.some((i) => i.id === selectedId) || !!details[selectedId]);

  useEffect(() => {
    if (selectedId) loadItem(selectedId, !itemId);
  }, [selectedId, itemId, loadItem]);

  // 한 칸짜리(휴대폰) 화면에서 결재를 고르면 상세로 내려 준다
  useEffect(() => {
    if (itemId && matchMedia("(max-width: 719px)").matches)
      document.querySelector(".detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [itemId]);

  const detail = selectedId ? details[selectedId] : undefined;

  return (
    <>
      <InboxList scope={scope} selectedId={selectedId} view={view} onView={setView} />
      <main className="detail" aria-label="결재 상세">
        {!selectedId ? (
          <EmptyDetail task={task} pastCount={inScope.length} />
        ) : detail ? (
          <ApprovalView detail={detail} readOnly={me.role !== "owner"} />
        ) : (
          <div className="loading">
            <span className="spin" aria-hidden="true" />
            {known ? "결재를 불러오는 중" : "결재를 찾는 중"}
          </div>
        )}
      </main>
    </>
  );
}

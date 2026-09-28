"use client";

import { AgentIcon, IconChat, IconFilter, IconSort } from "@/components/icons";
import type { InboxItem, SandboxLevel, TaskView } from "@/lib/api/types";
import { listTime } from "@/lib/format";
import { isAwaiting, useData } from "@/store/app-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BadgePill, RequesterAvatar } from "./parts";

export type ListTab = "all" | "awaiting" | "auto";

export interface ListView {
  tab: ListTab;
  grade: SandboxLevel | "all";
  newestFirst: boolean;
}

/** 결재함 목록은 서버가 최신순으로 준다. 태스크 · 탭 · 등급은 화면에서 거른다 */
export function filterItems(items: InboxItem[], scope: string, view: ListView) {
  const list = items.filter(
    (i) =>
      (scope === "all" || i.task?.id === scope) &&
      (view.tab === "all" || (view.tab === "awaiting" ? isAwaiting(i) : false)) &&
      (view.grade === "all" || i.grade === view.grade),
  );
  return view.newestFirst ? list : [...list].reverse();
}

/** 행이 가리키는 대화 상대: 담당 에이전트 → 태스크의 에이전트 → 비서 */
export function chatHref(item: Pick<InboxItem, "agent" | "task">, tasks: TaskView[]) {
  if (item.agent) return `/chat/${item.agent.id}`;
  const t = item.task && tasks.find((x) => x.id === item.task!.id);
  return t ? `/chat/${t.agentId}` : "/chat";
}

function AgentTag({ item }: { item: InboxItem }) {
  if (item.agent)
    return (
      <span className="rfa-agent-tag" title={`${item.agent.name} 담당`}>
        <i style={{ background: item.agent.color.bg, color: item.agent.color.fg }}>
          <AgentIcon name={item.agent.icon} size={9} stroke={2.6} />
        </i>
        {item.agent.desk}
      </span>
    );
  if (item.task)
    return (
      <span className="rfa-agent-tag" title={`${item.task.name} 태스크`} style={{ paddingLeft: 7 }}>
        {item.task.id}
      </span>
    );
  return null;
}

function Row({ item, scope, selected }: { item: InboxItem; scope: string; selected: boolean }) {
  const { tasks } = useData();
  const urgent = isAwaiting(item);
  const quiet = item.status === "closed" || item.status === "stalled";
  return (
    <div className="row">
      <Link
        href={`/inbox/${scope}/${item.id}`}
        className="row-link"
        aria-current={selected ? "page" : undefined}
        data-urgent={urgent || undefined}
        data-quiet={quiet || undefined}
      >
        <RequesterAvatar initials={item.requesterInitials} channel={item.channel} />
        <div className="row-text">
          <div className="row-who">
            <span>{item.requester}</span>
            {scope === "all" && <AgentTag item={item} />}
          </div>
          <div className="row-title">{item.title}</div>
          <div className="row-status">
            <span className="rfa-grade" data-grade={item.gradeLabel}>
              {item.gradeLabel}
            </span>
            {item.statusLine}
          </div>
        </div>
        <div className="row-side">
          <BadgePill badge={item.badge} />
          <span className="row-time">{listTime(item.arrivedAt ?? item.updatedAt)}</span>
        </div>
      </Link>
      <Link className="row-chat" href={chatHref(item, tasks)} aria-label="이 결재에 대해 대화">
        <IconChat size={14} />
        <span>대화</span>
      </Link>
    </div>
  );
}

export function InboxList({
  scope,
  selectedId,
  view,
  onView,
}: {
  scope: string;
  selectedId?: string;
  view: ListView;
  onView: (v: ListView) => void;
}) {
  const router = useRouter();
  const { inbox, summary, inboxError, tasks: sidebarTasks } = useData();
  const items = filterItems(inbox, scope, view);
  // 결재가 달린 태스크(사이드바에 없는 태스크 포함)로 거르기
  const taskOptions = [
    ...new Map(
      [
        ...inbox.filter((i) => i.task).map((i) => [i.task!.id, i.task!.name] as const),
        ...sidebarTasks.map((t) => [t.id, t.name] as const),
      ],
    ).entries(),
  ];
  const awaitingCount =
    scope === "all"
      ? (summary?.needsApproval ?? inbox.filter(isAwaiting).length)
      : (summary?.byTask[scope] ?? inbox.filter((i) => i.task?.id === scope && isAwaiting(i)).length);

  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const tabs: { id: ListTab; label: string }[] = [
    { id: "all", label: "전체" },
    { id: "awaiting", label: `결재 필요 ${awaitingCount}` },
    { id: "auto", label: summary?.autoReplied ? `자동응답 ${summary.autoReplied}` : "자동응답" },
  ];
  const grades: { id: ListView["grade"]; label: string }[] = [
    { id: "all", label: "모든 등급" },
    { id: "public", label: "사외만" },
    { id: "company", label: "사내만" },
  ];

  return (
    <section className="list" aria-label="요청 목록" data-scope={scope}>
      <div className="list-head">
        <div role="tablist" aria-label="보기" style={{ display: "contents" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className="list-tab"
              aria-selected={view.tab === t.id}
              onClick={() => onView({ ...view, tab: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ flexGrow: 1 }} />
        <button
          ref={btnRef}
          type="button"
          className="list-icon"
          aria-label={view.grade === "all" ? "필터" : `필터 · ${view.grade === "public" ? "사외" : "사내"}만`}
          title="태스크 · 등급으로 거르기"
          aria-haspopup="menu"
          aria-expanded={menu}
          style={view.grade !== "all" ? { color: "var(--accent)" } : undefined}
          onClick={() => setMenu((v) => !v)}
        >
          <IconFilter />
        </button>
        <button
          type="button"
          className="list-icon"
          aria-label={view.newestFirst ? "정렬 · 최근 것부터" : "정렬 · 오래된 것부터"}
          aria-pressed={!view.newestFirst}
          title={view.newestFirst ? "최근 것부터" : "오래된 것부터"}
          onClick={() => onView({ ...view, newestFirst: !view.newestFirst })}
        >
          <IconSort />
        </button>
        {menu && (
          <div ref={menuRef} className="list-menu" role="menu" aria-label="거르기">
            <div className="list-menu-head">태스크</div>
            {[["all", "모든 태스크"] as const, ...taskOptions].map(([id, name]) => {
              const n = id === "all" ? (summary?.needsApproval ?? 0) : (summary?.byTask[id] ?? 0);
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={scope === id}
                  onClick={() => {
                    setMenu(false);
                    router.push(id === "all" ? "/inbox" : `/inbox/${id}`);
                  }}
                >
                  <span>{name}</span>
                  {n > 0 && <em>{n}</em>}
                </button>
              );
            })}
            <div className="list-menu-head">결재 대상 등급</div>
            {grades.map((g) => (
              <button
                key={g.id}
                type="button"
                role="menuitemradio"
                aria-checked={view.grade === g.id}
                onClick={() => {
                  onView({ ...view, grade: g.id });
                  setMenu(false);
                }}
              >
                <span>{g.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((i) => (
          <Row key={i.id} item={i} scope={scope} selected={i.id === selectedId} />
        ))}
        {items.length === 0 && (
          <p className="list-empty">{inboxError ? `결재함을 불러오지 못했습니다: ${inboxError}` : "조건에 맞는 요청이 없습니다"}</p>
        )}
      </div>
    </section>
  );
}

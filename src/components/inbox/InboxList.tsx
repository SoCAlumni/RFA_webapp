"use client";

import { AgentIcon, IconChat, IconFilter, IconSort } from "@/components/icons";
import type { Grade, InboxItem, Task } from "@/lib/api/types";
import { isAwaiting, useData } from "@/store/app-store";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RequesterAvatar, StatePill } from "./parts";

export type ListTab = "all" | "awaiting" | "auto";

export interface ListView {
  tab: ListTab;
  grade: Grade | "all";
  newestFirst: boolean;
}

export function filterItems(items: InboxItem[], scope: string, view: ListView) {
  const list = items.filter(
    (i) =>
      (scope === "all" || i.taskId === scope) &&
      (view.tab === "all" || (view.tab === "awaiting" ? isAwaiting(i) : i.state === "auto")) &&
      (view.grade === "all" || i.grade === view.grade),
  );
  return view.newestFirst ? list : [...list].reverse();
}

function AgentTag({ task }: { task: Task }) {
  return (
    <span className="rfa-agent-tag" title={`${task.agentName} 담당`}>
      <i style={{ background: task.color.bg, color: task.color.fg }}>
        <AgentIcon name={task.icon} size={9} stroke={2.6} />
      </i>
      {task.agentShort}
    </span>
  );
}

function Row({
  item,
  scope,
  selected,
  task,
}: {
  item: InboxItem;
  scope: string;
  selected: boolean;
  task?: Task;
}) {
  const urgent = isAwaiting(item);
  const quiet = item.state === "auto" || item.state === "done";
  const href = item.hasDetail ? `/inbox/${scope}/${item.approvalId}` : `/inbox/${item.taskId}`;
  return (
    <div className="row">
      <Link
        href={href}
        className="row-link"
        aria-current={selected ? "page" : undefined}
        data-urgent={urgent || undefined}
        data-quiet={quiet || undefined}
      >
        <RequesterAvatar initials={item.initials} channel={item.channel} />
        <div className="row-text">
          <div className="row-who">
            <span>{item.requester}</span>
            {scope === "all" && task && <AgentTag task={task} />}
          </div>
          <div className="row-title">{item.title}</div>
          <div className="row-status">
            <span className="rfa-grade" data-grade={item.grade}>
              {item.grade}
            </span>
            {item.statusText}
          </div>
        </div>
        <div className="row-side">
          <StatePill state={item.state} />
          <span className="row-time">{item.time}</span>
        </div>
      </Link>
      <Link className="row-chat" href={`/chat/${item.taskId}`} aria-label="이 결재에 대해 대화">
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
  const { inbox, tasks } = useData();
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const items = filterItems(inbox, scope, view);
  const awaitingCount = inbox.filter((i) => (scope === "all" || i.taskId === scope) && isAwaiting(i)).length;

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
    { id: "auto", label: "자동응답" },
  ];
  const grades: { id: ListView["grade"]; label: string }[] = [
    { id: "all", label: "모든 등급" },
    { id: "사외", label: "사외만" },
    { id: "사내", label: "사내만" },
  ];

  return (
    <section className="list" aria-label="요청 목록" data-scope={scope}>
      <div className="list-head" style={{ position: "sticky" }}>
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
          aria-label={view.grade === "all" ? "필터" : `필터 · ${view.grade}만`}
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
          <div ref={menuRef} className="list-menu" role="menu" aria-label="결재 대상 등급">
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
          <Row
            key={i.key}
            item={i}
            scope={scope}
            selected={i.approvalId === selectedId}
            task={taskById.get(i.taskId)}
          />
        ))}
        {items.length === 0 && <p className="list-empty">조건에 맞는 요청이 없습니다</p>}
      </div>
    </section>
  );
}

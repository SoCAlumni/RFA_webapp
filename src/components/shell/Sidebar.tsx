"use client";

import { AgentIcon, IconChat, IconCube, IconInbox, IconPlus, IconRobot, IconSpark } from "@/components/icons";
import { useApp, useAwaitingCounts, useData } from "@/store/app-store";
import Link from "next/link";

export function Sidebar({
  mode,
  scope,
  onNavigate,
}: {
  mode: "chat" | "inbox";
  scope?: string;
  onNavigate: () => void;
}) {
  const { tasks, adminAgents, sandboxes, session } = useData();
  const { admin, openAdmin, requestAddTask } = useApp();
  const counts = useAwaitingCounts();
  const inboxMode = mode === "inbox";

  return (
    <nav className="nav" aria-label="주 메뉴" data-role={session.role}>
      <div className="nav-brand">
        <div className="nav-logo">R</div>
        <div className="nav-brand-name">RFA</div>
      </div>

      <Link
        href="/chat"
        className="nav-search"
        aria-label="검색하거나 물어보기"
        data-active={mode === "chat" || undefined}
        onClick={onNavigate}
      >
        <IconSpark style={{ flexShrink: 0 }} />
        <span>검색하거나 물어보기</span>
        <span className="nav-kbd">Ctrl K</span>
      </Link>

      <div className="nav-group">
        <div className="nav-label">태스크</div>
        <Link
          href="/inbox"
          className="nav-inbox"
          data-active={(inboxMode && scope === "all") || undefined}
          aria-current={inboxMode && scope === "all" ? "page" : undefined}
          onClick={onNavigate}
        >
          <span className="nav-circle" style={{ background: "#d9dce3", color: "#1a1d23" }}>
            <IconInbox />
          </span>
          <span style={{ flexGrow: 1 }}>결재함</span>
          <span className="nav-count">{counts.total}</span>
        </Link>

        {tasks.map((t) => {
          const n = counts.byTask[t.id] ?? 0;
          const active = inboxMode && scope === t.id;
          return (
            <div key={t.id} className="nav-task" data-active={active || undefined}>
              <Link href={`/inbox/${t.id}`} aria-current={active ? "page" : undefined} onClick={onNavigate}>
                <span className="nav-circle" style={{ background: t.color.bg, color: t.color.fg }}>
                  {t.custom ? (
                    <b style={{ fontSize: 11, fontWeight: 700 }}>{t.initials}</b>
                  ) : (
                    <AgentIcon name={t.icon} size={15} />
                  )}
                </span>
                <div className="nav-task-text">
                  <span>{t.label}</span>
                  <span>{t.agentShort}</span>
                </div>
                {n > 0 && <span className="nav-count">{n}</span>}
              </Link>
              <Link
                className="nav-task-chat"
                href={`/chat/${t.id}`}
                aria-label={`${t.label} 에이전트와 대화`}
                onClick={onNavigate}
              >
                <IconChat />
              </Link>
            </div>
          );
        })}

        <button
          type="button"
          className="nav-add"
          onClick={() => {
            onNavigate();
            requestAddTask();
          }}
        >
          <IconPlus style={{ flexShrink: 0 }} />
          <span>태스크&nbsp;추가</span>
        </button>
      </div>

      <div className="nav-grow" />

      <div className="nav-admin">
        <div className="nav-label">관리</div>
        <button
          type="button"
          data-active={(admin.open && admin.tab === "agents") || undefined}
          onClick={() => {
            onNavigate();
            openAdmin("agents");
          }}
        >
          <IconRobot style={{ flexShrink: 0 }} />
          <span>에이전트</span>
          <span className="nav-admin-count">{adminAgents.length}</span>
        </button>
        <button
          type="button"
          data-active={(admin.open && admin.tab === "sandbox") || undefined}
          onClick={() => {
            onNavigate();
            openAdmin("sandbox");
          }}
        >
          <IconCube style={{ flexShrink: 0 }} />
          <span>샌드박스</span>
          <span className="nav-admin-count">{sandboxes.length}</span>
        </button>
      </div>

      <div className="nav-user">
        <span className="nav-user-dot" />
        <div>
          <span>{session.userName}</span>
          <span>{session.role === "owner" ? "소유자 권한" : "게스트 · 볼 수만 있음"}</span>
        </div>
      </div>
    </nav>
  );
}

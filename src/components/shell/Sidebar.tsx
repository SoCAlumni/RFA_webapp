"use client";

import { AgentIcon, IconChat, IconCube, IconInbox, IconPlus, IconRobot, IconSpark } from "@/components/icons";
import { hasHangul } from "@/components/inbox/parts";
import type { TaskView } from "@/lib/api/types";
import { useApp, useAwaitingCounts, useData } from "@/store/app-store";
import Link from "next/link";

function TaskTile({ task }: { task: TaskView }) {
  const text = task.icon === "generic" ? task.initials : null;
  return (
    <span className="nav-circle" style={{ background: task.color.bg, color: task.color.fg }}>
      {text ? (
        <b style={{ fontSize: hasHangul(text) ? 10 : 11, fontWeight: 700, letterSpacing: "-0.03em" }}>{text}</b>
      ) : (
        <AgentIcon name={task.icon} size={15} />
      )}
    </span>
  );
}

export function Sidebar({
  mode,
  scope,
  onNavigate,
}: {
  mode: "chat" | "inbox";
  scope?: string;
  onNavigate: () => void;
}) {
  const { tasks, me } = useData();
  const { admin, openAdmin, requestAddTask, adminList, sandboxList, creation, reopenCreation } = useApp();
  const counts = useAwaitingCounts();
  const inboxMode = mode === "inbox";

  return (
    <nav className="nav" aria-label="주 메뉴" data-role={me.role}>
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
          const n = counts.byTask[t.id] ?? t.itemCount;
          const active = inboxMode && scope === t.id;
          const applyingNow = t.status === "applying";
          return (
            <div key={t.id} className="nav-task" data-active={active || undefined}>
              <Link href={`/inbox/${t.id}`} aria-current={active ? "page" : undefined} onClick={onNavigate}>
                <TaskTile task={t} />
                <div className="nav-task-text">
                  <span>{t.name}</span>
                  <span>{applyingNow ? "만드는 중…" : t.desk}</span>
                </div>
                {applyingNow ? (
                  <span className="spin" aria-label="만드는 중" style={{ width: 12, height: 12, color: "var(--accent)" }} />
                ) : (
                  n > 0 && <span className="nav-count">{n}</span>
                )}
              </Link>
              <Link
                className="nav-task-chat"
                href={`/chat/${t.agentId}`}
                aria-label={`${t.name} 에이전트와 대화`}
                onClick={onNavigate}
              >
                <IconChat />
              </Link>
            </div>
          );
        })}

        {creation && !creation.open ? (
          <button type="button" className="nav-add" onClick={reopenCreation}>
            <span className="spin" aria-hidden="true" style={{ width: 12, height: 12, flexShrink: 0 }} />
            <span>「{creation.name}」 만드는 중 · 보기</span>
          </button>
        ) : (
          <button
            type="button"
            className="nav-add"
            title={me.role === "owner" ? undefined : "소유자만 할 수 있어요"}
            onClick={() => {
              onNavigate();
              requestAddTask();
            }}
          >
            <IconPlus style={{ flexShrink: 0 }} />
            <span>태스크&nbsp;추가</span>
          </button>
        )}
      </div>

      <div className="nav-grow" />

      {me.isAdmin && (
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
            <span className="nav-admin-count">{adminList?.counts.total ?? ""}</span>
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
            <span className="nav-admin-count">{sandboxList?.sandboxes.length ?? ""}</span>
          </button>
        </div>
      )}

      <div className="nav-user">
        <span className="nav-user-dot" style={me.role === "owner" ? undefined : { background: "#aab0bc" }} />
        <div>
          <span>{me.name}</span>
          <span>{me.role === "owner" ? "소유자 권한" : "게스트 · 볼 수만 있음"}</span>
        </div>
      </div>
    </nav>
  );
}

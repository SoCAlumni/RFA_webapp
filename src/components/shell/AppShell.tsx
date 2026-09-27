"use client";

import { AdminModal } from "@/components/admin/AdminModal";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { Dialogs } from "@/components/dialogs/Dialogs";
import { TaskProgress } from "@/components/dialogs/TaskProgress";
import { IconBurger } from "@/components/icons";
import type { ChatStreamRequest, ConversationSummary, RefLink } from "@/lib/api/types";
import { useApp, useData } from "@/store/app-store";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";

function parseRoute(pathname: string) {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "chat") return { mode: "chat" as const, agentId: parts[1] };
  return { mode: "inbox" as const, scope: parts[1] ?? "all", approvalId: parts[2] };
}

function ChatHost({ agentId }: { agentId?: string }) {
  const router = useRouter();
  const { api, sandboxList } = useApp();
  const { agents, me, inbox, summary } = useData();
  const assistant = agents.find((a) => a.kind === "assistant") ?? agents[0];
  // 「맡은 안건 N건」은 결재함 요약의 태스크별 결재 필요 수
  const people = useMemo(
    () =>
      agents.map((a) =>
        a.kind === "task" && a.taskId && summary?.byTask[a.taskId] != null
          ? { ...a, itemCount: summary.byTask[a.taskId] }
          : a,
      ),
    [agents, summary],
  );
  const runQuery = useCallback(
    (req: ChatStreamRequest, signal: AbortSignal) => api.chat(req, signal),
    [api],
  );
  const loadConversation = useCallback((id: string) => api.getConversation(id), [api]);

  // 소유자의 저장된 대화: 대화 상대마다 GET /conversations?agentId= (게스트는 늘 빈 배열이라 묻지 않는다)
  const [remote, setRemote] = useState<ConversationSummary[] | undefined>(undefined);
  const ids = people.map((a) => a.id).join(",");
  useEffect(() => {
    if (me.role !== "owner") return;
    let alive = true;
    Promise.allSettled(ids.split(",").map((id) => api.listConversations(id))).then((all) => {
      if (!alive) return;
      setRemote(all.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
    });
    return () => {
      alive = false;
    };
  }, [api, ids, me.role]);

  const onSelectAgent = useCallback(
    (id: string) => {
      window.history.replaceState(null, "", id === assistant.id ? "/chat" : `/chat/${id}`);
    },
    [assistant.id],
  );
  const onRefClick = (r: RefLink) => {
    if (r.kind !== "approval") return;
    const item = inbox.find((i) => String(i.approvalId) === r.id || i.id === r.id);
    if (item) router.push(`/inbox/all/${item.id}`);
  };
  const provider = sandboxList?.sandboxes.find((s) => s.default)?.provider;
  return (
    <ChatWorkspace
      assistant={assistant}
      agents={people}
      remote={remote}
      loadConversation={loadConversation}
      selectedAgentId={agentId}
      onSelectAgent={onSelectAgent}
      runQuery={runQuery}
      suggestions={assistant.suggestions}
      disclosureNote={`대화 내용은 ${provider ?? "LLM API"}로 추론합니다. 답변은 등급 검사를 거쳐 나옵니다.`}
      role={me.role}
      onRefClick={onRefClick}
    />
  );
}

function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className="toast" role="status" data-tone={toast.tone}>
      {toast.text}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, loadError, reload } = useApp();
  const route = parseRoute(pathname);
  const isChat = route.mode === "chat";
  const [navOpen, setNavOpen] = useState(false);
  const [chatMounted, setChatMounted] = useState(isChat);
  if (isChat && !chatMounted) setChatMounted(true);

  // 좁은 화면의 메뉴 서랍
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    const mq = matchMedia("(min-width: 1180px)");
    const onMq = (e: MediaQueryListEvent) => e.matches && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [navOpen]);

  // Ctrl/⌘ K: 비서에게 물어보기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey) || e.isComposing) return;
      e.preventDefault();
      if (!window.location.pathname.startsWith("/chat")) router.push("/chat");
      setTimeout(() => {
        document.querySelector<HTMLTextAreaElement>(".chat-area .cw-pane:not([hidden]) [data-chat-input]")?.focus();
      }, 80);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <div className="app" data-chat={isChat || undefined} data-nav-open={navOpen || undefined}>
      <div className="topbar">
        <button
          type="button"
          className="burger"
          aria-label="메뉴 열기"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          <IconBurger />
        </button>
        <span className="brand-mini">
          <span>R</span>RFA
        </span>
      </div>
      {!data ? (
        <div className="loading" style={{ flex: 1 }}>
          {loadError ? (
            <>
              <span>불러오지 못했습니다: {loadError}</span>
              <button type="button" className="rfa-btn" onClick={reload}>
                다시 시도
              </button>
            </>
          ) : (
            <>
              <span className="spin" aria-hidden="true" />
              불러오는 중
            </>
          )}
        </div>
      ) : (
        <>
          <div className="app-grid">
            <Sidebar mode={route.mode} scope={route.scope} onNavigate={closeNav} />
            {chatMounted && (
              <div className="chat-area" hidden={!isChat}>
                <ChatHost agentId={route.agentId} />
              </div>
            )}
            {!isChat && children}
          </div>
          <div className="scrim" onClick={closeNav} />
          <AdminModal />
          <Dialogs />
          <TaskProgress />
        </>
      )}
      <Toast />
    </div>
  );
}

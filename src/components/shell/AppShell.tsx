"use client";

import { AdminModal } from "@/components/admin/AdminModal";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { Dialogs } from "@/components/dialogs/Dialogs";
import { IconBurger } from "@/components/icons";
import type { ChatRequest, RefLink } from "@/lib/api/types";
import { useApp, useData } from "@/store/app-store";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";

function parseRoute(pathname: string) {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "chat") return { mode: "chat" as const, agentId: parts[1] };
  return { mode: "inbox" as const, scope: parts[1] ?? "all", approvalId: parts[2] };
}

function ChatHost({ agentId }: { agentId?: string }) {
  const router = useRouter();
  const { api } = useApp();
  const { chatAgents, chatSeeds, session, inbox } = useData();
  const assistant = chatAgents.find((a) => a.kind === "assistant")!;
  const runQuery = useCallback(
    (req: ChatRequest, signal: AbortSignal) => api.streamChat(req, signal),
    [api],
  );
  const onSelectAgent = useCallback((id: string) => {
    window.history.replaceState(null, "", id === assistant.id ? "/chat" : `/chat/${id}`);
  }, [assistant.id]);
  const onRefClick = (r: RefLink) => {
    if (r.kind !== "approval") return;
    const item = inbox.find((i) => i.approvalId === r.id);
    if (item) router.push(item.hasDetail ? `/inbox/all/${item.approvalId}` : `/inbox/${item.taskId}`);
  };
  return (
    <ChatWorkspace
      assistant={assistant}
      agents={chatAgents}
      seed={chatSeeds}
      selectedAgentId={agentId}
      onSelectAgent={onSelectAgent}
      runQuery={runQuery}
      suggestions={assistant.suggestions}
      disclosureNote={session.disclosureNote}
      role={session.role}
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
        </>
      )}
      <Toast />
    </div>
  );
}

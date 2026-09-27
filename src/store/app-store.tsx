"use client";

import { ApiError, getApi } from "@/lib/api";
import type {
  AdminAgent,
  ApprovalDetail,
  ChatAgent,
  ChatSeed,
  DraftState,
  InboxItem,
  NewSourceInput,
  NewTaskInput,
  Sandbox,
  SandboxOptions,
  SandboxSettings,
  Session,
  Source,
  Task,
} from "@/lib/api/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type AdminTab = "agents" | "sandbox";
export type DialogName = "addTask" | "ownerOnly" | "addSandbox" | null;

export interface Toast {
  id: number;
  text: string;
  tone?: "error";
}

interface Data {
  session: Session;
  tasks: Task[];
  chatAgents: ChatAgent[];
  inbox: InboxItem[];
  adminAgents: AdminAgent[];
  sandboxes: Sandbox[];
  sandboxOptions: SandboxOptions;
  chatSeeds: ChatSeed[];
}

export const isAwaiting = (i: InboxItem) => i.state === "pending" || i.state === "blocked";

const errorText = (e: unknown) =>
  e instanceof ApiError || e instanceof Error ? e.message : String(e);

function useAppState() {
  const api = getApi();
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ApprovalDetail>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [sources, setSources] = useState<Record<string, Source[]>>({});
  const [admin, setAdmin] = useState<{
    open: boolean;
    tab: AdminTab;
    agentId: string;
    sandboxId: string;
  }>({ open: false, tab: "agents", agentId: "infer-opt", sandboxId: "team" });
  const [dialog, setDialog] = useState<DialogName>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastSeq = useRef(0);

  const notify = useCallback((text: string, tone?: "error") => {
    const id = ++toastSeq.current;
    setToast({ id, text, tone });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3200);
  }, []);
  const fail = useCallback((e: unknown) => notify(errorText(e), "error"), [notify]);

  /* ---------- 처음 불러오기 ---------- */

  const load = useCallback(() => {
    Promise.all([
      api.getSession(),
      api.listTasks(),
      api.listChatAgents(),
      api.listInbox(),
      api.listAdminAgents(),
      api.listSandboxes(),
      api.getSandboxOptions(),
      api.listChatSeeds(),
    ]).then(
      ([session, tasks, chatAgents, inbox, adminAgents, sandboxes, sandboxOptions, chatSeeds]) =>
        setData({ session, tasks, chatAgents, inbox, adminAgents, sandboxes, sandboxOptions, chatSeeds }),
      (e) => setLoadError(errorText(e)),
    );
  }, [api]);

  useEffect(load, [load]);

  const patch = useCallback((fn: (d: Data) => Partial<Data>) => {
    setData((d) => (d ? { ...d, ...fn(d) } : d));
  }, []);

  const refreshAgents = useCallback(async () => {
    const chatAgents = await api.listChatAgents();
    patch(() => ({ chatAgents }));
  }, [api, patch]);

  /* ---------- 결재 ---------- */

  const loadApproval = useCallback(
    async (approvalId: string) => {
      try {
        const d = await api.getApproval(approvalId);
        setDetails((m) => ({ ...m, [approvalId]: d }));
        setDrafts((m) => (m[approvalId] ? m : { ...m, [approvalId]: d.draft }));
        return d;
      } catch (e) {
        fail(e);
        return null;
      }
    },
    [api, fail],
  );

  const setDraftText = useCallback((approvalId: string, text: string) => {
    setDrafts((m) => (m[approvalId] ? { ...m, [approvalId]: { ...m[approvalId], text } } : m));
  }, []);

  const setDraftPhase = (approvalId: string, phase: DraftState["phase"]) =>
    setDrafts((m) => ({ ...m, [approvalId]: { ...m[approvalId], phase } }));

  const regenerateDraft = useCallback(
    async (approvalId: string, request: string) => {
      setDraftPhase(approvalId, "regenerating");
      setDrafts((m) => ({
        ...m,
        [approvalId]: { ...m[approvalId], requests: [...m[approvalId].requests, request] },
      }));
      try {
        const next = await api.regenerateDraft(approvalId, request);
        setDrafts((m) => ({ ...m, [approvalId]: next }));
      } catch (e) {
        setDrafts((m) => ({
          ...m,
          [approvalId]: {
            ...m[approvalId],
            phase: "ready",
            requests: m[approvalId].requests.slice(0, -1),
          },
        }));
        fail(e);
      }
    },
    [api, fail],
  );

  const postReply = useCallback(
    async (approvalId: string) => {
      const draft = drafts[approvalId];
      if (!draft) return;
      setDraftPhase(approvalId, "posting");
      try {
        const { item, draft: posted } = await api.postReply(approvalId, draft.text);
        setDrafts((m) => ({ ...m, [approvalId]: posted }));
        setDetails((m) => (m[approvalId] ? { ...m, [approvalId]: { ...m[approvalId], item } } : m));
        patch((d) => ({ inbox: d.inbox.map((i) => (i.approvalId === approvalId ? item : i)) }));
        refreshAgents().catch(() => {});
      } catch (e) {
        setDraftPhase(approvalId, "ready");
        fail(e);
      }
    },
    [api, drafts, fail, patch, refreshAgents],
  );

  /* ---------- 태스크 ---------- */

  const createTask = useCallback(
    async (input: NewTaskInput) => {
      const created = await api.createTask(input);
      const sandboxes = await api.listSandboxes().catch(() => null);
      patch((d) => ({
        tasks: [...d.tasks, created.task],
        chatAgents: [...d.chatAgents, created.agent],
        adminAgents: [...d.adminAgents, created.adminAgent],
        ...(sandboxes ? { sandboxes } : {}),
      }));
      return created;
    },
    [api, patch],
  );

  /* ---------- 소스 ---------- */

  const loadSources = useCallback(
    async (taskId: string) => {
      try {
        const list = await api.listSources(taskId);
        setSources((m) => ({ ...m, [taskId]: list }));
      } catch (e) {
        fail(e);
      }
    },
    [api, fail],
  );

  // 연결 중인 소스가 있으면 상태가 바뀔 때까지 다시 묻는다
  useEffect(() => {
    const pending = Object.entries(sources)
      .filter(([, list]) => list.some((s) => s.status === "connecting"))
      .map(([id]) => id);
    if (!pending.length) return;
    const t = setTimeout(() => pending.forEach((id) => loadSources(id)), 600);
    return () => clearTimeout(t);
  }, [sources, loadSources]);

  const addSource = useCallback(
    async (taskId: string, input: NewSourceInput) => {
      const s = await api.addSource(taskId, input);
      setSources((m) => ({ ...m, [taskId]: [...(m[taskId] ?? []), s] }));
    },
    [api],
  );

  const removeSource = useCallback(
    async (taskId: string, sourceId: string) => {
      const before = sources[taskId];
      setSources((m) => ({ ...m, [taskId]: (m[taskId] ?? []).filter((s) => s.id !== sourceId) }));
      try {
        await api.removeSource(taskId, sourceId);
      } catch (e) {
        setSources((m) => ({ ...m, [taskId]: before }));
        fail(e);
      }
    },
    [api, fail, sources],
  );

  /* ---------- 관리 ---------- */

  const replaceAdminAgent = (a: AdminAgent) =>
    patch((d) => ({ adminAgents: d.adminAgents.map((x) => (x.id === a.id ? a : x)) }));

  const compactContext = useCallback(
    async (id: string) => {
      try {
        replaceAdminAgent(await api.compactContext(id));
        notify("대화 기록을 압축했습니다");
      } catch (e) {
        fail(e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, fail, notify],
  );

  const clearMemory = useCallback(
    async (id: string) => {
      try {
        replaceAdminAgent(await api.clearMemory(id));
        notify("기억과 노트를 비웠습니다");
      } catch (e) {
        fail(e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, fail, notify],
  );

  const updateSystemPrompt = useCallback(
    async (id: string, prompt: string) => {
      replaceAdminAgent(await api.updateSystemPrompt(id, prompt));
      notify("시스템 프롬프트를 저장했습니다");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, notify],
  );

  const updateSandbox = useCallback(
    async (id: string, settings: SandboxSettings) => {
      try {
        const s = await api.updateSandbox(id, settings);
        patch((d) => ({ sandboxes: d.sandboxes.map((x) => (x.id === id ? s : x)) }));
        notify("샌드박스 설정을 적용했습니다");
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    },
    [api, fail, notify, patch],
  );

  const openAdmin = useCallback(
    (tab: AdminTab, select?: string) =>
      setAdmin((a) => ({
        ...a,
        open: true,
        tab,
        ...(select ? (tab === "agents" ? { agentId: select } : { sandboxId: select }) : {}),
      })),
    [],
  );
  const closeAdmin = useCallback(() => setAdmin((a) => ({ ...a, open: false })), []);
  const selectAdminAgent = useCallback((agentId: string) => setAdmin((a) => ({ ...a, agentId })), []);
  const selectSandbox = useCallback((sandboxId: string) => setAdmin((a) => ({ ...a, sandboxId })), []);

  /** 태스크 추가: 게스트면 권한 안내를 띄운다 */
  const requestAddTask = useCallback(() => {
    setDialog(data?.session.role === "owner" ? "addTask" : "ownerOnly");
  }, [data?.session.role]);

  return {
    api,
    data,
    loadError,
    reload: () => {
      setLoadError(null);
      load();
    },
    details,
    drafts,
    sources,
    admin,
    dialog,
    toast,
    notify,
    loadApproval,
    setDraftText,
    regenerateDraft,
    postReply,
    createTask,
    loadSources,
    addSource,
    removeSource,
    compactContext,
    clearMemory,
    updateSystemPrompt,
    updateSandbox,
    openAdmin,
    closeAdmin,
    selectAdminAgent,
    selectSandbox,
    setDialog,
    requestAddTask,
  };
}

export type AppStore = ReturnType<typeof useAppState>;

const Ctx = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const store = useAppState();
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useApp(): AppStore {
  const s = useContext(Ctx);
  if (!s) throw new Error("AppStoreProvider 안에서만 쓸 수 있습니다");
  return s;
}

/** 불러온 데이터(로딩이 끝난 뒤에만 쓰는 곳) */
export function useData(): Data {
  const { data } = useApp();
  if (!data) throw new Error("데이터를 아직 불러오지 않았습니다");
  return data;
}

/** 태스크별 결재 대기 수 */
export function useAwaitingCounts() {
  const { data } = useApp();
  return useMemo(() => {
    const byTask: Record<string, number> = {};
    let total = 0;
    for (const i of data?.inbox ?? [])
      if (isAwaiting(i)) {
        byTask[i.taskId] = (byTask[i.taskId] ?? 0) + 1;
        total++;
      }
    return { total, byTask };
  }, [data?.inbox]);
}

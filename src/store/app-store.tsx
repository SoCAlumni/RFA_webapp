"use client";

import { ApiError, errorText, getApi } from "@/lib/api";
import type {
  AdminAgentDetail,
  AdminAgentList,
  AgentView,
  InboxDetail,
  InboxItem,
  InboxSummary,
  Me,
  SandboxDetail,
  SandboxList,
  SandboxPatch,
  SourceIn,
  SourceOut,
  TaskCreateRequest,
  TaskEvent,
  TaskStageKey,
  TaskView,
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
export type DialogName = "addTask" | "ownerOnly" | "sandboxLimit" | null;

export interface Toast {
  id: number;
  text: string;
  tone?: "error";
}

interface Data {
  me: Me;
  tasks: TaskView[];
  agents: AgentView[];
  inbox: InboxItem[];
  summary: InboxSummary | null;
  /** 결재함을 못 불러왔을 때(결재 서버가 꺼졌을 때 등) */
  inboxError: string | null;
}

export type StageState = {
  status: "waiting" | "running" | "done" | "error";
  ms?: number | null;
  logs: string[];
  detail?: Record<string, unknown> | null;
};

/** 태스크 추가 진행 화면 */
export interface Creation {
  name: string;
  agentName: string;
  taskId?: string;
  startedAt: number;
  stages: Record<TaskStageKey, StageState>;
  error?: { stage?: TaskStageKey | null; code: string; message: string };
  done?: { task: TaskView; agent: AgentView };
  /** 스트림이 끊겨 GET /tasks/{id} 로 확인 중 */
  polling?: boolean;
  open: boolean;
}

export const STAGES: { key: TaskStageKey; label: string }[] = [
  { key: "analyze", label: "요구사항 분석" },
  { key: "design", label: "팀 설계" },
  { key: "spawn", label: "에이전트 생성" },
];

/** 결재 대기로 셀 상태 */
export const isAwaiting = (i: Pick<InboxItem, "status">) => i.status === "pending";
/** 서버에서 바뀌는 중이라 다시 물어야 하는 상태 */
const TRANSIENT = new Set<string>(["drafting", "regenerating", "posting"]);

const INBOX_POLL_MS = 15_000;
const DETAIL_POLL_MS = 3_000;
const TASK_POLL_MS = 5_000;
const TASK_POLL_LIMIT_MS = 6 * 60_000;

const omit = <T,>(m: Record<string, T>, key: string) => {
  const next = { ...m };
  delete next[key];
  return next;
};

function useAppState() {
  const api = getApi();
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, InboxDetail>>({});
  /** 화면에서 고친 초안(item id → 글). 서버 초안과 다르면 「수정함」 */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busyItems, setBusyItems] = useState<Record<string, "respond" | "regenerate">>({});
  /** 결재 쓰기가 거절된 까닭(초안 카드 안에 보여 준다) */
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [sources, setSources] = useState<Record<string, SourceOut[]>>({});
  const [adminList, setAdminList] = useState<AdminAgentList | null>(null);
  const [adminDetails, setAdminDetails] = useState<Record<string, AdminAgentDetail>>({});
  const [sandboxList, setSandboxList] = useState<SandboxList | null>(null);
  const [sandboxDetails, setSandboxDetails] = useState<Record<string, SandboxDetail>>({});
  const [admin, setAdmin] = useState<{
    open: boolean;
    tab: AdminTab;
    agentId?: string;
    sandboxId?: string;
    /** 「이 샌드박스의 에이전트 N개 보기」로 좁힌 목록 */
    filter?: { label: string; ids: string[] };
  }>({ open: false, tab: "agents" });
  const [dialog, setDialog] = useState<DialogName>(null);
  const [creation, setCreation] = useState<Creation | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastSeq = useRef(0);

  const notify = useCallback((text: string, tone?: "error") => {
    const id = ++toastSeq.current;
    setToast({ id, text, tone });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), tone ? 5200 : 3200);
  }, []);
  const fail = useCallback((e: unknown) => notify(errorText(e), "error"), [notify]);

  const patch = useCallback((fn: (d: Data) => Partial<Data>) => {
    setData((d) => (d ? { ...d, ...fn(d) } : d));
  }, []);

  /* ---------- 처음 불러오기 ---------- */

  const loadInbox = useCallback(async () => {
    const [inbox, summary] = await Promise.allSettled([api.listInbox(), api.getInboxSummary()]);
    patch(() => ({
      ...(inbox.status === "fulfilled" ? { inbox: inbox.value } : {}),
      ...(summary.status === "fulfilled" ? { summary: summary.value } : {}),
      inboxError: inbox.status === "rejected" ? errorText(inbox.reason) : null,
    }));
  }, [api, patch]);

  const loadAdmin = useCallback(async () => {
    const [agents, sandboxes] = await Promise.allSettled([api.listAdminAgents(), api.listSandboxes()]);
    if (agents.status === "fulfilled") setAdminList(agents.value);
    if (sandboxes.status === "fulfilled") setSandboxList(sandboxes.value);
  }, [api]);

  const load = useCallback(() => {
    Promise.all([api.getMe(), api.listTasks(), api.listAgents()]).then(
      async ([me, tasks, agents]) => {
        const [inbox, summary] = await Promise.allSettled([api.listInbox(), api.getInboxSummary()]);
        setData({
          me,
          tasks,
          agents,
          inbox: inbox.status === "fulfilled" ? inbox.value : [],
          summary: summary.status === "fulfilled" ? summary.value : null,
          inboxError: inbox.status === "rejected" ? errorText(inbox.reason) : null,
        });
        if (me.isAdmin) loadAdmin();
      },
      (e) => setLoadError(errorText(e)),
    );
  }, [api, loadAdmin]);

  useEffect(load, [load]);

  const refreshDirectory = useCallback(async () => {
    const [tasks, agents] = await Promise.all([api.listTasks(), api.listAgents()]);
    patch(() => ({ tasks, agents }));
  }, [api, patch]);

  // 결재함은 desk 가 새 결재를 올리므로 주기적으로 다시 묻는다
  const ready = data !== null;
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") loadInbox().catch(() => {});
    }, INBOX_POLL_MS);
    return () => clearInterval(t);
  }, [ready, loadInbox]);

  /* ---------- 결재 ---------- */

  const syncRow = useCallback(
    (d: InboxDetail) =>
      patch((prev) => ({
        inbox: prev.inbox.map((i) => (i.id === d.id ? { ...i, ...d, injection: !!d.injection } : i)),
      })),
    [patch],
  );

  const loadItem = useCallback(
    async (itemId: string, quiet = false) => {
      try {
        const d = await api.getInboxItem(itemId);
        setDetails((m) => ({ ...m, [itemId]: d }));
        syncRow(d);
        return d;
      } catch (e) {
        if (!quiet) fail(e);
        return null;
      }
    },
    [api, fail, syncRow],
  );

  // 작성 중 · 재생성 중 · 보내는 중이면 끝날 때까지 다시 묻는다
  const watching = useMemo(
    () =>
      Object.values(details)
        .filter((d) => TRANSIENT.has(d.status) || TRANSIENT.has(d.draft.phase))
        .map((d) => d.id)
        .join(","),
    [details],
  );
  useEffect(() => {
    if (!watching) return;
    const t = setTimeout(() => {
      watching.split(",").forEach((id) => loadItem(id, true));
      loadInbox().catch(() => {});
    }, DETAIL_POLL_MS);
    return () => clearTimeout(t);
  }, [watching, details, loadItem, loadInbox]);

  const setDraftText = useCallback((itemId: string, text: string) => {
    setEdits((m) => ({ ...m, [itemId]: text }));
    setItemErrors((m) => (m[itemId] ? omit(m, itemId) : m));
  }, []);

  const afterItemChange = useCallback(
    (d: InboxDetail) => {
      setDetails((m) => ({ ...m, [d.id]: d }));
      setEdits((m) => omit(m, d.id));
      syncRow(d);
      loadInbox().catch(() => {});
      refreshDirectory().catch(() => {});
    },
    [loadInbox, syncRow, refreshDirectory],
  );

  const respond = useCallback(
    async (itemId: string) => {
      const d = details[itemId];
      if (!d) return;
      const text = edits[itemId] ?? d.draft.text;
      setBusyItems((m) => ({ ...m, [itemId]: "respond" }));
      setItemErrors((m) => omit(m, itemId));
      try {
        const next = await api.respond(itemId, text);
        afterItemChange(next);
        notify(next.status === "posted" ? "응답했습니다" : "승인했습니다. 게시를 기다리는 중입니다");
      } catch (e) {
        setItemErrors((m) => ({ ...m, [itemId]: errorText(e) }));
        fail(e);
        loadItem(itemId, true);
      } finally {
        setBusyItems((m) => omit(m, itemId));
      }
    },
    [api, details, edits, afterItemChange, fail, loadItem, notify],
  );

  const regenerate = useCallback(
    async (itemId: string, request: string) => {
      setBusyItems((m) => ({ ...m, [itemId]: "regenerate" }));
      setItemErrors((m) => omit(m, itemId));
      try {
        afterItemChange(await api.regenerate(itemId, request));
      } catch (e) {
        setItemErrors((m) => ({ ...m, [itemId]: errorText(e) }));
        fail(e);
        loadItem(itemId, true);
      } finally {
        setBusyItems((m) => omit(m, itemId));
      }
    },
    [api, afterItemChange, fail, loadItem],
  );

  /* ---------- 태스크 추가 (SSE) ---------- */

  const creating = useRef<AbortController | null>(null);

  const pollTask = useCallback(
    async (taskId: string, since: number) => {
      setCreation((c) => (c ? { ...c, polling: true } : c));
      for (;;) {
        if (Date.now() - since > TASK_POLL_LIMIT_MS) {
          setCreation((c) =>
            c ? { ...c, polling: false, error: { code: "timeout", message: "생성 상태를 확인할 수 없습니다." } } : c,
          );
          return;
        }
        try {
          const t = await api.getTask(taskId);
          if (t.status === "ready") {
            const [tasks, agents] = await Promise.all([api.listTasks(), api.listAgents()]);
            patch(() => ({ tasks, agents }));
            const agent = agents.find((a) => a.id === t.agentId);
            setCreation((c) => (c ? { ...c, polling: false, done: agent ? { task: t, agent } : undefined } : c));
            return;
          }
          if (t.status === "failed") {
            setCreation((c) =>
              c ? { ...c, polling: false, error: { code: "failed", message: t.error || "태스크를 만들지 못했습니다." } } : c,
            );
            return;
          }
        } catch {
          /* 잠깐 끊겼을 수 있다 — 다음에 다시 */
        }
        await new Promise((r) => setTimeout(r, TASK_POLL_MS));
      }
    },
    [api, patch],
  );

  const applyTaskEvent = useCallback((ev: TaskEvent) => {
    setCreation((c) => {
      if (!c) return c;
      switch (ev.type) {
        case "task.start":
          return { ...c, taskId: ev.data.taskId, name: ev.data.name, agentName: ev.data.agentName };
        case "task.stage": {
          const s = c.stages[ev.data.stage];
          if (!s) return c;
          return {
            ...c,
            stages: {
              ...c.stages,
              [ev.data.stage]: { ...s, status: ev.data.status, ms: ev.data.ms ?? s.ms, detail: ev.data.detail ?? s.detail },
            },
          };
        }
        case "task.log": {
          const s = c.stages[ev.data.stage];
          if (!s) return c;
          return { ...c, stages: { ...c.stages, [ev.data.stage]: { ...s, logs: [...s.logs, ev.data.text] } } };
        }
        case "task.done":
          return { ...c, done: { task: ev.data.task, agent: ev.data.agent } };
        case "task.error": {
          const stage = ev.data.stage ?? undefined;
          return {
            ...c,
            error: { stage, code: ev.data.code, message: ev.data.message },
            stages: stage && c.stages[stage] ? { ...c.stages, [stage]: { ...c.stages[stage], status: "error" } } : c.stages,
          };
        }
        default:
          return c;
      }
    });
  }, []);

  /** 스트림 전 거절(403 · 409 · 422 · 503)은 던져서 대화상자가 보여 주게 한다 */
  const createTask = useCallback(
    async (req: TaskCreateRequest) => {
      const ac = new AbortController();
      const iterator = api.createTask(req, ac.signal)[Symbol.asyncIterator]();
      const first = await iterator.next();
      creating.current = ac;
      const started = Date.now();
      const blank = (): StageState => ({ status: "waiting", logs: [] });
      setCreation({
        name: req.name,
        agentName: req.agentName || `${req.name} 대응 에이전트`,
        startedAt: started,
        stages: { analyze: blank(), design: blank(), spawn: blank() },
        open: true,
      });
      refreshDirectory().catch(() => {});

      void (async () => {
        let taskId: string | undefined;
        let finished = false;
        try {
          let step = first;
          while (!step.done) {
            const ev = step.value;
            if (ev.type === "task.start") taskId = ev.data.taskId;
            if (ev.type === "task.done" || ev.type === "task.error") finished = true;
            applyTaskEvent(ev);
            if (ev.type === "task.done") {
              const { task, agent } = ev.data;
              patch((d) => ({
                tasks: d.tasks.some((t) => t.id === task.id)
                  ? d.tasks.map((t) => (t.id === task.id ? task : t))
                  : [...d.tasks, task],
                agents: d.agents.some((a) => a.id === agent.id)
                  ? d.agents.map((a) => (a.id === agent.id ? agent : a))
                  : [...d.agents, agent],
              }));
              refreshDirectory().catch(() => {});
              loadAdmin();
            }
            step = await iterator.next();
          }
        } catch {
          /* 연결이 끊김 — 아래에서 상태를 확인한다 */
        } finally {
          creating.current = null;
        }
        if (finished) return;
        if (taskId) pollTask(taskId, started);
        else
          setCreation((c) =>
            c ? { ...c, error: { code: "disconnected", message: "연결이 끊겼습니다. 다시 시도해 주세요." } } : c,
          );
      })();
    },
    [api, applyTaskEvent, loadAdmin, patch, pollTask, refreshDirectory],
  );

  /** 진행 화면 닫기. 진행 중이면 생성은 계속되고 사이드바에 「만드는 중」으로 보인다 */
  const closeCreation = useCallback(() => {
    setCreation((c) => (c && !c.done && !c.error ? { ...c, open: false } : null));
  }, []);
  const reopenCreation = useCallback(() => setCreation((c) => (c ? { ...c, open: true } : c)), []);

  // applying 으로 남은 태스크가 있으면(다른 탭에서 만들었거나 새로고침) 목록을 다시 묻는다
  const applying = data?.tasks.some((t) => t.status === "applying") ?? false;
  useEffect(() => {
    if (!applying) return;
    const t = setInterval(() => {
      if (!creating.current) refreshDirectory().catch(() => {});
    }, TASK_POLL_MS);
    return () => clearInterval(t);
  }, [applying, refreshDirectory]);

  /**
   * 태스크 삭제(만든 태스크만). 팀 에이전트를 샌드박스에서 내리느라 수십 초 걸릴 수 있어 호출한 쪽이 로딩을 건다.
   * 결재·대화 기록은 서버에 남는다. 열린 화면을 옮기는 일은 호출한 쪽이 한다
   */
  const deleteTask = useCallback(
    async (taskId: string) => {
      try {
        const r = await api.deleteTask(taskId);
        const gone = new Set([taskId, ...r.agents]);
        patch((d) => ({
          tasks: d.tasks.filter((t) => t.id !== taskId),
          agents: d.agents.filter((a) => a.id !== taskId && a.taskId !== taskId),
        }));
        setSources((m) => omit(m, taskId));
        setAdminList((l) => (l ? { ...l, agents: l.agents.filter((a) => !gone.has(a.id)) } : l));
        setAdminDetails((m) => Object.fromEntries(Object.entries(m).filter(([id]) => !gone.has(id))));
        setAdmin((a) => (a.agentId && gone.has(a.agentId) ? { ...a, agentId: undefined } : a));
        // agentsApply error: 선언은 지워졌지만 샌드박스에 에이전트가 남았다 — 경고로 알린다
        notify(r.message, r.agentsApply === "error" ? "error" : undefined);
        refreshDirectory().catch(() => {});
        loadAdmin();
        loadInbox().catch(() => {});
        return r;
      } catch (e) {
        fail(e);
        return null;
      }
    },
    [api, fail, loadAdmin, loadInbox, notify, patch, refreshDirectory],
  );

  /* ---------- 소스 ---------- */

  const loadSources = useCallback(
    async (taskId: string) => {
      try {
        const list = await api.listSources(taskId);
        setSources((m) => ({ ...m, [taskId]: list }));
      } catch (e) {
        setSources((m) => ({ ...m, [taskId]: [] }));
        if (!(e instanceof ApiError && e.code === "unknown_task")) fail(e);
      }
    },
    [api, fail],
  );

  const addSource = useCallback(
    async (taskId: string, input: SourceIn) => {
      const s = await api.addSource(taskId, input);
      setSources((m) => ({ ...m, [taskId]: [...(m[taskId] ?? []), s] }));
    },
    [api],
  );

  const removeSource = useCallback(
    async (taskId: string, sourceId: string) => {
      try {
        await api.removeSource(taskId, sourceId);
        setSources((m) => ({ ...m, [taskId]: (m[taskId] ?? []).filter((s) => s.id !== sourceId) }));
      } catch (e) {
        fail(e);
      }
    },
    [api, fail],
  );

  /* ---------- 관리 · 에이전트 ---------- */

  const loadAdminAgent = useCallback(
    async (id: string) => {
      try {
        const d = await api.getAdminAgent(id);
        setAdminDetails((m) => ({ ...m, [id]: d }));
      } catch (e) {
        fail(e);
      }
    },
    [api, fail],
  );

  /** 샌드박스 명령이라 수 초~수십 초 걸린다. 호출한 쪽이 로딩을 건다 */
  const agentAction = useCallback(
    async (id: string, action: "compact" | "clear-memory") => {
      try {
        const r = action === "compact" ? await api.compact(id) : await api.clearMemory(id);
        notify(r.note);
        await loadAdminAgent(id);
      } catch (e) {
        fail(e);
      }
    },
    [api, fail, loadAdminAgent, notify],
  );

  const toggleLoadedSource = useCallback(
    async (id: string, sourceId: string, enabled: boolean) => {
      try {
        const r = await api.toggleSource(id, sourceId, enabled);
        setAdminDetails((m) => (m[id] ? { ...m, [id]: { ...m[id], sources: r.sources } } : m));
        notify(r.note);
      } catch (e) {
        fail(e);
      }
    },
    [api, fail, notify],
  );

  /* ---------- 관리 · 샌드박스 ---------- */

  const loadSandbox = useCallback(
    async (id: string) => {
      try {
        const d = await api.getSandbox(id);
        setSandboxDetails((m) => ({ ...m, [id]: d }));
      } catch (e) {
        fail(e);
      }
    },
    [api, fail],
  );

  const updateSandbox = useCallback(
    async (id: string, p: SandboxPatch) => {
      try {
        const r = await api.updateSandbox(id, p);
        setSandboxDetails((m) => ({ ...m, [id]: r.sandbox }));
        const parts = [
          r.applied.length ? `바로 적용됨: ${r.applied.join(", ")}` : "",
          r.requiresRecreate.length ? `다시 만들 때 적용: ${r.requiresRecreate.join(", ")}` : "",
        ].filter(Boolean);
        notify(parts.join(" · ") || "바뀐 설정이 없습니다");
        loadAdmin();
        return true;
      } catch (e) {
        fail(e);
        loadSandbox(id); // 422 뒤에는 반드시 다시 조회(FE_API_GUIDE §5.3)
        return false;
      }
    },
    [api, fail, loadAdmin, loadSandbox, notify],
  );

  // 관리 창이 열려 있으면 상태(서버가 60초마다 갱신)를 가끔 다시 묻는다
  useEffect(() => {
    if (!admin.open) return;
    const t = setInterval(loadAdmin, 45_000);
    return () => clearInterval(t);
  }, [admin.open, loadAdmin]);

  const openAdmin = useCallback(
    (tab: AdminTab, select?: string, filter?: { label: string; ids: string[] }) => {
      setAdmin((a) => ({
        ...a,
        open: true,
        tab,
        filter: tab === "agents" ? filter : a.filter,
        ...(select ? (tab === "agents" ? { agentId: select } : { sandboxId: select }) : {}),
      }));
      loadAdmin();
    },
    [loadAdmin],
  );
  const closeAdmin = useCallback(() => setAdmin((a) => ({ ...a, open: false, filter: undefined })), []);
  const selectAdminAgent = useCallback((agentId: string) => setAdmin((a) => ({ ...a, agentId })), []);
  const selectSandbox = useCallback((sandboxId: string) => setAdmin((a) => ({ ...a, sandboxId })), []);
  const clearAgentFilter = useCallback(() => setAdmin((a) => ({ ...a, filter: undefined })), []);

  /** 태스크 추가: 게스트면 권한 안내 */
  const requestAddTask = useCallback(() => {
    setDialog(data?.me.role === "owner" ? "addTask" : "ownerOnly");
  }, [data?.me.role]);

  return {
    api,
    data,
    loadError,
    reload: () => {
      setLoadError(null);
      load();
    },
    details,
    edits,
    busyItems,
    itemErrors,
    sources,
    adminList,
    adminDetails,
    sandboxList,
    sandboxDetails,
    admin,
    dialog,
    creation,
    toast,
    notify,
    fail,
    loadInbox,
    loadItem,
    setDraftText,
    respond,
    regenerate,
    createTask,
    closeCreation,
    reopenCreation,
    deleteTask,
    refreshDirectory,
    loadSources,
    addSource,
    removeSource,
    loadAdminAgent,
    agentAction,
    toggleLoadedSource,
    loadSandbox,
    updateSandbox,
    openAdmin,
    closeAdmin,
    selectAdminAgent,
    selectSandbox,
    clearAgentFilter,
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

/** 결재 필요 수: 서버 요약(전체 · 태스크별)을 쓰고, 없으면 목록에서 센다 */
export function useAwaitingCounts() {
  const { data } = useApp();
  const inbox = data?.inbox;
  const summary = data?.summary;
  return useMemo(() => {
    if (summary) return { total: summary.needsApproval, byTask: summary.byTask };
    const byTask: Record<string, number> = {};
    let total = 0;
    for (const i of inbox ?? [])
      if (isAwaiting(i)) {
        if (i.task) byTask[i.task.id] = (byTask[i.task.id] ?? 0) + 1;
        total++;
      }
    return { total, byTask };
  }, [inbox, summary]);
}

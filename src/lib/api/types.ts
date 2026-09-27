/**
 * rfa_mas 프런트 API 타입.
 * 원본: rfa_mas `docs/openapi.yaml` (서버 `GET /openapi.json`), 화면 대응: `docs/FE_API_GUIDE.md`.
 * 서버 JSON 을 그대로 받는 타입(…View, …Item 등)과, 화면이 쓰는 정규화 타입(ChatMessage 등)을 나눈다.
 * 시각은 서버가 unix 초로 준다. 화면 쪽 정규화 타입만 밀리초를 쓴다(표기해 둠).
 */

export type Role = "owner" | "guest";

export type IconName =
  | "star"
  | "train"
  | "bolt"
  | "robot"
  | "chip"
  | "github"
  | "research"
  | "slack"
  | "mail"
  | "shield"
  | "generic";

export interface Color {
  bg: string;
  fg: string;
}

/** 오류 본문 `{code, message}` 또는 FastAPI 형식 `{detail: [{msg}]}` */
export interface ErrorOut {
  code: string;
  message: string;
}

/* ---------------- 앱 시작 ---------------- */

export interface Me {
  authenticated: boolean;
  role: Role;
  isAdmin: boolean;
  name: string;
}

export type TaskStatus = "ready" | "applying" | "failed";

export interface TaskView {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  desk: string;
  icon: IconName;
  color: Color;
  initials: string;
  itemCount: number;
  status: TaskStatus;
  error?: string | null;
  source?: "catalog" | "team";
  worker?: string | null;
  sandbox?: string | null;
  securityLabel?: string;
}

export type AgentStatus = "running" | "waiting_decision" | "stopped" | "applying";

export interface AgentView {
  id: string;
  name: string;
  kind: "assistant" | "task";
  icon: IconName;
  color: Color;
  initials: string;
  description: string;
  taskId?: string | null;
  taskName?: string | null;
  desk?: string | null;
  status: AgentStatus;
  itemCount: number;
  tags: string[];
  suggestions?: string[];
}

/* ---------------- 태스크 추가 (SSE) ---------------- */

export interface TaskCreateRequest {
  name: string;
  agentName?: string | null;
  description?: string | null;
  tags?: string[];
}

export type TaskStageKey = "analyze" | "design" | "spawn";
export type StageStatus = "running" | "done" | "error";

export type TaskEvent =
  | { type: "task.start"; data: { taskId: string; name: string; agentName: string } }
  | {
      type: "task.stage";
      data: { stage: TaskStageKey; status: StageStatus; ms?: number | null; detail?: Record<string, unknown> | null };
    }
  | { type: "task.log"; data: { stage: TaskStageKey; text: string } }
  | { type: "task.done"; data: { task: TaskView; agent: AgentView; ms?: number } }
  | {
      type: "task.error";
      data: { stage?: TaskStageKey | null; code: string; message: string; detail?: unknown };
    };

/* ---------------- 비서 대화 ---------------- */

export type SandboxLevel = "public" | "company";

export interface Candidate {
  agentId: string;
  reason?: string;
  score?: number;
}

export interface RefLink {
  kind: string;
  id: string;
  label: string;
  status?: string;
}

export type CallStatus = "running" | "ok" | "none" | "blocked" | "error";
export type GuardStatus = "running" | "pass" | "redacted" | "blocked";
export type TurnStatus = "streaming" | "done" | "stopped" | "error";
export type TurnPhase = "understand" | "search" | "delegate" | "guard" | "answer" | "idle";

/** SSE 봉투: `data: {type, runId, seq, ts, data}` */
export interface SseEnvelope<T = unknown> {
  type: string;
  runId: string;
  seq: number;
  ts: number;
  data: T;
}

/** 채팅 이벤트(봉투의 data 를 펼친 것). 순서는 FE_API_GUIDE §2.3 */
export type ChatEvent =
  | {
      type: "run.start";
      runId: string;
      conversationId?: string | null;
      messageId?: string;
      role?: Role;
      agentId?: string | null;
      level?: SandboxLevel;
      requestId?: string;
      /** 밀리초 */
      ts: number;
    }
  | { type: "assistant.delta"; text: string }
  | { type: "agents.search"; query: string; candidates: Candidate[] }
  | {
      type: "agents.select";
      selected: { agentId: string; task: string }[];
      skipped: { agentId: string; reason?: string }[];
    }
  | { type: "delegate.start"; callId: string; agentId: string; task: string }
  | { type: "delegate.log"; callId: string; text: string }
  | {
      type: "delegate.end";
      callId: string;
      status: CallStatus;
      summary?: string;
      refs?: RefLink[];
      durationMs?: number;
    }
  | { type: "guard.start"; level: SandboxLevel }
  | { type: "guard.end"; status: GuardStatus; note?: string; redactions?: number }
  | { type: "answer.delta"; text: string }
  | {
      type: "run.end";
      status: TurnStatus;
      durationMs?: number;
      messageId?: string;
      error?: string | null;
      code?: string;
    };

export interface DelegateCall {
  callId: string;
  agentId: string;
  task: string;
  status: CallStatus;
  logs: string[];
  refs: RefLink[];
  summary?: string;
  durationMs?: number;
}

/** 화면용 메시지. ts 는 밀리초 */
export interface UserMessage {
  id: string;
  role: "user";
  text: string;
  ts: number;
}

export interface AssistantTurn {
  id: string;
  role: "assistant";
  status: TurnStatus;
  phase: TurnPhase;
  preface: string;
  calls: DelegateCall[];
  answer: string;
  ts: number;
  runId?: string;
  level?: SandboxLevel;
  search?: { query: string; candidates: Candidate[] };
  selection?: {
    selected: { agentId: string; task: string }[];
    skipped: { agentId: string; reason?: string }[];
  };
  guard?: { level: SandboxLevel; status: GuardStatus; note?: string; redactions?: number };
  durationMs?: number;
  error?: string;
  code?: string;
}

export type ChatMessage = UserMessage | AssistantTurn;

export interface HistoryItem {
  role: "user" | "assistant";
  text: string;
}

/** `POST /chat` 본문 */
export interface ChatStreamRequest {
  text: string;
  role: Role;
  conversationId?: string;
  agentId?: string;
  /** guest 만. ≤50개, 각 ≤8000자 */
  history?: HistoryItem[];
}

/** `GET /conversations` 항목. 서버 JSON 그대로(초) */
export interface ConversationSummary {
  id: string;
  agentId: string;
  title: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  busy: boolean;
  count: number;
  persisted: boolean;
}

/** 서버가 저장한 메시지(비서 턴은 SSE 리듀서가 만드는 턴과 같은 모양, null 가능) */
export interface ServerChatMessage {
  id: string;
  role: "user" | "assistant";
  ts: number;
  text?: string | null;
  status?: string | null;
  phase?: string | null;
  preface?: string | null;
  search?: { query: string; candidates: Candidate[] } | null;
  selection?: AssistantTurn["selection"] | null;
  calls?: DelegateCall[] | null;
  guard?: AssistantTurn["guard"] | null;
  answer?: string | null;
  runId?: string | null;
  durationMs?: number | null;
  error?: string | null;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ServerChatMessage[];
}

/* ---------------- 결재함 ---------------- */

export type InboxStatus =
  | "drafting"
  | "stalled"
  | "pending"
  | "regenerating"
  | "posting"
  | "publish_failed"
  | "posted"
  | "closed";

export type BadgeTone = "info" | "warn" | "danger" | "ok" | "muted";

export interface Badge {
  label: string;
  tone: BadgeTone;
}

export interface InboxTask {
  id: string;
  name: string;
}

export interface InboxAgent {
  id: string;
  name: string;
  desk: string;
  icon: IconName;
  color: Color;
  initials: string;
}

export interface InboxItem {
  id: string;
  approvalId: number | null;
  sourceUrl: string;
  channel: "github" | "slack" | string;
  channelLabel: string;
  target: string | null;
  requester: string;
  requesterInitials: string;
  title: string;
  grade: SandboxLevel;
  gradeLabel: string;
  gradeSource: "source" | "channel";
  status: InboxStatus;
  badge: Badge;
  statusLine: string;
  round: number;
  task: InboxTask | null;
  agent: InboxAgent | null;
  injection: boolean;
  arrivedAt: number | null;
  updatedAt: number | null;
}

export interface InboxSummary {
  needsApproval: number;
  byTask: Record<string, number>;
  byStatus: Record<string, number>;
  autoReplied: number;
  total: number;
}

export interface ThreadMessage {
  author: string;
  text: string;
  at: number | null;
  isRequest?: boolean;
}

export interface GithubSource {
  kind: "github";
  url: string;
  repo?: string;
  number?: number;
  issueUrl?: string;
  title?: string;
  body?: string;
  author?: string;
  comments?: ThreadMessage[];
}

export interface SlackSource {
  kind: "slack";
  url: string;
  channelId?: string;
  threadTs?: string;
  dm?: boolean;
  messages?: ThreadMessage[];
}

export type SourceView = GithubSource | SlackSource;

export interface InjectionSentence {
  where: string;
  text: string;
}

export interface InjectionView {
  sentences: InjectionSentence[];
  note: string;
}

export type DraftPhase =
  | "drafting"
  | "stalled"
  | "ready"
  | "regenerating"
  | "posting"
  | "publish_failed"
  | "posted"
  | "closed";

export interface Regeneration {
  request: string | null;
  at: number | null;
  draft: string | null;
}

export interface DraftView {
  text: string;
  chars: number;
  round: number;
  phase: DraftPhase;
  regenerations: Regeneration[];
  lastRequest: string | null;
  postedUrl: string | null;
  publishError: string | null;
  canRespond: boolean;
  canRegenerate: boolean;
  regenerationsLeft: number;
  closesOnRegenerate: boolean;
}

export type Tone = "ok" | "warn" | "block";

export interface StepDetail {
  label: string;
  meta: string;
  tone?: Tone;
}

export interface Step {
  key: "rag" | "verify" | "draft";
  title: string;
  state: "pending" | "running" | "done" | "error" | "skipped";
  ms: number | null;
  summary: string;
  details: StepDetail[];
}

export interface BlockedAttempt {
  at: number | null;
  kind: string | null;
  action: string;
  reason: string;
}

export interface ApprovalEvent {
  at: number | null;
  who: string | null;
  what: string | null;
  detail: string | null;
}

export interface InboxDetail extends Omit<InboxItem, "injection"> {
  injection: InjectionView | null;
  question: string;
  source: SourceView;
  refusal: string | null;
  draft: DraftView;
  steps: Step[];
  stepsRecorded: boolean;
  blockedAttempts: BlockedAttempt[];
  events: ApprovalEvent[];
}

/* ---------------- 소스(문의가 들어오는 곳) ---------------- */

export type SourceKind = "github" | "slack";

export interface SourceIn {
  kind: SourceKind;
  target: string;
  scopes: string[];
  grade: SandboxLevel;
}

export interface SourceOut {
  id: string;
  taskId: string;
  kind: SourceKind;
  kindLabel: string;
  target: string;
  scopes: string[];
  grade: SandboxLevel;
  gradeLabel: string;
  status: "connected";
  createdAt: number;
  requestCount: number;
  lastRequestAt: number | null;
}

/* ---------------- 관리 · 에이전트 ---------------- */

export interface TaskRef {
  id: string;
  name: string;
}

export type AdminStatus = "running" | "stopped" | "applying";

export interface AdminAgent {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  group: "task" | "management";
  role: "task" | "supervisor" | "member" | "assistant" | "censor";
  parentId?: string | null;
  tasks: TaskRef[];
  sandbox: string | null;
  sandboxLine: string;
  securityLabel: string;
  status: AdminStatus;
  observed: boolean;
  callsToday: number;
  icon: IconName;
  color: Color;
  initials: string;
  editable: boolean;
  readOnlyReason?: string | null;
}

export interface AdminAgentList {
  agents: AdminAgent[];
  counts: { total: number; task: number; management: number };
  observedAt: number | null;
  hint: string;
}

export interface ContextUsage {
  usedTokens: number;
  limitTokens: number;
  measured: boolean;
  measuredAt: number | null;
  compaction?: string;
  preserveRecentTurns?: number;
  breakdown: {
    systemPrompt: number;
    toolDefinitions: number;
    memoryNotes: number;
    conversation: number;
  };
}

export interface LoadedSource {
  id: string;
  title: string;
  description?: string;
  enabled: boolean;
  available: boolean;
  unavailableReason?: string | null;
}

export interface CallStats {
  provider: string;
  model: string;
  calls: number;
  tokens: number;
  tokensThousands: number;
  avgLatencySeconds: number;
  blockedCalls: number;
  last7Days: { day: string; calls: number }[];
}

export interface AgentActions {
  compact: boolean;
  clearMemory: boolean;
  editPrompt: boolean;
  toggleSources: boolean;
}

export interface AdminAgentDetail extends AdminAgent {
  description: string;
  alias?: string | null;
  skill?: string | null;
  groups: string[];
  tools: Record<string, unknown>;
  model: string;
  context: ContextUsage | null;
  sources: LoadedSource[];
  stats: CallStats;
  instructions: string;
  instructionsUpdatedAt: number | null;
  actions: AgentActions;
}

export interface AgentActionResult {
  agentId: string;
  action: "compact" | "clear-memory";
  applied: boolean;
  removedSessions?: number | null;
  note: string;
}

export interface PromptView {
  agentId: string;
  identity: string;
  skill: string | null;
  skillText: string;
  instructions: string;
  instructionsUpdatedAt: number | null;
}

export interface PromptUpdateResult extends PromptView {
  applied: boolean;
  note: string;
}

export interface SourceToggleResult {
  sources: LoadedSource[];
  applied: boolean;
  note: string;
}

/* ---------------- 관리 · 샌드박스 ---------------- */

export interface SandboxItem {
  id: string;
  name: string;
  default: boolean;
  groups: string[];
  privilege: number;
  securityLabel: string;
  status: "running" | "stopped" | "unknown";
  observed: boolean;
  agentCount: number;
  tasks: TaskRef[];
  provider: string;
  model: string;
  gatewayPort: number | null;
}

export interface SandboxList {
  sandboxes: SandboxItem[];
  limit: number;
  canAdd: boolean;
  limitMessage: string;
  observedAt: number | null;
}

export interface ProviderOption {
  provider: string;
  label: string;
  selectable: boolean;
  reason?: string | null;
  models: string[];
}

export interface InferenceSettings {
  provider: string;
  providerLabel: string;
  model: string;
  providerOptions: ProviderOption[];
  contextLength: number;
  maxOutputTokens: number;
  contextLengthChoices: number[];
  maxOutputChoices: number[];
  pendingRecreate: string[];
}

export interface GatewayInfo {
  id: string;
  label: string;
  url: string | null;
  port: number | null;
  registeredProvider: string;
  hasKey: boolean;
  sandboxModel?: string | null;
  sandboxProvider?: string | null;
  currentRoute: string;
  sharedWith: string[];
}

export interface SecurityGroupView {
  id: string;
  privilege: number;
  description: string;
  presets: string[];
  mcpServers: string[];
}

export interface SandboxDetail extends SandboxItem {
  agentsManifest: string;
  agents: { id: string; kind: string }[];
  securityGroups: SecurityGroupView[];
  inference: InferenceSettings;
  gateway: GatewayInfo;
  applyNote: string;
}

export interface SandboxPatch {
  provider?: string;
  model?: string;
  contextLength?: number;
  maxOutputTokens?: number;
}

export interface SandboxUpdateResult {
  sandboxId: string;
  applied: string[];
  requiresRecreate: string[];
  sandbox: SandboxDetail;
}

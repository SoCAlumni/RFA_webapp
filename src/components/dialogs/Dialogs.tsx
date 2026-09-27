"use client";

import { Modal } from "@/components/Modal";
import { ApiError } from "@/lib/api";
import { useApp } from "@/store/app-store";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

function InfoDialog({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <Modal label={title} className="rfa-dialog rfa-dialog-sm" onClose={onClose}>
      <h2>{title === "권한 필요" ? "소유자만 할 수 있어요" : title}</h2>
      <p>{text}</p>
      <div className="rfa-actions">
        <button type="button" className="rfa-btn rfa-btn-primary" data-autofocus onClick={onClose}>
          확인
        </button>
      </div>
    </Modal>
  );
}

function AddTaskDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { createTask, closeAdmin } = useApp();
  const [task, setTask] = useState("");
  const [agent, setAgent] = useState("");
  const [agentTouched, setAgentTouched] = useState(false);
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const taskRef = useRef<HTMLInputElement>(null);
  const agentRef = useRef<HTMLInputElement>(null);
  const tagRef = useRef<HTMLInputElement>(null);

  const addTags = (raw: string, base = tags) => {
    const next = [...base];
    for (const t of raw
      .split(",")
      .map((s) => s.trim().replace(/^#/, ""))
      .filter(Boolean))
      if (!next.includes(t) && next.length < 8) next.push(t);
    setTags(next);
    return next;
  };

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if ((e.key === "Enter" || e.key === ",") && tagText.trim()) {
      e.preventDefault();
      addTags(tagText);
      setTagText("");
    } else if (e.key === "Backspace" && !tagText && tags.length) {
      setTags(tags.slice(0, -1));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let allTags = tags;
    if (tagText.trim()) {
      allTags = addTags(tagText);
      setTagText("");
    }
    const t = task.trim();
    const a = agent.trim();
    if (!t) {
      setError("태스크명을 적어 주세요.");
      taskRef.current?.focus();
      return;
    }
    if (!a) {
      setError("에이전트 이름을 적어 주세요.");
      agentRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const created = await createTask({ task: t, agent: a, description: desc, tags: allTags });
      onClose();
      closeAdmin();
      router.push(`/chat/${created.task.id}`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : String(err));
      agentRef.current?.focus();
      setSaving(false);
    }
  };

  return (
    <Modal label="태스크 추가" className="rfa-dialog" onClose={onClose}>
      <h2>태스크 추가</h2>
      <p>
        태스크와 에이전트는 1:1로 만들어집니다. 사내·사외 등급은 태스크가 아니라 들어오는 결재 대상마다 매겨집니다.
      </p>
      <form noValidate onSubmit={submit}>
        <label className="rfa-field">
          <span>태스크명</span>
          <input
            ref={taskRef}
            name="task"
            required
            maxLength={30}
            placeholder="예: Jira 이슈"
            data-autofocus
            value={task}
            onChange={(e) => {
              setTask(e.target.value);
              if (!agentTouched) setAgent(e.target.value.trim() ? `${e.target.value.trim()} 대응 에이전트` : "");
            }}
          />
        </label>
        <label className="rfa-field">
          <span>에이전트 이름</span>
          <input
            ref={agentRef}
            name="agent"
            required
            maxLength={40}
            placeholder="예: Jira 이슈 대응 에이전트"
            value={agent}
            onChange={(e) => {
              setAgent(e.target.value);
              setAgentTouched(e.target.value.trim() !== "");
            }}
          />
        </label>
        <label className="rfa-field">
          <span>설명</span>
          <textarea
            name="desc"
            rows={3}
            maxLength={200}
            placeholder="이 에이전트가 무엇을 읽고 어떻게 답하는지"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </label>
        <div className="rfa-field">
          <label htmlFor="rfa-tag-input">태그</label>
          <div className="rfa-tags" onClick={() => tagRef.current?.focus()}>
            {tags.map((t, i) => (
              <span key={t} className="rfa-chip">
                #{t}
                <button
                  type="button"
                  aria-label={`${t} 태그 빼기`}
                  onClick={() => {
                    setTags(tags.filter((_, j) => j !== i));
                    tagRef.current?.focus();
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              id="rfa-tag-input"
              ref={tagRef}
              placeholder="입력 후 Enter"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              onKeyDown={onTagKey}
            />
          </div>
          <small className="rfa-hint">질의에 태그가 들어가면 비서가 이 에이전트를 찾습니다.</small>
        </div>
        {error && (
          <p className="rfa-error" role="alert">
            {error}
          </p>
        )}
        <div className="rfa-actions">
          <button type="button" className="rfa-btn" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="rfa-btn rfa-btn-primary" disabled={saving}>
            {saving ? "만드는 중" : "만들기"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Dialogs() {
  const { dialog, setDialog } = useApp();
  const close = () => setDialog(null);
  if (dialog === "addTask") return <AddTaskDialog onClose={close} />;
  if (dialog === "ownerOnly")
    return (
      <InfoDialog
        title="권한 필요"
        text="게스트는 태스크와 에이전트를 추가할 수 없습니다. 소유자에게 요청하세요."
        onClose={close}
      />
    );
  if (dialog === "addSandbox")
    return (
      <InfoDialog
        title="샌드박스 추가"
        text="샌드박스는 많은 양의 메모리를 요구합니다. 현재 데모에서는 2개까지만 제공드립니다."
        onClose={close}
      />
    );
  return null;
}

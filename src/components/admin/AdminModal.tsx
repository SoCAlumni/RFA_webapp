"use client";

import { IconClose } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { useApp, useData } from "@/store/app-store";
import { AgentsPanel } from "./AgentsPanel";
import { SandboxPanel } from "./SandboxPanel";

/** 관리 팝업: 에이전트 · 샌드박스. 조회는 누구나, 쓰기는 owner(서버도 403) */
export function AdminModal() {
  const { admin, closeAdmin } = useApp();
  const { me } = useData();
  if (!admin.open) return null;
  const guest = me.role !== "owner";
  const label = admin.tab === "sandbox" ? "샌드박스 관리" : "에이전트 관리";
  return (
    <Modal label={label} className="rfa-admin" onClose={closeAdmin} guest={guest}>
      <div className="rfa-admin-bar">
        <b>관리 · {admin.tab === "sandbox" ? "샌드박스" : "에이전트"}</b>
        {guest && <span className="rfa-guest-note">게스트 권한으로 보는 중 · 바꿀 수 없습니다</span>}
        <span className="grow" />
        <button type="button" className="rfa-x" aria-label="닫기" onClick={closeAdmin}>
          <IconClose />
        </button>
      </div>
      {admin.tab === "sandbox" ? <SandboxPanel /> : <AgentsPanel />}
    </Modal>
  );
}

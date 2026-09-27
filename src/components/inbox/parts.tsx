import { AgentIcon } from "@/components/icons";
import type { Channel, Color, ItemState } from "@/lib/api/types";

export const CHANNEL_COLOR: Record<Channel, Color> = {
  github: { bg: "#d6e2fb", fg: "#1c3a8a" },
  slack: { bg: "#f6e3c5", fg: "#6b4200" },
  mail: { bg: "#f5d9e6", fg: "#7a1f4d" },
};

const CHANNEL_ICON = { github: "github", slack: "slack", mail: "mail" } as const;

export const hasHangul = (s: string) => /[가-힣]/.test(s);

/** 요청자 아바타 + 들어온 채널 배지 */
export function RequesterAvatar({
  initials,
  channel,
  color = CHANNEL_COLOR[channel],
}: {
  initials: string;
  channel: Channel;
  color?: Color;
}) {
  return (
    <div className="avatar">
      <div
        className="avatar-face"
        data-hangul={hasHangul(initials) || undefined}
        style={{ background: color.bg, color: color.fg }}
      >
        {initials}
      </div>
      <div className="avatar-badge" style={{ background: color.fg }}>
        <AgentIcon name={CHANNEL_ICON[channel]} size={10} stroke={3} />
      </div>
    </div>
  );
}

const PILL: Record<ItemState, { label: string; tone: string }> = {
  pending: { label: "결재 필요", tone: "warn" },
  blocked: { label: "차단됨", tone: "block" },
  auto: { label: "자동응답", tone: "ok" },
  done: { label: "결재 완료", tone: "mute" },
  responded: { label: "응답 완료", tone: "mute" },
};

export function StatePill({ state, wide }: { state: ItemState; wide?: boolean }) {
  const p = PILL[state];
  return (
    <span className="pill" data-tone={p.tone} data-wide={(wide && state === "responded") || undefined}>
      {p.label}
    </span>
  );
}

import { AgentIcon } from "@/components/icons";
import type { Badge, BadgeTone, Color, IconName } from "@/lib/api/types";

export const CHANNEL_COLOR: Record<string, Color> = {
  github: { bg: "#d6e2fb", fg: "#1c3a8a" },
  slack: { bg: "#f6e3c5", fg: "#6b4200" },
  mail: { bg: "#f5d9e6", fg: "#7a1f4d" },
};
const OTHER_COLOR: Color = { bg: "#e6e8ee", fg: "#3c424e" };

const CHANNEL_ICON: Record<string, IconName> = { github: "github", slack: "slack", mail: "mail" };

export const channelColor = (channel: string) => CHANNEL_COLOR[channel] ?? OTHER_COLOR;

export const hasHangul = (s: string) => /[가-힣]/.test(s);

/** 요청자 아바타 + 들어온 채널 배지 */
export function RequesterAvatar({
  initials,
  channel,
  color = channelColor(channel),
}: {
  initials: string;
  channel: string;
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
        <AgentIcon name={CHANNEL_ICON[channel] ?? "generic"} size={10} stroke={3} />
      </div>
    </div>
  );
}

const TONE: Record<BadgeTone, string> = { warn: "warn", danger: "block", ok: "ok", muted: "mute", info: "info" };

/** 서버가 정한 상태 배지(label · tone) */
export function BadgePill({ badge, wide }: { badge: Badge; wide?: boolean }) {
  const long = badge.label.length > 5;
  return (
    <span className="pill" data-tone={TONE[badge.tone] ?? "mute"} data-wide={(wide && long) || undefined}>
      {badge.label}
    </span>
  );
}

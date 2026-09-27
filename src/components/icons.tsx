import type { IconName } from "@/lib/api/types";
import type { ReactNode, SVGProps } from "react";

/** 에이전트 · 태스크 아이콘(24x24 viewBox 안쪽 도형) */
export const ICON_PATHS: Record<IconName, string> = {
  star: '<path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2z" fill="currentColor" stroke="none"/>',
  train: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l4-4 3 3 5-6"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z"/>',
  robot:
    '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4"/><circle cx="9.5" cy="13" r="1"/><circle cx="14.5" cy="13" r="1"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  github: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/>',
  research: '<path d="M5 8l5 4-5 4"/><line x1="13" y1="16" x2="19" y2="16"/>',
  slack: '<path d="M4 5h16v11H10l-4 4v-4H4z"/>',
  mail: '<path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/>',
  shield:
    '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
  generic: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
};

export function AgentIcon({
  name = "generic",
  size = 18,
  stroke = 2,
  className,
}: {
  name?: IconName;
  size?: number | string;
  stroke?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] ?? ICON_PATHS.generic }}
    />
  );
}

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconChat = (p: P) => (
  <Svg size={15} {...p}>
    <path d="M4 5h16v11H10l-4 4v-4H4z" />
  </Svg>
);
export const IconSpark = (p: P) => (
  <Svg size={16} fill="#2a4fc4" stroke="none" {...p}>
    <path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2z" />
  </Svg>
);
export const IconInbox = (p: P) => (
  <Svg size={15} {...p}>
    <path d="M3 13h5l1.5 3h5L16 13h5" />
    <path d="M5.5 5h13L21 13v6H3v-6l2.5-8z" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg size={15} {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);
export const IconRobot = (p: P) => (
  <Svg size={17} strokeWidth={1.8} {...p}>
    <rect x="5" y="8" width="14" height="11" rx="2" />
    <path d="M12 8V4" />
    <circle cx="9.5" cy="13" r="1" />
    <circle cx="14.5" cy="13" r="1" />
  </Svg>
);
export const IconCube = (p: P) => (
  <Svg size={17} strokeWidth={1.8} {...p}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M4 7.5l8 4.5 8-4.5" />
    <path d="M12 12v9" />
  </Svg>
);
export const IconFilter = (p: P) => (
  <Svg size={18} strokeWidth={1.8} {...p}>
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="7" y1="12" x2="17" y2="12" />
    <line x1="10" y1="17" x2="14" y2="17" />
  </Svg>
);
export const IconSort = (p: P) => (
  <Svg size={18} strokeWidth={1.8} {...p}>
    <path d="M8 19V5l-3.5 3.5" />
    <path d="M16 5v14l3.5-3.5" />
  </Svg>
);
export const IconLink = (p: P) => (
  <Svg size={15} {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const IconExternal = (p: P) => (
  <Svg size={13} {...p}>
    <path d="M8 16L18 6" />
    <path d="M10 6h8v8" />
  </Svg>
);
export const IconBurger = (p: P) => (
  <Svg size={20} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg size={18} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconRepo = (p: P) => (
  <Svg size={16} stroke="#9198a1" {...p}>
    <path d="M5 4h14v16H5z" />
    <path d="M9 4v10l2-1.5 2 1.5V4" />
  </Svg>
);
export const IconIssue = (p: P) => (
  <Svg size={13} strokeWidth={2.5} {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2" />
  </Svg>
);
export const IconWarn = (p: P) => (
  <Svg size={15} {...p}>
    <path d="M12 3l9.5 17h-19L12 3z" />
    <line x1="12" y1="10" x2="12" y2="14.5" />
    <line x1="12" y1="17.4" x2="12" y2="17.5" />
  </Svg>
);
export const IconPencil = (p: P) => (
  <Svg size={15} {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
  </Svg>
);
export const IconSend = (p: P) => (
  <Svg size={14} {...p}>
    <path d="M5 5l14 7-14 7V5z" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg size={16} strokeWidth={2.2} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconStarFill = (p: P) => (
  <Svg size={10} fill="currentColor" stroke="none" {...p}>
    <path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2z" />
  </Svg>
);
export const IconShieldSmall = (p: P) => (
  <Svg size={10} strokeWidth={3} {...p}>
    <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
  </Svg>
);

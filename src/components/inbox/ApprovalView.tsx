"use client";

import {
  IconChat,
  IconExternal,
  IconIssue,
  IconLink,
  IconPencil,
  IconRepo,
  IconSend,
  IconWarn,
} from "@/components/icons";
import type { ApprovalDetail, DraftState, GithubSourceView, SlackSourceView } from "@/lib/api/types";
import { useApp } from "@/store/app-store";
import Link from "next/link";
import { DraftCard } from "./DraftCard";
import { CHANNEL_COLOR, RequesterAvatar, StatePill } from "./parts";

function GithubSource({
  src,
  title,
  initials,
  agentShort,
  posted,
}: {
  src: GithubSourceView;
  title: string;
  initials: string;
  agentShort: string;
  posted?: string;
}) {
  const c = src.comment;
  return (
    <div className="gh">
      <div className="gh-repo">
        <IconRepo />
        <span>{src.owner}</span>
        <span className="gh-muted">/</span>
        <b>{src.repo}</b>
        <span className="gh-public">Public</span>
      </div>
      {src.showTabs && (
        <div className="gh-tabs">
          <span>Code</span>
          <span data-active>
            Issues<span className="gh-count">{src.issuesCount}</span>
          </span>
          <span>Pull requests</span>
          <span>Discussions</span>
        </div>
      )}
      <div className="gh-body">
        <div className="gh-head">
          <div className="gh-title">
            {title} <span>#{src.number}</span>
          </div>
          <div className="gh-meta">
            <span className="gh-open">
              <IconIssue />
              <span>Open</span>
            </span>
            <span>
              <b>{c.author}</b> opened {src.openedAgo} · {posted ? "1 comment" : "0 comments"}
            </span>
          </div>
        </div>
        <div className="gh-row">
          <div className="gh-av" style={{ background: CHANNEL_COLOR.github.bg, color: CHANNEL_COLOR.github.fg }}>
            {initials}
          </div>
          <div className="gh-comment">
            <div className="gh-comment-head">
              <b>{c.author}</b>
              <span>commented {c.ago}</span>
            </div>
            <div className="gh-comment-body">
              <div>{c.body}</div>
              {c.injection && <div className="gh-injection">{c.injection}</div>}
            </div>
          </div>
        </div>
        {src.warning ? (
          <div className="gh-slot" data-warning>
            <IconWarn style={{ flexShrink: 0 }} />
            <span>{src.warning}</span>
          </div>
        ) : (
          <div className="gh-row">
            <div className="gh-av" data-agent>
              {src.agentInitials}
            </div>
            <div className="gh-slot" data-posted={posted ? true : undefined}>
              {posted ?? `${agentShort} 에이전트의 댓글은 결재가 끝나면 이 자리에 등록됩니다.`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SlackSource({
  src,
  agentShort,
  posted,
}: {
  src: SlackSourceView;
  agentShort: string;
  posted?: string;
}) {
  const sq = (size: number, font: number, radius: number) => ({
    width: size,
    height: size,
    borderRadius: radius,
    fontSize: font,
  });
  return (
    <div className="sl">
      <div className="sl-side">
        <div className="sl-ws">
          <b>{src.workspace}</b>
          <IconPencil stroke="#efe6f1" />
        </div>
        <div className="sl-group">
          <div className="sl-item">
            <IconChat size={14} />
            <span>스레드</span>
          </div>
          <div className="sl-item">
            <IconSend />
            <span>초안 및 전송됨</span>
          </div>
        </div>
        <div className="sl-group">
          <div className="sl-group-label">채널</div>
          {["공지", "질문-답변", "자료-공유"].map((c) => (
            <div key={c} className="sl-item">
              <span className="hash">#</span>
              <span>{c}</span>
            </div>
          ))}
        </div>
        <div className="sl-group">
          <div className="sl-group-label">다이렉트 메시지</div>
          <div className="sl-item" data-dm data-active>
            <span className="sl-presence" />
            <span>{src.team}</span>
          </div>
          <div className="sl-item" data-dm>
            <span className="sl-presence" />
            <span>이다영 (나)</span>
          </div>
        </div>
      </div>
      <div className="sl-main">
        <div className="sl-head">
          <div className="sl-sq" style={sq(26, 10, 6)}>
            {src.initials}
          </div>
          <b>{src.team}</b>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1f7a4d" }} />
        </div>
        <div className="sl-msgs">
          <div className="sl-day">
            <span />
            <span className="sl-day-label">{src.day}</span>
            <span />
          </div>
          {src.messages.map((m, i) => (
            <div key={i} className="sl-msg">
              <div className="sl-sq" style={sq(36, 12, 8)}>
                {src.initials}
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div className="sl-msg-name">
                  <b>{src.team}</b>
                  <span>{m.time}</span>
                </div>
                <div className="sl-msg-text">{m.text}</div>
              </div>
            </div>
          ))}
          <div className="sl-slot" data-posted={posted ? true : undefined}>
            {posted ?? `${agentShort} 에이전트의 답장은 결재가 끝나면 이 대화로 전송됩니다.`}
          </div>
        </div>
        <div className="sl-composer">
          <div className="sl-toolbar">
            <b>B</b>
            <i>I</i>
            <u>U</u>
            <s>S</s>
          </div>
          <div className="sl-input">{src.team}에게 메시지 보내기</div>
        </div>
      </div>
    </div>
  );
}

/** 결재 상세: 원본 화면 + 답변 초안 */
export function ApprovalView({
  detail,
  draft,
  readOnly,
}: {
  detail: ApprovalDetail;
  draft: DraftState;
  readOnly?: boolean;
}) {
  const { openAdmin } = useApp();
  const { item, source } = detail;
  const posted = draft.phase === "posted" ? draft.postedText ?? draft.text : undefined;
  const isGithub = source.kind === "github";
  const openUrl = isGithub ? `https://${source.url}` : "https://app.slack.com/client";

  return (
    <>
      <div className="detail-bar">
        <span>{detail.taskLabel}</span>
        <span className="detail-bar-sep">/</span>
        <span className={isGithub ? "mono" : undefined}>{detail.target}</span>
        <div className="grow" />
        {detail.headerLink.to === "sandbox" ? (
          <button type="button" className="link-btn" onClick={() => openAdmin("sandbox", "public")}>
            <IconLink />
            <span>{detail.headerLink.label}</span>
          </button>
        ) : (
          <Link href={`/inbox/all/${item.approvalId}`} className="link-btn">
            <IconLink />
            <span>{detail.headerLink.label}</span>
          </Link>
        )}
      </div>
      <div className="detail-body">
        <div className="detail-head">
          <div className="detail-title">
            <h2>{item.title}</h2>
            <Link href={`/chat/${item.taskId}`} className="detail-chat" aria-label="이 결재에 대해 대화">
              <IconChat size={16} />
              {detail.commentCount != null && <span>{detail.commentCount}</span>}
            </Link>
            <div className="grow" />
            <StatePill state={item.state} wide />
          </div>
          <div className="detail-requester">
            <RequesterAvatar initials={item.initials} channel={item.channel} color={detail.requesterColor} />
            <div>
              <b>{item.requester}</b>
              <span>{detail.arrived}</span>
            </div>
          </div>
        </div>
        <section className="source" aria-label="원본 화면">
          <div className="source-bar">
            {isGithub ? (
              <IconIssue size={15} strokeWidth={2} stroke="#1c3a8a" style={{ flexShrink: 0 }} />
            ) : (
              <IconChat stroke="#6b4200" style={{ flexShrink: 0 }} />
            )}
            <b>원본 화면</b>
            <span className={`source-bar-url${isGithub ? " mono" : ""}`}>
              {isGithub ? source.url : source.label}
            </span>
            <div className="grow" />
            <span className="source-bar-ro">읽기 전용</span>
            <a href={openUrl} target="_blank" rel="noopener noreferrer">
              <span>원본 열기</span>
              <IconExternal />
            </a>
          </div>
          {source.kind === "github" ? (
            <GithubSource
              src={source}
              title={item.title}
              initials={item.initials}
              agentShort={detail.agentShort} posted={posted} />
          ) : (
            <SlackSource src={source} agentShort={detail.agentShort} posted={posted} />
          )}
        </section>
        <DraftCard draft={draft} readOnly={readOnly} />
      </div>
    </>
  );
}

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
import { Markdown } from "@/components/Markdown";
import type { GithubSource, InboxDetail, SlackSource, ThreadMessage } from "@/lib/api/types";
import { ago, clock, dayTime, initialsOf } from "@/lib/format";
import { useData } from "@/store/app-store";
import Link from "next/link";
import { DraftCard } from "./DraftCard";
import { chatHref } from "./InboxList";
import { BadgePill, RequesterAvatar, channelColor, hasHangul } from "./parts";

/** 결재 전 · 후 에이전트 자리 문구 */
function slotText(d: InboxDetail, desk: string, where: "comment" | "reply") {
  const phase = d.draft.phase;
  if (phase === "posted") return null;
  if (phase === "closed") return `${desk} 에이전트는 이 요청에 응답하지 않기로 했습니다.`;
  return where === "comment"
    ? `${desk} 에이전트의 댓글은 결재가 끝나면 이 자리에 등록됩니다.`
    : `${desk} 에이전트의 답장은 결재가 끝나면 이 스레드로 전송됩니다.`;
}

function Comment({
  msg,
  marks,
  color,
}: {
  msg: ThreadMessage;
  marks: string[];
  color: { bg: string; fg: string };
}) {
  return (
    <div className="gh-row">
      <div className="gh-av" style={{ background: color.bg, color: color.fg }}>
        {initialsOf(msg.author)}
      </div>
      <div className="gh-comment" data-request={msg.isRequest || undefined}>
        <div className="gh-comment-head">
          <b>{msg.author}</b>
          {msg.at ? <span>commented {ago(msg.at)}</span> : <span>opened this issue</span>}
          {msg.isRequest && <span className="gh-request-tag">이 댓글로 들어온 요청</span>}
        </div>
        <div className="gh-comment-body">
          <Markdown text={msg.text} mark={marks} />
        </div>
      </div>
    </div>
  );
}

function GithubThread({ d, desk, posted }: { d: InboxDetail; desk: string; posted?: string }) {
  const src = d.source as GithubSource;
  const [owner, repo] = (src.repo ?? d.target?.split("#")[0] ?? "").split("/");
  const comments = src.comments ?? [];
  const marks = d.injection?.sentences.map((s) => s.text) ?? [];
  const color = channelColor("github");
  const slot = slotText(d, desk, "comment");
  const count = comments.length + (posted ? 1 : 0);
  return (
    <div className="gh">
      <div className="gh-repo">
        <IconRepo />
        <span>{owner}</span>
        <span className="gh-muted">/</span>
        <b>{repo}</b>
      </div>
      <div className="gh-tabs">
        <span>Code</span>
        <span data-active>Issues</span>
        <span>Pull requests</span>
        <span>Discussions</span>
      </div>
      <div className="gh-body">
        <div className="gh-head">
          <div className="gh-title">
            {src.title ?? d.title} {src.number != null && <span>#{src.number}</span>}
          </div>
          <div className="gh-meta">
            <span className="gh-open">
              <IconIssue />
              <span>Open</span>
            </span>
            <span>
              {src.author && <b>{src.author}</b>} opened · {count} comment{count === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {src.body && (
          <Comment msg={{ author: src.author ?? d.requester, text: src.body, at: null }} marks={[]} color={color} />
        )}
        {comments.map((c, i) => (
          <Comment key={i} msg={c} marks={c.isRequest ? marks : []} color={color} />
        ))}
        {!src.body && !comments.length && (
          <Comment
            msg={{ author: d.requester, text: d.question, at: d.arrivedAt, isRequest: true }}
            marks={marks}
            color={color}
          />
        )}
        {d.injection && (
          <div className="gh-slot" data-warning>
            <IconWarn style={{ flexShrink: 0 }} />
            <span>{d.injection.note}</span>
          </div>
        )}
        {(posted || slot) && (
          <div className="gh-row">
            <div className="gh-av" data-agent>
              {initialsOf(desk)}
            </div>
            <div className="gh-slot" data-posted={posted ? true : undefined}>
              {posted ?? slot}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SlackThread({ d, desk, posted }: { d: InboxDetail; desk: string; posted?: string }) {
  const src = d.source as SlackSource;
  const messages: ThreadMessage[] = src.messages?.length
    ? src.messages
    : [{ author: d.requester, text: d.question, at: d.arrivedAt, isRequest: true }];
  const marks = d.injection?.sentences.map((s) => s.text) ?? [];
  const where = src.dm ? d.requester : `#${src.channelId ?? "channel"}`;
  const slot = slotText(d, desk, "reply");
  const sq = (size: number, font: number, radius: number) => ({ width: size, height: size, borderRadius: radius, fontSize: font });
  const day = dayTime(messages[0]?.at).split(" ")[0];
  return (
    <div className="sl">
      <div className="sl-side">
        <div className="sl-ws">
          <b>Slack</b>
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
        {src.dm ? (
          <div className="sl-group">
            <div className="sl-group-label">다이렉트 메시지</div>
            <div className="sl-item" data-dm data-active>
              <span className="sl-presence" />
              <span>{d.requester}</span>
            </div>
          </div>
        ) : (
          <div className="sl-group">
            <div className="sl-group-label">채널</div>
            <div className="sl-item" data-active>
              <span className="hash">#</span>
              <span>{src.channelId}</span>
            </div>
          </div>
        )}
      </div>
      <div className="sl-main">
        <div className="sl-head">
          {src.dm ? (
            <div className="sl-sq" style={sq(26, 10, 6)}>
              {d.requesterInitials}
            </div>
          ) : (
            <span style={{ color: "#55595f", fontWeight: 700 }}>#</span>
          )}
          <b>{src.dm ? d.requester : src.channelId}</b>
          {src.threadTs && <span style={{ fontSize: 12, color: "#55595f" }}>스레드</span>}
        </div>
        <div className="sl-msgs">
          {day && (
            <div className="sl-day">
              <span />
              <span className="sl-day-label">{day}</span>
              <span />
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className="sl-msg">
              <div className="sl-sq" style={sq(36, hasHangul(m.author) ? 11 : 12, 8)}>
                {initialsOf(m.author)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div className="sl-msg-name">
                  <b>{m.author}</b>
                  <span>{clock(m.at)}</span>
                </div>
                <div className="sl-msg-text">
                  <Markdown text={m.text} mark={m.isRequest ? marks : []} />
                </div>
              </div>
            </div>
          ))}
          {d.injection && (
            <div className="sl-slot">
              <IconWarn style={{ flexShrink: 0, marginRight: 8 }} />
              {d.injection.note}
            </div>
          )}
          {(posted || slot) && (
            <div className="sl-slot" data-posted={posted ? true : undefined}>
              {posted ?? slot}
            </div>
          )}
        </div>
        <div className="sl-composer">
          <div className="sl-toolbar">
            <b>B</b>
            <i>I</i>
            <u>U</u>
            <s>S</s>
          </div>
          <div className="sl-input">{where}에 메시지 보내기</div>
        </div>
      </div>
    </div>
  );
}

const ARRIVED: Record<string, string> = { github: "GitHub 이슈로 들어옴", slack: "Slack 메시지로 들어옴" };

/** 결재 상세: 원본 화면 + 답변 초안 */
export function ApprovalView({ detail: d, readOnly }: { detail: InboxDetail; readOnly?: boolean }) {
  const { tasks } = useData();
  const desk = d.agent?.desk ?? d.task?.id ?? "대응";
  const posted = d.draft.phase === "posted" ? d.draft.text : undefined;
  const isGithub = d.source.kind === "github";
  const slackDm = d.source.kind === "slack" && !!(d.source as SlackSource).dm;
  const arrived = slackDm ? "Slack 다이렉트 메시지로 들어옴" : (ARRIVED[d.channel] ?? `${d.channelLabel}로 들어옴`);
  const openUrl = (isGithub ? (d.source as GithubSource).issueUrl : undefined) ?? d.sourceUrl;

  return (
    <>
      <div className="detail-bar">
        <span>{d.task?.name ?? "담당 태스크 없음"}</span>
        <span className="detail-bar-sep">/</span>
        <span className={isGithub ? "mono" : undefined}>{d.target ?? d.channelLabel}</span>
        <div className="grow" />
        {d.approvalId != null && (
          <Link href={`/inbox/all/${d.id}`} className="link-btn">
            <IconLink />
            <span>결재함에서 결재 {d.approvalId} 보기</span>
          </Link>
        )}
      </div>
      <div className="detail-body">
        <div className="detail-head">
          <div className="detail-title">
            <h2>{d.title}</h2>
            <Link href={chatHref(d, tasks)} className="detail-chat" aria-label="이 결재에 대해 대화">
              <IconChat size={16} />
            </Link>
            <div className="grow" />
            <BadgePill badge={d.badge} wide />
          </div>
          <div className="detail-requester">
            <RequesterAvatar initials={d.requesterInitials} channel={d.channel} />
            <div>
              <b>{d.requester}</b>
              <span>
                {arrived}
                {d.arrivedAt ? ` · ${dayTime(d.arrivedAt)}` : ""}
                {d.gradeSource === "source" ? " · 등록된 소스의 등급" : ""}
              </span>
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
            <span className={`source-bar-url${isGithub ? " mono" : ""}`}>{d.sourceUrl.replace(/^https?:\/\//, "")}</span>
            <div className="grow" />
            <span className="source-bar-ro">읽기 전용</span>
            <a href={openUrl} target="_blank" rel="noopener noreferrer">
              <span>원본 열기</span>
              <IconExternal />
            </a>
          </div>
          {isGithub ? (
            <GithubThread d={d} desk={desk} posted={posted} />
          ) : (
            <SlackThread d={d} desk={desk} posted={posted} />
          )}
        </section>
        <DraftCard detail={d} readOnly={readOnly} />
      </div>
    </>
  );
}

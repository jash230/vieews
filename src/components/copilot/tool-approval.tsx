"use client";

// Adapted from 21st.dev "AI Tool Approval" by kokonutd (https://21st.dev/@kokonutd/components/ai-tool-approval,
// MIT, kokonutui.com): the approval card with hold-to-confirm and the folded one-line trace for tool calls,
// restyled to Vieews tokens and shaped around post proposals.

import { LocalTime } from "@/components/app/local-time";
import { AlertTriangle, Ban, CalendarClock, CheckCircle2, ChevronRight, Clock, Play, Send } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { PlatformBadge, PLATFORM_META } from "@/components/app/platform";
import type { ChatItem, ProposalView } from "@/lib/copilot/types";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const HOLD_MS = 900;
/** Captions longer than this start folded. */
const CAPTION_FOLD = 220;

const TIKTOK_PRIVACY: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type ToolItem = Extract<ChatItem, { kind: "tool" }>;

function StatusIcon({ status }: { status: ToolItem["status"] }) {
  if (status === "running") {
    return (
      <svg aria-hidden className="size-3.5 motion-safe:animate-spin" fill="none" style={{ animationDuration: "0.8s" }} viewBox="0 0 16 16">
        <circle className="stroke-border-strong" cx="8" cy="8" r="6.25" strokeWidth="1.5" />
        <path className="stroke-primary" d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    );
  }
  if (status === "done") {
    return (
      <svg aria-hidden className="size-3.5 text-success" fill="none" viewBox="0 0 16 16">
        <motion.path
          animate={{ pathLength: 1 }}
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          initial={{ pathLength: 0 }}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
          transition={{ duration: 0.3, ease: EASE_OUT }}
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden className="size-3.5 text-destructive" fill="none" viewBox="0 0 16 16">
      <path d="M4.5 4.5l7 7m0-7-7 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
    </svg>
  );
}

/** One tool the copilot ran, folded to a line. Failures open to show why. */
export function ToolRow({ item }: { item: ToolItem }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const hasDetail = !!item.detail;
  return (
    <MotionConfig reducedMotion="user">
      <div>
        <button
          type="button"
          disabled={!hasDetail}
          aria-expanded={hasDetail ? open : undefined}
          aria-controls={hasDetail ? detailId : undefined}
          onClick={() => setOpen((o) => !o)}
          className="group/line flex w-full items-center gap-2.5 rounded-lg py-1 text-left text-[13px] leading-5 text-muted-foreground disabled:cursor-default"
        >
          <span className="grid size-4 shrink-0 place-items-center"><StatusIcon status={item.status} /></span>
          <span className={cn("min-w-0 truncate", item.status === "error" && "text-destructive")}>
            {item.status === "error" ? `${item.label} failed` : item.label}
          </span>
          {hasDetail && <ChevronRight className={cn("ml-auto size-3.5 shrink-0 transition-transform duration-200", open && "rotate-90")} aria-hidden />}
        </button>
        <AnimatePresence initial={false}>
          {open && hasDetail && (
            <motion.div
              id={detailId}
              className="overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
            >
              <pre className="mb-1.5 ml-6.5 whitespace-pre-wrap rounded-lg bg-surface px-3 py-2 font-mono text-xs leading-5 text-muted-foreground ring-1 ring-border">
                {item.detail}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

/** Approve for actions that can't be undone: press and hold, so a slip never confirms. */
function HoldToApprove({ label, onConfirm, disabled }: { label: string; onConfirm: () => void; disabled?: boolean }) {
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKey = useRef(0);
  const start = () => {
    if (disabled) return;
    setHolding(true);
    setHint(false);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onConfirm();
    }, HOLD_MS);
  };
  const stop = () => {
    if (!timer.current) return;
    // Let go too early: say how it works instead of silently doing nothing.
    clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    setHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 2500);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  return (
    <span className="relative">
      {hint && (
        <span role="status" className="absolute bottom-full right-0 mb-1.5 animate-pop-in whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1 text-xs font-semibold text-background shadow-md">
          Keep holding to confirm
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        aria-label={`${label}. Press and hold to confirm`}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          lastKey.current = Date.now();
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          lastKey.current = Date.now();
          if (e.key === " " || e.key === "Enter") stop();
        }}
        // Screen readers activate with a plain click (no pointer, no key hold): confirm with a dialog instead.
        onClick={(e) => {
          if (e.detail !== 0 || disabled || timer.current || Date.now() - lastKey.current < 1000) return;
          if (window.confirm(`${label}?`)) onConfirm();
        }}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        className="relative min-h-10 select-none overflow-hidden rounded-xl bg-primary-soft px-4 text-sm font-bold text-primary ring-1 ring-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        Hold to {label.toLowerCase()}
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-primary text-on-primary"
          style={{
            clipPath: holding ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
            transition: holding ? `clip-path ${HOLD_MS}ms linear` : "clip-path 200ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          Hold to {label.toLowerCase()}
        </span>
      </button>
    </span>
  );
}

function optionSummary(options: Record<string, unknown> & { platform: string }): string | null {
  const o = options[options.platform] as Record<string, unknown> | undefined;
  if (!o) return null;
  if (options.platform === "youtube") return `${o.title ?? ""} · ${capitalize(String(o.privacy ?? "private"))}`;
  if (options.platform === "instagram") return capitalize(String(o.format ?? ""));
  if (options.platform === "tiktok") return TIKTOK_PRIVACY[String(o.privacyLevel)] ?? String(o.privacyLevel ?? "");
  return null;
}

/** A post the copilot wants to publish, waiting for the user's decision. */
export function PostApprovalCard({
  proposal,
  busy,
  onDecide,
}: {
  proposal: ProposalView;
  busy: boolean;
  onDecide: (approved: boolean) => void;
}) {
  const titleId = useId();
  const { input, status } = proposal;
  const when = input.scheduledFor ? new Date(input.scheduledFor) : null;
  const action = when ? "Schedule" : "Post now";
  const [captionOpen, setCaptionOpen] = useState(false);
  const longCaption = (input.caption?.length ?? 0) > CAPTION_FOLD || (input.caption?.split("\n").length ?? 0) > 4;
  const badge = {
    pending: { label: "Needs your OK", icon: Clock, className: "bg-accent-soft text-accent" },
    approved: { label: when ? "Scheduled" : "Posting", icon: CheckCircle2, className: "bg-success-soft text-success" },
    declined: { label: "Declined", icon: Ban, className: "bg-muted text-muted-foreground" },
    failed: { label: "Failed", icon: AlertTriangle, className: "bg-destructive-soft text-destructive" },
  }[status];

  return (
    <MotionConfig reducedMotion="user">
      <motion.section
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
        className={cn("rounded-2xl border bg-background p-3 shadow-sm", status === "pending" ? "border-primary/25" : "border-border")}
      >
        <header className="mb-2.5 flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            {when ? <CalendarClock className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
          </span>
          <h3 id={titleId} className="text-sm font-bold">{input.scheduledFor ? <>Schedule for <LocalTime iso={input.scheduledFor} fmt="EEE MMM d, h:mm a" /></> : "Post now"}</h3>
          {badge && (
            <span className={cn("ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", badge.className)}>
              <badge.icon className="size-3.5" aria-hidden />
              {badge.label}
            </span>
          )}
        </header>

        {proposal.media.length > 0 && (
          <ul className="mb-2.5 flex gap-1.5 overflow-x-auto">
            {proposal.media.map((m) => (
              <li key={m.id} className="relative h-20 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                {m.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbUrl} alt="" className="size-full object-cover" />
                )}
                {m.kind === "video" && <Play className="absolute bottom-1 left-1 size-3 fill-white text-white drop-shadow" aria-hidden />}
              </li>
            ))}
          </ul>
        )}

        {input.caption && (
          <div className="mb-2.5 rounded-xl bg-surface px-3 py-2">
            <p className={cn("whitespace-pre-wrap text-[13px] leading-relaxed", longCaption && !captionOpen && "line-clamp-4")}>{input.caption}</p>
            {longCaption && (
              <button type="button" onClick={() => setCaptionOpen((o) => !o)} aria-expanded={captionOpen} className="mt-1 text-xs font-bold text-primary hover:underline">
                {captionOpen ? "Show less" : "Show the whole caption"}
              </button>
            )}
          </div>
        )}

        <ul className="space-y-1.5">
          {input.targets.map((t) => {
            const account = proposal.accounts[t.accountId];
            const platform = (account?.platform ?? t.options.platform) as Platform;
            return (
              <li key={t.accountId} className="flex items-center gap-2 text-[13px]">
                <PlatformBadge platform={platform} />
                <span className="min-w-0 flex-1 truncate font-semibold">{account?.name ?? PLATFORM_META[platform]?.label ?? platform}</span>
                <span className="truncate text-xs text-muted-foreground">{optionSummary(t.options)}</span>
              </li>
            );
          })}
        </ul>

        {input.reason && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{input.reason}</p>}

        {status === "pending" ? (
          <div className="mt-3 flex items-center justify-end gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(false)}
              className="min-h-10 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-primary-soft hover:text-foreground disabled:opacity-50"
            >
              Decline
            </button>
            <HoldToApprove label={action} disabled={busy} onConfirm={() => onDecide(true)} />
          </div>
        ) : status === "approved" && proposal.result?.postId ? (
          <Link href={`/posts/${proposal.result.postId}`} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            See the post
          </Link>
        ) : status === "failed" ? (
          <p role="alert" className="mt-3 whitespace-pre-wrap text-sm text-destructive">{proposal.result?.error}</p>
        ) : null}
      </motion.section>
    </MotionConfig>
  );
}

"use client";

import { ArrowDown, Link2, PanelRightClose, RotateCw, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { approveProposalAction, createProjectFromLinkAction, declineProposalAction } from "@/app/(app)/actions";
import { uploadFile } from "@/app/(app)/compose/media";
import { ProjectSwitcher, type ProjectOption } from "@/components/app/project-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Loader } from "@/components/ui/loader";
import type { ChatItem, ChatMessage, CopilotEvent, ProposalView } from "@/lib/copilot/types";
import { cn } from "@/lib/utils";
import { ChatInput, type PendingAttachment } from "./chat-input";
import { COPILOT_PANEL_ID, useCopilotUI, useStored } from "./copilot-ui";
import { PostApprovalCard, ToolRow } from "./tool-approval";

const WIDTH_KEY = "vieews.copilot.width";
const MIN_WIDTH = 320;
const MAX_WIDTH = 560;
const RESIZE_STEP = 16;
/** How close to the bottom (px) still counts as "following along" for auto-scroll. */
const STICK_PX = 80;

const SUGGESTIONS = ["What's still missing from my project?", "Write 3 caption ideas for my next post", "What's scheduled this week?"];
const BLANK_SUGGESTIONS = ["What can you do?", "Help me plan posts for my app", "How do I connect TikTok?"];

/** Applies one streamed event to the assistant message being built. */
function applyEvent(items: ChatItem[], event: CopilotEvent): ChatItem[] {
  const next = [...items];
  if (event.type === "text") {
    const last = next.at(-1);
    if (last?.kind === "text") next[next.length - 1] = { kind: "text", text: last.text + event.delta };
    else next.push({ kind: "text", text: event.delta });
  } else if (event.type === "tool") {
    const tool = { id: event.id, name: event.name, label: event.label, status: event.status, detail: event.detail };
    const at = next.findIndex((i) => i.kind === "tool" && i.id === event.id);
    if (at >= 0) next[at] = { kind: "tool", ...tool };
    else next.push({ kind: "tool", ...tool });
  } else if (event.type === "proposal") {
    next.push({ kind: "proposal", proposal: event.proposal });
  }
  return next;
}

export function CopilotPanel({
  project,
  projects,
  initialMessages,
  blank = false,
}: {
  project: ProjectOption | null;
  projects: ProjectOption[];
  initialMessages: ChatMessage[];
  /** The project has no link or pitch yet, so the chat opens without assuming anything. */
  blank?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [live, setLive] = useState<ChatItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);
  const { open: mobileOpen, setOpen: setMobileOpen, collapsed, setCollapsed } = useCopilotUI();
  // Set when a failed send put the message back in the box, so Retry can send it again.
  const [canRetry, setCanRetry] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const stick = useRef(true);
  const aside = useRef<HTMLElement>(null);
  const [storedWidth, setStoredWidth] = useStored(WIDTH_KEY);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const streaming = live !== null;
  const width = dragWidth ?? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(storedWidth) || 384));

  // Server data wins whenever it changes (project switch, refresh after an action), except mid-turn.
  useEffect(() => {
    if (!abort.current) setMessages(initialMessages);
  }, [initialMessages]);

  // Follow new output only while you're at the bottom; scrolling up to read stays put.
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, live, mobileOpen, collapsed]);

  // The overlay (below lg) behaves like a dialog: focus goes to the input, Escape closes it.
  useEffect(() => {
    if (!mobileOpen) return;
    aside.current?.querySelector<HTMLElement>("textarea, input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    // A modal sheet: keep Tab and screen readers out of the page behind it (only while it overlays, below lg).
    const behind = window.matchMedia("(max-width: 1023.98px)").matches
      ? [...document.querySelectorAll<HTMLElement>("#main, body header, body aside")].filter(
          (el) => !aside.current?.contains(el) && !el.contains(aside.current) && !el.hasAttribute("inert"),
        )
      : [];
    behind.forEach((el) => el.setAttribute("inert", ""));
    return () => {
      document.removeEventListener("keydown", onKey);
      behind.forEach((el) => el.removeAttribute("inert"));
    };
  }, [mobileOpen, setMobileOpen]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    setAtBottom(stick.current);
  }

  function jumpToLatest() {
    const el = scroller.current;
    if (!el) return;
    stick.current = true;
    setAtBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  useEffect(() => () => abort.current?.abort(), []);

  const attach = useCallback((files: FileList) => {
    const added: PendingAttachment[] = [...files]
      .filter((f) => f.type.startsWith("video/") || f.type.startsWith("image/"))
      .map((file) => ({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        kind: file.type.startsWith("video/") ? "video" : "image",
        state: { status: "uploading" },
      }));
    setAttachments((prev) => [...prev, ...added]);
    for (const a of added) {
      uploadFile(a.file).then(
        (assetId) => setAttachments((prev) => prev.map((x) => (x.key === a.key ? { ...x, state: { status: "done", assetId } } : x))),
        (err: unknown) =>
          setAttachments((prev) => prev.map((x) => (x.key === a.key ? { ...x, state: { status: "error", error: err instanceof Error ? err.message : "Upload failed" } } : x))),
      );
    }
  }, []);

  const removeAttachment = (key: string) =>
    setAttachments((prev) => {
      const gone = prev.find((a) => a.key === key);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((a) => a.key !== key);
    });

  async function send(text = draft) {
    if (!project || streaming) return;
    const ids = attachments.flatMap((a) => (a.state.status === "done" ? [a.state.assetId] : []));
    if (!text.trim() && !ids.length) return;
    setError(null);
    setCanRetry(false);
    setDraft("");
    stick.current = true;
    setAtBottom(true);
    const sentAttachments = attachments;
    setAttachments([]);
    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      items: [
        ...(sentAttachments.length
          ? [{ kind: "attachments" as const, media: sentAttachments.flatMap((a) => (a.state.status === "done" ? [{ id: a.state.assetId, kind: a.kind, thumbUrl: a.kind === "image" ? a.previewUrl : null }] : [])) }]
          : []),
        ...(text.trim() ? [{ kind: "text" as const, text: text.trim() }] : []),
      ],
    };
    setMessages((prev) => [...prev, optimistic]);
    setLive([]);
    const controller = new AbortController();
    abort.current = controller;
    let items: ChatItem[] = [];
    let changed = false;
    // Whether the server has the message; until then a failure can hand it back to you.
    let received = false;
    let restored = false;
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, text, attachments: ids, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `The copilot didn't answer (${res.status})`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: CopilotEvent;
          try {
            event = JSON.parse(line) as CopilotEvent;
          } catch {
            continue; // One garbled line shouldn't end the whole reply.
          }
          if (event.type === "user") received = true;
          if (event.type === "user") setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...event.message, items: optimistic.items } : m)));
          else if (event.type === "changed") changed = true;
          else if (event.type === "error") setError(event.message);
          else if (event.type !== "done") {
            items = applyEvent(items, event);
            setLive(items);
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        if (!received && !items.length) {
          // Nothing reached the copilot: put the message back so it isn't lost.
          restored = true;
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
          setDraft(text);
          setAttachments(sentAttachments);
          setCanRetry(true);
        }
      }
    } finally {
      abort.current = null;
      if (items.length) setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", items }]);
      setLive(null);
      if (!restored) for (const a of sentAttachments) URL.revokeObjectURL(a.previewUrl);
      if (changed) router.refresh();
    }
  }

  const [, startDecision] = useTransition();
  function decide(proposal: ProposalView, approved: boolean) {
    setDeciding(proposal.id);
    startDecision(async () => {
      const res = approved ? await approveProposalAction(proposal.id) : await declineProposalAction(proposal.id);
      setDeciding(null);
      if (!res.ok) return setError(res.error);
      setMessages((prev) =>
        prev.map((m) => ({ ...m, items: m.items.map((i) => (i.kind === "proposal" && i.proposal.id === proposal.id ? { kind: "proposal", proposal: res.data } : i)) })),
      );
      if (approved) router.refresh();
    });
  }

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    let w = startW;
    const move = (ev: PointerEvent) => {
      w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW - (ev.clientX - startX)));
      setDragWidth(w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setStoredWidth(String(w));
      setDragWidth(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const all = live ? [...messages, { id: "live", role: "assistant" as const, items: live }] : messages;
  const status = streaming ? "Copilot is replying…" : all.at(-1)?.role === "assistant" ? "Copilot replied." : "";

  function onResizeKey(e: React.KeyboardEvent) {
    const step = { ArrowLeft: RESIZE_STEP, ArrowRight: -RESIZE_STEP }[e.key];
    if (!step) return;
    e.preventDefault();
    setStoredWidth(String(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width + step))));
  }

  return (
    <>
      {/* Below lg the copilot is a sheet over a scrim; both slide/fade so closing animates too. */}
      <div
        className={cn(
          "fixed inset-0 z-40 hidden bg-primary/30 backdrop-blur-sm transition-opacity duration-300 md:block lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      <aside
        ref={aside}
        id={COPILOT_PANEL_ID}
        aria-label="Copilot"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
        // Following a link from the chat (e.g. "See the post") should reveal that page.
        onClickCapture={(e) => mobileOpen && (e.target as HTMLElement).closest("a[href]") && setMobileOpen(false)}
        style={{ "--copilot-w": `${width}px` } as React.CSSProperties}
        className={cn(
          "flex bg-surface transition-[translate,width,visibility] duration-300 ease-out",
          // Below md it fills the screen; on tablets it's a side sheet. Either way it slides in from the right.
          "max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:w-full max-lg:shadow-lg md:max-lg:w-[26rem] md:max-lg:border-l md:max-lg:border-border",
          !mobileOpen && "max-lg:invisible max-lg:translate-x-full",
          // From lg it's docked on the right; collapsing shrinks it toward the edge, so the content slides off-screen.
          "lg:relative lg:shrink-0 lg:overflow-hidden lg:border-border",
          collapsed ? "lg:invisible lg:w-0 lg:border-l-0" : "lg:w-[var(--copilot-w)] lg:border-l",
          dragWidth !== null && "transition-none",
        )}
      >
        <div
          className="flex h-full min-h-0 w-full flex-col lg:w-[var(--copilot-w)] lg:shrink-0"
        >
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
            <span className="grid size-8 place-items-center rounded-xl bg-brand-tea/70 text-primary"><Sparkles className="size-4" aria-hidden /></span>
            <h2 className="font-display text-base font-semibold">Copilot</h2>
            <span className="flex-1" />
            {project && <ProjectSwitcher projects={projects} currentId={project.id} variant="chip" />}
            <button type="button" onClick={() => setCollapsed(true)} aria-label="Hide the copilot" className="hidden size-9 place-items-center rounded-lg text-muted-foreground hover:bg-primary-soft lg:grid">
              <PanelRightClose className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close the copilot" className="grid size-11 place-items-center rounded-lg hover:bg-primary-soft lg:hidden">
              <X className="size-5" aria-hidden />
            </button>
          </header>

          {!project ? (
            <FirstProject />
          ) : (
            <>
              <p className="sr-only" aria-live="polite">{status}</p>
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                  {all.length === 0 ? (
                    <div className="flex h-full flex-col justify-end gap-3 pb-2">
                      <div className="px-1">
                        <p className="font-display text-lg font-semibold">{blank ? "Hi! What are we promoting?" : `Hi! I know ${project.name}.`}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {blank
                            ? "Ask me anything, tell me about your app, or paste its link and I'll set it up."
                            : "Ask me to fix its details, or attach a video and tell me where and when to post it."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(blank ? BLANK_SUGGESTIONS : SUGGESTIONS).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => void send(s)}
                            className="min-h-9 rounded-full border border-border bg-background px-3 text-left text-xs font-semibold text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ol className="flex flex-col gap-4">
                      {all.map((m) => (
                        <li key={m.id} className={cn("flex flex-col gap-1.5", m.role === "user" && "items-end")}>
                          {m.items.map((item, i) => (
                            <MessageItem key={i} item={item} role={m.role} deciding={deciding} onDecide={decide} />
                          ))}
                          {m.id === "live" && m.items.at(-1)?.kind !== "text" && (
                            <span className="py-1"><Loader variant="dots" size={16} label="Thinking" /></span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                  {error && (
                    <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive-soft px-3 py-2 text-sm text-destructive">
                      <p className="min-w-0 flex-1">
                        {error}
                        {canRetry && <span className="block text-xs">Your message is back in the box.</span>}
                      </p>
                      {canRetry && (
                        <Button size="sm" variant="secondary" onClick={() => void send()} disabled={streaming}>
                          <RotateCw aria-hidden /> Retry
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {!atBottom && (
                  <button
                    type="button"
                    onClick={jumpToLatest}
                    className="absolute bottom-3 left-1/2 flex min-h-9 -translate-x-1/2 animate-pop-in items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-xs font-bold text-foreground shadow-md hover:bg-primary-soft"
                  >
                    <ArrowDown className="size-3.5" aria-hidden /> Jump to latest
                  </button>
                )}
              </div>
              <ChatInput
                value={draft}
                onChange={setDraft}
                onSend={() => void send()}
                onStop={() => abort.current?.abort()}
                streaming={streaming}
                attachments={attachments}
                onAttach={attach}
                onRemoveAttachment={removeAttachment}
                placeholder={blank ? "Ask the copilot anything…" : `Ask about ${project.name}…`}
              />
            </>
          )}

          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label="Resize the copilot"
            aria-valuenow={width}
            aria-valuemin={MIN_WIDTH}
            aria-valuemax={MAX_WIDTH}
            onPointerDown={startResize}
            onKeyDown={onResizeKey}
            className="absolute inset-y-0 left-0 hidden w-1.5 cursor-col-resize hover:bg-brand-tea/50 focus-visible:bg-brand-tea/70 lg:block"
          />
        </div>
      </aside>
    </>
  );
}

function MessageItem({
  item,
  role,
  deciding,
  onDecide,
}: {
  item: ChatItem;
  role: "user" | "assistant";
  deciding: string | null;
  onDecide: (p: ProposalView, approved: boolean) => void;
}) {
  if (item.kind === "text") {
    return role === "user" ? (
      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-on-primary">{item.text}</p>
    ) : (
      <p className="max-w-[95%] whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{item.text}</p>
    );
  }
  if (item.kind === "attachments") {
    return (
      <ul className="flex flex-wrap justify-end gap-1.5">
        {item.media.map((m) => (
          <li key={m.id} className="h-20 w-14 overflow-hidden rounded-xl bg-muted">
            {m.thumbUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.thumbUrl} alt="" className="size-full object-cover" />
            )}
          </li>
        ))}
      </ul>
    );
  }
  if (item.kind === "tool") return <ToolRow item={item} />;
  return <PostApprovalCard proposal={item.proposal} busy={deciding === item.proposal.id} onDecide={(approved) => onDecide(item.proposal, approved)} />;
}

/** The copilot needs a project; with none yet, it asks for the app's link right here. */
function FirstProject() {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-1 flex-col justify-end gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createProjectFromLinkAction(link);
          if (!res.ok) return setError(res.error);
          router.push(`/projects/${res.data.projectId}?review=1`);
          router.refresh();
        });
      }}
    >
      <p className="font-display text-lg font-semibold">Which app are we promoting?</p>
      <p className="text-sm text-muted-foreground">Paste its App Store, Google Play or website link. I&apos;ll pull the screenshots and draft everything ads need.</p>
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://apps.apple.com/…" aria-label="App link" inputMode="url" className="pl-10" required />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {pending && <p className="text-sm text-muted-foreground">Reading the listing and drafting your project… about 20 seconds.</p>}
      <Button type="submit" loading={pending}><Sparkles aria-hidden /> Set up my app</Button>
    </form>
  );
}

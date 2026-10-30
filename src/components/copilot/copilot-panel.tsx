"use client";

import { Link2, PanelLeftClose, PanelLeftOpen, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { approveProposalAction, createProjectFromLinkAction, declineProposalAction } from "@/app/(app)/actions";
import { uploadFile } from "@/app/(app)/compose/media";
import { ProjectSwitcher, type ProjectOption } from "@/components/app/project-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Loader } from "@/components/ui/loader";
import type { ChatItem, ChatMessage, CopilotEvent, ProposalView } from "@/lib/copilot/types";
import { cn } from "@/lib/utils";
import { ChatInput, type PendingAttachment } from "./chat-input";
import { PostApprovalCard, ToolRow } from "./tool-approval";

const WIDTH_KEY = "vieews.copilot.width";
const COLLAPSED_KEY = "vieews.copilot.collapsed";
const MIN_WIDTH = 320;
const MAX_WIDTH = 560;

const SUGGESTIONS = ["What's still missing from my project?", "Write 3 caption ideas for my next post", "What's scheduled this week?"];

const STORED_EVENT = "vieews:stored";

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A per-browser preference; renders the default on the server and before hydration. */
function useStored(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(STORED_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(STORED_EVENT, onChange);
      };
    },
    () => readStored(key),
    () => null,
  );
  const set = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Storage can be unavailable (private mode); the panel still works.
      }
      window.dispatchEvent(new Event(STORED_EVENT));
    },
    [key],
  );
  return [value, set];
}

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
}: {
  project: ProjectOption | null;
  projects: ProjectOption[];
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [live, setLive] = useState<ChatItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storedCollapsed, setStoredCollapsed] = useStored(COLLAPSED_KEY);
  const [storedWidth, setStoredWidth] = useStored(WIDTH_KEY);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fab = useRef<HTMLButtonElement>(null);

  // The phone sheet behaves like a dialog: focus moves in, Esc closes it, focus returns to the button.
  useEffect(() => {
    if (!mobileOpen) return;
    const opener = fab.current;
    document.getElementById("copilot-input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [mobileOpen]);
  const streaming = live !== null;
  const collapsed = storedCollapsed === "1";
  const width = dragWidth ?? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(storedWidth) || 384));

  // Server data wins whenever it changes (project switch, refresh after an action), except mid-turn.
  useEffect(() => {
    if (!abort.current) setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, live, mobileOpen, collapsed]);

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
    setDraft("");
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
          const event = JSON.parse(line) as CopilotEvent;
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
      if (!(err instanceof DOMException && err.name === "AbortError")) setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      abort.current = null;
      if (items.length) setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", items }]);
      setLive(null);
      for (const a of sentAttachments) URL.revokeObjectURL(a.previewUrl);
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
      w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + ev.clientX - startX));
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

  const toggleCollapsed = (value: boolean) => setStoredCollapsed(value ? "1" : "0");

  const all = live ? [...messages, { id: "live", role: "assistant" as const, items: live }] : messages;

  return (
    <>
      {collapsed && (
        <div className="hidden w-14 shrink-0 flex-col items-center border-r border-border bg-surface py-3 lg:flex">
          <button
            type="button"
            onClick={() => toggleCollapsed(false)}
            aria-label="Open the copilot"
            className="grid size-11 place-items-center rounded-xl bg-primary text-on-primary shadow-pop transition-transform hover:-translate-y-0.5"
          >
            <PanelLeftOpen className="size-5" aria-hidden />
          </button>
        </div>
      )}

      <aside
        aria-label="Copilot"
        {...(mobileOpen ? { role: "dialog", "aria-modal": true } : {})}
        style={{ "--copilot-w": `${width}px` } as React.CSSProperties}
        className={cn(
          "flex-col bg-surface",
          mobileOpen ? "fixed inset-0 z-50 flex sheet-in" : "hidden",
          !collapsed && "lg:relative lg:z-auto lg:flex lg:w-[var(--copilot-w)] lg:shrink-0 lg:border-r lg:border-border lg:[animation:none]",
        )}
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-tea/70 text-primary"><Sparkles className="size-4" aria-hidden /></span>
          <h2 className="font-display text-base font-semibold">Copilot</h2>
          <span className="flex-1" />
          {project && <ProjectSwitcher projects={projects} currentId={project.id} variant="chip" />}
          <button type="button" onClick={() => toggleCollapsed(true)} aria-label="Hide the copilot" className="hidden size-9 place-items-center rounded-lg text-muted-foreground hover:bg-primary-soft lg:grid">
            <PanelLeftClose className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close the copilot" className="grid size-11 place-items-center rounded-lg hover:bg-primary-soft lg:hidden">
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {!project ? (
          <FirstProject />
        ) : (
          <>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              {/* Announce finished replies once instead of re-reading every streamed token. */}
              <p className="sr-only" aria-live="polite">{!streaming && all.at(-1)?.role === "assistant" ? "The copilot replied." : ""}</p>
              {all.length === 0 ? (
                <div className="flex h-full flex-col justify-end gap-3 pb-2">
                  <div className="px-1">
                    <p className="font-display text-lg font-semibold">Hi! I know {project.name}.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Ask me to fix its details, or attach a video and tell me where and when to post it.</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
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
                <p role="alert" className="mt-3 rounded-xl border border-destructive/25 bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>
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
              placeholder={`Ask about ${project.name}…`}
            />
          </>
        )}

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the copilot"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={(e) => {
            const step = e.key === "ArrowRight" ? 16 : e.key === "ArrowLeft" ? -16 : 0;
            if (!step) return;
            e.preventDefault();
            setStoredWidth(String(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width + step))));
          }}
          className="absolute inset-y-0 -right-1 hidden w-2 cursor-col-resize outline-none hover:bg-brand-tea/50 focus-visible:bg-brand-teal/60 lg:block"
        />
      </aside>

      {/* Stays mounted while the sheet is open so focus can return to it. */}
      <button
        ref={fab}
        type="button"
        onClick={() => setMobileOpen(true)}
        hidden={mobileOpen}
        aria-haspopup="dialog"
        className="fixed bottom-5 right-5 z-40 flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-on-primary shadow-lg lg:hidden"
      >
        <Sparkles className="size-4" aria-hidden /> Copilot
      </button>
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

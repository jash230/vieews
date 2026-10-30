"use client";

// Adapted from 21st.dev "Agent Chat" by serafimcloud (https://21st.dev/@serafimcloud/components/agent-chat):
// the composer, restyled to Vieews tokens, with video/image attachments that upload as they're added.

import { ArrowUp, Paperclip, Play, Square, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

export interface PendingAttachment {
  key: string;
  file: File;
  previewUrl: string;
  kind: "video" | "image";
  state: { status: "uploading" } | { status: "done"; assetId: string } | { status: "error"; error: string };
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  attachments,
  onAttach,
  onRemoveAttachment,
  placeholder = "Ask the copilot…",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  attachments: PendingAttachment[];
  onAttach: (files: FileList) => void;
  onRemoveAttachment: (key: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = attachments.some((a) => a.state.status === "uploading");
  const canSend = !streaming && !uploading && !disabled && (value.trim().length > 0 || attachments.some((a) => a.state.status === "done"));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    el.style.overflowY = el.scrollHeight > 160 ? "auto" : "hidden";
  }, [value]);

  return (
    <div className="shrink-0 px-3 pb-3">
      <div
        className="cursor-text rounded-2xl border border-border bg-background shadow-sm transition-colors focus-within:border-accent focus-within:ring-4 focus-within:ring-brand-tea/50"
        onClick={(e) => !(e.target as HTMLElement).closest("button, textarea") && ref.current?.focus()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) onAttach(e.dataTransfer.files);
        }}
      >
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 px-2.5 pt-2.5" aria-label="Attachments">
            {attachments.map((a) => (
              <li key={a.key} className="group relative size-14 overflow-hidden rounded-xl bg-muted">
                {a.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.previewUrl} alt={a.file.name} className="size-full object-cover" />
                ) : (
                  <video src={a.previewUrl} muted playsInline className="size-full object-cover" aria-label={a.file.name} />
                )}
                {a.kind === "video" && a.state.status !== "uploading" && (
                  <Play className="absolute bottom-1 left-1 size-3.5 fill-white text-white drop-shadow" aria-hidden />
                )}
                {a.state.status === "uploading" && (
                  <span className="absolute inset-0 grid place-items-center bg-foreground/40"><Loader variant="dots" size={14} label="Uploading" /></span>
                )}
                {a.state.status === "error" && (
                  <span className="absolute inset-0 grid place-items-center bg-destructive/70 text-[10px] font-bold text-white" title={a.state.error}>
                    Failed<span className="sr-only">: {a.state.error}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(a.key)}
                  aria-label={`Remove ${a.file.name}`}
                  className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-foreground/70 text-white"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <label htmlFor="copilot-input" className="sr-only">Message the copilot</label>
        <textarea
          id="copilot-input"
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="block w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-base leading-relaxed text-foreground outline-none placeholder:text-subtle-foreground disabled:opacity-50 sm:text-sm"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label="Attach a video or photos"
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-foreground"
          >
            <Paperclip className="size-[18px]" aria-hidden />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) onAttach(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            aria-label={streaming ? "Stop" : "Send"}
            onClick={() => (streaming ? onStop() : canSend && onSend())}
            disabled={!streaming && !canSend}
            className={cn(
              "grid size-9 place-items-center rounded-full transition-[background-color,translate] duration-150 ease-spring",
              streaming || canSend ? "bg-primary text-on-primary hover:-translate-y-0.5" : "bg-muted text-subtle-foreground",
            )}
          >
            {streaming ? <Square className="size-3 fill-current" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}

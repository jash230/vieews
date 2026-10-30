"use client";

import { Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { switchProjectAction } from "@/app/(app)/actions";
import { ProjectIcon } from "@/app/(app)/projects/project-icon";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

export interface ProjectOption {
  id: string;
  name: string;
  iconUrl: string | null;
}

/**
 * Picks the project the whole app (workspace and copilot) works on. Used as the top-left menu and,
 * compact, as the chip in the copilot's header; both switch the same cookie.
 */
export function ProjectSwitcher({
  projects,
  currentId,
  variant = "menu",
  className,
}: {
  projects: ProjectOption[];
  currentId: string | null;
  variant?: "menu" | "chip";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = projects.find((p) => p.id === currentId) ?? null;
  const shown = query ? projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())) : projects;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: string) {
    if (id === currentId) return setOpen(false);
    setSwitching(id);
    setError(null);
    start(async () => {
      const res = await switchProjectAction(id);
      setSwitching(null);
      // Keep the menu open on failure so the reason is visible.
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  }

  const chip = variant === "chip";
  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen((o) => !o);
        }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Project: ${current?.name ?? "none"}. Switch project`}
        className={cn(
          "flex min-w-0 items-center gap-2 text-left transition-colors duration-150",
          chip
            ? "min-h-9 max-w-[12rem] rounded-full border border-border bg-background py-1 pl-1 pr-2.5 text-xs font-bold hover:border-border-strong"
            : "min-h-11 max-w-[16rem] rounded-2xl px-2 hover:bg-primary-soft",
        )}
      >
        {current ? <ProjectIcon name={current.name} url={current.iconUrl} size={chip ? 24 : 32} /> : <span className="grid size-8 place-items-center rounded-xl bg-muted"><Plus className="size-4" aria-hidden /></span>}
        <span className={cn("min-w-0 flex-1 truncate", chip ? "" : "font-display text-base font-semibold")}>{current?.name ?? "New project"}</span>
        {pending ? <Loader variant="dots" size={14} label={null} /> : <ChevronsUpDown className="size-4 shrink-0 text-subtle-foreground" aria-hidden />}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-72 animate-pop-in rounded-2xl border border-border bg-background p-1.5 shadow-lg",
            chip ? "right-0" : "left-0",
          )}
        >
          {projects.length > 6 && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a project"
              aria-label="Find a project"
              className="mb-1 min-h-10 w-full rounded-xl border border-border px-3 text-sm focus-visible:border-accent focus-visible:outline-none"
            />
          )}
          <ul id={listId} aria-label="Projects" className="max-h-72 overflow-y-auto">
            {shown.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  autoFocus={projects.length <= 6 && p.id === (currentId ?? shown[0]?.id)}
                  aria-current={p.id === currentId || undefined}
                  onClick={() => pick(p.id)}
                  disabled={pending}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-sm font-semibold hover:bg-primary-soft disabled:opacity-60"
                >
                  <ProjectIcon name={p.name} url={p.iconUrl} size={28} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {switching === p.id ? <Loader variant="dots" size={14} label={null} /> : p.id === currentId && <Check className="size-4 text-primary" aria-hidden />}
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-2 text-sm text-muted-foreground">No match</li>}
          </ul>
          {error && <p role="alert" className="px-2 py-1.5 text-xs text-destructive">{error}</p>}
          <div className="mt-1 border-t border-border pt-1">
            <Link href="/projects/new" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 text-sm font-semibold hover:bg-primary-soft">
              <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary"><Plus className="size-4" aria-hidden /></span>
              New project
            </Link>
            {current && (
              <Link href={`/projects/${current.id}`} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 text-sm font-semibold hover:bg-primary-soft">
                <span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground"><Settings2 className="size-4" aria-hidden /></span>
                Project settings
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

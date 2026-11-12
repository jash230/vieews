"use client";

import { Sparkles } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const COPILOT_PANEL_ID = "copilot-panel";

const COLLAPSED_KEY = "vieews.copilot.collapsed";
const STORED_EVENT = "vieews:stored";
const DESKTOP_QUERY = "(min-width: 64rem)";

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A per-browser preference; renders the default on the server and before hydration. */
export function useStored(key: string): [string | null, (value: string) => void] {
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

/**
 * False until a couple of frames after hydration. Saved preferences (collapsed, width) only apply
 * once the page hydrates, so transitions stay off until then: the panel snaps to its saved state
 * instead of visibly sliding there on every page load.
 */
let settled = false;
const settledListeners = new Set<() => void>();
function subscribeSettled(onChange: () => void) {
  settledListeners.add(onChange);
  if (!settled) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        settled = true;
        settledListeners.forEach((l) => l());
      }),
    );
  }
  return () => void settledListeners.delete(onChange);
}
export function useSettled(): boolean {
  return useSyncExternalStore(subscribeSettled, () => settled, () => false);
}

/** True from lg up, where the copilot is docked instead of an overlay. */
function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

type CopilotUIValue = {
  /** The overlay below lg. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The docked panel from lg up, remembered per browser. */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};

// The sidebar button and the panel sit in different parts of the layout (the panel streams in
// behind Suspense), so they share the open state here.
const CopilotUI = createContext<CopilotUIValue | null>(null);

export function CopilotUIProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [storedCollapsed, setStoredCollapsed] = useStored(COLLAPSED_KEY);
  const trigger = useRef<HTMLElement | null>(null);
  const setOpen = useCallback((next: boolean) => {
    if (next) trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpenState(next);
    // Hand focus back to whatever opened it, like a dialog does.
    if (!next) requestAnimationFrame(() => trigger.current?.focus());
  }, []);
  const collapsed = storedCollapsed === "1";
  const setCollapsed = useCallback((next: boolean) => setStoredCollapsed(next ? "1" : "0"), [setStoredCollapsed]);
  const value = useMemo(() => ({ open, setOpen, collapsed, setCollapsed }), [open, setOpen, collapsed, setCollapsed]);
  return <CopilotUI value={value}>{children}</CopilotUI>;
}

export function useCopilotUI() {
  const ui = useContext(CopilotUI);
  if (!ui) throw new Error("useCopilotUI needs a CopilotUIProvider");
  return ui;
}

/** The phone top-bar button that opens the copilot overlay. */
export function CopilotToggle({ className }: { className?: string }) {
  const { open, setOpen } = useCopilotUI();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-expanded={open}
      aria-controls={COPILOT_PANEL_ID}
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-bold text-on-primary shadow-pop transition-[translate,box-shadow] duration-200 ease-spring active:translate-y-[3px] active:shadow-none",
        className,
      )}
    >
      <Sparkles className="size-4" aria-hidden /> Copilot
    </button>
  );
}

/**
 * The strip on the right edge (tablet and up) that opens the copilot. From lg it only shows while
 * the docked panel is collapsed, sliding in as the panel slides out.
 */
export function CopilotRail() {
  const { open, setOpen, collapsed, setCollapsed } = useCopilotUI();
  const desktop = useIsDesktop();
  const hidden = desktop && !collapsed;
  const settledUI = useSettled();
  return (
    <div
      className={cn(
        "hidden shrink-0 overflow-hidden border-border bg-surface transition-[width,visibility] duration-300 ease-out md:flex",
        hidden ? "invisible w-0" : "w-16 border-l",
        !settledUI && "transition-none",
      )}
    >
      <div className="flex w-16 shrink-0 flex-col items-center py-4">
        <button
          type="button"
          onClick={() => (desktop ? setCollapsed(false) : setOpen(true))}
          aria-expanded={desktop ? !collapsed : open}
          aria-controls={COPILOT_PANEL_ID}
          aria-label="Open the copilot"
          className="group flex flex-col items-center gap-1.5 rounded-2xl px-1.5 py-2 text-[11px] font-bold text-primary"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-on-primary shadow-pop transition-[translate,box-shadow] duration-200 ease-spring group-hover:-translate-y-0.5 group-active:translate-y-[3px] group-active:shadow-none">
            <Sparkles className="size-5" aria-hidden />
          </span>
          Copilot
        </button>
      </div>
    </div>
  );
}

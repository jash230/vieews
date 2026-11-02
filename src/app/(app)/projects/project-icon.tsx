import { cn } from "@/lib/utils";

/** The app's icon, or a tile with its first letter. */
export function ProjectIcon({ name, url, size = 32, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  return url ? (
    <img src={url} alt="" style={style} className={cn("shrink-0 rounded-[22%] object-cover shadow-sm", className)} />
  ) : (
    <span
      style={{ ...style, fontSize: size * 0.45 }}
      className={cn("grid shrink-0 place-items-center rounded-[22%] bg-brand-tea/60 font-display font-semibold text-primary", className)}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

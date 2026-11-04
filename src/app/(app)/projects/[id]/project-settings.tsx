"use client";

import { ArrowUp, ImagePlus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { PlatformBadge, PLATFORM_META } from "@/components/app/platform";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import type { ProjectKit } from "@/lib/projects/kit";
import type { ProjectMediaRole } from "@/lib/projects/service";
import type { MediaKind, PublicAccount } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteProjectAction, setProjectAccountsAction, setProjectMediaAction, updateProjectAction, type ActionResult } from "../../actions";
import { uploadFile } from "../../compose/media";

interface MediaItem {
  id: string;
  role: ProjectMediaRole;
  shows: string;
  tags: string[];
  url: string | null;
  kind: MediaKind;
}

interface Props {
  project: { id: string; name: string; storeUrl: string | null; notes: string; kit: ProjectKit };
  media: MediaItem[];
  accounts: PublicAccount[];
  linked: string[];
}

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const commas = (s: string) => s.split(",").map((l) => l.trim().replace(/^#/, "")).filter(Boolean);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A section's form state that follows the server. When the saved value changes (a save in this
 * section, or the copilot editing the project) the form takes it, unless that would overwrite
 * edits you haven't saved. Other sections' saves don't touch it.
 */
function useSynced<T>(server: T, key: (v: T) => unknown = (v) => v) {
  const [value, setValue] = useState(server);
  const [synced, setSynced] = useState(server);
  if (!same(key(server), key(synced))) {
    setSynced(server);
    if (same(key(value), key(synced)) || same(key(value), key(server))) setValue(server);
  }
  return [value, setValue] as const;
}

/** Saves a section: a toast on success, the error next to its button on failure. */
function useSave(success: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (fn: () => Promise<ActionResult<unknown>>) =>
    start(async () => {
      const res = await fn();
      setError(res.ok ? null : res.error);
      if (!res.ok) return;
      toast.success(success);
      router.refresh();
    });
  return { pending, error, save };
}

function SaveRow({ pending, error, label = "Save", disabled }: { pending: boolean; error: string | null; label?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button type="submit" loading={pending} disabled={disabled}>{label}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function ProjectSettings({ project, media, accounts, linked }: Props) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <KitForm project={project} />
        <ScreensEditor projectId={project.id} initial={media} />
      </div>
      <div className="space-y-6">
        <AccountsPicker projectId={project.id} accounts={accounts} linked={linked} />
        <DangerZone projectId={project.id} name={project.name} />
      </div>
    </div>
  );
}

function KitForm({ project }: { project: Props["project"] }) {
  const id = useId();
  const k = project.kit;
  const [f, setF] = useSynced({
    name: project.name,
    storeUrl: project.storeUrl ?? "",
    oneLiner: k.oneLiner,
    audience: k.audience,
    pains: k.pains.join("\n"),
    outcomes: k.outcomes.join("\n"),
    magic: k.magicMoment.description,
    allowed: k.claims.allowed.join("\n"),
    banned: k.claims.banned.join("\n"),
    cta: k.cta,
    tone: k.tone.join(", "),
    personas: k.personas.join("\n"),
    hashtags: k.hashtags.join(", "),
    notes: project.notes,
  });
  const set = (key: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [key]: e.target.value });
  const { pending, error, save } = useSave("Project details saved");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save(() =>
      updateProjectAction(project.id, {
        name: f.name,
        storeUrl: f.storeUrl.trim() || null,
        notes: f.notes,
        kit: {
          oneLiner: f.oneLiner,
          audience: f.audience,
          pains: lines(f.pains),
          outcomes: lines(f.outcomes),
          magicMoment: { ...k.magicMoment, description: f.magic },
          claims: { allowed: lines(f.allowed), banned: lines(f.banned) },
          cta: f.cta,
          tone: commas(f.tone),
          personas: lines(f.personas),
          hashtags: commas(f.hashtags),
        },
      }),
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>About the app</CardTitle>
          <CardDescription>Every ad is built from this. Ads only claim what&apos;s in &ldquo;Ads may say&rdquo;.</CardDescription>
        </div>
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-name`} label="Name" required>
            <Input id={`${id}-name`} value={f.name} onChange={set("name")} maxLength={80} required />
          </Field>
          <Field id={`${id}-url`} label="Store or website link">
            <Input id={`${id}-url`} value={f.storeUrl} onChange={set("storeUrl")} inputMode="url" />
          </Field>
          <Field id={`${id}-one`} label="One-line pitch" counter={{ value: f.oneLiner.length, max: 160 }} className="sm:col-span-2">
            <Input id={`${id}-one`} value={f.oneLiner} onChange={set("oneLiner")} />
          </Field>
          <Field id={`${id}-aud`} label="Who it's for" hint="A specific person and the moment they'd want it." className="sm:col-span-2">
            <Textarea id={`${id}-aud`} value={f.audience} onChange={set("audience")} className="min-h-20" />
          </Field>
          <Field id={`${id}-pains`} label="Pains" hint="One per line, in their words.">
            <Textarea id={`${id}-pains`} value={f.pains} onChange={set("pains")} />
          </Field>
          <Field id={`${id}-out`} label="What it delivers" hint="One per line. No invented numbers.">
            <Textarea id={`${id}-out`} value={f.outcomes} onChange={set("outcomes")} />
          </Field>
          <Field id={`${id}-magic`} label="The magic moment" hint="The one screen that makes people ask &ldquo;what app is that?&rdquo;" className="sm:col-span-2">
            <Textarea id={`${id}-magic`} value={f.magic} onChange={set("magic")} className="min-h-20" />
          </Field>
          <Field id={`${id}-allowed`} label="Ads may say" hint="Plain facts, one per line.">
            <Textarea id={`${id}-allowed`} value={f.allowed} onChange={set("allowed")} />
          </Field>
          <Field id={`${id}-banned`} label="Ads must never say" hint="One per line.">
            <Textarea id={`${id}-banned`} value={f.banned} onChange={set("banned")} />
          </Field>
          <Field id={`${id}-cta`} label="Call to action" hint="e.g. Free on the App Store: search Tally" className="sm:col-span-2">
            <Input id={`${id}-cta`} value={f.cta} onChange={set("cta")} />
          </Field>
          <Field id={`${id}-tone`} label="Tone" hint="Comma separated.">
            <Input id={`${id}-tone`} value={f.tone} onChange={set("tone")} />
          </Field>
          <Field id={`${id}-tags`} label="Hashtags" hint="Comma separated, without #.">
            <Input id={`${id}-tags`} value={f.hashtags} onChange={set("hashtags")} />
          </Field>
          <Field id={`${id}-personas`} label="People who'd use it" hint="One per line, for ads with AI people." className="sm:col-span-2">
            <Textarea id={`${id}-personas`} value={f.personas} onChange={set("personas")} className="min-h-20" />
          </Field>
          <Field id={`${id}-notes`} label="Notes for the copilot" hint="Voice, no-gos, anything that would make you wince." className="sm:col-span-2">
            <Textarea id={`${id}-notes`} value={f.notes} onChange={set("notes")} className="min-h-20" />
          </Field>
          <div className="sm:col-span-2">
            <SaveRow pending={pending} error={error} />
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ScreensEditor({ projectId, initial }: { projectId: string; initial: MediaItem[] }) {
  const id = useId();
  // Compared without `url`: signed URLs change on every refresh, and fresh uploads show a local preview.
  const [items, setItems] = useSynced(initial, (list) => list.map((m) => ({ ...m, url: null })));
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { pending, error, save } = useSave("Images saved");

  const update = (mediaId: string, patch: Partial<MediaItem>) => setItems((prev) => prev.map((m) => (m.id === mediaId ? { ...m, ...patch } : m)));
  const moveUp = (index: number) =>
    setItems((prev) => {
      if (index <= 0) return prev;
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadError(null);
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    setUploading((n) => n + list.length);
    await Promise.all(
      list.map(async (file) => {
        try {
          const assetId = await uploadFile(file);
          setItems((prev) => [...prev, { id: assetId, role: "screen", shows: "", tags: [], url: URL.createObjectURL(file), kind: "image" }]);
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading > 0) return;
    save(() => setProjectMediaAction(projectId, items.map((m) => ({ mediaAssetId: m.id, role: m.role, shows: m.shows, tags: m.tags }))));
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Screenshots and logo</CardTitle>
          <CardDescription>Say what each screen shows. Tag the ones that make people want the app as magic.</CardDescription>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => fileInput.current?.click()} loading={uploading > 0}>
          <ImagePlus aria-hidden /> Add images
        </Button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          {uploadError && <Notice tone="error">{uploadError}</Notice>}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No images yet. Add full-resolution phone screenshots, including the magic-moment screen.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((m, i) => {
                const magic = m.tags.includes("magic");
                return (
                  <li key={m.id} className="flex gap-3 rounded-2xl border border-border bg-surface p-3">
                    {m.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className={cn("w-16 shrink-0 rounded-xl object-cover", m.role === "logo" ? "h-16" : "h-28")} />
                    ) : (
                      <span className="h-28 w-16 shrink-0 rounded-xl bg-muted" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-1">
                        <select
                          aria-label="Kind"
                          value={m.role}
                          onChange={(e) => update(m.id, { role: e.target.value as ProjectMediaRole })}
                          className="min-h-9 rounded-lg border border-border bg-background px-2 text-xs font-semibold"
                        >
                          <option value="screen">Screen</option>
                          <option value="logo">Logo</option>
                          <option value="photo">Photo</option>
                        </select>
                        <button
                          type="button"
                          aria-pressed={magic}
                          onClick={() => update(m.id, { tags: magic ? m.tags.filter((t) => t !== "magic") : [...m.tags, "magic"] })}
                          className={cn(
                            "min-h-9 rounded-lg border px-2 text-xs font-bold",
                            magic ? "border-primary bg-primary text-on-primary" : "border-border bg-background text-muted-foreground",
                          )}
                        >
                          Magic
                        </button>
                        <span className="flex-1" />
                        <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => moveUp(i)} className="grid size-9 place-items-center rounded-lg text-subtle-foreground hover:bg-primary-soft disabled:opacity-30">
                          <ArrowUp className="size-4" aria-hidden />
                        </button>
                        <button type="button" aria-label="Remove" onClick={() => setItems((prev) => prev.filter((x) => x.id !== m.id))} className="grid size-9 place-items-center rounded-lg text-subtle-foreground hover:bg-destructive-soft hover:text-destructive">
                          <X className="size-4" aria-hidden />
                        </button>
                      </div>
                      <label className="sr-only" htmlFor={`${id}-${m.id}`}>What it shows</label>
                      <Textarea
                        id={`${id}-${m.id}`}
                        value={m.shows}
                        onChange={(e) => update(m.id, { shows: e.target.value })}
                        placeholder="What it shows"
                        className="min-h-16 text-sm"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <SaveRow pending={pending} error={error} label={uploading > 0 ? "Uploading…" : "Save images"} disabled={uploading > 0} />
        </form>
      </CardBody>
    </Card>
  );
}

function AccountsPicker({ projectId, accounts, linked }: { projectId: string; accounts: PublicAccount[]; linked: string[] }) {
  const [selected, setSelected] = useSynced([...linked].sort());
  const { pending, error, save } = useSave("Accounts updated");
  const toggle = (accountId: string) =>
    setSelected((prev) => (prev.includes(accountId) ? prev.filter((x) => x !== accountId) : [...prev, accountId].sort()));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Posts to</CardTitle>
          <CardDescription>Any connected account can post for several projects.</CardDescription>
        </div>
      </CardHeader>
      <CardBody>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(() => setProjectAccountsAction(projectId, selected));
          }}
          className="space-y-3"
        >
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No accounts connected yet. <a href="/accounts" className="font-semibold text-primary underline underline-offset-2">Connect one</a>.
            </p>
          ) : (
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li key={a.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                    <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="size-4 accent-[var(--color-primary)]" />
                    <PlatformBadge platform={a.platform} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{a.display_name ?? a.username}</span>
                      <span className={cn("block text-xs", a.status === "active" ? "text-muted-foreground" : "text-destructive")}>
                        {a.status === "active" ? PLATFORM_META[a.platform].label : "Reconnect needed"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <a href="/accounts" className="inline-block text-sm font-semibold text-primary hover:underline">Connect another account</a>
          <SaveRow pending={pending} error={error} />
        </form>
      </CardBody>
    </Card>
  );
}

function DangerZone({ projectId, name }: { projectId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Delete project</CardTitle>
          <CardDescription>Removes its copilot chat and settings. Posts already made stay on the platforms.</CardDescription>
        </div>
      </CardHeader>
      <CardBody className="space-y-2">
        <Button
          variant="destructive"
          className="max-w-full"
          loading={pending}
          onClick={() => {
            if (!confirm(`Delete ${name}? Its copilot chat and settings are removed for good.`)) return;
            start(async () => {
              const res = await deleteProjectAction(projectId);
              if (!res.ok) return setError(res.error);
              toast.success(`Deleted ${name}`);
              router.push("/projects");
            });
          }}
        >
          <Trash2 aria-hidden /> <span className="truncate">Delete {name}</span>
        </Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </CardBody>
    </Card>
  );
}

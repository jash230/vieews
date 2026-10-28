"use client";

import { AlertCircle, CalendarClock, CheckCircle2, Film, Info, RefreshCw, Send, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { PlatformBadge, PlatformIcon, PLATFORM_META } from "@/components/app/platform";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { CAPTION_MAX, LIMITS, SUPPORTED_MIME, isVertical, validateTarget, type MediaInfo, type ValidationIssue } from "@/lib/platforms/limits";
import type { TikTokCreatorInfo } from "@/lib/platforms/tiktok";
import type { CreatePostInput } from "@/lib/posts/schema";
import type { InstagramOptions, Platform, PublicAccount, TargetOptions, TikTokOptions, YouTubeOptions } from "@/lib/types";
import { cn, formatBytes, formatDuration } from "@/lib/utils";
import { createPostAction, tiktokCreatorInfoAction } from "../actions";
import { readMediaMeta, useMediaUpload, type MediaMeta } from "./media";

const ACCEPT = [...SUPPORTED_MIME.video, ...SUPPORTED_MIME.image].join(",");

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Scheduling needs at least a minute of lead time. */
function isTooSoon(localValue: string) {
  return new Date(localValue).getTime() < Date.now() + 60_000;
}

function Section({ step, title, description, children }: { step: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-nowrap">
        <div className="flex items-start gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background tabular-nums">{step}</span>
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export function Composer({ accounts }: { accounts: PublicAccount[] }) {
  const router = useRouter();
  const ids = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<MediaMeta | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const { state: upload, upload: startUpload, cancel: cancelUpload } = useMediaUpload();

  const [selected, setSelected] = useState<Set<string>>(() => new Set(accounts.map((a) => a.id)));
  const [caption, setCaption] = useState("");
  const [captionTab, setCaptionTab] = useState<"all" | Platform>("all");
  const [overrides, setOverrides] = useState<Partial<Record<Platform, string>>>({});

  const [yt, setYt] = useState<YouTubeOptions>({ title: "", privacy: "public", tags: [] });
  const [ig, setIg] = useState<InstagramOptions>({ format: "reel", shareToFeed: true });
  const [tt, setTt] = useState<TikTokOptions>({
    privacyLevel: "",
    disableComment: false,
    disableDuet: false,
    disableStitch: false,
    brandOrganic: false,
    brandedContent: false,
  });
  const [commercial, setCommercial] = useState(false);
  const [creatorInfo, setCreatorInfo] = useState<Record<string, TikTokCreatorInfo | { error: string }>>({});

  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduleAt, setScheduleAt] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [minSchedule] = useState(() => toLocalInput(new Date()));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const selectedAccounts = accounts.filter((a) => selected.has(a.id));
  const platforms = [...new Set(selectedAccounts.map((a) => a.platform))];
  const tiktokAccounts = selectedAccounts.filter((a) => a.platform === "tiktok");

  // TikTok requires showing live creator info before posting.
  useEffect(() => {
    for (const a of tiktokAccounts) {
      if (creatorInfo[a.id]) continue;
      tiktokCreatorInfoAction(a.id).then((res) =>
        setCreatorInfo((prev) => ({ ...prev, [a.id]: res.ok ? res.data : { error: res.error } })),
      );
    }
  }, [tiktokAccounts, creatorInfo]);

  const tiktokInfos = tiktokAccounts.map((a) => creatorInfo[a.id]).filter((i): i is TikTokCreatorInfo => !!i && !("error" in i));
  const tiktokPrivacyOptions = tiktokInfos.length
    ? tiktokInfos.map((i) => i.privacyLevelOptions).reduce((acc, opts) => acc.filter((o) => opts.includes(o)))
    : [];
  const tiktokMaxDuration = tiktokInfos.length ? Math.min(...tiktokInfos.map((i) => i.maxVideoPostDurationSec)) : undefined;
  const tiktokLocked = {
    comment: tiktokInfos.some((i) => i.commentDisabled),
    duet: tiktokInfos.some((i) => i.duetDisabled),
    stitch: tiktokInfos.some((i) => i.stitchDisabled),
  };

  // Warn before leaving with unsaved work.
  useEffect(() => {
    if (!file || submitted) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [file, submitted]);

  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  async function pickFile(f: File | undefined) {
    if (!f) return;
    setFileError(null);
    if (!ACCEPT.split(",").includes(f.type)) {
      setFileError("Use an MP4 or MOV video, or a JPEG, PNG or WebP image.");
      return;
    }
    const url = URL.createObjectURL(f);
    try {
      const m = await readMediaMeta(f, url);
      setFile(f);
      setPreviewUrl(url);
      setMeta(m);
      // Keep the Instagram format valid for the media type.
      const isImage = f.type.startsWith("image/");
      setIg((o) => (isImage && o.format === "reel" ? { ...o, format: "post" } : !isImage && o.format === "post" ? { ...o, format: "reel" } : o));
      startUpload(f, m);
    } catch (err) {
      URL.revokeObjectURL(url);
      setFileError(err instanceof Error ? err.message : "Couldn't read this file");
    }
  }

  function clearFile() {
    cancelUpload();
    setFile(null);
    setMeta(null);
    setPreviewUrl(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  const mediaInfo: MediaInfo | null = file && meta
    ? { kind: file.type.startsWith("image/") ? "image" : "video", mime: file.type, sizeBytes: file.size, width: meta.width, height: meta.height, durationS: meta.durationS }
    : null;

  const optionsFor = (platform: Platform): TargetOptions =>
    platform === "youtube"
      ? { platform, youtube: { ...yt, description: overrides.youtube ?? caption } }
      : platform === "instagram"
        ? { platform, instagram: ig }
        : { platform, tiktok: { ...tt, brandOrganic: commercial && tt.brandOrganic, brandedContent: commercial && tt.brandedContent } };

  const captionFor = (platform: Platform) => overrides[platform] ?? caption;

  const issues: ValidationIssue[] = mediaInfo
    ? platforms.flatMap((p) => validateTarget(mediaInfo, captionFor(p), optionsFor(p), { tiktokMaxDurationS: tiktokMaxDuration }))
    : [];

  const extraBlockers: string[] = [];
  if (commercial && !tt.brandOrganic && !tt.brandedContent && platforms.includes("tiktok")) extraBlockers.push("TikTok: choose what kind of commercial content this is.");
  if (when === "later" && !scheduleAt) extraBlockers.push("Pick a date and time.");
  if (tiktokAccounts.some((a) => !creatorInfo[a.id])) extraBlockers.push("Loading TikTok account settings…");
  for (const a of tiktokAccounts) {
    const info = creatorInfo[a.id];
    if (info && "error" in info) extraBlockers.push(`TikTok: ${info.error}`);
  }

  const canSubmit = upload.status === "done" && selectedAccounts.length > 0 && issues.length === 0 && extraBlockers.length === 0 && !submitting;

  function submit() {
    if (upload.status !== "done") return;
    setSubmitError(null);
    if (when === "later" && isTooSoon(scheduleAt)) {
      setSubmitError("Pick a time at least a minute from now.");
      return;
    }
    const input: CreatePostInput = {
      mediaAssetId: upload.assetId,
      caption,
      scheduledFor: when === "later" ? new Date(scheduleAt).toISOString() : null,
      targets: selectedAccounts.map((a) => ({
        accountId: a.id,
        captionOverride: overrides[a.platform] ?? null,
        options: optionsFor(a.platform),
      })),
    };
    startSubmit(async () => {
      const res = await createPostAction(input, tiktokMaxDuration);
      if (!res.ok) {
        setSubmitError(res.error);
        return;
      }
      setSubmitted(true);
      router.push(`/posts/${res.data.postId}`);
    });
  }

  const issuesFor = (platform: Platform, field?: ValidationIssue["field"]) =>
    issues.filter((i) => i.platform === platform && (!field || i.field === field));
  const activeCaption = captionTab === "all" ? caption : overrides[captionTab] ?? caption;
  const captionMax = captionTab === "all" ? Math.min(...(platforms.length ? platforms.map((p) => CAPTION_MAX[p]) : [2200])) : CAPTION_MAX[captionTab];
  const vertical = mediaInfo ? isVertical(mediaInfo) : true;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        {/* 1. Media */}
        <Section step={1} title="Media" description="Vertical 9:16 video works best on every platform.">
          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-200",
                dragging ? "border-primary bg-primary-soft" : "border-border bg-surface",
              )}
            >
              <span className="grid size-14 animate-float place-items-center rounded-2xl bg-background text-primary shadow-pop">
                <UploadCloud className="size-6" aria-hidden />
              </span>
              <p className="mt-4 font-semibold">Drag a video or photo here</p>
              <p className="mt-1 text-sm text-muted-foreground">MP4, MOV, JPEG, PNG or WebP</p>
              <Button type="button" variant="secondary" className="mt-5" onClick={() => fileInput.current?.click()}>
                Choose file
              </Button>
              <input
                ref={fileInput}
                id={`${ids}-file`}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                aria-label="Choose a video or photo"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-background text-muted-foreground shadow-sm">
                <Film className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatBytes(file.size)}
                  {meta?.width && meta.height ? ` · ${meta.width}×${meta.height}` : ""}
                  {meta?.durationS ? ` · ${formatDuration(meta.durationS)}` : ""}
                  {mediaInfo && !vertical && " · landscape"}
                </p>
                <div className="mt-2" aria-live="polite">
                  {upload.status === "uploading" && (
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(upload.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                        <div className="stripes h-full animate-stripes rounded-full bg-accent transition-[width] duration-300" style={{ width: `${upload.progress * 100}%` }} />
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">{Math.round(upload.progress * 100)}%</span>
                    </div>
                  )}
                  {upload.status === "done" && (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-success"><CheckCircle2 className="size-3.5" aria-hidden />Uploaded</p>
                  )}
                  {upload.status === "error" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive"><AlertCircle className="size-3.5" aria-hidden />{upload.error}</p>
                      <Button size="sm" variant="secondary" onClick={() => meta && startUpload(file, meta)}>
                        <RefreshCw aria-hidden /> Retry
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <button type="button" onClick={clearFile} aria-label="Remove file" className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-5" aria-hidden />
              </button>
            </div>
          )}
          {fileError && <p role="alert" className="mt-3 text-sm text-destructive">{fileError}</p>}
        </Section>

        {/* 2. Accounts */}
        <Section step={2} title="Post to" description="Pick one or more accounts.">
          <fieldset>
            <legend className="sr-only">Accounts</legend>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => {
                const on = selected.has(a.id);
                return (
                  <label
                    key={a.id}
                    className={cn(
                      "flex min-h-12 items-center gap-2.5 rounded-xl border py-1.5 pl-1.5 pr-4 text-sm font-medium transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      on ? "border-primary bg-primary-soft text-foreground" : "border-border bg-background text-muted-foreground hover:border-border-strong",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(a.id)) next.delete(a.id);
                          else next.add(a.id);
                          return next;
                        })
                      }
                    />
                    <PlatformBadge platform={a.platform} className={cn("size-8", on && "bg-background")} />
                    <span>{a.display_name ?? a.username}</span>
                    {on && <CheckCircle2 className="size-4 text-primary" aria-hidden />}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {selectedAccounts.length === 0 && <p className="mt-3 text-sm text-destructive" role="alert">Pick at least one account.</p>}
        </Section>

        {/* 3. Caption */}
        <Section step={3} title="Caption" description="Write once, or tailor it per platform.">
          {platforms.length > 1 && (
            <div role="tablist" aria-label="Caption per platform" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
              {(["all", ...platforms] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  type="button"
                  aria-selected={captionTab === tab}
                  onClick={() => setCaptionTab(tab)}
                  className={cn(
                    "flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                    captionTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab === "all" ? "All platforms" : <><PlatformIcon platform={tab} />{PLATFORM_META[tab].label}{overrides[tab] !== undefined && <span className="size-1.5 rounded-full bg-primary" aria-label="customized" />}</>}
                </button>
              ))}
            </div>
          )}
          <Field
            id={`${ids}-caption`}
            label={captionTab === "all" ? "Caption" : `${PLATFORM_META[captionTab].label} caption`}
            counter={{ value: activeCaption.length, max: captionMax }}
            hint={captionTab === "all" ? "Hashtags and @mentions are fine. Instagram allows up to 30 hashtags." : "Only used on this platform."}
            error={issues.find((i) => i.field === "caption" && (captionTab === "all" || i.platform === captionTab))?.message}
          >
            <Textarea
              id={`${ids}-caption`}
              rows={5}
              value={activeCaption}
              aria-invalid={activeCaption.length > captionMax || undefined}
              placeholder="What's this one about?"
              onChange={(e) => (captionTab === "all" ? setCaption(e.target.value) : setOverrides((o) => ({ ...o, [captionTab]: e.target.value })))}
            />
          </Field>
          {captionTab !== "all" && overrides[captionTab] !== undefined && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() =>
                setOverrides((o) => {
                  const next = { ...o };
                  delete next[captionTab];
                  return next;
                })
              }
            >
              Use the shared caption
            </Button>
          )}
        </Section>

        {/* 4. Platform settings */}
        {platforms.length > 0 && (
          <Section step={4} title="Platform settings">
            <div className="divide-y divide-border [&>*]:py-6 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
              {platforms.includes("youtube") && (
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-semibold"><PlatformIcon platform="youtube" />YouTube</h3>
                  <Field
                    id={`${ids}-yt-title`}
                    label="Title"
                    required
                    counter={{ value: yt.title.length, max: LIMITS.youtube.titleMax }}
                    error={issuesFor("youtube", "title")[0]?.message}
                    hint={vertical && (meta?.durationS ?? 0) <= LIMITS.youtube.shortsMaxDurationS ? "This will appear as a YouTube Short (vertical, 3 min or less)." : undefined}
                  >
                    <Input id={`${ids}-yt-title`} value={yt.title} maxLength={120} onChange={(e) => setYt({ ...yt, title: e.target.value })} aria-invalid={!!issuesFor("youtube", "title").length || undefined} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id={`${ids}-yt-privacy`} label="Visibility">
                      <Select id={`${ids}-yt-privacy`} value={yt.privacy} onChange={(e) => setYt({ ...yt, privacy: e.target.value as YouTubeOptions["privacy"] })}>
                        <option value="public">Public</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="private">Private</option>
                      </Select>
                    </Field>
                    <Field id={`${ids}-yt-tags`} label="Tags" hint="Comma separated">
                      <Input
                        id={`${ids}-yt-tags`}
                        defaultValue={yt.tags?.join(", ")}
                        onBlur={(e) => setYt({ ...yt, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                      />
                    </Field>
                  </div>
                  <Switch id={`${ids}-yt-kids`} checked={!!yt.madeForKids} onChange={(v) => setYt({ ...yt, madeForKids: v })} label="Made for kids" description="Required by YouTube if this content is directed at children." />
                  {issuesFor("youtube", "media").map((i) => <p key={i.message} role="alert" className="text-sm text-destructive">{i.message}</p>)}
                </div>
              )}

              {platforms.includes("instagram") && (
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-semibold"><PlatformIcon platform="instagram" />Instagram</h3>
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">Post as</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {(["reel", "post", "story"] as const).map((f) => {
                        const disabled = mediaInfo ? (f === "reel" && mediaInfo.kind !== "video") || (f === "post" && mediaInfo.kind !== "image") : false;
                        return (
                          <label
                            key={f}
                            className={cn(
                              "flex min-h-11 items-center justify-center rounded-xl border text-sm font-medium capitalize transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                              ig.format === f ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:border-border-strong",
                              disabled && "cursor-not-allowed opacity-50",
                            )}
                          >
                            <input type="radio" name={`${ids}-ig-format`} className="sr-only" checked={ig.format === f} disabled={disabled} onChange={() => setIg({ ...ig, format: f })} />
                            {f}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  {ig.format === "reel" && (
                    <Switch id={`${ids}-ig-feed`} checked={ig.shareToFeed ?? true} onChange={(v) => setIg({ ...ig, shareToFeed: v })} label="Also show in feed" description="Reels appear on your profile grid too." />
                  )}
                  {issuesFor("instagram", "media").map((i) => <p key={i.message} role="alert" className="text-sm text-destructive">{i.message}</p>)}
                </div>
              )}

              {platforms.includes("tiktok") && (
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-semibold"><PlatformIcon platform="tiktok" />TikTok</h3>
                  {tiktokInfos.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Posting as <span className="font-semibold text-foreground">{tiktokInfos.map((i) => i.creatorNickname || `@${i.creatorUsername}`).join(", ")}</span>
                    </p>
                  )}
                  <Field id={`${ids}-tt-privacy`} label="Who can view this video" required hint="Until TikTok audits your app, only “Only me” will succeed.">
                    <Select id={`${ids}-tt-privacy`} value={tt.privacyLevel} onChange={(e) => setTt({ ...tt, privacyLevel: e.target.value })} disabled={!tiktokPrivacyOptions.length}>
                      <option value="" disabled>Choose…</option>
                      {tiktokPrivacyOptions.map((o) => (
                        <option key={o} value={o} disabled={commercial && tt.brandedContent && o === "SELF_ONLY"}>
                          {PRIVACY_LABELS[o] ?? o}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="divide-y divide-border rounded-xl border border-border px-4">
                    <Switch id={`${ids}-tt-comment`} checked={!tt.disableComment && !tiktokLocked.comment} disabled={tiktokLocked.comment} onChange={(v) => setTt({ ...tt, disableComment: !v })} label="Allow comments" />
                    <Switch id={`${ids}-tt-duet`} checked={!tt.disableDuet && !tiktokLocked.duet} disabled={tiktokLocked.duet} onChange={(v) => setTt({ ...tt, disableDuet: !v })} label="Allow Duet" />
                    <Switch id={`${ids}-tt-stitch`} checked={!tt.disableStitch && !tiktokLocked.stitch} disabled={tiktokLocked.stitch} onChange={(v) => setTt({ ...tt, disableStitch: !v })} label="Allow Stitch" />
                  </div>
                  <div className="rounded-xl border border-border px-4 py-1">
                    <Switch id={`${ids}-tt-commercial`} checked={commercial} onChange={setCommercial} label="Disclose commercial content" description="Turn on if this promotes yourself, a brand, product or service." />
                    {commercial && (
                      <div className="space-y-3 border-t border-border py-3">
                        <label className="flex min-h-11 items-start gap-3 text-sm">
                          <input type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" checked={tt.brandOrganic} onChange={(e) => setTt({ ...tt, brandOrganic: e.target.checked })} />
                          <span><span className="font-medium">Your brand</span><br /><span className="text-muted-foreground">Labeled “Promotional content”.</span></span>
                        </label>
                        <label className="flex min-h-11 items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1 size-4 accent-[var(--primary)]"
                            checked={tt.brandedContent}
                            onChange={(e) => setTt({ ...tt, brandedContent: e.target.checked, privacyLevel: e.target.checked && tt.privacyLevel === "SELF_ONLY" ? "" : tt.privacyLevel })}
                          />
                          <span><span className="font-medium">Branded content</span><br /><span className="text-muted-foreground">Labeled “Paid partnership”. Can&apos;t be private.</span></span>
                        </label>
                      </div>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    By posting, you agree to TikTok&apos;s{" "}
                    {commercial && tt.brandedContent && (<><a className="underline" href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer">Branded Content Policy</a> and </>)}
                    <a className="underline" href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer">Music Usage Confirmation</a>.
                    It may take a few minutes for the video to appear on your profile.
                  </p>
                  {issuesFor("tiktok", "media").map((i) => <p key={i.message} role="alert" className="text-sm text-destructive">{i.message}</p>)}
                </div>
              )}
            </div>
          </Section>
        )}
      </div>

      {/* Preview + publish */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="mx-auto w-full max-w-[13rem] rounded-[2.25rem] sm:max-w-[17rem] border-[6px] border-foreground bg-foreground shadow-lg">
          <div className={cn("relative overflow-hidden rounded-[1.75rem] bg-muted-foreground", vertical ? "aspect-[9/16]" : "aspect-[9/16] flex items-center")}>
            {previewUrl && file?.type.startsWith("video/") && (
              <video src={previewUrl} controls playsInline muted loop className="size-full object-contain" aria-label="Preview" />
            )}
            {previewUrl && file?.type.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview" className="size-full object-contain" />
            )}
            {!previewUrl && (
              <div className="grid size-full place-items-center text-center text-sm font-semibold text-brand-tea">
                <span className="px-6">Your preview shows up here</span>
              </div>
            )}
            {previewUrl && caption && (
              <p className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-14 pt-10 text-[13px] leading-snug text-white">
                {captionFor(captionTab === "all" ? platforms[0] ?? "instagram" : captionTab)}
              </p>
            )}
          </div>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">When</legend>
              <div className="grid grid-cols-2 gap-2">
                {([["now", "Post now", Send], ["later", "Schedule", CalendarClock]] as const).map(([value, label, Icon]) => (
                  <label
                    key={value}
                    className={cn(
                      "flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      when === value ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:border-border-strong",
                    )}
                  >
                    <input type="radio" name={`${ids}-when`} className="sr-only" checked={when === value} onChange={() => setWhen(value)} />
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {when === "later" && (
              <Field id={`${ids}-at`} label="Date and time" hint={`Your time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone})`}>
                <Input id={`${ids}-at`} type="datetime-local" value={scheduleAt} min={minSchedule} onChange={(e) => setScheduleAt(e.target.value)} />
              </Field>
            )}

            {(issues.length > 0 || extraBlockers.length > 0) && file && (
              <ul className="space-y-1.5 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning" aria-live="polite">
                {[...issues.map((i) => `${PLATFORM_META[i.platform].label}: ${i.message}`), ...extraBlockers].map((m) => (
                  <li key={m} className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />{m}</li>
                ))}
              </ul>
            )}
            {submitError && <Notice tone="error" className="whitespace-pre-line">{submitError}</Notice>}

            <Button className="w-full" disabled={!canSubmit} loading={submitting} onClick={submit}>
              {when === "now" ? <Send aria-hidden /> : <CalendarClock aria-hidden />}
              {when === "now" ? `Publish to ${selectedAccounts.length} account${selectedAccounts.length === 1 ? "" : "s"}` : "Schedule post"}
            </Button>
            {upload.status === "uploading" && <p className="text-center text-xs text-muted-foreground">You can publish once the upload finishes.</p>}
            {!file && <p className="text-center text-xs text-muted-foreground">Add a video or photo to get started.</p>}
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

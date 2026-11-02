import "server-only";
import { draftKit } from "@/lib/ai/draft-kit";
import { importMediaFromUrl } from "@/lib/media/service";
import { fetchListing, type Listing } from "./import";
import { emptyKit } from "./kit";
import { createProject, setProjectMedia, updateProject, type ProjectMediaInput, type ProjectRow } from "./service";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const platformOf = (l: Listing): ProjectRow["platform_hint"] => (l.source === "appstore" ? "ios" : l.source === "play" ? "android" : "web");

/**
 * Pasted link → a saved project: listing facts, the icon and screenshots copied into storage,
 * and an AI-drafted kit the user reviews afterwards. A failed draft still leaves a usable project.
 */
export async function createProjectFromLink(userId: string, link: string): Promise<{ project: ProjectRow; warnings: string[] }> {
  const listing = await fetchListing(link);
  const warnings: string[] = [];
  const project = await createProject(userId, {
    name: listing.name,
    storeUrl: listing.storeUrl,
    platformHint: platformOf(listing),
    kit: { ...emptyKit(), oneLiner: listing.description.split(/(?<=[.!?])\s/)[0]?.slice(0, 160) ?? "" },
  });

  const [icon, screens, draft] = await Promise.all([
    listing.iconUrl ? importMediaFromUrl(userId, listing.iconUrl, MAX_IMAGE_BYTES).catch(() => null) : null,
    Promise.all(listing.screenshotUrls.map((url) => importMediaFromUrl(userId, url, MAX_IMAGE_BYTES).catch(() => null))),
    draftKit(userId, project.id, listing).catch((err: unknown) => {
      warnings.push(err instanceof Error ? err.message : "The AI draft failed. Fill in the details by hand.");
      return null;
    }),
  ]);
  if (listing.screenshotUrls.length && screens.every((s) => !s)) warnings.push("The screenshots couldn't be copied. Upload them yourself.");

  const media: ProjectMediaInput[] = [
    ...(icon ? [{ mediaAssetId: icon.id, role: "logo" as const, shows: "App icon" }] : []),
    ...screens.flatMap((s, i) =>
      s ? [{ mediaAssetId: s.id, role: "screen" as const, shows: draft?.screens[i]?.shows ?? "", tags: draft?.screens[i]?.tags ?? [] }] : [],
    ),
  ];
  await setProjectMedia(userId, project.id, media);

  const magicIds = screens.flatMap((s, i) => (s && draft?.screens[i]?.tags.includes("magic") ? [s.id] : []));
  const updated = await updateProject(userId, project.id, {
    iconAssetId: icon?.id ?? null,
    ...(draft ? { kit: { ...draft.kit, magicMoment: { description: draft.kit.magicMoment?.description ?? "", mediaIds: magicIds } } } : {}),
  });
  return { project: updated, warnings };
}

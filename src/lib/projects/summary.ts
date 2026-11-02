import "server-only";
import { kitGaps } from "./kit";
import { listProjectAccounts, listProjectMedia, type ProjectRow } from "./service";

/** What an agent (MCP client or the copilot) needs to know about a project, in one object. */
export async function projectSummary(userId: string, project: ProjectRow) {
  const [accounts, media] = await Promise.all([listProjectAccounts(userId, project.id), listProjectMedia(userId, project.id)]);
  const screens = media.filter((m) => m.role === "screen");
  return {
    id: project.id,
    name: project.name,
    store_url: project.store_url,
    platform: project.platform_hint,
    kit: project.kit,
    notes: project.notes,
    missing: kitGaps(project.kit, screens.length),
    accounts: accounts.map((a) => ({ id: a.id, platform: a.platform, name: a.username ?? a.display_name, status: a.status })),
    media: media.map((m) => ({ id: m.media_asset_id, role: m.role, shows: m.shows, tags: m.tags, kind: m.media.kind, url: m.url })),
  };
}

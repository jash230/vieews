import "server-only";
import { signedReadUrls } from "@/lib/media/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listProjects } from "./service";

/** The user's projects with icon URLs, for the project menu and the copilot chip. */
export async function listProjectOptions(userId: string): Promise<{ id: string; name: string; iconUrl: string | null }[]> {
  const projects = await listProjects(userId);
  const iconIds = projects.flatMap((p) => (p.icon_asset_id ? [p.icon_asset_id] : []));
  const { data: icons } = iconIds.length
    ? await supabaseAdmin().from("media_assets").select("id, storage_path").eq("user_id", userId).in("id", iconIds)
    : { data: [] as { id: string; storage_path: string }[] };
  const urls = await signedReadUrls((icons ?? []).map((i) => i.storage_path));
  return projects.map((p) => {
    const icon = (icons ?? []).find((i) => i.id === p.icon_asset_id);
    return { id: p.id, name: p.name, iconUrl: icon ? (urls[icon.storage_path] ?? null) : null };
  });
}

import "server-only";
import { cookies } from "next/headers";
import { defaultProject, getProject, ProjectNotFoundError, type ProjectRow } from "./service";

/** Which project the top-left dropdown and the copilot chip have selected. */
export const PROJECT_COOKIE = "vieews_project";

/**
 * The selected project, falling back to the user's first one when the cookie is missing or
 * points at a project they no longer have. Null for a user with no projects yet.
 * Reads cookies, so callers render inside a Suspense boundary.
 */
export async function getCurrentProject(userId: string): Promise<ProjectRow | null> {
  const id = (await cookies()).get(PROJECT_COOKIE)?.value;
  if (id) {
    try {
      return await getProject(userId, id);
    } catch (err) {
      if (!(err instanceof ProjectNotFoundError)) throw err;
    }
  }
  return defaultProject(userId);
}

export async function setCurrentProjectCookie(projectId: string) {
  (await cookies()).set(PROJECT_COOKIE, projectId, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365 });
}

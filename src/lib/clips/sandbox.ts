import "server-only";
import { Sandbox } from "@vercel/sandbox";
import { detachedCommand, waitScript, WORKDIR } from "./render";

// One named sandbox per clip job. Workflow steps look it up by name, so nothing but the name crosses
// step boundaries. It's persistent: if a session times out between steps, the files come back.

const VCPUS = 4;
/** Hobby caps a sandbox session at 45 minutes; Pro allows more but a job shouldn't need it. */
const TIMEOUT_MS = 45 * 60_000;
/** Rough sandbox cost for 4 vCPUs and 8 GB: active CPU plus memory, per wall-clock minute. */
export const SANDBOX_USD_PER_MIN = 0.01;

export const sandboxNameFor = (jobId: string) => `clip-${jobId}`;

/** Longer than any job can run (its phase waits top out near 100 minutes), so nothing older is still in use. */
const STALE_MS = 3 * 60 * 60_000;

/**
 * Deletes sandboxes (and their snapshots) older than STALE_MS: leftovers from jobs whose cleanup never
 * ran, or from scripts. Hobby caps snapshot storage, and once it's full no new job can start. Never throws.
 */
export async function pruneStaleSandboxes(now = Date.now()): Promise<void> {
  try {
    const { sandboxes } = await Sandbox.list({ sortBy: "createdAt", sortOrder: "asc", limit: 50 });
    const stale = sandboxes.filter((s) => now - s.createdAt > STALE_MS);
    await Promise.all(stale.map((s) => destroyJobSandbox(s.name)));
  } catch (err) {
    console.error("pruneStaleSandboxes failed", err);
  }
}

export async function createJobSandbox(jobId: string): Promise<Sandbox> {
  await pruneStaleSandboxes();
  const name = sandboxNameFor(jobId);
  const sandbox = await Sandbox.getOrCreate({
    name,
    resources: { vcpus: VCPUS },
    timeout: TIMEOUT_MS,
    persistent: true,
    tags: { app: "vieews", feature: "clips" },
  });
  await sandbox.runCommand({ cmd: "mkdir", args: ["-p", WORKDIR] });
  return sandbox;
}

export function jobSandbox(name: string): Promise<Sandbox> {
  return Sandbox.get({ name });
}

/** Writes `<phase>.sh` and starts it in the background. */
export async function startPhase(sandbox: Sandbox, phase: string, script: string, env?: Record<string, string>, extraFiles: { path: string; content: string }[] = []) {
  await sandbox.writeFiles([{ path: `${WORKDIR}/${phase}.sh`, content: script }, ...extraFiles.map((f) => ({ path: `${WORKDIR}/${f.path}`, content: f.content }))]);
  await sandbox.runCommand({ cmd: "bash", args: detachedCommand(phase), detached: true, env });
}

export type PhaseState = { done: false } | { done: true; ok: true } | { done: true; ok: false; log: string };

/** Waits up to `seconds` for a phase to finish. Short enough to fit in one function invocation. */
export async function waitPhase(sandbox: Sandbox, phase: string, seconds = 200): Promise<PhaseState> {
  const waited = await sandbox.runCommand({ cmd: "bash", args: waitScript(phase, seconds) });
  if (waited.exitCode === 99) return { done: false };
  const code = (await readText(sandbox, `${phase}.done`)).trim();
  if (code === "0") return { done: true, ok: true };
  const log = await readText(sandbox, `${phase}.log`);
  return { done: true, ok: false, log: log.slice(-2000) };
}

export async function readText(sandbox: Sandbox, file: string): Promise<string> {
  const buf = await sandbox.readFileToBuffer({ path: `${WORKDIR}/${file}` });
  return buf ? buf.toString("utf8") : "";
}

export async function readBytes(sandbox: Sandbox, file: string): Promise<Buffer | null> {
  return sandbox.readFileToBuffer({ path: `${WORKDIR}/${file}` });
}

/** Stops and deletes the job's sandbox and its snapshots. Never throws. */
export async function destroyJobSandbox(name: string): Promise<void> {
  try {
    const sandbox = await Sandbox.get({ name });
    await sandbox.delete({ deleteOrphanSnapshots: true });
  } catch (err) {
    console.error("destroyJobSandbox failed", name, err);
  }
}

import { sleep } from "workflow";
import type { StepMemo } from "@/lib/posts/publish";
import { advanceStep, claimStep, failPendingStep, failTargetStep, planStep } from "./steps";

/** Retries for a platform call that failed with something retrying might fix, 15s, 30s, then 60s apart. */
const MAX_RETRIES = 3;

const messageOf = (err: unknown) => (err && typeof err === "object" && "message" in err ? String(err.message) : String(err));

/**
 * Publishes a post: sleeps until it's due (no compute while asleep), then posts every target, accounts
 * in parallel and each account's targets one at a time to stay inside platform rate limits.
 */
export async function publishPostWorkflow(postId: string) {
  "use workflow";
  try {
    for (;;) {
      const plan = await planStep(postId);
      if (plan.kind === "skip") return;
      if (plan.kind === "wait") {
        // Plans again on waking, so a rescheduled, canceled or deleted post is handled then.
        await sleep(new Date(plan.until));
        continue;
      }
      await Promise.all(
        plan.byAccount.map(async (ids) => {
          for (const id of ids) await publishOne(id);
        }),
      );
      return;
    }
  } catch (err) {
    await failPendingStep(postId, `Couldn't start publishing: ${messageOf(err)}`);
  }
}

/** Publishes one target that was set back to pending (the Retry button). */
export async function retryTargetWorkflow(targetId: string) {
  "use workflow";
  await publishOne(targetId);
}

async function publishOne(targetId: string) {
  try {
    if (!(await claimStep(targetId))) return;
    let memo: StepMemo = {};
    let failures = 0;
    for (;;) {
      const r = await advanceStep(targetId, memo);
      memo = r.memo;
      if (r.kind === "done") return;
      if (r.kind === "sleep") {
        await sleep(r.duration as `${number}s`);
        memo = { ...memo, [r.id]: { v: true } };
      } else if (r.retryable && failures < MAX_RETRIES) {
        await sleep(`${15 * 2 ** failures}s`);
        failures++;
      } else {
        await failTargetStep(targetId, r.message);
        return;
      }
    }
  } catch (err) {
    await failTargetStep(targetId, messageOf(err));
  }
}

import type { HistoryEntry } from "../src/history";
import { kitSchema, type Kit } from "../src/kit";

export function makeKit(overrides: Partial<Kit> = {}): Kit {
  return kitSchema.parse({
    name: "Tally",
    slug: "tally",
    oneLiner: "Snap a receipt, split it with friends in 10 seconds.",
    audience: "college students who share rent and groceries",
    desires: ["belonging", "money"],
    pains: ["chasing roommates for money", "awkward bill splitting at dinner", "forgetting who paid"],
    magicMoment: { description: "photo of a receipt turns into an even split", screens: ["screens/scan.png", "screens/split.png"] },
    screens: [
      { file: "screens/scan.png", shows: "camera over a receipt", tags: ["magic"] },
      { file: "screens/split.png", shows: "split result per person", tags: ["magic", "result"] },
      { file: "screens/home.png", shows: "balances with friends", tags: ["home"] },
    ],
    claims: { allowed: ["Splits a receipt from a photo", "Free on iOS"] },
    cta: "Free on the App Store: search Tally",
    personas: ["college junior in a shared apartment"],
    ...overrides,
  });
}

let n = 0;
export function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  n++;
  return {
    studio: "ad-studio",
    adId: `tally-${n}`,
    app: "tally",
    format: "V1",
    angle: "chasing roommates for money",
    hookPattern: "watch-me",
    hook: `hook ${n}`,
    tone: "funny",
    aiImages: 0,
    neurons: 0,
    part: "all",
    createdAt: new Date(Date.UTC(2026, 9, 30, 12) - n * 3_600_000).toISOString(),
    postIds: [`p${n}`],
    ...overrides,
  };
}

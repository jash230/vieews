import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "vieews" });

export const EVENTS = {
  postRequested: "post/requested",
  postCanceled: "post/canceled",
  targetPublish: "target/publish",
} as const;

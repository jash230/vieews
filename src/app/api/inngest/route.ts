import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Uploads stream through this route; give them room.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });

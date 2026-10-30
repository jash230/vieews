import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

/** Shared client; reads ANTHROPIC_API_KEY from the environment. */
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("The copilot isn't set up yet: ANTHROPIC_API_KEY is missing.");
  client ??= new Anthropic();
  return client;
}

"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { PromptBox } from "@/components/ui/prompt-box";
import { stashPendingClip } from "@/lib/clips/pending";

/** The home page's box. The link waits in this browser while the user signs in, then /clips starts it. */
export function LandingClipBox() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const id = useId();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [going, setGoing] = useState(false);

  function submit() {
    const link = url.trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(link)) return setError("Paste the full link to the video, starting with https://");
    stashPendingClip({ sourceUrl: link });
    setGoing(true);
    router.push(isSignedIn ? "/clips" : `/sign-in?redirect_url=${encodeURIComponent(new URL("/clips", location.href).href)}`);
  }

  return (
    <PromptBox
      id={`${id}-url`}
      value={url}
      onValueChange={(v) => {
        setUrl(v);
        setError(null);
      }}
      onSubmit={submit}
      label="Video link"
      placeholder="Paste a YouTube, TikTok or podcast link…"
      submitLabel="Find clips"
      busy={going}
      canSubmit={url.trim().length > 0}
      error={error}
      hint="Podcasts, interviews, streams and talks work best. Up to 2 hours."
    />
  );
}

"use client";

import { Link2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { createBlankProjectAction, createProjectFromLinkAction } from "../../actions";

export function NewProjectForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "manual">("link");
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = mode === "link" ? await createProjectFromLinkAction(link) : await createBlankProjectAction(name);
      if (!res.ok) return setError(res.error);
      const { warnings } = res.data;
      const qs = warnings.length ? `?${new URLSearchParams({ warning: warnings.join(" ") })}` : "?review=1";
      router.push(`/projects/${res.data.projectId}${qs}`);
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardBody className="py-6">
        <form onSubmit={submit} className="space-y-5">
          {mode === "link" ? (
            <Field
              id="link"
              label="App Store, Google Play or website link"
              hint="For example apps.apple.com/us/app/…/id123456789. Takes about 20 seconds."
              error={error}
              required
            >
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
                <Input
                  id="link"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://apps.apple.com/…"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="pl-10"
                  aria-invalid={!!error || undefined}
                  autoFocus
                  required
                />
              </div>
            </Field>
          ) : (
            <Field id="name" label="App name" error={error} required>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus required />
            </Field>
          )}
          {pending && mode === "link" && (
            <Notice>Reading the listing, copying screenshots and drafting your project with AI…</Notice>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={pending}>
              <Sparkles aria-hidden /> {mode === "link" ? "Set up project" : "Create project"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "link" ? "manual" : "link");
                setError(null);
              }}
              className="min-h-11 px-2 text-sm font-semibold text-primary hover:underline"
            >
              {mode === "link" ? "No link? Fill it in by hand" : "Use a link instead"}
            </button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

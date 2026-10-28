import { auth } from "@clerk/nextjs/server";
import { Link2 } from "lucide-react";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { listAccounts } from "@/lib/accounts/service";
import { Composer } from "./composer";

export const metadata = { title: "Create post" };

export default function ComposePage() {
  return (
    <>
      <PageHeader title="Create post" description="Upload once, then choose where it goes." />
      <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
        <ComposeForm />
      </Suspense>
    </>
  );
}

async function ComposeForm() {
  const { userId } = await auth.protect();
  const accounts = (await listAccounts(userId)).filter((a) => a.status === "active");

  return accounts.length === 0 ? (
    <Card>
      <EmptyState
        icon={<Link2 />}
        title="No accounts to post to"
        description="Connect YouTube, Instagram or TikTok first."
        action={<ButtonLink href="/accounts">Connect accounts</ButtonLink>}
      />
    </Card>
  ) : (
    <Composer accounts={accounts} />
  );
}

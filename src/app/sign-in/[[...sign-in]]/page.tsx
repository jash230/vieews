import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { Logo } from "@/components/app/logo";
import { Skeleton } from "@/components/ui/misc";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="flex flex-col items-center gap-8">
        <Logo />
        <Suspense fallback={<Skeleton className="h-[420px] w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl" />}>
          <SignIn forceRedirectUrl="/dashboard" />
        </Suspense>
      </div>
    </div>
  );
}

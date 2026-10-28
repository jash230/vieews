import { ClerkLoading, SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { BrandLoader } from "@/components/app/brand-loader";
import { Logo } from "@/components/app/logo";
import { Skeleton } from "@/components/ui/misc";

export const metadata = { title: "Sign in" };

function CardPlaceholder() {
  return (
    <div className="relative">
      <Skeleton className="h-[420px] w-[400px] max-w-[calc(100vw-2rem)] rounded-3xl" />
      <BrandLoader className="absolute inset-0 justify-center" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-surface px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 animate-float rounded-full bg-brand-tea/50 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -right-16 size-80 animate-float rounded-full bg-brand-teal/30 blur-3xl [animation-delay:-3s]" aria-hidden />
      <div className="relative flex animate-fade-up flex-col items-center gap-8">
        <Logo />
        {/* Suspense covers the server render; ClerkLoading covers Clerk's script loading in the browser. */}
        <Suspense fallback={<CardPlaceholder />}>
          <ClerkLoading>
            <CardPlaceholder />
          </ClerkLoading>
          <SignIn forceRedirectUrl="/dashboard" />
        </Suspense>
      </div>
    </div>
  );
}

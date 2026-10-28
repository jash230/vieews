import { BrandLoader } from "@/components/app/brand-loader";
import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-9 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[86px] rounded-3xl" />)}
      </div>
      <div className="relative">
        <Skeleton className="h-80 rounded-3xl" />
        <BrandLoader className="absolute inset-0 justify-center" />
      </div>
    </div>
  );
}

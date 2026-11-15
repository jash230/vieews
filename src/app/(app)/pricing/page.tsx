import { PricingTable } from "@clerk/nextjs";
import { Notice, PageHeader } from "@/components/ui/misc";
import { PLANS } from "@/lib/billing/plans";

export const metadata = { title: "Plans" };

const { free, pro, max } = PLANS;

export default function PricingPage() {
  return (
    <>
      <PageHeader title="Pick a plan" description="Find viral clips in your videos and post them to all your accounts." />
      <Notice tone="info" className="mb-6">
        Free: {free.uploadsPerDay} upload a day. Pro: {pro.clipsPerDay} videos clipped and {pro.uploadsPerDay} uploads a day. Max: {max.clipsPerDay} of each. If you were finding clips, they start as soon as you subscribe.
      </Notice>
      {/* Checkout lands on /clips, which starts the clip request waiting in this browser. */}
      <PricingTable newSubscriptionRedirectUrl="/clips" />
    </>
  );
}

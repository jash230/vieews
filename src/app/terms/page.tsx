import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/app/logo";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Vieews to post to YouTube, Instagram and TikTok.",
};

const UPDATED = "October 30, 2026";
// TODO before submitting the platform reviews: point this at a monitored inbox on Vieews' own domain.
const CONTACT = "support@vieews.app";

const SECTIONS = {
  agreement: "Agreeing to these terms",
  service: "What Vieews does",
  account: "Your account",
  platforms: "YouTube, Instagram and TikTok",
  content: "Your content",
  copilot: "The AI copilot",
  rules: "What you can’t do",
  plans: "Plans and payment",
  ending: "Ending your use",
  disclaimers: "Disclaimers",
  liability: "Limitation of liability",
  indemnity: "Indemnity",
  changes: "Changes",
  law: "Governing law",
  contact: "Contact",
} as const;

function Section({ id, children }: { id: keyof typeof SECTIONS; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 pt-12">
      <h2 id={`${id}-title`} className="font-display text-2xl font-semibold tracking-tight text-foreground">
        {SECTIONS[id]}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export default function TermsPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div className="pointer-events-none absolute -left-32 -top-32 size-[24rem] rounded-full bg-brand-tea/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 top-24 size-80 rounded-full bg-brand-olive/20 blur-3xl" aria-hidden />

      <header className="relative mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Logo />
        <nav aria-label="Legal" className="flex gap-1 text-sm font-semibold">
          <Link href="/privacy" className="flex min-h-11 items-center rounded-xl px-3 text-muted-foreground transition-colors hover:bg-primary-soft hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" aria-current="page" className="flex min-h-11 items-center rounded-xl bg-primary-soft px-3 text-foreground">
            Terms
          </Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <p className="text-sm font-semibold text-muted-foreground">Last updated {UPDATED}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Terms of Service</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          These terms are the agreement between you and Vieews for using vieews.vercel.app and its API. Please read them with our{" "}
          <Link href="/privacy" className="font-semibold text-primary underline underline-offset-2">Privacy Policy</Link>, which explains
          what we store and how to delete it.
        </p>

        <div className="mt-8 rounded-3xl border border-border bg-primary-soft p-6 shadow-sm">
          <h2 className="font-display text-xl font-semibold">The short version</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground marker:text-accent">
            <li>Your content stays yours. We only use it to post it where you tell us to.</li>
            <li>Nothing is published without your say-so, including posts the copilot drafts.</li>
            <li>You must follow the rules of YouTube, Instagram and TikTok, and only post content you have the rights to.</li>
            <li>You can stop using Vieews and delete your data whenever you like.</li>
          </ul>
        </div>

        <nav aria-label="On this page" className="mt-8 rounded-3xl border border-border bg-background p-6 shadow-sm">
          <h2 className="text-sm font-bold text-foreground">On this page</h2>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {Object.entries(SECTIONS).map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="text-[15px] leading-relaxed text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:[overflow-wrap:anywhere] [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          <Section id="agreement">
            <p>
              By creating an account or using Vieews, you agree to these terms. If you use Vieews for a company, you confirm you can accept
              them on its behalf, and “you” includes that company. You must be at least 13, old enough to form a contract where you live, and
              allowed to use every platform you connect.
            </p>
          </Section>

          <Section id="service">
            <p>
              Vieews lets you upload a video or photos once and publish or schedule them to the YouTube, Instagram and TikTok accounts you
              connect. It checks your media against each platform’s rules, tracks the result of every post, and includes an AI copilot that
              helps you set up projects for the apps you promote and draft posts for your approval. You can also connect Claude or other MCP
              clients with an API key.
            </p>
            <p>
              Vieews is not affiliated with, endorsed or sponsored by Google, YouTube, Meta, Instagram or TikTok. Their names are used only
              to describe what Vieews connects to.
            </p>
          </Section>

          <Section id="account">
            <p>
              Keep your sign-in details and API keys safe: anything done with them counts as done by you. Tell us right away at{" "}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a> if you think someone else has access to your account. Give us accurate information,
              and one person or company per account.
            </p>
          </Section>

          <Section id="platforms">
            <p>
              When you connect an account, you let Vieews act on it only as you direct: to publish and schedule the posts you create or
              approve, and to read the basic profile details needed to show which account a post goes to. You can disconnect an account at
              any time.
            </p>
            <p>Each platform’s own terms apply to what you post there, and you agree to follow them:</p>
            <ul>
              <li>
                <strong>YouTube.</strong> Vieews uses YouTube API Services. By using Vieews to post to YouTube, you agree to be bound by the{" "}
                <Ext href="https://www.youtube.com/t/terms">YouTube Terms of Service</Ext>, and Google’s{" "}
                <Ext href="https://policies.google.com/privacy">Privacy Policy</Ext> applies.
              </li>
              <li>
                <strong>Instagram.</strong> The <Ext href="https://help.instagram.com/581066165581870">Instagram Terms of Use</Ext> and{" "}
                <Ext href="https://help.instagram.com/477434105621119">Community Guidelines</Ext>. Posting requires a professional
                (Business or Creator) account.
              </li>
              <li>
                <strong>TikTok.</strong> The <Ext href="https://www.tiktok.com/legal/page/global/terms-of-service/en">TikTok Terms of Service</Ext>,{" "}
                <Ext href="https://www.tiktok.com/community-guidelines">Community Guidelines</Ext>,{" "}
                <Ext href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en">Music Usage Confirmation</Ext> and, for paid
                partnerships, the <Ext href="https://www.tiktok.com/legal/page/global/bc-policy/en">Branded Content Policy</Ext>.
              </li>
            </ul>
            <p>
              The platforms decide what they accept and when. They can reject, delay, limit the visibility of, or remove a post, change their
              APIs, or cap how often you can post, and Vieews can’t override that. We’ll show you what each platform returns.
            </p>
          </Section>

          <Section id="content">
            <p>
              You keep all rights to the videos, photos, captions and other material you upload or create with Vieews (“your content”). You
              give us a limited, worldwide, non-exclusive, royalty-free license to store, process and send your content to the platforms you
              choose, only to run Vieews for you. The license ends when you delete the content or your account, except for content already
              posted, which the platforms hold under their own terms.
            </p>
            <p>You’re responsible for your content. In particular, you confirm that:</p>
            <ul>
              <li>it’s original or you have every right needed to post it, including for any music, footage, logos and people in it;</li>
              <li>
                you mark it honestly using the settings Vieews offers, such as paid partnerships and promotional content, “made for kids”, and
                realistic AI-generated or altered content;
              </li>
              <li>any claims it makes about a product, including your own app, are true and allowed where you post them.</li>
            </ul>
            <p>Vieews never adds its own watermark, logo or links to your posts.</p>
          </Section>

          <Section id="copilot">
            <p>
              The copilot is powered by AI models and can make mistakes. Review what it drafts before you approve it. It can’t publish anything
              by itself: every post it proposes waits for your approval, and you can edit it first. Once you approve a post or set a schedule,
              you’re responsible for what is published, just as if you’d written it yourself.
            </p>
          </Section>

          <Section id="rules">
            <p>Don’t use Vieews to:</p>
            <ul>
              <li>post content that is illegal, infringing, deceptive, hateful, sexual, violent or otherwise against a platform’s rules;</li>
              <li>repost other people’s content from other platforms or accounts without their permission;</li>
              <li>spam, artificially inflate engagement, impersonate anyone, or post to accounts you don’t own or aren’t authorized to manage;</li>
              <li>get around a platform’s limits, reviews or safety features, or Vieews’ plan limits;</li>
              <li>break, overload, probe or reverse engineer Vieews, or access it other than through the website and the API we provide;</li>
              <li>resell Vieews or give others access to your account without our written permission.</li>
            </ul>
            <p>We may remove content from Vieews or suspend accounts that break these rules.</p>
          </Section>

          <Section id="plans">
            <p>
              If you buy a paid plan, its price, billing period and usage limits (such as how many posts or AI generations it includes) are
              shown before you pay. Plans renew automatically until you cancel, and canceling takes effect at the end of the period you’ve paid
              for. Payments may be handled by a reseller acting as merchant of record, whose checkout terms also apply. We’ll give you at least
              30 days’ notice before a price change affects you. Refunds follow the law where you live and the terms shown at checkout.
            </p>
          </Section>

          <Section id="ending">
            <p>
              You can stop using Vieews at any time and ask us to delete your data as the{" "}
              <Link href="/privacy#delete-your-data">Privacy Policy</Link> explains. We may suspend or close your account if you break these
              terms, if a platform requires it, or if we stop offering Vieews. Unless you’ve seriously broken these terms, we’ll give you notice
              and a chance to export your data first.
            </p>
          </Section>

          <Section id="disclaimers">
            <p>
              Vieews is provided “as is” and “as available”. To the extent the law allows, we disclaim all warranties, including that it will
              be uninterrupted or error-free, that a post will publish at an exact time, or that a post will reach any audience or result.
              Nothing in these terms limits rights you have under consumer protection law that can’t be waived.
            </p>
          </Section>

          <Section id="liability">
            <p>
              To the extent the law allows, Vieews isn’t liable for indirect, incidental, special or consequential losses, or for lost
              profits, revenue, data or followers. Our total liability for any claim about Vieews is limited to the greater of what you paid us
              in the 12 months before the claim and 100 US dollars. These limits don’t apply to fraud, or to death or personal injury caused
              by negligence.
            </p>
          </Section>

          <Section id="indemnity">
            <p>
              If someone makes a claim against us because of your content or your breach of these terms or a platform’s terms, you’ll cover
              our reasonable costs of dealing with it, to the extent the law allows.
            </p>
          </Section>

          <Section id="changes">
            <p>
              We may update Vieews and these terms. If a change to these terms materially affects you, we’ll email you at least 30 days before
              it takes effect. Continuing to use Vieews after that means you accept the new terms.
            </p>
          </Section>

          <Section id="law">
            <p>
              These terms are governed by the laws of the State of Israel, and the courts of Tel Aviv-Jaffa have exclusive jurisdiction,
              except where the law of the country you live in gives you the right to bring a claim at home.
            </p>
          </Section>

          <Section id="contact">
            <p>
              Questions about these terms: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
          </Section>
        </article>
      </main>

      <footer className="relative border-t border-border bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p>© 2026 Vieews</p>
          <nav aria-label="Footer" className="flex gap-4 font-semibold">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" aria-current="page" className="text-foreground">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

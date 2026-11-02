import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/app/logo";
import { PlatformBadge } from "@/components/app/platform";
import type { Platform } from "@/lib/types";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Vieews stores when you post to YouTube, Instagram and TikTok, why, and how to delete it.",
};

const UPDATED = "October 30, 2026";
// TODO before submitting the platform reviews: point this at a monitored inbox on Vieews' own domain.
const CONTACT = "privacy@vieews.app";

const SECTIONS = {
  collect: "What we collect",
  platforms: "What we access on YouTube, Instagram and TikTok",
  use: "How we use it",
  ai: "The AI copilot",
  google: "Google and YouTube data",
  sharing: "Who we share it with",
  cookies: "Cookies",
  retention: "How long we keep it",
  "delete-your-data": "Disconnecting and deleting your data",
  security: "Security",
  rights: "Your rights",
  children: "Children",
  transfers: "International transfers",
  changes: "Changes to this policy",
  contact: "Contact",
} as const;

const PLATFORMS: { platform: Platform; name: string; scopes: string[]; reads: string; writes: string }[] = [
  {
    platform: "youtube",
    name: "YouTube (Google)",
    scopes: ["youtube.upload", "youtube.readonly"],
    reads: "Your channel’s ID, title, handle and profile picture, so you can see which channel a video goes to.",
    writes: "Uploads the videos you choose, with the title, description, tags, visibility and disclosures you set.",
  },
  {
    platform: "instagram",
    name: "Instagram (Meta)",
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    reads: "Your professional account’s ID, username, name, profile picture and account type.",
    writes: "Publishes the Reels, posts, carousels and Stories you create, with your caption.",
  },
  {
    platform: "tiktok",
    name: "TikTok",
    scopes: ["user.info.basic", "video.upload", "video.publish"],
    reads: "Your open ID, display name and avatar, plus your posting settings each time you post (username, nickname, who can view, whether comments, Duet and Stitch are allowed, and your maximum video length).",
    writes: "Posts the videos and photos you create, with the caption, visibility, interaction and disclosure settings you choose.",
  },
];

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

export default function PrivacyPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div className="pointer-events-none absolute -left-32 -top-32 size-[24rem] rounded-full bg-brand-tea/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 top-24 size-80 rounded-full bg-brand-teal/20 blur-3xl" aria-hidden />

      <header className="relative mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Logo />
        <nav aria-label="Legal" className="flex gap-1 text-sm font-semibold">
          <Link href="/privacy" aria-current="page" className="flex min-h-11 items-center rounded-xl bg-primary-soft px-3 text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="flex min-h-11 items-center rounded-xl px-3 text-muted-foreground transition-colors hover:bg-primary-soft hover:text-foreground">
            Terms
          </Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <p className="text-sm font-semibold text-muted-foreground">Last updated {UPDATED}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Vieews lets you upload a video or photos once and post them to YouTube, Instagram and TikTok, with an AI copilot that helps
          you plan and write posts. This policy explains what we store to do that, why, and how to delete it.
        </p>

        <div className="mt-8 rounded-3xl border border-border bg-primary-soft p-6 shadow-sm">
          <h2 className="font-display text-xl font-semibold">The short version</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground marker:text-accent">
            <li>We only store what we need to post for you and show you how each post did.</li>
            <li>Your YouTube, Instagram and TikTok sign-in tokens are encrypted, and we only post when you tell us to.</li>
            <li>We never sell your data, use it for ads, or use it to train AI models.</li>
            <li>Uploaded files are deleted automatically a few days after they post.</li>
            <li>
              You can disconnect an account at any time, and we delete everything within 7 days when you{" "}
              <a href="#delete-your-data" className="font-semibold text-primary underline underline-offset-2">ask us to</a>.
            </li>
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

        <article className="text-[15px] leading-relaxed text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:[overflow-wrap:anywhere] [&_h3]:font-semibold [&_h3]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          <Section id="collect">
            <p>
              Vieews (“we”, “us”) runs the website at vieews.vercel.app. When you use it, we store the following.
            </p>
            <h3>Your Vieews account</h3>
            <p>
              Sign-in is handled by Clerk. Clerk stores your name, email address, profile picture and the way you sign in (for example
              Google or email). Vieews never sees your password. We store your Clerk user ID so we can link your data to you.
            </p>
            <h3>Connected social accounts</h3>
            <ul>
              <li>The platform’s ID for your account, your username, display name and profile picture URL.</li>
              <li>
                The OAuth access and refresh tokens the platform gives us when you connect, their expiry times and the permissions you
                granted. Tokens are <strong>encrypted with AES-256-GCM</strong> before they are saved, and they are only decrypted on our
                servers to make a request you asked for.
              </li>
            </ul>
            <h3>What you upload and post</h3>
            <ul>
              <li>Videos and photos you upload, their size, dimensions and length, and a thumbnail.</li>
              <li>
                Your captions and per-platform settings (title, tags, who can view the post, comment and remix settings, and disclosures
                such as “made for kids”, AI-generated or branded content), the time you schedule a post for, and its result on each platform
                (the post’s ID and link, or the error the platform returned).
              </li>
            </ul>
            <h3>Projects and the copilot</h3>
            <ul>
              <li>
                The details you give us about the app or business you promote (name, store or website link, description, audience, claims
                you allow or ban, screenshots and logos). If you paste a link, we read that public page (for example an App Store listing)
                to fill these in for you.
              </li>
              <li>Your conversations with the copilot, the post drafts it proposes, and whether you approved them.</li>
            </ul>
            <h3>Usage and keys</h3>
            <ul>
              <li>A record of each AI request we make for you: which model, how many tokens, and the cost. We use it to keep you within your plan.</li>
              <li>API keys you create for Claude or other MCP clients. We store only a hash; the key itself is shown to you once.</li>
              <li>
                Basic technical data our hosting and sign-in providers log, such as IP address, browser type and request times, used to
                keep the service running and secure.
              </li>
            </ul>
          </Section>

          <Section id="platforms">
            <p>
              You choose which accounts to connect. Each platform shows you the exact permissions on its own screen before you agree. Vieews
              only acts on an account when you publish or schedule a post, or approve a post the copilot proposed.
            </p>
            <ul className="list-none! space-y-3! pl-0!">
              {PLATFORMS.map((p) => (
                <li key={p.platform} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <PlatformBadge platform={p.platform} className="bg-background" />
                    <h3>{p.name}</h3>
                  </div>
                  <p className="mt-3">
                    <strong>Permissions:</strong>{" "}
                    {p.scopes.map((s, i) => (
                      <span key={s}>
                        {i > 0 && ", "}
                        <code className="rounded-md bg-muted px-1.5 py-0.5 text-[13px] text-foreground">{s}</code>
                      </span>
                    ))}
                  </p>
                  <p className="mt-2"><strong>What we read:</strong> {p.reads}</p>
                  <p className="mt-2"><strong>What we do:</strong> {p.writes}</p>
                </li>
              ))}
            </ul>
            <p>
              We don’t read your existing posts, comments, messages, followers, subscribers or analytics on any platform, and we don’t
              change or delete anything already on your accounts.
            </p>
          </Section>

          <Section id="use">
            <p>We use your data only to run Vieews for you:</p>
            <ul>
              <li>to upload and publish the posts you create, at the time you pick, and show you the result;</li>
              <li>to refresh your sign-in tokens so scheduled posts still go out;</li>
              <li>to check your media against each platform’s rules before you post;</li>
              <li>to run the copilot, and to enforce your plan’s limits;</li>
              <li>to answer support requests, prevent abuse and keep the service secure;</li>
              <li>to meet legal obligations.</li>
            </ul>
            <p>
              We don’t sell your data, share it with advertisers or data brokers, use it to show you ads, or use it to train or improve AI
              or machine-learning models.
            </p>
          </Section>

          <Section id="ai">
            <p>
              When you chat with the copilot or ask it to draft a project, we send your messages, your project’s details and short summaries
              of your connected accounts and recent posts to Anthropic, which provides the Claude models behind it. Anthropic processes this
              data on our behalf to generate the response and, under its commercial terms, doesn’t use it to train its models.
            </p>
            <p>
              The copilot can’t publish anything by itself. Every post it proposes appears as a card you approve or decline, and you can
              edit the caption and settings first.
            </p>
          </Section>

          <Section id="google">
            <p>
              Vieews uses <strong>YouTube API Services</strong>. By connecting a YouTube channel, you agree to the{" "}
              <Ext href="https://www.youtube.com/t/terms">YouTube Terms of Service</Ext>, and Google’s handling of your data is described
              in the <Ext href="https://policies.google.com/privacy">Google Privacy Policy</Ext>.
            </p>
            <p>
              Vieews’ use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <Ext href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</Ext>,
              including the Limited Use requirements. In particular:
            </p>
            <ul>
              <li>We use YouTube data only for the features you see in Vieews: showing which channel you’re posting to, and uploading your videos.</li>
              <li>
                We don’t transfer it to anyone except as needed to provide those features (for example, our hosting and database providers),
                for security, to comply with the law, or as part of a merger or sale after asking for your consent.
              </li>
              <li>No person reads it unless you ask us to (for example in a support request), it’s needed for security, or the law requires it.</li>
              <li>We never use it for advertising, sell it, or use it to develop, improve or train AI or machine-learning models.</li>
            </ul>
            <p>
              We refresh or delete the channel details we store at least every 30 days. You can remove Vieews’ access at any time from your
              Google Account’s <Ext href="https://security.google.com/settings/security/permissions">security settings</Ext>; we then delete
              the YouTube data we hold for that channel within 30 days, or within 7 days if you disconnect it inside Vieews.
            </p>
          </Section>

          <Section id="sharing">
            <p>We share data only with the companies that help us run Vieews, each limited to its job:</p>
            <ul>
              <li><strong>Clerk</strong>: sign-in and account management.</li>
              <li><strong>Supabase</strong>: our database and file storage.</li>
              <li><strong>Vercel</strong>: hosting for the website and its servers.</li>
              <li><strong>Inngest</strong>: runs scheduled and background jobs, such as publishing at the time you picked.</li>
              <li><strong>Anthropic</strong>: the AI models behind the copilot.</li>
              <li><strong>Our payment provider</strong>, once paid plans launch: billing, taxes and invoices.</li>
            </ul>
            <p>
              We also send your posts to the platforms you choose, which handle them under their own privacy policies (
              <Ext href="https://policies.google.com/privacy">Google</Ext>, <Ext href="https://privacycenter.instagram.com/policy">Instagram</Ext>,{" "}
              <Ext href="https://www.tiktok.com/legal/page/global/privacy-policy/en">TikTok</Ext>). We may disclose data if the law requires
              it, or to protect people from harm.
            </p>
          </Section>

          <Section id="cookies">
            <p>
              We use only the cookies Vieews needs to work: Clerk’s cookies that keep you signed in, and one that remembers which project you
              have open. We don’t use advertising or cross-site tracking cookies.
            </p>
          </Section>

          <Section id="retention">
            <ul>
              <li>
                <strong>Uploaded files</strong> are deleted automatically 3 days after a post is published everywhere, 14 days after a post
                fails, partly fails or is canceled (so you can retry), and 2 days after upload if no post uses them. The thumbnail and the post
                record stay so your history still makes sense.
              </li>
              <li><strong>Sign-in tokens</strong> are kept until you disconnect the account or delete your Vieews account, and are deleted immediately when you do.</li>
              <li><strong>Profile details from the platforms</strong> are refreshed or deleted at least every 30 days.</li>
              <li><strong>Projects, copilot conversations, post history and usage records</strong> are kept until you delete them or your account.</li>
              <li><strong>Billing records</strong> are kept as long as tax and accounting law requires.</li>
            </ul>
            <p>Deleted data can remain in encrypted backups for up to 30 days before it is overwritten.</p>
          </Section>

          <Section id="delete-your-data">
            <h3>Disconnect one account</h3>
            <p>
              On the <strong>Accounts</strong> page, select <strong>Disconnect</strong> next to the account. We delete its stored tokens
              right away and cancel its scheduled posts. You can also remove Vieews’ access on the platform itself:
            </p>
            <ul>
              <li>Google / YouTube: <Ext href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</Ext></li>
              <li>Instagram: in Settings, open Website permissions → Apps and websites, and remove Vieews</li>
              <li>TikTok: in Settings and privacy, open Security, find the apps with access to your account, and remove Vieews</li>
            </ul>
            <h3>Delete everything</h3>
            <p>
              Email <a href={`mailto:${CONTACT}?subject=Delete%20my%20Vieews%20account`}>{CONTACT}</a> from the address you sign in with,
              with the subject “Delete my Vieews account”. Within 7 days we delete your account, connected accounts and tokens, uploads,
              projects, copilot conversations, post history and usage records, and email you to confirm. Billing records we must keep by law
              are the only exception.
            </p>
            <p>
              Deleting your Vieews data doesn’t remove posts that are already live on YouTube, Instagram or TikTok. Delete those on the
              platform.
            </p>
          </Section>

          <Section id="security">
            <p>
              Data travels over HTTPS. Sign-in tokens are encrypted at rest with a key that only our servers hold, API keys are stored as
              hashes, and every request is checked so you can only reach your own data. Media is stored privately and shared with a platform
              only through short-lived signed links while it’s being posted. No system is perfectly secure, so if we ever learn of a breach
              that affects you, we’ll tell you promptly.
            </p>
          </Section>

          <Section id="rights">
            <p>
              Depending on where you live (for example under the GDPR, the UK GDPR, Israel’s Privacy Protection Law or California law), you
              can ask to see, correct, export or delete your data, or object to how we use it. Email{" "}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we’ll answer within 30 days. We process your data to provide the service you
              signed up for (performance of a contract), and for security and abuse prevention (legitimate interests). You can also complain
              to your local data-protection authority.
            </p>
          </Section>

          <Section id="children">
            <p>
              Vieews isn’t for children. You must be at least 13, old enough to accept these terms where you live, and allowed to use the
              platforms you connect. If we learn that a child has given us data, we delete it.
            </p>
          </Section>

          <Section id="transfers">
            <p>
              Our providers store and process data in the United States and other countries. Where the law requires it, we rely on their
              standard contractual clauses or similar safeguards for these transfers.
            </p>
          </Section>

          <Section id="changes">
            <p>
              If we change this policy, we’ll update the date at the top. If a change affects how we use data you’ve already given us, we’ll
              email you before it takes effect.
            </p>
          </Section>

          <Section id="contact">
            <p>
              Questions or complaints about privacy: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also our{" "}
              <Link href="/terms">Terms of Service</Link>.
            </p>
          </Section>
        </article>
      </main>

      <footer className="relative border-t border-border bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p>© 2026 Vieews</p>
          <nav aria-label="Footer" className="flex gap-4 font-semibold">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <Link href="/privacy" aria-current="page" className="text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "@/components/AppLink";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The rules and limitations that apply when using SkyPilot.",
};

const effectiveDate = "August 15, 2026";

export default function TermsPage() {
  return (
    <div className="page-shell prose-page">
      <header className="page-header">
        <div className="page-title">
          <small>TERMS OF USE · EFFECTIVE {effectiveDate.toUpperCase()}</small>
          <h1>Plan fairly. Verify important decisions.</h1>
          <p>
            By using SkyPilot, you agree to these operating rules. If you do not agree, do not use
            the service. Core calculations and profile analysis are planning tools, not a promise
            of a particular in-game result.
          </p>
        </div>
      </header>

      <section className="prose-grid" aria-label="SkyPilot terms of use">
        <article className="panel">
          <span>01</span>
          <h2>Independent, unofficial project</h2>
          <p>
            SkyPilot is an independently operated community project, not an official product of or
            endorsed by Hypixel Inc., Mojang Studios, Microsoft, Cloudflare, or OpenAI. Its use of
            Cloudflare hosting and optional OpenAI services does not make it a product of either
            company. Product, game, and company
            names belong to their respective owners. Their terms and policies continue to apply
            when you use their games, accounts, APIs, or services.
          </p>
        </article>

        <article className="panel">
          <span>02</span>
          <h2>Informational planning only</h2>
          <p>
            Scores, recommendations, prices, profit estimates, completion times, and readiness
            checks are unofficial estimates based on available data and your inputs. Market values
            can change and summary prices are not guaranteed executable trades. Verify important
            choices in-game and against current official sources. SkyPilot does not provide
            financial, investment, legal, or professional advice.
          </p>
        </article>

        <article className="panel">
          <span>03</span>
          <h2>Fair-use rules</h2>
          <p>
            Use SkyPilot for legitimate analysis, education, and planning. Do not use it to automate
            gameplay or trades, control a Minecraft client, exploit bugs, gain a prohibited unfair
            advantage, impersonate another person, probe private systems, scrape at scale, bypass
            access or rate limits, evade a suspension, or violate applicable law or third-party
            rules. The service may limit or block abusive traffic to protect users and providers.
          </p>
        </article>

        <article className="panel">
          <span>04</span>
          <h2>Accounts and shared content</h2>
          <p>
            An account is optional for core tools. You are responsible for activity tied to your
            sign-in and for keeping share links secure. Only submit content you are allowed to use.
            Build titles, descriptions, notes, and configurations marked public can be displayed to
            other visitors; unlisted content is available to anyone with its link. SkyPilot may
            remove content or restrict access when reasonably necessary for security, policy, or
            legal compliance.
          </p>
        </article>

        <article className="panel">
          <span>05</span>
          <h2>Availability and changes</h2>
          <p>
            Features can be experimental, disabled, delayed, rate-limited, or withdrawn. Upstream
            services can return incomplete, stale, or unavailable data. SkyPilot will label known
            demo, stale, and unavailable states, but it cannot guarantee uninterrupted operation,
            permanent storage, complete data, or error-free results. Export anything you need to
            keep before deleting an account or relying on an experimental feature.
          </p>
        </article>

        <article className="panel">
          <span>06</span>
          <h2>Responsibility and liability</h2>
          <p>
            You choose whether and how to act on SkyPilot output and remain responsible for your
            account, trades, purchases, gameplay, and compliance with platform rules. To the extent
            permitted by applicable law, the service is provided as available without warranties,
            and its maintainers are not responsible for indirect or consequential losses caused by
            reliance on estimates, service interruption, data loss, or third-party services.
            Nothing here limits rights or responsibilities that cannot legally be limited.
          </p>
        </article>

        <article className="panel">
          <span>07</span>
          <h2>Privacy, updates, and contact</h2>
          <p>
            The <Link href="/privacy">Privacy Notice</Link> explains current data handling and account
            deletion. These terms may be updated when the product or its obligations change; the
            effective date above identifies this version. Material changes should be posted before
            they take effect when practical. Questions can be opened in the{" "}
            <a
              href="https://github.com/test23780460/skyblock-hub/issues"
              rel="noreferrer"
              target="_blank"
            >
              SkyPilot GitHub Issues tracker
            </a>
            —without including personal data, credentials, or secrets.
          </p>
        </article>
      </section>

      <div className="notice independence-note">
        <strong>THIRD-PARTY RULES STILL APPLY</strong>
        <span>
          SkyPilot never authorizes conduct prohibited by Hypixel, Minecraft, Cloudflare, OpenAI, or
          another service you use. Check their current rules before relying on a feature.
        </span>
      </div>
    </div>
  );
}

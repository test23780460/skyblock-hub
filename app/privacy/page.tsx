import type { Metadata } from "next";
import Link from "@/components/AppLink";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What SkyPilot collects, why it is used, where it is sent, and how to delete it.",
};

const effectiveDate = "August 22, 2026";

export default function PrivacyPage() {
  return (
    <div className="page-shell prose-page">
      <header className="page-header">
        <div className="page-title">
          <small>PRIVACY NOTICE · EFFECTIVE {effectiveDate.toUpperCase()}</small>
          <h1>Your data has a job, a boundary, and a way out.</h1>
          <p>
            SkyPilot works without an account for core lookup and planning. This notice explains
            what the current application code handles when you search, sign in, save work, or use
            an optional integration.
          </p>
        </div>
      </header>

      <section className="prose-grid" aria-label="SkyPilot privacy practices">
        <article className="panel">
          <span>01</span>
          <h2>Player lookups are request-driven</h2>
          <p>
            When you submit a Minecraft username or Java UUID, SkyPilot sends the selector and an
            optional SkyBlock profile ID to its server. A username is first resolved through
            Minecraft Services or Mojang. If both official services fail for transport or access
            reasons, SkyPilot may ask PlayerDB for a username-to-UUID mapping. Its application
            fields are the normalized username and an identifying SkyPilot service user agent;
            Cloudflare may add network metadata as described below. An official not-found
            response does not use that fallback. The resolved UUID and display name must match Hypixel&apos;s
            authenticated player response before SkyPilot returns analysis. Lookups happen only
            after your action; saved profiles, accounts, goals, and page visits do not schedule
            player refreshes, monitoring, or lookup history.
          </p>
        </article>

        <article className="panel">
          <span>02</span>
          <h2>Bounded shared caches, not player tracking</h2>
          <p>
            SkyPilot caches a normalized latest Hypixel snapshot for one hour and may use that
            snapshot as clearly marked stale data for at most 24 hours when the provider is
            unavailable. The latest normalized username-to-UUID mapping may remain cached for up
            to seven days. SkyPilot does not cache PlayerDB&apos;s raw response, avatar, or other
            metadata. These caches can be shared between visitors to reduce upstream requests. The
            application does not keep scheduled stat timelines, play sessions, raw upstream
            profile dumps, identity lookup history, or another co-op member&apos;s profile data.
          </p>
        </article>

        <article className="panel">
          <span>03</span>
          <h2>What sign-in stores</h2>
          <p>
            Sign-in is optional. When you use a saved feature, SkyPilot creates a canonical
            application user and stores the sign-in provider, provider subject (the provider&apos;s
            account identifier), normalized email address, display name, and last login time. The
            provider and subject reconnect your sign-in to the right SkyPilot owner; the email and
            display name identify the account in its own workspace; and the login time records the
            latest authentication. The provider supplies those fields to the server. SkyPilot does
            not store your Cloudflare Access credentials or assertion token.
          </p>
        </article>

        <article className="panel">
          <span>04</span>
          <h2>Saved data is your choice</h2>
          <p>
            Signed-in features can store site preferences; linked Minecraft UUIDs, usernames, and
            profile identifiers; your labels and pinned or primary choices; goals and progress;
            favorites; and build titles, notes, equipment choices, and visibility. A private build
            is owner-only. An unlisted build can be opened by anyone with its share link, and a
            public build can appear in the public gallery. Changing a build&apos;s visibility controls
            future reads but cannot retract copies someone already received.
          </p>
        </article>

        <article className="panel">
          <span>05</span>
          <h2>Optional AI and measurements</h2>
          <p>
            If the AI assistant is enabled and you use it, SkyPilot sends your question, selected
            mode, and bounded server-resolved context to OpenAI. The request sets the OpenAI API{" "}
            <code>store</code> option to <code>false</code>; that does not override OpenAI&apos;s own
            service and retention rules. SkyPilot stores aggregate AI usage, cost, failure, and
            latency counters—not prompts or answers. For provider abuse controls, it can send
            OpenAI a one-way safety identifier derived from the signed-in account ID or requesting
            IP address; it does not send that underlying identifier as the safety value. The current
            application has no advertising pixels or third-party product analytics enabled.
          </p>
        </article>

        <article className="panel">
          <span>06</span>
          <h2>Service providers and disclosures</h2>
          <p>
            Depending on the enabled feature, data is processed by Cloudflare for hosting, verified
            Access sign-in, caching, database storage, admission limits, and security controls;
            Minecraft Services or Mojang for username resolution; PlayerDB, operated by Nodecraft,
            for the conditional username-to-UUID fallback described above; Hypixel for game data;
            and OpenAI for optional AI answers. SkyPilot&apos;s application code does not copy
            browser cookies, authentication, a profile selector, or the Hypixel key into the
            PlayerDB request. It supplies the requested username and SkyPilot&apos;s service user
            agent. Cloudflare can add network headers to Worker requests; depending on how the
            destination is routed, those headers may include the visitor IP address. PlayerDB may
            therefore process the requested username, request IP, and ordinary network metadata.
            Review the{" "}
            <a href="https://playerdb.co/" rel="noreferrer" target="_blank">
              PlayerDB API information
            </a>{" "}
            and{" "}
            <a
              href="https://nodecraft.com/legal/privacy-policy"
              rel="noreferrer"
              target="_blank"
            >
              Nodecraft privacy policy
            </a>. Hosting and security infrastructure can process the request IP address and standard
            request headers. Player admission uses a one-way actor key, and
            structured application logs contain bounded event, status, duration, and error-category
            fields rather than raw profile or NBT payloads. The application sends data to these
            services only for the requested feature. It may also disclose data when required by law
            or to protect the service and its users.
          </p>
        </article>

        <article className="panel">
          <span>07</span>
          <h2>Retention and deletion</h2>
          <p>
            Player-cache limits are described above. Durable account data remains until you delete
            it or it is removed by the operator. From the <Link href="/account">Account page</Link>,
            a signed-in user can permanently delete the canonical SkyPilot user, external identity,
            preferences, saved links, goals, recommendation state, builds, favorites, and linked
            analytics. This does not delete the user&apos;s Cloudflare Access identity or end that
            provider session. Shared Minecraft identity
            and minimal profile records can remain without the user link; aggregate metrics and
            security or administrator records with the canonical user reference removed can also
            remain. A final
            production-wide retention period for every operational record has not yet been set.
          </p>
        </article>

        <article className="panel">
          <span>08</span>
          <h2>Public economy data is separate</h2>
          <p>
            When economy ingestion is enabled, SkyPilot stores normalized Bazaar summaries,
            current active-auction fields, minimal ended-sale facts, and derived price or volume
            aggregates from Hypixel&apos;s public feeds. It does not attach those feed records to the
            visitor who views them and does not retain raw auction pages as a user history. Bazaar
            history has bounded hourly and daily windows; the complete production retention policy
            for every economy and operational record is still a launch requirement.
          </p>
        </article>

        <article className="panel">
          <span>09</span>
          <h2>No sale or targeted advertising</h2>
          <p>
            The current SkyPilot application code has no path that sells account or lookup data or
            uses it for targeted advertising. It contains no advertising network, data-broker, or
            cross-site tracking integration. Hosting and sign-in providers may use essential
            session, fraud-prevention, and security mechanisms under their own notices.
          </p>
        </article>
      </section>

      <div className="notice independence-note">
        <strong>QUESTIONS OR REQUESTS</strong>
        <span>
          Open a private-data-safe ticket in the{" "}
          <a
            href="https://github.com/test23780460/skyblock-hub/issues"
            rel="noreferrer"
            target="_blank"
          >
            SkyPilot GitHub Issues tracker
          </a>
          . Do not post email addresses, account IDs, API keys, or other secrets. Review the{" "}
          <Link href="/terms">Terms of Use</Link> for service rules and third-party disclaimers.
        </span>
      </div>
    </div>
  );
}

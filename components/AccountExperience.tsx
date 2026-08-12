"use client";

import { useState } from "react";
import Link from "@/components/AppLink";
import { SavedStateExperience } from "@/components/SavedStateExperience";

export type AccountPersistenceState = "active" | "absent" | "unavailable" | "disabled" | "anonymous";

type AccountUser = { displayName: string; email: string } | null;
type DeletePayload = {
  data?: { deleted?: boolean; alreadyAbsent?: boolean; message?: string };
  error?: { message?: string; action?: string };
};

export function AccountExperience({
  authEnabled,
  persistenceState: initialPersistenceState,
  signInHref,
  signOutHref,
  user,
}: {
  authEnabled: boolean;
  persistenceState: AccountPersistenceState;
  signInHref: string;
  signOutHref: string;
  user: AccountUser;
}) {
  const [persistenceState, setPersistenceState] = useState(initialPersistenceState);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const accountActive = Boolean(user) && persistenceState === "active";

  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!accountActive || confirmation !== "DELETE SKYPILOT") return;
    setDeleting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { accept: "application/json" },
      });
      const payload = await response.json() as DeletePayload;
      if (!response.ok || !payload.data) {
        throw new Error([payload.error?.message, payload.error?.action].filter(Boolean).join(" ") || "Account deletion could not be completed.");
      }
      setPersistenceState("absent");
      setConfirmation("");
      setMessage(payload.data.message || "SkyPilot application account data was deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account deletion could not be completed.");
    } finally {
      setDeleting(false);
    }
  }

  const stateLabel = user
    ? persistenceState === "active"
      ? "SYNC ENABLED"
      : persistenceState === "unavailable"
        ? "PERSISTENCE UNAVAILABLE"
        : "SIGNED IN · NO STORED DATA"
    : authEnabled
      ? "NOT SAVING"
      : "SYNC DISABLED";

  return (
    <div className="page-shell account-page">
      <header className="page-header"><div className="page-title"><small>OPTIONAL SKYPILOT ACCOUNT</small><h1>{user ? "Your SkyPilot account" : authEnabled ? "Save the plan, not the gate" : "Account sync is disabled"}</h1><p>{authEnabled ? "Public tools do not require an account. Sign in only when you want durable account data." : "This deployment has not enabled its platform authentication trust boundary. Public tools remain separate from account storage."}</p></div>{user ? <Link className="button-secondary" href={signOutHref}>Sign out</Link> : authEnabled ? <Link className="button-primary" href={signInHref}>Sign in with ChatGPT</Link> : <Link className="button-secondary" href="/status">View status</Link>}</header>

      <section className="account-hero panel">
        <span className="account-avatar">{user?.displayName.slice(0, 1).toUpperCase() || "P"}</span>
        <div><small>{user ? "SIGNED IN" : "ANONYMOUS VISITOR"}</small><h2>{user?.displayName || "Public SkyPilot access"}</h2><p>{user ? persistenceState === "active" ? user.email : persistenceState === "unavailable" ? "The sign-in is valid, but SkyPilot cannot verify stored application data right now." : "This identity is signed in, but no canonical SkyPilot account data currently exists." : authEnabled ? "No account is needed for enabled public planning tools." : "Account data is neither loaded nor saved while authentication is disabled."}</p></div>
        <span className={accountActive ? "account-state active" : "account-state"}>{stateLabel}</span>
      </section>

      <section className="three-column account-feature-grid">
        {[{ title: "Profile analysis", copy: "Analyze enabled player lookups on demand. Shared game records are separate from optional account links.", href: "/dashboard" }, { title: "Saved goals", copy: "Enabled signed-in deployments support owner-scoped goal creation, updates, recurrence, and deletion.", href: "/goals" }, { title: "Planning tools", copy: "Use transparent manual planning inputs without requiring an account.", href: "/gear" }].map((item) => <article className="panel account-feature" key={item.title}><span aria-hidden="true">◇</span><h2>{item.title}</h2><p>{item.copy}</p><Link href={item.href}>Open →</Link></article>)}
      </section>

      <SavedStateExperience
        enabled={authEnabled}
        signedIn={Boolean(user)}
        onActivated={() => setPersistenceState("active")}
      />

      {user ? <section className="panel" aria-labelledby="delete-account-title"><div className="panel-header"><div><h2 id="delete-account-title">Delete SkyPilot account data</h2><small>Permanent application-data deletion</small></div><span className="unofficial-label">DOES NOT DELETE CHATGPT</span></div>
        {persistenceState === "active" ? <><p>Deletion removes the canonical SkyPilot user and cascades through external identity links, preferences, roles, saved profile links, goals, recommendation state, saved builds, favorites, and linked analytics. Shared Minecraft and SkyBlock records are not account-owned and remain without your user link. Security and administrator records may remain with the user reference removed.</p><form onSubmit={deleteAccount}><label htmlFor="delete-account-confirmation">Type <strong>DELETE SKYPILOT</strong> to confirm</label><input className="control" id="delete-account-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} /><div className="toolbar"><button className="button-primary" type="submit" disabled={deleting || confirmation !== "DELETE SKYPILOT"}>{deleting ? "Deleting…" : "Delete my SkyPilot data"}</button><span>This cannot be undone.</span></div></form></> : persistenceState === "unavailable" ? <div className="notice" role="alert"><strong>!</strong><span>Persistence is unavailable, so SkyPilot cannot verify or delete account data. No successful deletion is being claimed.</span></div> : <div className="notice"><strong>✓</strong><span>No canonical SkyPilot account data currently exists. Using a saved feature later may create a new SkyPilot application account.</span></div>}
        {error ? <div className="notice" role="alert"><strong>!</strong><span>{error}</span></div> : null}
        {message ? <div className="notice" role="status"><strong>✓</strong><span>{message} You may sign out separately; the platform session remains active.</span></div> : null}
      </section> : null}

      <div className="notice privacy-notice"><strong>PRIVACY</strong><span>SkyPilot uses an internal canonical application user ID. Deleting it does not delete your ChatGPT account or shared public game-data records.</span></div>
    </div>
  );
}

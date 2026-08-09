import type { Metadata } from "next";
import Link from "@/components/AppLink";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { featureFlags } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const user = await getChatGPTUser();
  const authEnabled = featureFlags.chatGptAuth;
  return (
    <div className="page-shell account-page">
      <header className="page-header"><div className="page-title"><small>OPTIONAL SKYPILOT ACCOUNT</small><h1>{user ? "Your SkyPilot account" : authEnabled ? "Save the plan, not the gate" : "Account sync is disabled"}</h1><p>{authEnabled ? "Public tools do not require an account. Sign in only when you want durable account data." : "This deployment has not enabled its platform authentication trust boundary. Public tools remain separate from account storage."}</p></div>{user ? <Link className="button-secondary" href={chatGPTSignOutPath("/")}>Sign out</Link> : authEnabled ? <Link className="button-primary" href={chatGPTSignInPath("/account")}>Sign in with ChatGPT</Link> : <Link className="button-secondary" href="/status">View status</Link>}</header>
      <section className="account-hero panel">
        <span className="account-avatar">{user?.displayName.slice(0, 1).toUpperCase() || "P"}</span>
        <div><small>{user ? "SIGNED IN" : "ANONYMOUS VISITOR"}</small><h2>{user?.displayName || "Public SkyPilot access"}</h2><p>{user ? user.email : authEnabled ? "No account is needed for enabled public planning tools." : "Account data is neither loaded nor saved while authentication is disabled."}</p></div>
        <span className={user ? "account-state active" : "account-state"}>{user ? "SYNC ENABLED" : authEnabled ? "NOT SAVING" : "SYNC DISABLED"}</span>
      </section>
      <section className="three-column account-feature-grid">
        {[{ title: "Profile analysis", copy: "Analyze enabled player lookups on demand. A saved-profile workflow is not exposed yet.", href: "/dashboard" }, { title: "Saved goals", copy: "Enabled signed-in deployments can save goals. Dashboard recommendation choices remain visit-local.", href: "/goals" }, { title: "Planning tools", copy: "Use transparent manual planning inputs. Durable preference and build-saving workflows are not exposed yet.", href: "/gear" }].map((item) => <article className="panel account-feature" key={item.title}><span>◇</span><h2>{item.title}</h2><p>{item.copy}</p><Link href={item.href}>Open →</Link></article>)}
      </section>
      <div className="notice privacy-notice"><strong>PRIVACY</strong><span>SkyPilot uses an internal canonical application user ID. External provider identifiers map to it and are not scattered through business records.</span></div>
    </div>
  );
}

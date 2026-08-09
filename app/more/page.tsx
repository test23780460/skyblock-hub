import type { Metadata } from "next";
import Link from "@/components/AppLink";
import { navigationGroups, primaryNavigation } from "@/lib/navigation";

export const metadata: Metadata = { title: "All Tools", description: "Explore every enabled SkyPilot planning and intelligence module." };

export default function MorePage() {
  return (
    <div className="page-shell directory-page">
      <header className="page-header"><div className="page-title"><small>EVERY ENABLED DESTINATION</small><h1>SkyPilot tool directory</h1><p>Profile, progression, economy, skills, completion, calculators, and account tools—organized by the decision they help you make.</p></div><Link className="button-primary" href="/dashboard">Analyze a player</Link></header>
      <section className="directory-grid">
        <article className="panel directory-group"><div className="panel-header"><h2>Core</h2><span>{primaryNavigation.length}</span></div><div>{primaryNavigation.map((item) => <Link href={item.href} key={item.href}><span className="module-icon cyan">{item.icon}</span><div><strong>{item.label}</strong><small>{item.description}</small></div><i>→</i></Link>)}</div></article>
        {navigationGroups.map((group) => <article className="panel directory-group" key={group.label}><div className="panel-header"><h2>{group.label}</h2><span>{group.items.length}</span></div><div>{group.items.map((item) => <Link href={item.href} key={item.href}><span className="module-icon violet">{item.icon}</span><div><strong>{item.label}</strong><small>{item.description}</small></div><i>→</i></Link>)}</div></article>)}
      </section>
    </div>
  );
}

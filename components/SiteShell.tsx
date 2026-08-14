import Link from "@/components/AppLink";
import { featureFlags, siteConfig } from "@/lib/config";
import { getVisibleNavigationGroups, getVisiblePrimaryNavigation } from "@/lib/navigation";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const primaryNavigation = getVisiblePrimaryNavigation();
  const navigationGroups = getVisibleNavigationGroups();

  return (
    <div className="site-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label={siteConfig.name + " home"}>
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span className="brand-copy"><strong>{siteConfig.name}</strong><small>SKYBLOCK INTELLIGENCE</small></span>
        </Link>

        <nav className="desktop-nav">
          <div className="nav-stack">
            {primaryNavigation.map((item) => (
              <Link className="nav-link" href={item.href} key={item.href} title={item.description}>
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
          {navigationGroups.map((group) => (
            <details className="nav-group" key={group.label} open={group.label === "Markets"}>
              <summary>{group.label}<span aria-hidden="true">+</span></summary>
              <div className="nav-stack compact">
                {group.items.map((item) => (
                  <Link className="nav-link" href={item.href} key={item.href} title={item.description}>
                    <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge ? <small className="nav-badge">{item.badge}</small> : null}
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="status-dot" aria-hidden="true" />
          <span><strong>Policy-safe data</strong><small>{featureFlags.playerLookup ? "Request-driven player lookups" : "Live player lookup is currently off"}</small></span>
        </div>
      </aside>

      <div className="content-column">
        <header className="topbar">
          <Link className="mobile-brand" href="/">{siteConfig.name}</Link>
          {featureFlags.playerLookup ? (
            <form className="quick-search" action="/dashboard" method="get" role="search">
              <label className="sr-only" htmlFor="global-player-search">Minecraft username or Java UUID</label>
              <span aria-hidden="true">⌕</span>
              <input id="global-player-search" name="player" placeholder="Username or UUID" autoComplete="off" maxLength={36} pattern="[A-Za-z0-9_]{1,16}|[0-9A-Fa-f]{32}|[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}" />
              <kbd>↵</kbd>
            </form>
          ) : <Link className="text-link" href="/dashboard?demo=1">Explore the labeled demo</Link>}
          <div className="topbar-actions">
            <Link className="text-link" href="/more">Tool directory</Link>
            {featureFlags.chatGptAuth ? <Link className="avatar-button" href="/account" aria-label="Account">P</Link> : null}
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <span>{siteConfig.name} is not affiliated with or endorsed by Hypixel, Mojang, or Microsoft.</span>
          <nav aria-label="Footer navigation"><Link href="/status">Status</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/about">About</Link></nav>
        </footer>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {primaryNavigation.slice(0, 4).map((item) => (
          <Link href={item.href} key={item.href}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></Link>
        ))}
        <Link href="/more"><span aria-hidden="true">•••</span><small>More</small></Link>
      </nav>
    </div>
  );
}

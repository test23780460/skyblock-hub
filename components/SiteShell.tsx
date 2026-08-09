import Link from "@/components/AppLink";
import { navigationGroups, primaryNavigation } from "@/lib/navigation";
import { siteConfig } from "@/lib/config";

export function SiteShell({ children }: { children: React.ReactNode }) {
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
          <span><strong>Policy-safe data</strong><small>Request-driven player lookups</small></span>
        </div>
      </aside>

      <div className="content-column">
        <header className="topbar">
          <Link className="mobile-brand" href="/">{siteConfig.name}</Link>
          <form className="quick-search" action="/dashboard" method="get" role="search">
            <label className="sr-only" htmlFor="global-player-search">Minecraft username</label>
            <span aria-hidden="true">⌕</span>
            <input id="global-player-search" name="player" placeholder="Search any player" autoComplete="off" maxLength={16} pattern="[A-Za-z0-9_]{1,16}" />
            <kbd>↵</kbd>
          </form>
          <div className="topbar-actions">
            <Link className="text-link" href="/items">Item lookup</Link>
            <Link className="avatar-button" href="/account" aria-label="Account">P</Link>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <span>{siteConfig.name} is not affiliated with or endorsed by Hypixel, Mojang, or Microsoft.</span>
          <nav aria-label="Footer navigation"><Link href="/status">Status</Link><Link href="/privacy">Privacy</Link><Link href="/about">About</Link></nav>
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

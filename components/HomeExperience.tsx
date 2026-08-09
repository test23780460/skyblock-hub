import Link from "@/components/AppLink";

const previewStats = [
  ["SkyBlock Level", "287"],
  ["Net Worth", "4.82B"],
  ["Magical Power", "1,104"],
  ["Skill Average", "49.6"],
];

const nextMoves = [
  { rank: "01", title: "Finish accessory upgrades", detail: "+31 MP for about 18.4M", tag: "BEST VALUE", tone: "mint" },
  { rank: "02", title: "Add gemstones to mining gear", detail: "+74 Mining Fortune", tag: "HIGH IMPACT", tone: "violet" },
  { rank: "03", title: "Unlock your next minion slot", detail: "4 cheapest crafts identified", tag: "QUICK WIN", tone: "amber" },
];

const modules = [
  { icon: "↗", title: "Progression engine", copy: "A ranked plan that accounts for your stage, budget, goals, and prerequisites.", href: "/progression", color: "cyan" },
  { icon: "✦", title: "Magical Power", copy: "Find the cheapest missing accessories and best coins-per-MP upgrades.", href: "/accessories", color: "violet" },
  { icon: "⇄", title: "Market intelligence", copy: "Browse Bazaar and auction opportunities with liquidity and risk in view.", href: "/economy", color: "amber" },
  { icon: "❋", title: "Skill optimizers", copy: "Model Garden, mining, fishing, dungeons, slayers, and minion progression.", href: "/skills", color: "mint" },
  { icon: "◇", title: "Gear diagnostics", copy: "Inspect upgrades already missing from the equipment you actually own.", href: "/gear", color: "rose" },
  { icon: "✣", title: "Grounded AI help", copy: "Ask planning questions backed by deterministic calculations and explicitly available context.", href: "/ai", color: "blue" },
];

export function HomeExperience() {
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-glow" aria-hidden="true" />
        <div className="eyebrow"><span /> ALL-IN-ONE SKYBLOCK PROGRESSION</div>
        <h1>Stop guessing.<br /><em>Know your next move.</em></h1>
        <p className="hero-copy">Search your profile for a precise, connected view of progression, gear, Magical Power, markets, and the upgrades worth doing now.</p>
        <form className="hero-search" action="/dashboard" method="get" role="search">
          <label className="sr-only" htmlFor="hero-player-search">Minecraft username</label>
          <span className="head-cube" aria-hidden="true"><i /></span>
          <input id="hero-player-search" name="player" placeholder="Enter Minecraft username" autoComplete="off" maxLength={16} pattern="[A-Za-z0-9_]{1,16}" required />
          <button type="submit">Analyze profile <span aria-hidden="true">→</span></button>
        </form>
        <div className="hero-meta"><span><i className="live-dot" /> No account required</span><span>Player data is fetched on request</span><Link href="/dashboard?demo=1">Explore a labeled demo</Link></div>

        <div className="profile-preview" aria-label="SkyPilot profile analysis preview">
          <div className="preview-watermark">ILLUSTRATIVE PRODUCT PREVIEW</div>
          <div className="preview-player">
            <span className="pixel-avatar" aria-hidden="true"><i /><b /></span>
            <div><small>SELECTED PROFILE · IRONMAN</small><strong>PilotExample</strong><span><i className="online-dot" /> Watermelon</span></div>
            <div className="progression-ring"><span>84</span><small>OUR SCORE</small></div>
          </div>
          <div className="preview-stats">
            {previewStats.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong><span className="tiny-trend">↗</span></div>)}
          </div>
          <div className="preview-grid">
            <div className="next-card">
              <div className="section-heading"><div><small>PRIORITIZED FOR THIS PROFILE</small><h2>Next best upgrades</h2></div><Link href="/progression">Full plan →</Link></div>
              <div className="move-list">
                {nextMoves.map((move) => (
                  <div className="move-row" key={move.rank}><span className="move-rank">{move.rank}</span><span className={"item-orb " + move.tone} aria-hidden="true" /><div><strong>{move.title}</strong><small>{move.detail}</small></div><span className={"value-badge " + move.tone}>{move.tag}</span><span aria-hidden="true">›</span></div>
                ))}
              </div>
            </div>
            <div className="market-card">
              <div className="section-heading"><div><small>BAZAAR PULSE</small><h2>Market movement</h2></div><span className="live-pill">ILLUSTRATIVE</span></div>
              <div className="market-value"><strong>+12.8%</strong><span>top tracked basket · 24h</span></div>
              <div className="spark-chart" aria-label="Decorative market preview chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <div className="market-foot"><span>Volume <strong>18.3B</strong></span><span>Spread <strong>2.7%</strong></span></div>
              <small className="sample-note">*Preview values are illustrative. Live values load from Hypixel after activation.</small>
            </div>
          </div>
        </div>
      </section>

      <section className="product-section">
        <div className="section-kicker">ONE CONNECTED COMMAND CENTER</div>
        <div className="product-heading"><h2>Five tabs worth of answers.<br /><em>One clear plan.</em></h2><p>Core analysis and market modules use consistent data contracts, while manual planning labs keep their inputs and assumptions visible.</p></div>
        <div className="module-grid">
          {modules.map((module) => (
            <Link className="module-card" href={module.href} key={module.title}>
              <span className={"module-icon " + module.color} aria-hidden="true">{module.icon}</span><h3>{module.title}</h3><p>{module.copy}</p><span className="module-link">Open module <i aria-hidden="true">→</i></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div><span className="cta-mark" aria-hidden="true">⌁</span><div><small>YOUR PROFILE. YOUR BUDGET. YOUR NEXT MOVE.</small><h2>Ready to fly smarter?</h2></div></div>
        <Link className="primary-button" href="#hero-player-search">Analyze my profile <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  );
}

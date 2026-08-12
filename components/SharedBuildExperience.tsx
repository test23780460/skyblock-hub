"use client";

import { useEffect, useState } from "react";
import Link from "@/components/AppLink";
import type { BuildConfiguration, BuildVisibility } from "@/lib/saved-state/validation";
import styles from "./SavedState.module.css";

type SharedBuild = {
  id: string;
  title: string;
  description: string | null;
  visibility: Exclude<BuildVisibility, "private">;
  sharePath: string;
  build: BuildConfiguration;
  updatedAt: string;
};

export function SharedBuildExperience({ shareSlug, enabled }: { shareSlug: string; enabled: boolean }) {
  const [build, setBuild] = useState<SharedBuild | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetch(`/api/builds/shared/${encodeURIComponent(shareSlug)}`, { headers: { accept: "application/json" } })
      .then(async (response) => {
        const payload = await response.json() as { data?: { build?: SharedBuild }; error?: { message?: string } };
        if (!response.ok || !payload.data?.build) throw new Error(payload.error?.message || "This shared build is unavailable.");
        if (active) setBuild(payload.data.build);
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : "This shared build is unavailable."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [enabled, shareSlug]);

  return <div className="page-shell"><header className="page-header"><div className="page-title"><small>USER-ENTERED LOADOUT</small><h1>{build?.title || "Shared SkyPilot build"}</h1><p>{build?.description || "A manually composed SkyBlock planning reference with explicit sharing privacy."}</p></div><Link className="button-primary" href="/builds">Open build planner</Link></header>
    <div className="notice"><strong>UNVERIFIED</strong><span>This is user-entered planning content. It is not live profile data, market advice, or an in-game action.</span></div>
    {!enabled ? <section className="panel"><div className="panel-header"><h2>Sharing disabled</h2></div><div className={styles.panelBody}><p className={styles.muted}>This deployment has not enabled durable account and sharing features.</p></div></section> : loading ? <section className="panel" aria-busy="true"><div className="panel-header"><h2>Loading shared build…</h2></div></section> : error || !build ? <section className="panel"><div className="panel-header"><h2>Build unavailable</h2></div><div className={styles.panelBody}><p className={styles.error}>{error || "This link is invalid, private, deleted, or has been rotated."}</p></div></section> : <section className="panel"><div className="panel-header"><div><h2>{build.title}</h2><small>{build.build.activity} · updated {new Date(build.updatedAt).toLocaleDateString()}</small></div><span className={styles.badge}>{build.visibility.toUpperCase()}</span></div><div className={styles.panelBody}><div className={styles.summary}><div><small>ARMOR</small><strong>{build.build.armor || "Not specified"}</strong></div><div><small>WEAPON / TOOL</small><strong>{build.build.weapon || "Not specified"}</strong></div><div><small>PET</small><strong>{build.build.pet || "Not specified"}</strong></div></div><div className={styles.card}><h3>Equipment</h3><p>{build.build.equipment || "Not specified"}</p></div><div className={styles.card}><h3>Accessories / power</h3><p>{build.build.accessories || "Not specified"}</p></div><div className={styles.card}><h3>Notes and assumptions</h3><p>{build.build.notes || "No notes provided."}</p></div></div></section>}
  </div>;
}

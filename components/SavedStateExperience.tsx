"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/AppLink";
import type { SavedPreferences } from "@/lib/saved-state/validation";
import { defaultSavedPreferences } from "@/lib/saved-state/validation";
import styles from "./SavedState.module.css";

type LinkedAccount = {
  id: string;
  username: string;
  label: string | null;
  isPrimary: boolean;
  linkedAt: string;
};
type SavedProfile = {
  id: string;
  minecraftAccountId: string;
  username: string;
  name: string;
  gameMode: string;
  alias: string | null;
  isPinned: boolean;
  dataState: string;
};
type Favorite = {
  id: string;
  resourceType: string;
  resourceId: string;
  label: string | null;
};
type SavedState = {
  accountExists: boolean;
  accounts: LinkedAccount[];
  profiles: SavedProfile[];
  builds: { id: string }[];
  favorites: Favorite[];
  preferences: SavedPreferences;
};

const favoriteTools = [
  ["calculators", "Calculator lab"],
  ["garden", "Garden optimizer"],
  ["accessories", "Accessory optimizer"],
  ["goals", "Goal planner"],
  ["bazaar", "Bazaar explorer"],
  ["auctions", "Auction intelligence"],
] as const;

export function SavedStateExperience({
  enabled,
  signedIn,
  onActivated,
}: {
  enabled: boolean;
  signedIn: boolean;
  onActivated: () => void;
}) {
  const [state, setState] = useState<SavedState | null>(null);
  const [preferences, setPreferences] = useState<SavedPreferences>({ ...defaultSavedPreferences });
  const [tool, setTool] = useState<string>(favoriteTools[0][0]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!enabled || !signedIn) return;
    setBusy("load");
    setError("");
    try {
      const payload = await requestJson<{ data: SavedState }>("/api/saved-state");
      setState(payload.data);
      setPreferences(payload.data.preferences);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }, [enabled, signedIn]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function mutate(path: string, method: "PATCH" | "POST" | "DELETE", body?: unknown, success = "Saved.") {
    setBusy(path + method);
    setMessage("");
    setError("");
    try {
      await requestJson(path, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (method !== "DELETE") onActivated();
      setMessage(success);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  async function savePreferences(event: React.FormEvent) {
    event.preventDefault();
    await mutate("/api/preferences", "PATCH", preferences, "Preferences saved across sessions.");
  }

  async function resetPreferences() {
    await mutate("/api/preferences", "DELETE", undefined, "Preferences reset to SkyPilot defaults.");
  }

  async function renameProfile(event: React.FormEvent<HTMLFormElement>, profile: SavedProfile) {
    event.preventDefault();
    const alias = String(new FormData(event.currentTarget).get("alias") || "");
    await mutate(`/api/saved-profiles/${profile.id}`, "PATCH", { alias }, "Profile alias updated.");
  }

  async function relabelAccount(event: React.FormEvent<HTMLFormElement>, account: LinkedAccount) {
    event.preventDefault();
    const label = String(new FormData(event.currentTarget).get("label") || "");
    await mutate(`/api/saved-accounts/${account.id}`, "PATCH", { label }, "Minecraft account label updated.");
  }

  async function addToolFavorite(event: React.FormEvent) {
    event.preventDefault();
    const label = favoriteTools.find(([id]) => id === tool)?.[1] ?? tool;
    await mutate("/api/favorites", "POST", { resourceType: "tool", resourceId: tool, label }, "Tool added to favorites.");
  }

  if (!enabled || !signedIn) {
    return <section className="panel"><div className="panel-header"><div><h2>Saved workspace</h2><small>Profiles · preferences · favorites · builds</small></div><span className="unofficial-label">OPTIONAL</span></div><div className={styles.panelBody}><p className={styles.muted}>{enabled ? "Sign in to persist these records across sessions. Anonymous lookup and planning remain available." : "This deployment keeps durable account storage off. Anonymous lookup and planning remain available."}</p><div className={styles.actions}><Link href="/dashboard">Analyze a profile →</Link><Link href="/builds">Open build planner →</Link></div></div></section>;
  }

  if (!state && busy === "load") {
    return <section className="panel" aria-busy="true"><div className="panel-header"><h2>Saved workspace</h2><span>Loading…</span></div><div className={styles.panelBody}><p className={styles.muted}>Loading only this signed-in owner&apos;s saved records.</p></div></section>;
  }

  return (
    <section className={`${styles.stack} ${preferences.compactAccountView ? styles.compact : ""}`} aria-label="Saved SkyPilot workspace">
      <div className="panel"><div className="panel-header"><div><h2>Saved workspace</h2><small>Durable, owner-scoped records</small></div><Link href="/builds">Build planner →</Link></div><div className={styles.panelBody}>
        <div className={styles.summary} aria-label="Saved record counts"><div><small>MINECRAFT ACCOUNTS</small><strong>{state?.accounts.length ?? 0}</strong></div><div><small>SAVED PROFILES</small><strong>{state?.profiles.length ?? 0}</strong></div><div><small>BUILDS · FAVORITES</small><strong>{state?.builds.length ?? 0} · {state?.favorites.length ?? 0}</strong></div></div>
        {!state?.accountExists ? <p className={styles.muted}>No SkyPilot application account data exists yet. Your first save creates it; merely using public tools does not.</p> : null}
        <div className={styles.status} aria-live="polite">{error ? <span className={styles.error}>{error}</span> : message}</div>
      </div></div>

      <div className={styles.grid}>
        <section className="panel"><div className="panel-header"><div><h2>Minecraft accounts</h2><small>Explicitly linked by a saved live profile</small></div><Link href="/dashboard">Add from lookup</Link></div><div className={styles.panelBody}>
          <div className={styles.list}>{state?.accounts.length ? state.accounts.map((account) => <article className={styles.card} key={account.id}><div className={styles.cardHead}><div><h3>{account.label || account.username}</h3><p>{account.username}</p></div>{account.isPrimary ? <span className={styles.badge}>PRIMARY</span> : null}</div><form className={styles.actions} onSubmit={(event) => void relabelAccount(event, account)}><label className="sr-only" htmlFor={`account-label-${account.id}`}>Label for {account.username}</label><input className="control" id={`account-label-${account.id}`} name="label" defaultValue={account.label ?? ""} maxLength={60} placeholder="Optional account label" /><button type="submit" disabled={Boolean(busy)}>Save label</button></form><div className={styles.actions}>{!account.isPrimary ? <button type="button" disabled={Boolean(busy)} onClick={() => void mutate(`/api/saved-accounts/${account.id}`, "PATCH", { isPrimary: true }, `${account.username} is now primary.`)}>Make primary</button> : null}<button className={styles.danger} type="button" disabled={Boolean(busy)} onClick={() => window.confirm(`Unlink ${account.username} and its saved profiles?`) && void mutate(`/api/saved-accounts/${account.id}`, "DELETE", undefined, "Minecraft account unlinked.")}>Unlink</button></div></article>) : <p className={styles.muted}>No Minecraft account is linked. Run a live profile lookup, then choose Save profile.</p>}</div>
        </div></section>

        <section className="panel"><div className="panel-header"><div><h2>Saved profiles</h2><small>Links only · no background refresh</small></div><span>{state?.profiles.length ?? 0}</span></div><div className={styles.panelBody}>
          <div className={styles.list}>{state?.profiles.length ? state.profiles.map((profile) => <article className={styles.card} key={profile.id}><div className={styles.cardHead}><div><h3>{profile.alias || profile.name}</h3><p>{profile.username} · {profile.name} · {profile.gameMode}</p></div>{profile.isPinned ? <span className={styles.badge}>PINNED</span> : null}</div><form className={styles.actions} onSubmit={(event) => void renameProfile(event, profile)}><label className="sr-only" htmlFor={`profile-alias-${profile.id}`}>Alias for {profile.name}</label><input className="control" id={`profile-alias-${profile.id}`} name="alias" defaultValue={profile.alias ?? ""} maxLength={60} placeholder="Optional profile alias" /><button type="submit" disabled={Boolean(busy)}>Save alias</button></form><div className={styles.actions}><Link href={`/dashboard?player=${encodeURIComponent(profile.username)}`}>Open current lookup</Link><button type="button" disabled={Boolean(busy)} onClick={() => void mutate(`/api/saved-profiles/${profile.id}`, "PATCH", { isPinned: !profile.isPinned }, profile.isPinned ? "Profile unpinned." : "Profile pinned.")}>{profile.isPinned ? "Unpin" : "Pin"}</button><button className={styles.danger} type="button" disabled={Boolean(busy)} onClick={() => window.confirm(`Remove ${profile.alias || profile.name} from saved profiles?`) && void mutate(`/api/saved-profiles/${profile.id}`, "DELETE", undefined, "Saved profile removed.")}>Remove</button></div></article>) : <p className={styles.muted}>Saved profiles appear here after an explicit live lookup. Saving a link does not schedule monitoring.</p>}</div>
        </div></section>
      </div>

      <div className={styles.grid}>
        <section className="panel"><div className="panel-header"><div><h2>Preferences</h2><small>Durable planning defaults</small></div></div><form className={`${styles.panelBody} ${styles.formGrid}`} onSubmit={savePreferences}>
          <label className={styles.field}><span>DEFAULT MINECRAFT PLAYER</span><input value={preferences.defaultPlayer} onChange={(event) => setPreferences((current) => ({ ...current, defaultPlayer: event.target.value }))} maxLength={16} pattern="[A-Za-z0-9_]{0,16}" placeholder="Optional username" /></label>
          <label className={styles.field}><span>DEFAULT PLANNING BUDGET</span><input type="number" min={0} max={100_000_000_000} step={1} value={preferences.defaultBudgetCoins} onChange={(event) => setPreferences((current) => ({ ...current, defaultBudgetCoins: Number(event.target.value) }))} /></label>
          <label className={styles.field}><span>PLANNING FOCUS</span><select value={preferences.planningFocus} onChange={(event) => setPreferences((current) => ({ ...current, planningFocus: event.target.value as SavedPreferences["planningFocus"] }))}><option value="progression">Progression</option><option value="economy">Economy</option><option value="completion">Completion</option></select></label>
          <label className={styles.check}><input type="checkbox" checked={preferences.compactAccountView} onChange={(event) => setPreferences((current) => ({ ...current, compactAccountView: event.target.checked }))} />Use compact saved-record cards</label>
          <div className={`${styles.actions} ${styles.wide}`}><button className="button-primary" type="submit" disabled={Boolean(busy)}>Save preferences</button><button className="button-secondary" type="button" disabled={Boolean(busy)} onClick={() => void resetPreferences()}>Reset defaults</button>{preferences.defaultPlayer ? <Link href={`/dashboard?player=${encodeURIComponent(preferences.defaultPlayer)}`}>Analyze default player →</Link> : null}</div>
        </form></section>

        <section className="panel"><div className="panel-header"><div><h2>Favorites</h2><small>Tools and saved planning references</small></div><span>{state?.favorites.length ?? 0}</span></div><div className={styles.panelBody}><form className={styles.actions} onSubmit={addToolFavorite}><label className="sr-only" htmlFor="favorite-tool">Tool to favorite</label><select className="control" id="favorite-tool" value={tool} onChange={(event) => setTool(event.target.value)}>{favoriteTools.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button className="button-secondary" type="submit" disabled={Boolean(busy)}>Add tool</button></form><div className={styles.list}>{state?.favorites.length ? state.favorites.map((favorite) => <article className={styles.card} key={favorite.id}><div className={styles.cardHead}><div><h3>{favorite.label || favorite.resourceId}</h3><p>{favorite.resourceType} · {favorite.resourceId}</p></div></div><div className={styles.actions}>{favorite.resourceType === "tool" ? <Link href={`/${favorite.resourceId}`}>Open</Link> : favorite.resourceType === "profile" ? <Link href="/account">View profile</Link> : favorite.resourceType === "build" ? <Link href="/builds">View build</Link> : null}<button className={styles.danger} type="button" disabled={Boolean(busy)} onClick={() => void mutate("/api/favorites", "DELETE", { resourceType: favorite.resourceType, resourceId: favorite.resourceId, label: favorite.label }, "Favorite removed.")}>Remove</button></div></article>) : <p className={styles.muted}>Favorite a tool here, a recommendation from a live dashboard, or one of your saved builds.</p>}</div></div></section>
      </div>
    </section>
  );
}

async function requestJson<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, headers: { accept: "application/json", ...init?.headers } });
  const payload = await response.json() as T & { error?: { message?: string; action?: string } };
  if (!response.ok) throw new Error([payload.error?.message, payload.error?.action].filter(Boolean).join(" ") || "The saved-state request failed.");
  return payload;
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : "The saved-state request failed.";
}

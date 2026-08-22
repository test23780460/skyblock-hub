"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/AppLink";
import type {
  BuildActivity,
  BuildConfiguration,
  BuildVisibility,
} from "@/lib/saved-state/validation";
import { buildActivities } from "@/lib/saved-state/validation";
import styles from "./SavedState.module.css";

type BuildView = {
  id: string;
  profileId: string | null;
  title: string;
  description: string | null;
  visibility: BuildVisibility;
  sharePath: string | null;
  build: BuildConfiguration;
  createdAt: string;
  updatedAt: string;
};
type ProfileOption = { id: string; username: string; name: string; alias: string | null };
type Draft = {
  title: string;
  description: string;
  profileId: string;
  visibility: BuildVisibility;
  build: BuildConfiguration;
};

const emptyDraft: Draft = {
  title: "",
  description: "",
  profileId: "",
  visibility: "private",
  build: { activity: "general", armor: "", weapon: "", equipment: "", pet: "", accessories: "", notes: "" },
};

const activityLabels: Record<BuildActivity, string> = {
  general: "General progression",
  farming: "Farming",
  mining: "Mining",
  dungeons: "Dungeons",
  slayers: "Slayers",
  fishing: "Fishing",
};

export function BuildsExperience({
  authEnabled,
  signedIn,
  signInHref,
}: {
  authEnabled: boolean;
  signedIn: boolean;
  signInHref: string;
}) {
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft, build: { ...emptyDraft.build } });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [builds, setBuilds] = useState<BuildView[]>([]);
  const [publicBuilds, setPublicBuilds] = useState<BuildView[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!authEnabled) return;
    setError("");
    try {
      const publicRequest = requestJson<{ data: { builds: BuildView[] } }>("/api/builds/public");
      if (signedIn) {
        const [owned, savedState, publicResult] = await Promise.all([
          requestJson<{ data: { builds: BuildView[] } }>("/api/builds"),
          requestJson<{ data: { profiles: ProfileOption[] } }>("/api/saved-state"),
          publicRequest,
        ]);
        setBuilds(owned.data.builds);
        setProfiles(savedState.data.profiles);
        setPublicBuilds(publicResult.data.builds);
      } else {
        setPublicBuilds((await publicRequest).data.builds);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoaded(true);
    }
  }, [authEnabled, signedIn]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const filledSlots = useMemo(() => [draft.build.armor, draft.build.weapon, draft.build.equipment, draft.build.pet, draft.build.accessories].filter(Boolean).length, [draft.build]);

  function updateBuildField(key: keyof BuildConfiguration, value: string) {
    setDraft((current) => ({ ...current, build: { ...current.build, [key]: value } }));
  }

  function resetEditor() {
    setEditingId(null);
    setDraft({ ...emptyDraft, build: { ...emptyDraft.build } });
  }

  function editBuild(build: BuildView) {
    setEditingId(build.id);
    setDraft({
      title: build.title,
      description: build.description ?? "",
      profileId: build.profileId ?? "",
      visibility: build.visibility,
      build: { ...build.build },
    });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("build-editor")?.scrollIntoView({
      block: "start",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  async function saveBuild(event: React.FormEvent) {
    event.preventDefault();
    if (!signedIn) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const path = editingId ? `/api/builds/${editingId}` : "/api/builds";
      await requestJson(path, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, profileId: draft.profileId || null, rotateShareLink: false }),
      });
      setMessage(editingId ? "Build changes saved." : "Build saved to your SkyPilot account.");
      resetEditor();
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function patchBuild(build: BuildView, change: Partial<Pick<Draft, "visibility">> & { rotateShareLink?: boolean }, success: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await requestJson(`/api/builds/${build.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: build.title,
          description: build.description,
          profileId: build.profileId,
          visibility: change.visibility ?? build.visibility,
          rotateShareLink: change.rotateShareLink ?? false,
          build: build.build,
        }),
      });
      setMessage(success);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function deleteBuild(build: BuildView) {
    if (!window.confirm(`Delete “${build.title}”? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/builds/${build.id}`, { method: "DELETE" });
      if (editingId === build.id) resetEditor();
      setMessage("Saved build deleted.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function favoriteBuild(build: BuildView) {
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceType: "build", resourceId: build.id, label: build.title }),
      });
      setMessage("Build added to account favorites.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="page-header"><div className="page-title"><small>MANUAL LOADOUT WORKSPACE</small><h1>Build planner</h1><p>Compose and compare a SkyBlock loadout without an account. Sign-in adds durable saves, profile links, favorites, and explicit private, unlisted, or public sharing.</p></div><div className="toolbar"><Link className="button-secondary" href="/dashboard">Analyze a profile</Link><Link className="button-secondary" href="/account">Saved workspace</Link></div></header>

      <div className="notice"><strong>EXPERIMENTAL</strong><span>Build fields are user-entered planning notes, not live profile data or verified item recommendations. SkyPilot never applies a build in-game.</span></div>

      <section className={styles.grid}>
        <form id="build-editor" className="panel" onSubmit={saveBuild}><div className="panel-header"><div><h2>{editingId ? "Edit saved build" : "Compose a build"}</h2><small>All assumptions stay visible</small></div>{editingId ? <button className={styles.textButton} type="button" onClick={resetEditor}>Cancel edit</button> : <span className="unofficial-label">LOCAL UNTIL SAVED</span>}</div><div className={`${styles.panelBody} ${styles.formGrid}`}>
          <label className={styles.field}><span>TITLE</span><input required maxLength={80} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Floor VII tank setup" /></label>
          <label className={styles.field}><span>ACTIVITY</span><select value={draft.build.activity} onChange={(event) => updateBuildField("activity", event.target.value as BuildActivity)}>{buildActivities.map((activity) => <option value={activity} key={activity}>{activityLabels[activity]}</option>)}</select></label>
          <label className={`${styles.field} ${styles.wide}`}><span>DESCRIPTION</span><input maxLength={400} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="What this setup is meant to accomplish" /></label>
          <label className={styles.field}><span>ARMOR</span><input maxLength={120} value={draft.build.armor} onChange={(event) => updateBuildField("armor", event.target.value)} placeholder="Armor set and upgrades" /></label>
          <label className={styles.field}><span>WEAPON OR TOOL</span><input maxLength={120} value={draft.build.weapon} onChange={(event) => updateBuildField("weapon", event.target.value)} placeholder="Primary weapon or tool" /></label>
          <label className={styles.field}><span>EQUIPMENT</span><input maxLength={120} value={draft.build.equipment} onChange={(event) => updateBuildField("equipment", event.target.value)} placeholder="Equipment pieces" /></label>
          <label className={styles.field}><span>PET</span><input maxLength={120} value={draft.build.pet} onChange={(event) => updateBuildField("pet", event.target.value)} placeholder="Pet and held item" /></label>
          <label className={`${styles.field} ${styles.wide}`}><span>ACCESSORIES / POWER</span><input maxLength={200} value={draft.build.accessories} onChange={(event) => updateBuildField("accessories", event.target.value)} placeholder="Magical Power target, power, tuning, or accessory notes" /></label>
          <label className={`${styles.field} ${styles.wide}`}><span>NOTES AND ASSUMPTIONS</span><textarea maxLength={800} value={draft.build.notes} onChange={(event) => updateBuildField("notes", event.target.value)} placeholder="Missing upgrades, budget assumptions, swaps, or prerequisites" /></label>
          {signedIn ? <label className={`${styles.field} ${styles.wide}`}><span>LINKED SAVED PROFILE (OPTIONAL)</span><select value={draft.profileId} onChange={(event) => setDraft((current) => ({ ...current, profileId: event.target.value }))}><option value="">No linked profile</option>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.alias || profile.name} · {profile.username}</option>)}</select></label> : null}
          <fieldset className={`${styles.wide} ${styles.privacy}`}><legend className="sr-only">Build visibility</legend>{([[
            "private", "Private", "Only your signed-in account can read it. No share URL."
          ], ["unlisted", "Unlisted", "Anyone with its unguessable URL can read it; it is not listed."], ["public", "Public", "Readable by share URL and eligible for the public gallery."]] as const).map(([value, label, copy]) => <label key={value}><span><input type="radio" name="visibility" value={value} checked={draft.visibility === value} onChange={() => setDraft((current) => ({ ...current, visibility: value }))} /> <strong>{label}</strong></span><span>{copy}</span></label>)}</fieldset>
          <div className={`${styles.actions} ${styles.wide}`}>{signedIn ? <button className="button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Save build"}</button> : authEnabled ? <Link className="button-primary" href={signInHref}>Sign in to save</Link> : <span className={styles.muted}>Durable saving is disabled here; the editor remains available.</span>}<button className="button-secondary" type="button" onClick={resetEditor}>Clear editor</button></div>
        </div></form>

        <aside className="panel"><div className="panel-header"><div><h2>Current plan</h2><small>Local preview</small></div><span>{filledSlots}/5 loadout fields</span></div><div className={styles.panelBody}><div className={styles.card}><div className={styles.cardHead}><div><h3>{draft.title || "Untitled build"}</h3><p>{activityLabels[draft.build.activity]}</p></div><span className={styles.badge}>{draft.visibility.toUpperCase()}</span></div><p>{draft.description || "Add a purpose so future-you knows what this setup is for."}</p></div><div className={styles.summary}><div><small>ARMOR</small><strong>{draft.build.armor || "Not set"}</strong></div><div><small>WEAPON / TOOL</small><strong>{draft.build.weapon || "Not set"}</strong></div><div><small>PET</small><strong>{draft.build.pet || "Not set"}</strong></div></div><div className={styles.card}><h3>Accessories / power</h3><p>{draft.build.accessories || "Not set"}</p></div><p className={styles.muted}>Privacy takes effect only after saving. An unsaved draft stays in this page&apos;s memory and is lost when the tab closes.</p></div></aside>
      </section>

      <div className={styles.status} aria-live="polite">{error ? <span className={styles.error}>{error}</span> : message}</div>

      <section className="panel"><div className="panel-header"><div><h2>Your saved builds</h2><small>Owner-scoped create, edit, share, and delete</small></div><span>{builds.length}</span></div><div className={styles.panelBody}>{signedIn && !loaded ? <p className={styles.muted}>Loading your builds…</p> : builds.length ? <div className={styles.list}>{builds.map((build) => <BuildCard build={build} busy={busy} key={build.id} onDelete={() => void deleteBuild(build)} onEdit={() => editBuild(build)} onFavorite={() => void favoriteBuild(build)} onPrivacy={(visibility) => void patchBuild(build, { visibility }, `Build is now ${visibility}.`)} onRotate={() => void patchBuild(build, { rotateShareLink: true }, "Share link rotated; the old link no longer works.")} />)}</div> : <p className={styles.muted}>{signedIn ? "No saved builds yet. Compose one above and choose Save build." : "Sign in to keep builds across sessions. The planner above remains available without an account."}</p>}</div></section>

      <section className="panel"><div className="panel-header"><div><h2>Public build gallery</h2><small>User-entered planning references</small></div><span>{publicBuilds.length}</span></div><div className={styles.panelBody}>{!authEnabled ? <p className={styles.muted}>Build sharing is disabled in this environment.</p> : publicBuilds.length ? <div className={styles.list}>{publicBuilds.map((build) => <article className={styles.card} key={build.id}><div className={styles.cardHead}><div><h3>{build.title}</h3><p>{activityLabels[build.build.activity]}</p></div><span className={styles.badge}>PUBLIC</span></div><p>{build.description || "No description provided."}</p>{build.sharePath ? <div className={styles.actions}><Link href={build.sharePath}>Open shared build →</Link></div> : null}</article>)}</div> : <p className={styles.muted}>No public builds are available. Unlisted builds never appear here.</p>}</div></section>
    </div>
  );
}

function BuildCard({
  build,
  busy,
  onDelete,
  onEdit,
  onFavorite,
  onPrivacy,
  onRotate,
}: {
  build: BuildView;
  busy: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onFavorite: () => void;
  onPrivacy: (visibility: BuildVisibility) => void;
  onRotate: () => void;
}) {
  return <article className={styles.card}><div className={styles.cardHead}><div><h3>{build.title}</h3><p>{activityLabels[build.build.activity]} · updated {new Date(build.updatedAt).toLocaleDateString()}</p></div><span className={styles.badge}>{build.visibility.toUpperCase()}</span></div><p>{build.description || "No description provided."}</p><div className={styles.summary}><div><small>ARMOR</small><strong>{build.build.armor || "Not set"}</strong></div><div><small>WEAPON / TOOL</small><strong>{build.build.weapon || "Not set"}</strong></div><div><small>PET</small><strong>{build.build.pet || "Not set"}</strong></div></div>{build.build.accessories ? <p><strong>Accessories / power:</strong> {build.build.accessories}</p> : null}<div className={styles.actions}><button type="button" disabled={busy} onClick={onEdit}>Edit</button><button type="button" disabled={busy} onClick={onFavorite}>Favorite</button>{build.sharePath ? <Link href={build.sharePath}>Open share page</Link> : null}<label className={styles.field}><span className="sr-only">Visibility for {build.title}</span><select aria-label={`Visibility for ${build.title}`} disabled={busy} value={build.visibility} onChange={(event) => onPrivacy(event.target.value as BuildVisibility)}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label>{build.sharePath ? <button type="button" disabled={busy} onClick={onRotate}>Rotate link</button> : null}<button className={styles.danger} type="button" disabled={busy} onClick={onDelete}>Delete</button></div></article>;
}

async function requestJson<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, headers: { accept: "application/json", ...init?.headers } });
  const payload = await response.json() as T & { error?: { message?: string; action?: string } };
  if (!response.ok) throw new Error([payload.error?.message, payload.error?.action].filter(Boolean).join(" ") || "The build request failed.");
  return payload;
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : "The build request failed.";
}

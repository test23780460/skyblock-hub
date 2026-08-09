"use client";

import Link from "@/components/AppLink";
import { useEffect, useMemo, useState } from "react";

type Auction = { id: string; itemName: string; category: string | null; tier: string | null; startingBid: number | null; highestBidAmount: number | null; bin: boolean | null; startAt: number | null; endAt: number | null; bidCount: number };
type AuctionData = { cacheStatus: string; fetchedAt: string; lastUpdated: string; page: number; totalPages: number; totalAuctions: number; auctions: Auction[]; meta: { returned: number; pageAvailable: number; skippedMalformed: number }; notice: string };
type AuctionSort = "ending" | "price-low" | "price-high" | "name";

function compact(value: number | null): string { return value === null ? "--" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value); }
function price(auction: Auction): number { return auction.highestBidAmount || auction.startingBid || 0; }
function ending(value: number | null): string { if (!value) return "Unknown"; const diff = value - Date.now(); if (diff <= 0) return "Ended"; const minutes = Math.floor(diff / 60_000); return minutes < 60 ? minutes + "m" : minutes < 1440 ? Math.floor(minutes / 60) + "h " + minutes % 60 + "m" : Math.floor(minutes / 1440) + "d"; }

export function AuctionExperience() {
  const [data, setData] = useState<AuctionData | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<AuctionSort>("ending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/economy/auctions?page=" + page + "&limit=250&q=" + encodeURIComponent(submittedQuery), { headers: { accept: "application/json" } }).then(async (response) => {
      const payload = await response.json() as { data?: AuctionData; error?: { message?: string; action?: string } };
      if (!response.ok || !payload.data) throw new Error([payload.error?.message, payload.error?.action].filter(Boolean).join(" ") || "Auction data is unavailable.");
      if (active) setData(payload.data);
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Auction data is unavailable."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, submittedQuery]);

  const auctions = useMemo(() => [...(data?.auctions || [])].sort((left, right) => {
    if (sort === "price-low") return price(left) - price(right);
    if (sort === "price-high") return price(right) - price(left);
    if (sort === "name") return left.itemName.localeCompare(right.itemName);
    return (left.endAt || Infinity) - (right.endAt || Infinity);
  }), [data, sort]);

  function search(event: React.FormEvent) { event.preventDefault(); const nextQuery = query.trim(); if (page === 0 && submittedQuery === nextQuery) return; setLoading(true); setError(""); setData(null); setPage(0); setSubmittedQuery(nextQuery); }

  return <div className="page-shell auction-page">
    <header className="page-header"><div className="page-title"><small>ACTIVE LISTINGS · NORMALIZED SAFELY</small><h1>Auction intelligence</h1><p>Browse a bounded active snapshot, filter item names, distinguish BINs from bids, and keep listings separate from fair-value evidence.</p></div><div className="toolbar"><Link className="button-secondary" href="/economy">Economy overview</Link><Link className="button-primary" href="/items">Item valuation</Link></div></header>
    <div className="notice"><strong>i</strong><span>Active listings are asking prices—not completed sales. SkyPilot omits sellers, bidders, profiles, raw lore, and unbounded NBT from this public view.</span></div>
    <section className="stat-grid auction-metrics"><article className="stat-card"><small>Total active auctions</small><strong>{data ? compact(data.totalAuctions) : "--"}</strong><span>Across the current snapshot</span></article><article className="stat-card"><small>Snapshot pages</small><strong>{data ? data.totalPages.toLocaleString() : "--"}</strong><span>Fetched globally by the worker</span></article><article className="stat-card"><small>Current page</small><strong>{data ? data.page + 1 : page + 1}</strong><span>100–250 normalized listings</span></article><article className="stat-card"><small>Freshness</small><strong>{data?.cacheStatus || "Loading"}</strong><span>{data ? new Date(data.lastUpdated).toLocaleTimeString() : "Waiting for source"}</span></article></section>
    <section className="market-toolbar panel auction-toolbar"><form onSubmit={search}><label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this auction page by item name" aria-label="Filter auctions" /></label><button type="submit">Search page</button></form><div role="group" aria-label="Sort auctions">{(["ending", "price-low", "price-high", "name"] as AuctionSort[]).map((value) => <button aria-pressed={sort === value} className={sort === value ? "active" : ""} type="button" onClick={() => setSort(value)} key={value}>{value.replace("-", " ")}</button>)}</div></section>
    {error ? <div className="error-state panel market-error" role="alert"><span className="error-code">AUCTIONS UNAVAILABLE</span><h1>The active snapshot could not load</h1><p>{error}</p><button className="button-primary" onClick={() => window.location.reload()} type="button">Try again</button></div> : <section className="panel auction-table-panel" aria-busy={loading}>
      <div className="panel-header"><div><h2>{submittedQuery ? "Matches for “" + submittedQuery + "”" : "Active auction page"}</h2><small>{loading ? "Loading…" : auctions.length + " normalized listings"}</small></div><span className="unofficial-label">PAGE {page + 1} OF {data?.totalPages || "--"}</span></div>
      {loading && !data ? <div className="market-loading" role="status"><div className="skeleton" /><div className="skeleton" /><span>Loading a bounded auction page…</span></div> : <div className="auction-table"><div className="auction-head"><span>Item</span><span>Tier</span><span>Price</span><span>Type</span><span>Bids</span><span>Ending</span></div>{auctions.length ? auctions.map((auction) => <article className="auction-row" key={auction.id}><div><span className={"item-orb " + (auction.tier === "LEGENDARY" ? "amber" : auction.tier === "MYTHIC" ? "violet" : "blue")} aria-hidden="true" /><span><strong>{auction.itemName}</strong><small>{auction.category || "Uncategorized"}</small></span></div><span>{auction.tier || "UNKNOWN"}</span><strong>{compact(price(auction))}</strong><span className={auction.bin ? "bin-badge" : "bid-badge"}>{auction.bin ? "BIN" : "AUCTION"}</span><span>{auction.bidCount}</span><span>{ending(auction.endAt)}</span></article>) : <div className="empty-state compact-empty"><span className="empty-icon" aria-hidden="true">⌕</span><h2>No matches on this page</h2><p>Clear the filter or inspect another bounded snapshot page.</p></div>}</div>}
      <div className="auction-pagination"><button type="button" disabled={page <= 0 || loading} onClick={() => { setLoading(true); setError(""); setData(null); setPage((value) => Math.max(0, value - 1)); }}>← Previous</button><span>Page {page + 1}</span><button type="button" disabled={loading || Boolean(data && page + 1 >= data.totalPages)} onClick={() => { setLoading(true); setError(""); setData(null); setPage((value) => value + 1); }}>Next →</button></div>
    </section>}
    <div className="notice market-history-note"><strong>VALUATION</strong><span>Variant-aware ended-sale valuation activates after the bounded NBT parser and sale sink are enabled. SkyPilot will show “insufficient data” until then instead of deriving fair value from listing floors.</span></div>
  </div>;
}

"use client";

import Link from "@/components/AppLink";
import { useEffect, useMemo, useState } from "react";
import { scoreBazaarFlip } from "@/lib/engines";
import { BazaarHistoryPanel } from "@/components/BazaarHistoryPanel";

type Product = { productId: string; buyPrice: number | null; sellPrice: number | null; buyVolume: number | null; sellVolume: number | null; buyMovingWeek: number | null; sellMovingWeek: number | null; buyOrders: number | null; sellOrders: number | null; spread: number | null; spreadPercent: number | null };
type BazaarData = { cacheStatus: string; fetchedAt: string; lastUpdated: string; products: Product[]; meta: { returned: number; available: number; skippedMalformed: number }; notice: string };
type SortKey = "volume" | "spread" | "liquidity" | "name";
const MAX_QUANTITY = 1_000_000_000;

function compact(value: number | null): string { return value === null ? "--" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value); }
function coins(value: number | null): string { return value === null ? "Unavailable" : value.toLocaleString("en-US", { maximumFractionDigits: value < 100 ? 2 : 1 }); }
function label(id: string): string { return id.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function volume(product: Product): number { return (product.buyMovingWeek || 0) + (product.sellMovingWeek || 0); }
function liquidity(product: Product): number { return (product.buyVolume || 0) + (product.sellVolume || 0); }
function boundedQuantity(value: string): number { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(MAX_QUANTITY, Math.max(1, Math.floor(parsed))) : 1; }
function total(value: number, quantity: number): number | null { const result = value * quantity; return Number.isFinite(result) ? result : null; }

export function BazaarExperience() {
  const [data, setData] = useState<BazaarData | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("volume");
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState(10_000);

  useEffect(() => {
    let active = true;
    fetch("/api/economy/bazaar?limit=250", { headers: { accept: "application/json" } }).then(async (response) => {
      const payload = await response.json() as { data?: BazaarData; error?: { message?: string; action?: string } };
      if (!response.ok || !payload.data) throw new Error([payload.error?.message, payload.error?.action].filter(Boolean).join(" ") || "Bazaar data is unavailable.");
      if (active) { setData(payload.data); setSelectedId(payload.data.products[0]?.productId || ""); }
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "Bazaar data is unavailable.");
    });
    return () => { active = false; };
  }, []);

  const products = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLowerCase();
    return data.products.filter((product) => !normalized || label(product.productId).toLowerCase().includes(normalized) || product.productId.toLowerCase().includes(normalized)).sort((left, right) => {
      if (sort === "name") return left.productId.localeCompare(right.productId);
      if (sort === "spread") return (right.spreadPercent || -Infinity) - (left.spreadPercent || -Infinity);
      if (sort === "liquidity") return liquidity(right) - liquidity(left);
      return volume(right) - volume(left);
    });
  }, [data, query, sort]);
  const selected = products.find((product) => product.productId === selectedId) || products[0];
  const flip = useMemo(() => {
    if (!selected || selected.buyPrice === null || selected.sellPrice === null || selected.buyPrice <= 0 || selected.sellPrice <= 0) return null;
    return scoreBazaarFlip({
      productId: selected.productId,
      displayName: label(selected.productId),
      buyOrderPrice: selected.buyPrice,
      sellOfferPrice: selected.sellPrice,
      buyVolume: selected.buyMovingWeek ?? selected.buyVolume ?? 0,
      sellVolume: selected.sellMovingWeek ?? selected.sellVolume ?? 0,
      ...(selected.buyOrders === null ? {} : { buyOrders: selected.buyOrders }),
      ...(selected.sellOrders === null ? {} : { sellOrders: selected.sellOrders }),
    });
  }, [selected]);
  const gross = flip ? total(flip.grossMarginPerUnit, quantity) : null;
  const fees = flip ? total(flip.feesPerUnit, quantity) : null;
  const net = flip ? total(flip.netMarginPerUnit, quantity) : null;

  return <div className="page-shell bazaar-page">
    <header className="page-header"><div className="page-title"><small>LIVE PUBLIC ECONOMY FEED</small><h1>Bazaar explorer</h1><p>Search products, compare Hypixel summary prices, inspect spread and liquidity, and model fee-aware opportunity estimates.</p></div><div className="toolbar"><Link className="button-secondary" href="/economy">Economy overview</Link><a className="button-primary" href="#flip-lab">Open flip lab</a></div></header>
    {error ? <div className="error-state panel market-error" role="alert"><span className="error-code">MARKET UNAVAILABLE</span><h1>Bazaar data could not load</h1><p>{error}</p><button className="button-primary" type="button" onClick={() => window.location.reload()}>Try again</button></div> : !data ? <div className="market-loading panel" role="status" aria-busy="true"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /><span>Loading the current public Bazaar snapshot…</span></div> : <>
      <div className="market-freshness"><span className="account-chip"><i /> {data.cacheStatus.toUpperCase()}</span><span>Source updated {new Date(data.lastUpdated).toLocaleString()}</span><span>{data.meta.available.toLocaleString()} products available</span><span>{data.meta.skippedMalformed} malformed records skipped safely</span></div>
      <section className="market-toolbar panel"><label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Bazaar products" aria-label="Search Bazaar products" /></label><div role="group" aria-label="Sort products">{(["volume", "spread", "liquidity", "name"] as SortKey[]).map((value) => <button aria-pressed={sort === value} className={sort === value ? "active" : ""} type="button" key={value} onClick={() => setSort(value)}>{value}</button>)}</div></section>
      <section className="two-column market-layout">
        <div className="panel market-table-panel"><div className="panel-header"><div><h2>Bazaar products</h2><small>{products.length} matching this snapshot</small></div><span className="unofficial-label">ESTIMATES · NOT GUARANTEES</span></div><div className="market-table"><div className="market-table-head"><span>Product</span><span>Buy summary</span><span>Sell summary</span><span>Spread</span><span>7d volume</span><span>Liquidity</span></div>{products.length ? products.slice(0, 100).map((product) => <button className={selected?.productId === product.productId ? "market-row selected" : "market-row"} type="button" key={product.productId} onClick={() => setSelectedId(product.productId)}><span><i className="item-orb mint" aria-hidden="true" /> <strong>{label(product.productId)}</strong><small>{product.productId}</small></span><span>{coins(product.buyPrice)}</span><span>{coins(product.sellPrice)}</span><span className={(product.spread || 0) > 0 ? "positive-value" : "negative-value"}>{product.spreadPercent === null ? "—" : product.spreadPercent.toFixed(2) + "%"}</span><span>{compact(volume(product))}</span><span>{compact(liquidity(product))}</span></button>) : <div className="empty-state compact-empty"><span className="empty-icon" aria-hidden="true">⌕</span><h2>No products match</h2><p>Clear the search to inspect this snapshot.</p></div>}</div></div>
        <aside className="panel flip-lab" id="flip-lab"><div className="panel-header"><div><h2>Flip planning lab</h2><small>Current summary prices</small></div><span className="lab-symbol" aria-hidden="true">⇄</span></div>{selected ? <div className="flip-content"><div className="selected-product"><span className="item-orb mint" aria-hidden="true" /><div><small>SELECTED PRODUCT</small><strong>{label(selected.productId)}</strong><span>{selected.productId}</span></div></div><label><span>Quantity</span><input type="number" min="1" max={MAX_QUANTITY} step="1" value={quantity} onChange={(event) => setQuantity(boundedQuantity(event.target.value))} /></label><dl><div><dt>Buy summary</dt><dd>{coins(selected.buyPrice)}</dd></div><div><dt>Sell summary</dt><dd>{coins(selected.sellPrice)}</dd></div><div><dt>Gross spread</dt><dd>{compact(gross)}</dd></div><div><dt>Assumed fees</dt><dd>{compact(fees)}</dd></div>{flip ? <><div><dt>Liquidity score</dt><dd>{flip.liquidityScore}/100</dd></div><div><dt>Risk score</dt><dd>{flip.riskScore}/100</dd></div><div><dt>Opportunity</dt><dd>{flip.opportunityScore}/100 · {flip.quality}</dd></div></> : null}</dl><div className="flip-result"><small>MODELED NET</small><strong>{compact(net)} coins</strong><span>{flip ? (flip.returnOnInvestment * 100).toFixed(2) + "% modeled return" : "Insufficient price data"}</span></div><p>{flip?.disclaimer || data.notice}</p></div> : <div className="empty-inline">Select a product to model.</div>}</aside>
      </section>
      {selected ? <BazaarHistoryPanel productId={selected.productId} /> : null}
    </>}
  </div>;
}

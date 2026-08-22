"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type HistoryPoint = {
  bucketStartAt: string;
  lastSourceUpdatedAt: string;
  sampleCount: number;
  buy: { open: number; high: number; low: number; close: number };
  sell: { open: number; high: number; low: number; close: number };
  averageBuyVolume: number | null;
  averageSellVolume: number | null;
  referenceClose: number;
};

type HistoryData = {
  cacheStatus: string;
  lastUpdated: string;
  collectionStatus: "ready" | "collecting" | "lagging";
  aggregatedThrough: string | null;
  identity: { kind: "bazaar-product"; productId: string; variantKey: null };
  resolution: "hour" | "day";
  points: HistoryPoint[];
  summary: null | {
    latestReference: number;
    periodLow: number;
    periodHigh: number;
    absoluteChange: number;
    percentChange: number | null;
    meanAbsoluteMovementPercent: number | null;
    direction: "up" | "down" | "flat";
    bucketCount: number;
    sampleCount: number;
  };
  meta: { returned: number; retentionDays: number };
  notice: string;
};

type RangeId = "24h" | "7d" | "30d" | "1y";

const RANGES: Array<{
  id: RangeId;
  label: string;
  resolution: "hour" | "day";
  limit: number;
}> = [
  { id: "24h", label: "24H", resolution: "hour", limit: 24 },
  { id: "7d", label: "7D", resolution: "hour", limit: 7 * 24 },
  { id: "30d", label: "30D", resolution: "day", limit: 30 },
  { id: "1y", label: "1Y", resolution: "day", limit: 365 },
];

export function BazaarHistoryPanel({ productId }: { productId: string }) {
  const [rangeId, setRangeId] = useState<RangeId>("24h");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data: HistoryData | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  const [activeIndex, setActiveIndex] = useState(0);
  const pointRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const range = RANGES.find((option) => option.id === rangeId) ?? RANGES[0]!;
  const requestKey = `${productId}:${range.resolution}:${range.limit}:${retry}`;
  const data = result.key === requestKey ? result.data : null;
  const error = result.key === requestKey ? result.error : "";
  const loading = result.key !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      product: productId,
      resolution: range.resolution,
      limit: String(range.limit),
    });
    fetch(`/api/economy/bazaar/history?${parameters}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as {
          data?: HistoryData;
          error?: { message?: string; action?: string };
        };
        if (!response.ok || !payload.data) {
          throw new Error(
            [payload.error?.message, payload.error?.action]
              .filter(Boolean)
              .join(" ") || "Price history is unavailable.",
          );
        }
        setResult({ key: requestKey, data: payload.data, error: "" });
        setActiveIndex(Math.max(0, payload.data.points.length - 1));
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setResult({
          key: requestKey,
          data: null,
          error: caught instanceof Error ? caught.message : "Price history is unavailable.",
        });
      });
    return () => controller.abort();
  }, [productId, range.limit, range.resolution, requestKey]);

  const scale = useMemo(() => {
    if (!data?.points.length) return { low: 0, span: 1 };
    const low = Math.min(...data.points.map((point) => midpoint(point.buy.low, point.sell.low)));
    const high = Math.max(...data.points.map((point) => midpoint(point.buy.high, point.sell.high)));
    return { low, span: Math.max(0.0001, high - low) };
  }, [data]);
  const activePoint = data?.points[activeIndex] ?? data?.points.at(-1) ?? null;

  function movePoint(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!data?.points.length) return;
    let next = index;
    if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
    else if (event.key === "ArrowRight") next = Math.min(data.points.length - 1, index + 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = data.points.length - 1;
    else return;
    event.preventDefault();
    setActiveIndex(next);
    pointRefs.current[next]?.focus();
  }

  return (
    <section className="panel bazaar-history-panel" aria-labelledby="bazaar-history-title">
      <div className="panel-header bazaar-history-header">
        <div>
          <h2 id="bazaar-history-title">Price and volume history</h2>
          <small>{humanize(productId)} · durable worker aggregates</small>
        </div>
        <div className="bazaar-history-ranges" role="group" aria-label="History range">
          {RANGES.map((option) => (
            <button
              type="button"
              key={option.id}
              aria-pressed={rangeId === option.id}
              onClick={() => setRangeId(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bazaar-history-state" role="status" aria-live="polite">
          <span className="skeleton" />
          <span>Loading collected history…</span>
        </div>
      ) : error ? (
        <div className="bazaar-history-state" role="alert">
          <strong>History unavailable</strong>
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
        </div>
      ) : !data?.points.length || !data.summary ? (
        <div className="bazaar-history-state" role="status">
          <strong>History is collecting</strong>
          <span>The worker has not completed a {range.resolution} bucket for this product yet. No prior prices are fabricated.</span>
        </div>
      ) : (
        <div className="bazaar-history-body">
          <div className="bazaar-history-metrics" aria-label="History summary">
            <div><small>REFERENCE MIDPOINT</small><strong>{coins(data.summary.latestReference)}</strong></div>
            <div><small>PERIOD CHANGE</small><strong className={data.summary.direction === "up" ? "positive-value" : data.summary.direction === "down" ? "negative-value" : ""}>{signedPercent(data.summary.percentChange)}</strong></div>
            <div><small>OBSERVED RANGE</small><strong>{coins(data.summary.periodLow)}–{coins(data.summary.periodHigh)}</strong></div>
            <div><small>MEAN MOVEMENT</small><strong>{percent(data.summary.meanAbsoluteMovementPercent)}</strong></div>
            <div><small>EVIDENCE</small><strong>{data.summary.sampleCount.toLocaleString()} samples</strong></div>
          </div>

          <div
            className="bazaar-history-chart"
            role="group"
            aria-label={`${range.label} midpoint chart. Use left and right arrow keys to inspect buckets.`}
          >
            {data.points.map((point, index) => {
              const high = midpoint(point.buy.high, point.sell.high);
              const low = midpoint(point.buy.low, point.sell.low);
              const close = point.referenceClose;
              const style = {
                "--history-low": `${(low - scale.low) / scale.span * 100}%`,
                "--history-high": `${(high - scale.low) / scale.span * 100}%`,
                "--history-close": `${(close - scale.low) / scale.span * 100}%`,
              } as CSSProperties;
              return (
                <button
                  type="button"
                  className={index === activeIndex ? "active" : ""}
                  key={`${point.bucketStartAt}-${index}`}
                  ref={(node) => { pointRefs.current[index] = node; }}
                  tabIndex={index === activeIndex ? 0 : -1}
                  style={style}
                  aria-label={`${formatBucket(point.bucketStartAt, data.resolution)}: reference ${coins(close)}, buy close ${coins(point.buy.close)}, sell close ${coins(point.sell.close)}, ${point.sampleCount} samples`}
                  onFocus={() => setActiveIndex(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => setActiveIndex(index)}
                  onKeyDown={(event) => movePoint(event, index)}
                >
                  <i aria-hidden="true" />
                  <span aria-hidden="true" />
                </button>
              );
            })}
          </div>

          {activePoint ? (
            <div className="bazaar-history-tooltip" aria-live="polite">
              <strong>{formatBucket(activePoint.bucketStartAt, data.resolution)}</strong>
              <span>Reference {coins(activePoint.referenceClose)}</span>
              <span>Buy close {coins(activePoint.buy.close)}</span>
              <span>Sell close {coins(activePoint.sell.close)}</span>
              <span>Avg. visible volume {compact(average(activePoint.averageBuyVolume, activePoint.averageSellVolume))}</span>
              <span>{activePoint.sampleCount} source sample{activePoint.sampleCount === 1 ? "" : "s"}</span>
            </div>
          ) : null}

          <div className="bazaar-history-axis" aria-hidden="true">
            <span>{formatBucket(data.points[0]!.bucketStartAt, data.resolution)}</span>
            <span>{formatBucket(data.points.at(-1)!.bucketStartAt, data.resolution)}</span>
          </div>
          <p className="bazaar-history-notice">
            {data.notice} Hourly buckets retain 90 days; daily buckets retain three years. {data.aggregatedThrough ? `History aggregated through ${new Date(data.aggregatedThrough).toLocaleString()}. ` : ""}Source snapshot updated {new Date(data.lastUpdated).toLocaleString()}.
          </p>
        </div>
      )}
    </section>
  );
}

function midpoint(left: number, right: number): number {
  return (left + right) / 2;
}

function average(left: number | null, right: number | null): number | null {
  if (left === null && right === null) return null;
  if (left === null) return right;
  if (right === null) return left;
  return (left + right) / 2;
}

function coins(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 100 ? 2 : 1 }).format(value);
}

function compact(value: number | null): string {
  return value === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function percent(value: number | null): string {
  return value === null ? "Collecting" : `${value.toFixed(2)}%`;
}

function signedPercent(value: number | null): string {
  if (value === null) return "Collecting";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function humanize(value: string): string {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatBucket(value: string, resolution: "hour" | "day"): string {
  return new Intl.DateTimeFormat("en-US", resolution === "hour"
    ? { month: "short", day: "numeric", hour: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(value));
}

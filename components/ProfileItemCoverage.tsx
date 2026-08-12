import type { ProfileItemData } from "@/lib/models";

export function ProfileItemCoverage({
  itemData,
  accessoryCount = 0,
}: {
  itemData?: ProfileItemData;
  accessoryCount?: number;
}) {
  if (!itemData) return null;
  const parsedCount = itemData.containers.filter(
    (container) => container.state === "parsed",
  ).length;

  return (
    <section className="panel item-coverage" aria-labelledby="item-coverage-title">
      <div className="panel-header">
        <div>
          <h2 id="item-coverage-title">Bounded item-data coverage</h2>
          <small>{itemData.version} · latest requested snapshot</small>
        </div>
        <span>{parsedCount}/{itemData.containers.length} decoded</span>
      </div>
      <ul className="item-coverage-list">
        {itemData.containers.map((container) => (
          <li key={container.key}>
            <div>
              <strong>{container.label}</strong>
              <p>{container.note}</p>
            </div>
            <span className={`item-coverage-state ${container.state}`}>
              {container.state}
            </span>
            <small>
              {container.state === "parsed"
                ? `${container.itemCount.toLocaleString("en-US")} item${container.itemCount === 1 ? "" : "s"}${container.skippedItemCount > 0 ? ` · ${container.skippedItemCount.toLocaleString("en-US")} unsupported` : ""}${container.truncated ? " · capped" : ""}`
                : "No item summary"}
            </small>
          </li>
        ))}
      </ul>
      <p className="item-coverage-footnote">
        {accessoryCount.toLocaleString("en-US")} unique accessory identifier
        {accessoryCount === 1 ? "" : "s"} detected. Raw base64, NBT trees, lore,
        and unsupported fields are discarded before shared caching.
      </p>
    </section>
  );
}

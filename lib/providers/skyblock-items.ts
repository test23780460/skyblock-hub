import { cleanMinecraftText, isJsonObject, type JsonObject } from "./guards";
import type {
  ProfileItemContainerState,
  ProfileItemContainerSummary,
  ProfileItemData,
  ProfileItemSummary,
} from "../models";

/**
 * Versioned, portable boundary for untrusted Hypixel inventory payloads.
 *
 * Hypixel documents these values as base64-encoded, gzip-compressed NBT. Raw
 * strings and parsed NBT trees never leave this module. Only the bounded safe
 * summaries below are eligible for the shared profile cache or public API.
 */
export const SKYBLOCK_ITEM_SUMMARY_VERSION = "skyblock-items-v1" as const;

export const SKYBLOCK_ITEM_LIMITS = Object.freeze({
  containersPerResponse: 24,
  encodedCharactersPerContainer: 1_400_000,
  encodedCharactersPerResponse: 4_000_000,
  compressedBytesPerContainer: 1_050_000,
  inflatedBytesPerContainer: 2_000_000,
  inflatedBytesPerResponse: 8_000_000,
  nbtDepth: 16,
  nbtNodes: 12_000,
  nbtListLength: 512,
  nbtArrayLength: 1_000_000,
  nbtStringBytes: 8_192,
  nbtTotalStringBytes: 256_000,
  safeItemsPerContainer: 216,
  safeItemsPerResponse: 512,
});

export type SkyBlockItemContainerKey =
  | "inventory"
  | "armor"
  | "equipment"
  | "accessories"
  | "wardrobe";

export type SkyBlockItemContainerState = ProfileItemContainerState;
export type SafeSkyBlockItem = ProfileItemSummary;
export type SafeSkyBlockItemContainer = ProfileItemContainerSummary;
export type SafeSkyBlockItemData = ProfileItemData;

export type SkyBlockItemDecodeBudget = {
  remainingContainers: number;
  remainingEncodedCharacters: number;
  remainingInflatedBytes: number;
  remainingSafeItems: number;
};

type ContainerDefinition = {
  key: SkyBlockItemContainerKey;
  label: string;
  paths: readonly (readonly string[])[];
};

const CONTAINERS: readonly ContainerDefinition[] = [
  {
    key: "inventory",
    label: "Inventory",
    paths: [
      ["inventory", "inv_contents", "data"],
      ["inv_contents", "data"],
    ],
  },
  {
    key: "armor",
    label: "Equipped armor",
    paths: [
      ["inventory", "inv_armor", "data"],
      ["inv_armor", "data"],
    ],
  },
  {
    key: "equipment",
    label: "Equipped equipment",
    paths: [
      ["inventory", "equipment_contents", "data"],
      ["equipment_contents", "data"],
    ],
  },
  {
    key: "accessories",
    label: "Accessory bag",
    paths: [
      ["inventory", "bag_contents", "talisman_bag", "data"],
      ["talisman_bag", "data"],
    ],
  },
  {
    key: "wardrobe",
    label: "Wardrobe",
    paths: [
      ["inventory", "wardrobe_contents", "data"],
      ["wardrobe_contents", "data"],
    ],
  },
] as const;

export function createSkyBlockItemDecodeBudget(): SkyBlockItemDecodeBudget {
  return {
    remainingContainers: SKYBLOCK_ITEM_LIMITS.containersPerResponse,
    remainingEncodedCharacters:
      SKYBLOCK_ITEM_LIMITS.encodedCharactersPerResponse,
    remainingInflatedBytes: SKYBLOCK_ITEM_LIMITS.inflatedBytesPerResponse,
    remainingSafeItems: SKYBLOCK_ITEM_LIMITS.safeItemsPerResponse,
  };
}

export async function normalizeSkyBlockItemData(
  member: JsonObject,
  budget = createSkyBlockItemDecodeBudget(),
): Promise<SafeSkyBlockItemData> {
  const containers: SafeSkyBlockItemContainer[] = [];
  for (const definition of CONTAINERS) {
    const source = findContainerSource(member, definition.paths);
    if (source.kind === "missing") {
      containers.push(containerResult(definition, "hidden"));
      continue;
    }
    if (source.kind === "invalid") {
      containers.push(containerResult(definition, "malformed"));
      continue;
    }
    containers.push(
      await decodeSkyBlockItemContainer(
        source.data,
        definition.key,
        definition.label,
        budget,
      ),
    );
  }
  return { version: SKYBLOCK_ITEM_SUMMARY_VERSION, containers };
}

export async function decodeSkyBlockItemContainer(
  encoded: string,
  key: SkyBlockItemContainerKey,
  label: string,
  budget = createSkyBlockItemDecodeBudget(),
): Promise<SafeSkyBlockItemContainer> {
  const definition = { key, label, paths: [] } satisfies ContainerDefinition;
  try {
    if (budget.remainingContainers <= 0) {
      throw new ItemDecodeFailure("oversized");
    }
    budget.remainingContainers -= 1;

    if (
      encoded.length === 0 ||
      encoded.length > SKYBLOCK_ITEM_LIMITS.encodedCharactersPerContainer ||
      encoded.length > budget.remainingEncodedCharacters
    ) {
      throw new ItemDecodeFailure("oversized");
    }
    budget.remainingEncodedCharacters -= encoded.length;

    const compressed = decodeBase64(encoded);
    if (compressed.byteLength > SKYBLOCK_ITEM_LIMITS.compressedBytesPerContainer) {
      throw new ItemDecodeFailure("oversized");
    }
    const availableInflatedBytes = Math.min(
      SKYBLOCK_ITEM_LIMITS.inflatedBytesPerContainer,
      budget.remainingInflatedBytes,
    );
    if (availableInflatedBytes <= 0) {
      throw new ItemDecodeFailure("oversized");
    }
    const inflated = await gunzipBounded(compressed, availableInflatedBytes);
    budget.remainingInflatedBytes -= inflated.byteLength;

    const parsed = parseItemList(inflated, key);
    const allowedItems = Math.min(
      SKYBLOCK_ITEM_LIMITS.safeItemsPerContainer,
      Math.max(0, budget.remainingSafeItems),
    );
    const items = parsed.items.slice(0, allowedItems);
    budget.remainingSafeItems -= items.length;
    const truncated = items.length < parsed.items.length;
    const noteParts = [
      truncated
        ? "the displayed summary was capped by a fixed item budget"
        : null,
      parsed.skippedItemCount > 0
        ? `${parsed.skippedItemCount.toLocaleString("en-US")} unsupported item entr${parsed.skippedItemCount === 1 ? "y was" : "ies were"} omitted`
        : null,
    ].filter((value): value is string => value !== null);
    return {
      key,
      label,
      state: "parsed",
      itemCount: parsed.items.length,
      skippedItemCount: parsed.skippedItemCount,
      items,
      truncated,
      note:
        noteParts.length > 0
          ? `Decoded safely; ${noteParts.join("; ")}.`
          : "Decoded safely from the current request-driven profile snapshot.",
    };
  } catch (error) {
    const state =
      error instanceof ItemDecodeFailure ? error.state : "malformed";
    return containerResult(definition, state);
  }
}

function containerResult(
  definition: Pick<ContainerDefinition, "key" | "label">,
  state: Exclude<SkyBlockItemContainerState, "parsed">,
): SafeSkyBlockItemContainer {
  const notes: Record<Exclude<SkyBlockItemContainerState, "parsed">, string> = {
    hidden: "The player did not expose this container in the current response.",
    malformed: "The container was exposed but could not be safely decoded.",
    oversized:
      "The container exceeded SkyPilot's fixed decode budget and was skipped.",
    unsupported:
      "The container used an unsupported encoding or NBT shape and was skipped.",
  };
  return {
    key: definition.key,
    label: definition.label,
    state,
    itemCount: 0,
    skippedItemCount: 0,
    items: [],
    truncated: false,
    note: notes[state],
  };
}

function findContainerSource(
  member: JsonObject,
  paths: readonly (readonly string[])[],
): { kind: "missing" } | { kind: "invalid" } | { kind: "found"; data: string } {
  let invalid = false;
  for (const path of paths) {
    const value = readPath(member, path);
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.length > 0) {
      return { kind: "found", data: value };
    }
    invalid = true;
  }
  return invalid ? { kind: "invalid" } : { kind: "missing" };
}

function readPath(object: JsonObject, path: readonly string[]): unknown {
  let current: unknown = object;
  for (const segment of path) {
    if (!isJsonObject(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function decodeBase64(encoded: string): Uint8Array {
  if (
    encoded.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      encoded,
    )
  ) {
    throw new ItemDecodeFailure("malformed");
  }
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    throw new ItemDecodeFailure("malformed");
  }
  if (binary.length > SKYBLOCK_ITEM_LIMITS.compressedBytesPerContainer) {
    throw new ItemDecodeFailure("oversized");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function gunzipBounded(
  compressed: Uint8Array,
  maxOutputBytes: number,
): Promise<Uint8Array> {
  if (compressed[0] !== 0x1f || compressed[1] !== 0x8b) {
    throw new ItemDecodeFailure("malformed");
  }
  if (typeof DecompressionStream !== "function") {
    throw new ItemDecodeFailure("unsupported");
  }

  const buffer = compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength,
  ) as ArrayBuffer;
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = new Blob([buffer])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"))
      .getReader();
  } catch {
    throw new ItemDecodeFailure("unsupported");
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxOutputBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ItemDecodeFailure("oversized");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ItemDecodeFailure) throw error;
    throw new ItemDecodeFailure("malformed");
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

type NbtScalar = string | number | bigint | null;
type NbtValue = NbtScalar | NbtValue[] | NbtCompound;
interface NbtCompound {
  [key: string]: NbtValue;
}

function parseItemList(
  bytes: Uint8Array,
  container: SkyBlockItemContainerKey,
): { items: SafeSkyBlockItem[]; skippedItemCount: number } {
  const root = new BoundedNbtReader(bytes).parseRoot();
  const itemList = root.i;
  if (!Array.isArray(itemList)) {
    throw new ItemDecodeFailure("unsupported");
  }

  const items: SafeSkyBlockItem[] = [];
  let skippedItemCount = 0;
  for (const value of itemList) {
    if (!isNbtCompound(value)) {
      skippedItemCount += 1;
      continue;
    }
    if (Object.keys(value).length === 0 || (nbtNumber(value.Count) ?? 1) <= 0) {
      continue;
    }
    const item = normalizeItem(value, container);
    if (item) items.push(item);
    else skippedItemCount += 1;
  }
  return { items, skippedItemCount };
}

function normalizeItem(
  item: NbtCompound,
  container: SkyBlockItemContainerKey,
): SafeSkyBlockItem | null {
  const countValue = nbtNumber(item.Count);
  if (countValue !== null && countValue <= 0) return null;
  const tag = isNbtCompound(item.tag) ? item.tag : null;
  const extra = tag && isNbtCompound(tag.ExtraAttributes)
    ? tag.ExtraAttributes
    : null;
  const display = tag && isNbtCompound(tag.display) ? tag.display : null;
  const id = safeItemId(extra?.id);
  const displayName = safeDisplayName(display?.Name);
  if (!id && !displayName) return null;

  const rawSlot = nbtNumber(item.Slot);
  const slot =
    rawSlot === null || !Number.isInteger(rawSlot)
      ? null
      : Math.min(255, Math.max(0, rawSlot < 0 ? rawSlot + 256 : rawSlot));
  const rarity = rarityFromLore(display?.Lore);
  const stars = boundedInteger(
    nbtNumber(extra?.upgrade_level) ?? nbtNumber(extra?.dungeon_item_level),
    0,
    15,
  );
  return {
    slot,
    id,
    name: displayName ?? formatItemId(id ?? "UNKNOWN_ITEM"),
    count: boundedInteger(countValue, 1, 255),
    rarity,
    category: inferCategory(id, container),
    stars,
    recombobulated: boundedInteger(nbtNumber(extra?.rarity_upgrades), 0, 1) > 0,
  };
}

function safeItemId(value: NbtValue | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9_:-]{1,96}$/.test(normalized) ? normalized : null;
}

function safeDisplayName(value: NbtValue | undefined): string | null {
  if (typeof value !== "string") return null;
  const cleaned = cleanMinecraftText(value, 96);
  if (cleaned === "Unknown item" || cleaned.startsWith("{")) return null;
  return cleaned;
}

function rarityFromLore(value: NbtValue | undefined): SafeSkyBlockItem["rarity"] {
  if (!Array.isArray(value)) return "UNKNOWN";
  const candidates = value
    .slice(-4)
    .filter((line): line is string => typeof line === "string")
    .map((line) => cleanMinecraftText(line, 160).toUpperCase());
  const rarities: readonly SafeSkyBlockItem["rarity"][] = [
    "VERY SPECIAL",
    "SPECIAL",
    "SUPREME",
    "DIVINE",
    "MYTHIC",
    "LEGENDARY",
    "EPIC",
    "RARE",
    "UNCOMMON",
    "COMMON",
  ];
  for (const line of candidates.reverse()) {
    for (const rarity of rarities) {
      if (new RegExp(`(?:^|\\s)${rarity}(?:\\s|$)`).test(line)) return rarity;
    }
  }
  return "UNKNOWN";
}

function inferCategory(
  id: string | null,
  container: SkyBlockItemContainerKey,
): SafeSkyBlockItem["category"] {
  if (container === "accessories") return "accessory";
  if (container === "equipment") return "equipment";
  if (!id) return "item";
  if (id.endsWith("_HELMET")) return "helmet";
  if (id.endsWith("_CHESTPLATE")) return "chestplate";
  if (id.endsWith("_LEGGINGS")) return "leggings";
  if (id.endsWith("_BOOTS")) return "boots";
  if (/(?:SWORD|BOW|DAGGER|SHORTBOW|GAUNTLET|KATANA|SCYTHE|WAND)$/.test(id)) {
    return "weapon";
  }
  if (/(?:PICKAXE|DRILL|AXE|HOE|ROD)$/.test(id)) return "tool";
  return "item";
}

function formatItemId(id: string): string {
  return id
    .split("_")
    .filter(Boolean)
    .map((part) => part.slice(0, 1) + part.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 96);
}

function nbtNumber(value: NbtValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "bigint" &&
    value >= BigInt(Number.MIN_SAFE_INTEGER) &&
    value <= BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return Number(value);
  }
  return null;
}

function boundedInteger(
  value: number | null,
  minimum: number,
  maximum: number,
): number {
  if (value === null || !Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function isNbtCompound(value: NbtValue | undefined): value is NbtCompound {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class BoundedNbtReader {
  private readonly view: DataView;
  private offset = 0;
  private nodes = 0;
  private totalStringBytes = 0;
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });

  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  parseRoot(): NbtCompound {
    const type = this.readUint8();
    if (type !== 10) throw new ItemDecodeFailure("unsupported");
    this.readString();
    const value = this.readPayload(type, 0);
    if (!isNbtCompound(value) || this.offset !== this.view.byteLength) {
      throw new ItemDecodeFailure("malformed");
    }
    return value;
  }

  private readPayload(type: number, depth: number): NbtValue {
    this.nodes += 1;
    if (this.nodes > SKYBLOCK_ITEM_LIMITS.nbtNodes) {
      throw new ItemDecodeFailure("oversized");
    }
    if (depth > SKYBLOCK_ITEM_LIMITS.nbtDepth) {
      throw new ItemDecodeFailure("oversized");
    }
    switch (type) {
      case 1:
        return this.readInt8();
      case 2:
        return this.readInt16();
      case 3:
        return this.readInt32();
      case 4:
        return this.readBigInt64();
      case 5:
        return this.readFloat32();
      case 6:
        return this.readFloat64();
      case 7:
        this.skipArray(1);
        return null;
      case 8:
        return this.readString();
      case 9:
        return this.readList(depth + 1);
      case 10:
        return this.readCompound(depth + 1);
      case 11:
        this.skipArray(4);
        return null;
      case 12:
        this.skipArray(8);
        return null;
      default:
        throw new ItemDecodeFailure("unsupported");
    }
  }

  private readList(depth: number): NbtValue[] {
    const elementType = this.readUint8();
    const length = this.readLength(SKYBLOCK_ITEM_LIMITS.nbtListLength);
    if (elementType === 0 && length !== 0) {
      throw new ItemDecodeFailure("malformed");
    }
    const values: NbtValue[] = [];
    for (let index = 0; index < length; index += 1) {
      values.push(this.readPayload(elementType, depth));
    }
    return values;
  }

  private readCompound(depth: number): NbtCompound {
    const value: NbtCompound = Object.create(null) as NbtCompound;
    while (true) {
      const type = this.readUint8();
      if (type === 0) return value;
      const name = this.readString();
      value[name] = this.readPayload(type, depth);
    }
  }

  private skipArray(bytesPerElement: number): void {
    const length = this.readLength(SKYBLOCK_ITEM_LIMITS.nbtArrayLength);
    if (length > Math.floor(Number.MAX_SAFE_INTEGER / bytesPerElement)) {
      throw new ItemDecodeFailure("oversized");
    }
    this.ensure(length * bytesPerElement);
    this.offset += length * bytesPerElement;
  }

  private readLength(maximum: number): number {
    const length = this.readInt32();
    if (length < 0) throw new ItemDecodeFailure("malformed");
    if (length > maximum) throw new ItemDecodeFailure("oversized");
    return length;
  }

  private readString(): string {
    const length = this.readUint16();
    if (length > SKYBLOCK_ITEM_LIMITS.nbtStringBytes) {
      throw new ItemDecodeFailure("oversized");
    }
    this.totalStringBytes += length;
    if (this.totalStringBytes > SKYBLOCK_ITEM_LIMITS.nbtTotalStringBytes) {
      throw new ItemDecodeFailure("oversized");
    }
    this.ensure(length);
    const bytes = new Uint8Array(
      this.view.buffer,
      this.view.byteOffset + this.offset,
      length,
    );
    this.offset += length;
    try {
      return this.decoder.decode(bytes);
    } catch {
      throw new ItemDecodeFailure("malformed");
    }
  }

  private readUint8(): number {
    this.ensure(1);
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  private readInt8(): number {
    this.ensure(1);
    const value = this.view.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  private readUint16(): number {
    this.ensure(2);
    const value = this.view.getUint16(this.offset);
    this.offset += 2;
    return value;
  }

  private readInt16(): number {
    this.ensure(2);
    const value = this.view.getInt16(this.offset);
    this.offset += 2;
    return value;
  }

  private readInt32(): number {
    this.ensure(4);
    const value = this.view.getInt32(this.offset);
    this.offset += 4;
    return value;
  }

  private readBigInt64(): bigint {
    this.ensure(8);
    const value = this.view.getBigInt64(this.offset);
    this.offset += 8;
    return value;
  }

  private readFloat32(): number {
    this.ensure(4);
    const value = this.view.getFloat32(this.offset);
    this.offset += 4;
    if (!Number.isFinite(value)) throw new ItemDecodeFailure("malformed");
    return value;
  }

  private readFloat64(): number {
    this.ensure(8);
    const value = this.view.getFloat64(this.offset);
    this.offset += 8;
    if (!Number.isFinite(value)) throw new ItemDecodeFailure("malformed");
    return value;
  }

  private ensure(length: number): void {
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      this.offset > this.view.byteLength - length
    ) {
      throw new ItemDecodeFailure("malformed");
    }
  }
}

class ItemDecodeFailure extends Error {
  constructor(readonly state: Exclude<SkyBlockItemContainerState, "parsed" | "hidden">) {
    super(state);
    this.name = "ItemDecodeFailure";
  }
}

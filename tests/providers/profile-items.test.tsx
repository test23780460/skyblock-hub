import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileItemCoverage } from "../../components/ProfileItemCoverage";
import { MemoryTtlCache } from "../../lib/cache/ttl-cache";
import { HypixelProvider } from "../../lib/providers/hypixel";
import { MojangProvider } from "../../lib/providers/mojang";
import { getPlayerAnalysis } from "../../lib/providers/player-analysis";
import {
  SKYBLOCK_ITEM_LIMITS,
  decodeSkyBlockItemContainer,
  normalizeSkyBlockItemData,
} from "../../lib/providers/skyblock-items";

type SyntheticItem = {
  slot: number;
  count: number;
  id: string;
  name: string;
  lore: string[];
  stars: number;
  rarityUpgrades: number;
};

type SyntheticFixture = {
  fixtureNotice: string;
  schemaVersion: "skyblock-items-v1";
  containers: {
    armor: SyntheticItem[];
    inventory: SyntheticItem[];
    accessories: SyntheticItem[];
  };
  expected: {
    helmetName: string;
    weaponName: string;
    accessoryFamily: string;
    uniqueAccessoryCount: number;
  };
};

const fixture = JSON.parse(
  await readFile(
    new URL("../../fixtures/hypixel/items-v1.synthetic.json", import.meta.url),
    "utf8",
  ),
) as SyntheticFixture;

class NbtWriter {
  private readonly output: number[] = [];
  private readonly encoder = new TextEncoder();

  uint8(value: number): void {
    this.output.push(value & 0xff);
  }

  int8(value: number): void {
    this.uint8(value);
  }

  uint16(value: number): void {
    this.output.push((value >>> 8) & 0xff, value & 0xff);
  }

  int32(value: number): void {
    this.output.push(
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    );
  }

  string(value: string): void {
    const bytes = this.encoder.encode(value);
    this.uint16(bytes.length);
    this.output.push(...bytes);
  }

  namedHeader(type: number, name: string): void {
    this.uint8(type);
    this.string(name);
  }

  bytes(): Uint8Array {
    return Uint8Array.from(this.output);
  }
}

test("versioned synthetic NBT is reduced to bounded safe item summaries", async () => {
  const member = await fixtureMember();
  const itemData = await normalizeSkyBlockItemData(member);

  assert.equal(itemData.version, fixture.schemaVersion);
  assert.equal(itemData.containers.length, 5);
  const armor = itemData.containers.find((item) => item.key === "armor");
  const inventory = itemData.containers.find((item) => item.key === "inventory");
  const accessories = itemData.containers.find(
    (item) => item.key === "accessories",
  );
  assert.equal(armor?.state, "parsed");
  assert.equal(armor?.skippedItemCount, 0);
  assert.deepEqual(armor?.items[0], {
    slot: 3,
    id: "SYNTHETIC_HELMET",
    name: fixture.expected.helmetName,
    count: 1,
    rarity: "LEGENDARY",
    category: "helmet",
    stars: 5,
    recombobulated: true,
  });
  assert.equal(inventory?.items[0]?.name, fixture.expected.weaponName);
  assert.equal(inventory?.items[0]?.category, "weapon");
  assert.equal(accessories?.itemCount, 2);
  assert.equal(
    itemData.containers.find((item) => item.key === "equipment")?.state,
    "hidden",
  );
  const serialized = JSON.stringify(itemData);
  assert.doesNotMatch(serialized, /Fixture lore|Private fixture lore|ExtraAttributes|Lore|§/);
  assert.ok(serialized.length < 12_000);
});

test("valid containers beyond the public item limit are explicitly capped", async () => {
  const template = fixture.containers.inventory[0]!;
  const items = Array.from(
    { length: SKYBLOCK_ITEM_LIMITS.safeItemsPerContainer + 5 },
    (_, index): SyntheticItem => ({
      ...template,
      slot: index % 128,
      id: `SYNTHETIC_${index}_SWORD`,
      name: `Synthetic Blade ${index}`,
    }),
  );
  const result = await decodeSkyBlockItemContainer(
    await encodeInventory(items),
    "inventory",
    "Inventory",
  );
  assert.equal(result.state, "parsed");
  assert.equal(result.itemCount, SKYBLOCK_ITEM_LIMITS.safeItemsPerContainer + 5);
  assert.equal(result.items.length, SKYBLOCK_ITEM_LIMITS.safeItemsPerContainer);
  assert.equal(result.truncated, true);
  assert.match(result.note, /capped by a fixed item budget/i);
});

test("malformed, oversized, deep, and decompression-bomb inputs never escape the decoder", async () => {
  const malformed = await decodeSkyBlockItemContainer(
    "not base64!",
    "inventory",
    "Inventory",
  );
  assert.equal(malformed.state, "malformed");

  const oversized = await decodeSkyBlockItemContainer(
    "A".repeat(SKYBLOCK_ITEM_LIMITS.encodedCharactersPerContainer + 4),
    "inventory",
    "Inventory",
  );
  assert.equal(oversized.state, "oversized");

  const corruptedGzip = await decodeSkyBlockItemContainer(
    bytesToBase64(new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0xff])),
    "inventory",
    "Inventory",
  );
  assert.equal(corruptedGzip.state, "malformed");

  const deep = await decodeSkyBlockItemContainer(
    await gzipBase64(deepCompoundNbt(SKYBLOCK_ITEM_LIMITS.nbtDepth + 4)),
    "inventory",
    "Inventory",
  );
  assert.equal(deep.state, "oversized");

  const bomb = await decodeSkyBlockItemContainer(
    await gzipBase64(
      new Uint8Array(SKYBLOCK_ITEM_LIMITS.inflatedBytesPerContainer + 1),
    ),
    "inventory",
    "Inventory",
  );
  assert.equal(bomb.state, "oversized");
});

test("deterministic fuzz-style byte inputs always return a classified bounded result", async () => {
  let state = 0x6d2b79f5;
  for (let caseIndex = 0; caseIndex < 128; caseIndex += 1) {
    state = xorshift(state);
    const length = state % 257;
    const bytes = new Uint8Array(length);
    for (let index = 0; index < bytes.length; index += 1) {
      state = xorshift(state);
      bytes[index] = state & 0xff;
    }
    const result = await decodeSkyBlockItemContainer(
      bytesToBase64(bytes),
      "inventory",
      "Inventory",
    );
    assert.ok(
      ["malformed", "oversized", "unsupported", "parsed"].includes(
        result.state,
      ),
    );
    assert.ok(result.items.length <= SKYBLOCK_ITEM_LIMITS.safeItemsPerContainer);
  }

  const unicode = await decodeSkyBlockItemContainer(
    "H4sI☃==",
    "inventory",
    "Inventory",
  );
  assert.equal(unicode.state, "malformed");
});

test("player provider cache and public analysis contract contain summaries but never raw NBT", async () => {
  const member = await fixtureMember();
  const cache = new MemoryTtlCache();
  let calls = 0;
  const mojang = new MojangProvider({
    cache,
    fetchImplementation: async () => {
      calls += 1;
      return jsonResponse({
        id: "10000000000000000000000000000001",
        name: "ItemFixture",
      });
    },
  });
  const hypixel = new HypixelProvider({
    apiKey: "fixture-credential",
    cache,
    fetchImplementation: async (input) => {
      calls += 1;
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/player")) {
        return jsonResponse({
          success: true,
          player: {
            uuid: "10000000000000000000000000000001",
            displayname: "ItemFixture",
          },
        });
      }
      return jsonResponse({
        success: true,
        profiles: [
          {
            profile_id: "20000000000000000000000000000002",
            cute_name: "Synthetic",
            selected: true,
            members: {
              "10000000000000000000000000000001": {
                ...member,
                accessory_bag_storage: { highest_magical_power: 321 },
              },
            },
          },
        ],
      });
    },
  });

  const first = await getPlayerAnalysis("ItemFixture", null, {
    mojang,
    hypixel,
  });
  const second = await getPlayerAnalysis("ItemFixture", null, {
    mojang,
    hypixel,
  });
  assert.equal(calls, 3, "the second user-triggered lookup should use shared caches");
  assert.equal(second.cacheStatus, "cached");

  const profile = first.profiles[0];
  assert.equal(profile?.itemData?.version, "skyblock-items-v1");
  assert.ok(
    profile?.gear.some(
      (item) =>
        item.name === fixture.expected.helmetName && item.status === "detected",
    ),
  );
  assert.ok(
    profile?.gear.some((item) => item.name === fixture.expected.weaponName),
  );
  assert.equal(profile?.accessories?.length, fixture.expected.uniqueAccessoryCount);
  assert.ok(
    profile?.accessories?.every(
      (item) => item.familyId === fixture.expected.accessoryFamily,
    ),
  );
  const netWorth = profile?.stats.find((stat) => stat.key === "networth");
  assert.equal(netWorth?.value, null);
  assert.match(netWorth?.note ?? "", /safe item summaries are ready/i);

  const cachedProfiles = await hypixel.getSkyBlockProfiles(
    "10000000000000000000000000000001",
  );
  const contract = JSON.stringify({ data: first });
  const cached = JSON.stringify(cachedProfiles.data);
  for (const output of [contract, cached]) {
    assert.doesNotMatch(
      output,
      /inv_contents|inv_armor|talisman_bag|ExtraAttributes|Fixture lore|Private fixture lore|§/,
    );
    assert.match(output, /skyblock-items-v1/);
  }
});

test("item coverage UI renders parsed, hidden, and safety-boundary states", () => {
  const html = renderToStaticMarkup(
    <ProfileItemCoverage
      accessoryCount={2}
      itemData={{
        version: "skyblock-items-v1",
        containers: [
          {
            key: "inventory",
            label: "Inventory",
            state: "parsed",
            itemCount: 2,
            skippedItemCount: 0,
            items: [],
            truncated: false,
            note: "Decoded safely from the current request-driven profile snapshot.",
          },
          {
            key: "accessories",
            label: "Accessory bag",
            state: "hidden",
            itemCount: 0,
            skippedItemCount: 0,
            items: [],
            truncated: false,
            note: "The player did not expose this container in the current response.",
          },
        ],
      }}
    />,
  );
  assert.match(html, /Bounded item-data coverage/);
  assert.match(html, /skyblock-items-v1/);
  assert.match(html, /2 items/);
  assert.match(html, /class="item-coverage-state parsed"/);
  assert.match(html, /class="item-coverage-state hidden"/);
  assert.match(html, /Raw base64, NBT trees, lore/);
});

async function fixtureMember(): Promise<Record<string, unknown>> {
  return {
    inventory: {
      inv_contents: {
        data: await encodeInventory(fixture.containers.inventory),
      },
      inv_armor: { data: await encodeInventory(fixture.containers.armor) },
      bag_contents: {
        talisman_bag: {
          data: await encodeInventory(fixture.containers.accessories),
        },
      },
    },
  };
}

async function encodeInventory(items: SyntheticItem[]): Promise<string> {
  const writer = new NbtWriter();
  writer.uint8(10);
  writer.string("");
  writer.namedHeader(9, "i");
  writer.uint8(10);
  writer.int32(items.length);
  for (const item of items) writeItemCompound(writer, item);
  writer.uint8(0);
  return gzipBase64(writer.bytes());
}

function writeItemCompound(writer: NbtWriter, item: SyntheticItem): void {
  writer.namedHeader(1, "Count");
  writer.int8(item.count);
  writer.namedHeader(1, "Slot");
  writer.int8(item.slot);
  writer.namedHeader(10, "tag");
  writer.namedHeader(10, "display");
  writer.namedHeader(8, "Name");
  writer.string(item.name);
  writer.namedHeader(9, "Lore");
  writer.uint8(8);
  writer.int32(item.lore.length);
  for (const line of item.lore) writer.string(line);
  writer.uint8(0);
  writer.namedHeader(10, "ExtraAttributes");
  writer.namedHeader(8, "id");
  writer.string(item.id);
  writer.namedHeader(3, "upgrade_level");
  writer.int32(item.stars);
  writer.namedHeader(3, "rarity_upgrades");
  writer.int32(item.rarityUpgrades);
  writer.uint8(0);
  writer.uint8(0);
  writer.uint8(0);
}

function deepCompoundNbt(depth: number): Uint8Array {
  const writer = new NbtWriter();
  writer.uint8(10);
  writer.string("");
  for (let index = 0; index < depth; index += 1) {
    writer.namedHeader(10, "x");
  }
  for (let index = 0; index <= depth; index += 1) writer.uint8(0);
  return writer.bytes();
}

async function gzipBase64(input: Uint8Array): Promise<string> {
  const buffer = input.buffer.slice(
    input.byteOffset,
    input.byteOffset + input.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([buffer])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return bytesToBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
  }
  return btoa(binary);
}

function xorshift(value: number): number {
  let next = value >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

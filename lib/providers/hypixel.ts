import {
  cachedLoad,
  sharedProviderCache,
  type CachedLoadResult,
  type TtlCache,
} from "../cache/ttl-cache";
import { ProviderError } from "./errors";
import {
  boundedString,
  cleanMinecraftText,
  finiteNumber,
  invalidResponse,
  isJsonObject,
  nonNegativeNumber,
  normalizeMinecraftUsername,
  normalizeUuid,
  optionalObject,
  requireObject,
  safeTimestamp,
  type JsonObject,
} from "./guards";
import {
  assertServerRuntime,
  requestJson,
  type FetchImplementation,
} from "./http";
import {
  createSkyBlockItemDecodeBudget,
  normalizeSkyBlockItemData,
} from "./skyblock-items";

const API_BASE_URL = "https://api.hypixel.net/v2/";
const PLAYER_TTL_MS = 60 * 60 * 1_000;
const PLAYER_STALE_TTL_MS = 24 * 60 * 60 * 1_000;
const ECONOMY_TTL_MS = 60 * 1_000;
const ECONOMY_STALE_TTL_MS = 5 * 60 * 1_000;

export type HypixelPlayer = {
  uuid: string;
  displayName: string;
};

export type HypixelSkyBlockProfile = {
  id: string;
  name: string;
  selected: boolean;
  gameMode: string;
  banking: JsonObject | null;
  members: Record<string, JsonObject>;
};

export type BazaarProduct = {
  productId: string;
  buyPrice: number | null;
  sellPrice: number | null;
  buyVolume: number | null;
  sellVolume: number | null;
  buyMovingWeek: number | null;
  sellMovingWeek: number | null;
  buyOrders: number | null;
  sellOrders: number | null;
  spread: number | null;
  spreadPercent: number | null;
};

export type BazaarSnapshot = {
  lastUpdated: number;
  products: BazaarProduct[];
  skippedProducts: number;
};

export type ActiveAuction = {
  id: string;
  itemName: string;
  category: string | null;
  tier: string | null;
  startingBid: number | null;
  highestBidAmount: number | null;
  bin: boolean | null;
  startAt: number | null;
  endAt: number | null;
  bidCount: number;
};

export type ActiveAuctionPage = {
  page: number;
  totalPages: number;
  totalAuctions: number;
  lastUpdated: number;
  auctions: ActiveAuction[];
  skippedAuctions: number;
};

export type EndedAuction = {
  id: string;
  endedAt: number | null;
  price: number | null;
  bin: boolean | null;
};

export type EndedAuctionSnapshot = {
  lastUpdated: number;
  auctions: EndedAuction[];
  skippedAuctions: number;
};

type HypixelProviderOptions = {
  apiKey?: string | null;
  fetchImplementation?: FetchImplementation;
  cache?: TtlCache;
  timeoutMs?: number;
};

export class HypixelProvider {
  private readonly apiKey: string | null;
  private readonly fetchImplementation?: FetchImplementation;
  private readonly cache: TtlCache;
  private readonly timeoutMs: number;

  constructor(options: HypixelProviderOptions = {}) {
    assertServerRuntime();
    this.apiKey =
      options.apiKey === undefined
        ? process.env.HYPIXEL_API_KEY?.trim() || null
        : options.apiKey?.trim() || null;
    this.fetchImplementation = options.fetchImplementation;
    this.cache = options.cache ?? sharedProviderCache;
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async getPlayer(uuidInput: string): Promise<CachedLoadResult<HypixelPlayer>> {
    const uuid = normalizeUuid(uuidInput);
    return cachedLoad(
      this.cache,
      `hypixel:player:${uuid}`,
      {
        ttlMs: PLAYER_TTL_MS,
        staleTtlMs: PLAYER_STALE_TTL_MS,
        staleIfError: true,
      },
      async () => {
        const payload = await this.authenticatedRequest("player", { uuid });
        return normalizePlayer(payload);
      },
    );
  }

  async getSkyBlockProfiles(
    uuidInput: string,
  ): Promise<CachedLoadResult<HypixelSkyBlockProfile[]>> {
    const uuid = normalizeUuid(uuidInput);
    return cachedLoad(
      this.cache,
      `hypixel:skyblock:profiles:${uuid}`,
      {
        ttlMs: PLAYER_TTL_MS,
        staleTtlMs: PLAYER_STALE_TTL_MS,
        staleIfError: true,
      },
      async () => {
        const payload = await this.authenticatedRequest("skyblock/profiles", {
          uuid,
        });
        return normalizeProfiles(payload, uuid);
      },
    );
  }

  async getBazaar(): Promise<CachedLoadResult<BazaarSnapshot>> {
    return cachedLoad(
      this.cache,
      "hypixel:economy:bazaar",
      {
        ttlMs: ECONOMY_TTL_MS,
        staleTtlMs: ECONOMY_STALE_TTL_MS,
        staleIfError: true,
      },
      async () => normalizeBazaar(await this.publicRequest("skyblock/bazaar")),
    );
  }

  async getActiveAuctions(
    pageInput = 0,
  ): Promise<CachedLoadResult<ActiveAuctionPage>> {
    const page = normalizePage(pageInput);
    return cachedLoad(
      this.cache,
      `hypixel:economy:auctions:${page}`,
      {
        ttlMs: ECONOMY_TTL_MS,
        staleTtlMs: ECONOMY_STALE_TTL_MS,
        staleIfError: true,
      },
      async () =>
        normalizeActiveAuctions(
          await this.publicRequest(
            "skyblock/auctions",
            { page: String(page) },
            new ProviderError({
              code: "invalid_input",
              message: "That active-auction page does not exist.",
              status: 404,
              action: "Request a page within the current total page count.",
            }),
          ),
        ),
    );
  }

  async getEndedAuctions(): Promise<CachedLoadResult<EndedAuctionSnapshot>> {
    return cachedLoad(
      this.cache,
      "hypixel:economy:auctions-ended",
      {
        ttlMs: 55 * 1_000,
        staleTtlMs: ECONOMY_STALE_TTL_MS,
        staleIfError: true,
      },
      async () =>
        normalizeEndedAuctions(
          await this.publicRequest("skyblock/auctions_ended"),
        ),
    );
  }

  private async authenticatedRequest(
    path: string,
    query: Record<string, string>,
  ): Promise<unknown> {
    const apiKey = this.requireApiKey();
    return requestJson({
      provider: "Hypixel",
      url: buildApiUrl(path, query),
      fetchImplementation: this.fetchImplementation,
      timeoutMs: this.timeoutMs,
      maxResponseCharacters: 16_000_000,
      hypixelRateScope: "authenticated",
      headers: { "API-Key": apiKey },
    });
  }

  private async publicRequest(
    path: string,
    query: Record<string, string> = {},
    notFoundError?: ProviderError,
  ): Promise<unknown> {
    return requestJson({
      provider: "Hypixel",
      url: buildApiUrl(path, query),
      fetchImplementation: this.fetchImplementation,
      timeoutMs: this.timeoutMs,
      maxResponseCharacters: 24_000_000,
      hypixelRateScope: "public",
      notFoundError,
    });
  }

  private requireApiKey(): string {
    if (this.apiKey) return this.apiKey;
    throw new ProviderError({
      code: "missing_credentials",
      message: "Live Hypixel profile analysis is not configured.",
      status: 503,
      action:
        "An administrator must add a server-side Hypixel production API key.",
    });
  }
}

function normalizePlayer(payload: unknown): HypixelPlayer {
  const root = requireSuccessfulPayload(payload);
  const player = optionalObject(root.player);
  if (!player) {
    throw new ProviderError({
      code: "player_not_found",
      message: "Hypixel has no player record for that Minecraft account.",
      status: 404,
      action: "Confirm the player has joined Hypixel and try again.",
    });
  }
  const uuid = upstreamUuid(player.uuid);
  const displayNameValue = boundedString(player.displayname, 16);
  if (!displayNameValue) throw invalidResponse("Hypixel");
  let displayName: string;
  try {
    displayName = normalizeMinecraftUsername(displayNameValue);
  } catch {
    throw invalidResponse("Hypixel");
  }
  return { uuid, displayName };
}

async function normalizeProfiles(
  payload: unknown,
  requestedUuid: string,
): Promise<HypixelSkyBlockProfile[]> {
  const root = requireSuccessfulPayload(payload);
  if (root.profiles === null) return [];
  if (!Array.isArray(root.profiles) || root.profiles.length > 32) {
    throw invalidResponse("Hypixel");
  }

  const profiles: HypixelSkyBlockProfile[] = [];
  const itemDecodeBudget = createSkyBlockItemDecodeBudget();
  for (const value of root.profiles) {
    const profile = optionalObject(value);
    if (!profile) continue;
    try {
      const id = upstreamUuid(profile.profile_id);
      const name = boundedString(profile.cute_name, 32) ?? "Unnamed";
      const membersObject = optionalObject(profile.members);
      if (!membersObject) continue;
      const members: Record<string, JsonObject> = {};
      for (const [memberId, memberValue] of Object.entries(membersObject)) {
        if (!isJsonObject(memberValue)) continue;
        try {
          const normalizedMemberId = upstreamUuid(memberId);
          if (normalizedMemberId !== requestedUuid) continue;
          members[normalizedMemberId] = await normalizeMemberForAnalysis(
            memberValue,
            itemDecodeBudget,
          );
          break;
        } catch {
          // Ignore malformed member data without retaining another co-op member.
        }
      }
      if (Object.keys(members).length === 0) continue;
      profiles.push({
        id,
        name,
        selected: profile.selected === true,
        gameMode: boundedString(profile.game_mode, 32) ?? "normal",
        banking: normalizeBanking(profile.banking),
        members,
      });
    } catch {
      // A malformed profile is omitted; valid profiles remain useful.
    }
  }
  if (root.profiles.length > 0 && profiles.length === 0) {
    throw invalidResponse("Hypixel");
  }
  return profiles;
}

async function normalizeMemberForAnalysis(
  member: JsonObject,
  itemDecodeBudget: ReturnType<typeof createSkyBlockItemDecodeBudget>,
): Promise<JsonObject> {
  const normalized: JsonObject = {};

  const profile = optionalObject(member.profile);
  const lastSave = nonNegativeNumber(profile?.last_save ?? member.last_save);
  if (lastSave !== null) normalized.profile = { last_save: lastSave };

  const currencies = optionalObject(member.currencies);
  const purse = nonNegativeNumber(currencies?.coin_purse ?? member.coin_purse);
  if (purse !== null) normalized.currencies = { coin_purse: purse };

  const leveling = optionalObject(member.leveling);
  const skyBlockXp = nonNegativeNumber(leveling?.experience ?? leveling?.xp);
  if (skyBlockXp !== null) normalized.leveling = { experience: skyBlockXp };

  const playerData = optionalObject(member.player_data);
  const structuredExperience = optionalObject(playerData?.experience);
  const structuredSkills =
    optionalObject(playerData?.skills) ?? optionalObject(member.skills);
  const experience: JsonObject = {};
  const skills: JsonObject = {};
  for (const skill of [
    "farming",
    "mining",
    "combat",
    "foraging",
    "fishing",
    "enchanting",
    "alchemy",
  ]) {
    const upperKey = `SKILL_${skill.toUpperCase()}`;
    const xp = nonNegativeNumber(
      structuredExperience?.[upperKey] ?? structuredExperience?.[skill],
    );
    if (xp !== null) experience[upperKey] = xp;

    const skillObject = optionalObject(structuredSkills?.[skill]);
    const level = nonNegativeNumber(skillObject?.level);
    if (level !== null) skills[skill] = { level };

    const legacyXp = nonNegativeNumber(member[`experience_skill_${skill}`]);
    if (legacyXp !== null) normalized[`experience_skill_${skill}`] = legacyXp;
  }
  if (Object.keys(experience).length > 0 || Object.keys(skills).length > 0) {
    normalized.player_data = {
      ...(Object.keys(experience).length > 0 ? { experience } : {}),
      ...(Object.keys(skills).length > 0 ? { skills } : {}),
    };
  }

  const accessoryBag = optionalObject(member.accessory_bag_storage);
  if (accessoryBag) {
    const safeBag: JsonObject = { present: true };
    const highest = nonNegativeNumber(accessoryBag.highest_magical_power);
    const current = nonNegativeNumber(accessoryBag.magical_power);
    if (highest !== null) safeBag.highest_magical_power = highest;
    if (current !== null) safeBag.magical_power = current;
    normalized.accessory_bag_storage = safeBag;
  }

  const dungeons = optionalObject(member.dungeons);
  const dungeonTypes = optionalObject(dungeons?.dungeon_types);
  const catacombs =
    optionalObject(dungeonTypes?.catacombs) ??
    optionalObject(dungeons?.catacombs);
  const catacombsLevel = nonNegativeNumber(catacombs?.level);
  const catacombsXp = nonNegativeNumber(catacombs?.experience);
  if (catacombsLevel !== null || catacombsXp !== null) {
    normalized.dungeons = {
      dungeon_types: {
        catacombs: {
          ...(catacombsLevel !== null ? { level: catacombsLevel } : {}),
          ...(catacombsXp !== null ? { experience: catacombsXp } : {}),
        },
      },
    };
  }

  const slayerContainer = optionalObject(member.slayer);
  const slayerBosses =
    optionalObject(slayerContainer?.slayer_bosses) ??
    optionalObject(member.slayer_bosses);
  if (slayerBosses) {
    const safeBosses: JsonObject = Object.create(null) as JsonObject;
    for (const [bossName, bossValue] of Object.entries(slayerBosses).slice(0, 32)) {
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(bossName)) continue;
      const boss = optionalObject(bossValue);
      const xp = nonNegativeNumber(boss?.xp);
      if (xp !== null) safeBosses[bossName] = { xp };
    }
    if (Object.keys(safeBosses).length > 0) {
      normalized.slayer_bosses = safeBosses;
    }
  }

  normalized.item_data = await normalizeSkyBlockItemData(
    member,
    itemDecodeBudget,
  );

  return normalized;
}

function normalizeBanking(value: unknown): JsonObject | null {
  const banking = optionalObject(value);
  const balance = nonNegativeNumber(banking?.balance);
  return balance === null ? null : { balance };
}

function normalizeBazaar(payload: unknown): BazaarSnapshot {
  const root = requireSuccessfulPayload(payload);
  const lastUpdated = safeTimestamp(root.lastUpdated);
  const productsObject = optionalObject(root.products);
  if (lastUpdated === null || !productsObject) throw invalidResponse("Hypixel");

  const products: BazaarProduct[] = [];
  let skippedProducts = 0;
  for (const [key, value] of Object.entries(productsObject).slice(0, 20_000)) {
    const product = optionalObject(value);
    const quickStatus = product ? optionalObject(product.quick_status) : null;
    const productId = normalizeProductId(product?.product_id ?? key);
    if (!product || !quickStatus || !productId) {
      skippedProducts += 1;
      continue;
    }

    const buyPrice = nonNegativeNumber(quickStatus.buyPrice);
    const sellPrice = nonNegativeNumber(quickStatus.sellPrice);
    const spread =
      buyPrice !== null && sellPrice !== null ? sellPrice - buyPrice : null;
    products.push({
      productId,
      buyPrice,
      sellPrice,
      buyVolume: nonNegativeNumber(quickStatus.buyVolume),
      sellVolume: nonNegativeNumber(quickStatus.sellVolume),
      buyMovingWeek: nonNegativeNumber(
        quickStatus.buyMovingWeek ?? quickStatus.movingWeek,
      ),
      sellMovingWeek: nonNegativeNumber(
        quickStatus.sellMovingWeek ?? quickStatus.movingWeek,
      ),
      buyOrders: nonNegativeNumber(quickStatus.buyOrders),
      sellOrders: nonNegativeNumber(quickStatus.sellOrders),
      spread,
      spreadPercent:
        spread !== null && buyPrice !== null && buyPrice > 0
          ? (spread / buyPrice) * 100
          : null,
    });
  }
  if (Object.keys(productsObject).length > 20_000) {
    skippedProducts += Object.keys(productsObject).length - 20_000;
  }
  if (Object.keys(productsObject).length > 0 && products.length === 0) {
    throw invalidResponse("Hypixel");
  }

  return { lastUpdated, products, skippedProducts };
}

function normalizeActiveAuctions(payload: unknown): ActiveAuctionPage {
  const root = requireSuccessfulPayload(payload);
  const page = integer(root.page);
  const totalPages = integer(root.totalPages);
  const totalAuctions = integer(root.totalAuctions);
  const lastUpdated = safeTimestamp(root.lastUpdated);
  if (
    page === null ||
    totalPages === null ||
    totalAuctions === null ||
    lastUpdated === null ||
    !Array.isArray(root.auctions) ||
    root.auctions.length > 5_000
  ) {
    throw invalidResponse("Hypixel");
  }

  const auctions: ActiveAuction[] = [];
  let skippedAuctions = 0;
  for (const value of root.auctions) {
    const auction = optionalObject(value);
    if (!auction) {
      skippedAuctions += 1;
      continue;
    }
    try {
      auctions.push({
        id: upstreamUuid(auction.uuid),
        itemName: cleanMinecraftText(auction.item_name),
        category: boundedString(auction.category, 40),
        tier: boundedString(auction.tier, 40)?.toUpperCase() ?? null,
        startingBid: nonNegativeNumber(auction.starting_bid),
        highestBidAmount: nonNegativeNumber(auction.highest_bid_amount),
        bin: typeof auction.bin === "boolean" ? auction.bin : null,
        startAt: safeTimestamp(auction.start),
        endAt: safeTimestamp(auction.end),
        bidCount: Array.isArray(auction.bids)
          ? Math.min(auction.bids.length, 100_000)
          : 0,
      });
    } catch {
      skippedAuctions += 1;
    }
  }
  if (root.auctions.length > 0 && auctions.length === 0) {
    throw invalidResponse("Hypixel");
  }

  return {
    page,
    totalPages,
    totalAuctions,
    lastUpdated,
    auctions,
    skippedAuctions,
  };
}

function normalizeEndedAuctions(payload: unknown): EndedAuctionSnapshot {
  const root = requireSuccessfulPayload(payload);
  const lastUpdated = safeTimestamp(root.lastUpdated);
  if (
    lastUpdated === null ||
    !Array.isArray(root.auctions) ||
    root.auctions.length > 20_000
  ) {
    throw invalidResponse("Hypixel");
  }

  const auctions: EndedAuction[] = [];
  let skippedAuctions = 0;
  for (const value of root.auctions) {
    const auction = optionalObject(value);
    if (!auction) {
      skippedAuctions += 1;
      continue;
    }
    try {
      auctions.push({
        id: upstreamUuid(auction.auction_id),
        endedAt: safeTimestamp(auction.timestamp),
        price: nonNegativeNumber(auction.price),
        bin: typeof auction.bin === "boolean" ? auction.bin : null,
      });
    } catch {
      skippedAuctions += 1;
    }
  }
  if (root.auctions.length > 0 && auctions.length === 0) {
    throw invalidResponse("Hypixel");
  }
  return { lastUpdated, auctions, skippedAuctions };
}

function requireSuccessfulPayload(payload: unknown): JsonObject {
  const root = requireObject(payload, "Hypixel");
  if (root.success !== true) throw invalidResponse("Hypixel");
  return root;
}

function buildApiUrl(path: string, query: Record<string, string>): URL {
  const url = new URL(path, API_BASE_URL);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function upstreamUuid(value: unknown): string {
  if (typeof value !== "string") throw invalidResponse("Hypixel");
  try {
    return normalizeUuid(value);
  } catch {
    throw invalidResponse("Hypixel");
  }
}

function normalizeProductId(value: unknown): string | null {
  const productId = boundedString(value, 128);
  return productId && /^[A-Za-z0-9_:.-]+$/.test(productId)
    ? productId.toUpperCase()
    : null;
}

function normalizePage(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new ProviderError({
      code: "invalid_input",
      message: "The requested auction page is invalid.",
      status: 400,
      action: "Choose a non-negative page number.",
    });
  }
  return value;
}

function integer(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && Number.isSafeInteger(number) && number >= 0
    ? number
    : null;
}

export const hypixelProvider = new HypixelProvider();

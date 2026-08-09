import { and, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  auctionSales,
  auctionListings,
  bazaarAggregates,
  bazaarProducts,
  bazaarSnapshots,
  items,
  itemValuations,
} from "@/db/schema";
import type {
  AuctionSaleInput,
  AuctionListingInput,
  BazaarAggregateInput,
  BazaarProductInput,
  BazaarSnapshotInput,
  BazaarSnapshotRecord,
  EconomyRepository,
  ItemInput,
  ItemValuationInput,
  ItemValuationRecord,
} from "../contracts";

export class DrizzleEconomyRepository implements EconomyRepository {
  constructor(private readonly db: AppDatabase) {}

  async upsertItem(input: ItemInput): Promise<void> {
    const values = {
      id: input.id,
      name: input.name,
      nameNormalized: input.nameNormalized,
      rarity: input.rarity ?? null,
      category: input.category ?? null,
      npcSellPrice: input.npcSellPrice ?? null,
      isTradeable: input.isTradeable ?? true,
      isActive: input.isActive ?? true,
      metadata: input.metadata ?? null,
      sourceVersion: input.sourceVersion ?? null,
    };

    await this.db
      .insert(items)
      .values(values)
      .onConflictDoUpdate({
        target: items.id,
        set: { ...values, updatedAt: new Date() },
      });
  }

  async upsertBazaarProduct(input: BazaarProductInput): Promise<void> {
    await this.db
      .insert(bazaarProducts)
      .values({
        productId: input.productId,
        itemId: input.itemId ?? null,
        displayName: input.displayName ?? null,
        isActive: input.isActive ?? true,
        lastSeenAt: input.lastSeenAt,
      })
      .onConflictDoUpdate({
        target: bazaarProducts.productId,
        set: {
          itemId: input.itemId ?? null,
          displayName: input.displayName ?? null,
          isActive: input.isActive ?? true,
          lastSeenAt: input.lastSeenAt,
          updatedAt: new Date(),
        },
      });
  }

  async recordBazaarSnapshot(input: BazaarSnapshotInput): Promise<void> {
    await this.db
      .insert(bazaarSnapshots)
      .values({
        id: input.id,
        productId: input.productId,
        capturedAt: input.capturedAt,
        sourceUpdatedAt: input.sourceUpdatedAt ?? null,
        instantBuyPrice: input.instantBuyPrice,
        instantSellPrice: input.instantSellPrice,
        buyVolume: input.buyVolume ?? 0,
        sellVolume: input.sellVolume ?? 0,
        buyOrders: input.buyOrders ?? 0,
        sellOrders: input.sellOrders ?? 0,
        buyMovingWeek: input.buyMovingWeek ?? 0,
        sellMovingWeek: input.sellMovingWeek ?? 0,
      })
      .onConflictDoNothing({
        target: [bazaarSnapshots.productId, bazaarSnapshots.capturedAt],
      });
  }

  async recordBazaarAggregate(input: BazaarAggregateInput): Promise<void> {
    const values = {
      id: input.id,
      productId: input.productId,
      resolution: input.resolution,
      bucketStartAt: input.bucketStartAt,
      sampleCount: input.sampleCount,
      buyOpen: input.buyOpen,
      buyHigh: input.buyHigh,
      buyLow: input.buyLow,
      buyClose: input.buyClose,
      sellOpen: input.sellOpen,
      sellHigh: input.sellHigh,
      sellLow: input.sellLow,
      sellClose: input.sellClose,
      averageBuyVolume: input.averageBuyVolume ?? 0,
      averageSellVolume: input.averageSellVolume ?? 0,
    };

    await this.db
      .insert(bazaarAggregates)
      .values(values)
      .onConflictDoUpdate({
        target: [
          bazaarAggregates.productId,
          bazaarAggregates.resolution,
          bazaarAggregates.bucketStartAt,
        ],
        set: values,
      });
  }

  async getLatestBazaarSnapshot(productId: string): Promise<BazaarSnapshotRecord | null> {
    const [snapshot] = await this.db
      .select()
      .from(bazaarSnapshots)
      .where(eq(bazaarSnapshots.productId, productId))
      .orderBy(desc(bazaarSnapshots.capturedAt))
      .limit(1);
    return snapshot ?? null;
  }

  async upsertAuctionListing(input: AuctionListingInput): Promise<void> {
    const values = {
      auctionUuid: input.auctionUuid,
      itemId: input.itemId ?? null,
      itemVariantKey: input.itemVariantKey ?? "base",
      sellerMinecraftUuid: input.sellerMinecraftUuid ?? null,
      isBin: input.isBin ?? false,
      isClaimed: input.isClaimed ?? false,
      startingBid: input.startingBid,
      highestBid: input.highestBid ?? 0,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      fetchedAt: input.fetchedAt,
      itemData: input.itemData ?? null,
    };

    await this.db
      .insert(auctionListings)
      .values(values)
      .onConflictDoUpdate({
        target: auctionListings.auctionUuid,
        set: { ...values, updatedAt: new Date() },
      });
  }

  async recordAuctionSale(input: AuctionSaleInput): Promise<void> {
    const values = {
      id: input.id,
      auctionUuid: input.auctionUuid,
      itemId: input.itemId ?? null,
      itemVariantKey: input.itemVariantKey ?? "base",
      soldPrice: input.soldPrice,
      isBin: input.isBin ?? false,
      soldAt: input.soldAt,
      saleData: input.saleData ?? null,
    };

    await this.db
      .insert(auctionSales)
      .values(values)
      .onConflictDoUpdate({
        target: auctionSales.auctionUuid,
        set: {
          itemId: values.itemId,
          itemVariantKey: values.itemVariantKey,
          soldPrice: values.soldPrice,
          isBin: values.isBin,
          soldAt: values.soldAt,
          saleData: values.saleData,
        },
      });
  }

  async recordItemValuation(input: ItemValuationInput): Promise<void> {
    await this.db
      .insert(itemValuations)
      .values({
        id: input.id,
        itemId: input.itemId,
        itemVariantKey: input.itemVariantKey ?? "base",
        estimatedValue: input.estimatedValue,
        confidence: input.confidence,
        sampleCount: input.sampleCount ?? 0,
        methodologyVersion: input.methodologyVersion,
        factors: input.factors ?? null,
        valuedAt: input.valuedAt,
      })
      .onConflictDoNothing({
        target: [
          itemValuations.itemId,
          itemValuations.itemVariantKey,
          itemValuations.methodologyVersion,
          itemValuations.valuedAt,
        ],
      });
  }

  async getLatestItemValuation(
    itemId: string,
    itemVariantKey = "base",
  ): Promise<ItemValuationRecord | null> {
    const [valuation] = await this.db
      .select()
      .from(itemValuations)
      .where(
        and(
          eq(itemValuations.itemId, itemId),
          eq(itemValuations.itemVariantKey, itemVariantKey),
        ),
      )
      .orderBy(desc(itemValuations.valuedAt))
      .limit(1);
    return valuation ?? null;
  }
}

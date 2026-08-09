export type JsonRecord = Record<string, unknown>;

export interface CanonicalUser {
  id: string;
  displayName: string | null;
  status: "active" | "disabled" | "deleted";
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date | null;
}

export interface CreateUserInput {
  id: string;
  displayName?: string | null;
}

export interface ExternalIdentityInput {
  id: string;
  userId: string;
  provider: string;
  providerSubject: string;
  emailNormalized?: string | null;
  providerData?: JsonRecord | null;
  lastLoginAt?: Date | null;
}

export interface IdentityRepository {
  getUser(userId: string): Promise<CanonicalUser | null>;
  findUserByExternalIdentity(provider: string, providerSubject: string): Promise<CanonicalUser | null>;
  createUser(input: CreateUserInput): Promise<CanonicalUser>;
  upsertExternalIdentity(input: ExternalIdentityInput): Promise<void>;
  setPreference(
    id: string,
    userId: string,
    namespace: string,
    key: string,
    value: JsonRecord,
  ): Promise<void>;
  getPreferences(userId: string, namespace: string): Promise<Record<string, JsonRecord>>;
}

export interface MinecraftAccountRecord {
  id: string;
  minecraftUuid: string;
  lastKnownUsername: string;
  usernameNormalized: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkyblockProfileRecord {
  id: string;
  minecraftAccountId: string;
  hypixelProfileId: string;
  profileName: string | null;
  cuteName: string | null;
  gameMode: string | null;
  isSelected: boolean;
  dataState: "unknown" | "complete" | "partial" | "disabled" | "error";
  memberJoinedAt: Date | null;
  lastRequestedAt: Date | null;
  lastSuccessfulFetchAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertMinecraftAccountInput {
  id: string;
  minecraftUuid: string;
  lastKnownUsername: string;
  usernameNormalized: string;
}

export interface UpsertSkyblockProfileInput {
  id: string;
  minecraftAccountId: string;
  hypixelProfileId: string;
  profileName?: string | null;
  cuteName?: string | null;
  gameMode?: string | null;
  isSelected?: boolean;
  dataState?: SkyblockProfileRecord["dataState"];
  memberJoinedAt?: Date | null;
  lastRequestedAt?: Date | null;
  lastSuccessfulFetchAt?: Date | null;
}

export interface SavedProfileRecord {
  userId: string;
  profileId: string;
  alias: string | null;
  isPinned: boolean;
  createdAt: Date;
  lastViewedAt: Date | null;
}

export interface ProfileRepository {
  findMinecraftAccountByUuid(minecraftUuid: string): Promise<MinecraftAccountRecord | null>;
  upsertMinecraftAccount(input: UpsertMinecraftAccountInput): Promise<MinecraftAccountRecord>;
  findProfileByHypixelId(hypixelProfileId: string): Promise<SkyblockProfileRecord | null>;
  upsertProfile(input: UpsertSkyblockProfileInput): Promise<SkyblockProfileRecord>;
  linkMinecraftAccount(
    userId: string,
    minecraftAccountId: string,
    options?: { label?: string | null; isPrimary?: boolean },
  ): Promise<void>;
  saveProfile(
    userId: string,
    profileId: string,
    options?: { alias?: string | null; isPinned?: boolean },
  ): Promise<void>;
  listSavedProfiles(userId: string): Promise<SavedProfileRecord[]>;
}

export type GoalStatus = "active" | "paused" | "completed" | "archived";
export type GoalStepStatus = "pending" | "active" | "completed" | "skipped";
export type RecommendationState = "active" | "completed" | "ignored" | "snoozed";

export interface GoalRecord {
  id: string;
  userId: string;
  profileId: string | null;
  goalType: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  progressPercent: number;
  target: JsonRecord;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGoalInput {
  id: string;
  userId: string;
  profileId?: string | null;
  goalType: string;
  title: string;
  description?: string | null;
  target: JsonRecord;
  dueAt?: Date | null;
}

export interface CreateGoalStepInput {
  id: string;
  goalId: string;
  position: number;
  title: string;
  description?: string | null;
  estimate?: JsonRecord | null;
}

export interface RecommendationStateInput {
  id: string;
  userId: string;
  profileId: string;
  recommendationKey: string;
  recommendationVersion?: string;
  category: string;
  state: RecommendationState;
  context?: JsonRecord | null;
  remindAt?: Date | null;
  completedAt?: Date | null;
}

export interface GoalRepository {
  createGoal(input: CreateGoalInput): Promise<GoalRecord>;
  addStep(input: CreateGoalStepInput): Promise<void>;
  listGoals(userId: string, status?: GoalStatus): Promise<GoalRecord[]>;
  updateGoalProgress(
    goalId: string,
    progressPercent: number,
    status: GoalStatus,
    completedAt?: Date | null,
  ): Promise<void>;
  updateStepStatus(stepId: string, status: GoalStepStatus, completedAt?: Date | null): Promise<void>;
  upsertRecommendationState(input: RecommendationStateInput): Promise<void>;
}

export interface SavedBuildInput {
  id: string;
  userId: string;
  profileId?: string | null;
  title: string;
  description?: string | null;
  visibility?: "private" | "unlisted" | "public";
  shareSlug?: string | null;
  schemaVersion?: number;
  isExperimental?: boolean;
  build: JsonRecord;
}

export interface FavoriteInput {
  id: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  label?: string | null;
}

export interface UserContentRepository {
  saveBuild(input: SavedBuildInput): Promise<void>;
  addFavorite(input: FavoriteInput): Promise<void>;
  removeFavorite(userId: string, resourceType: string, resourceId: string): Promise<void>;
}

export interface ItemInput {
  id: string;
  name: string;
  nameNormalized: string;
  rarity?: string | null;
  category?: string | null;
  npcSellPrice?: number | null;
  isTradeable?: boolean;
  isActive?: boolean;
  metadata?: JsonRecord | null;
  sourceVersion?: string | null;
}

export interface BazaarProductInput {
  productId: string;
  itemId?: string | null;
  displayName?: string | null;
  isActive?: boolean;
  lastSeenAt: Date;
}

export interface BazaarSnapshotInput {
  id: string;
  productId: string;
  capturedAt: Date;
  sourceUpdatedAt?: Date | null;
  instantBuyPrice: number;
  instantSellPrice: number;
  buyVolume?: number;
  sellVolume?: number;
  buyOrders?: number;
  sellOrders?: number;
  buyMovingWeek?: number;
  sellMovingWeek?: number;
}

export interface BazaarSnapshotRecord extends BazaarSnapshotInput {
  sourceUpdatedAt: Date | null;
  buyVolume: number;
  sellVolume: number;
  buyOrders: number;
  sellOrders: number;
  buyMovingWeek: number;
  sellMovingWeek: number;
  createdAt: Date;
}

export interface BazaarAggregateInput {
  id: string;
  productId: string;
  resolution: "hour" | "day";
  bucketStartAt: Date;
  sampleCount: number;
  buyOpen: number;
  buyHigh: number;
  buyLow: number;
  buyClose: number;
  sellOpen: number;
  sellHigh: number;
  sellLow: number;
  sellClose: number;
  averageBuyVolume?: number;
  averageSellVolume?: number;
}

export interface AuctionListingInput {
  auctionUuid: string;
  itemId?: string | null;
  itemVariantKey?: string;
  sellerMinecraftUuid?: string | null;
  isBin?: boolean;
  isClaimed?: boolean;
  startingBid: number;
  highestBid?: number;
  startsAt: Date;
  endsAt: Date;
  fetchedAt: Date;
  itemData?: JsonRecord | null;
}

export interface AuctionSaleInput {
  id: string;
  auctionUuid: string;
  itemId?: string | null;
  itemVariantKey?: string;
  soldPrice: number;
  isBin?: boolean;
  soldAt: Date;
  saleData?: JsonRecord | null;
}

export interface ItemValuationInput {
  id: string;
  itemId: string;
  itemVariantKey?: string;
  estimatedValue: number;
  confidence: "low" | "medium" | "high";
  sampleCount?: number;
  methodologyVersion: string;
  factors?: JsonRecord | null;
  valuedAt: Date;
}

export interface ItemValuationRecord {
  id: string;
  itemId: string;
  itemVariantKey: string;
  estimatedValue: number;
  confidence: "low" | "medium" | "high";
  sampleCount: number;
  methodologyVersion: string;
  factors: JsonRecord | null;
  valuedAt: Date;
  createdAt: Date;
}

export interface EconomyRepository {
  upsertItem(input: ItemInput): Promise<void>;
  upsertBazaarProduct(input: BazaarProductInput): Promise<void>;
  recordBazaarSnapshot(input: BazaarSnapshotInput): Promise<void>;
  recordBazaarAggregate(input: BazaarAggregateInput): Promise<void>;
  getLatestBazaarSnapshot(productId: string): Promise<BazaarSnapshotRecord | null>;
  upsertAuctionListing(input: AuctionListingInput): Promise<void>;
  recordAuctionSale(input: AuctionSaleInput): Promise<void>;
  recordItemValuation(input: ItemValuationInput): Promise<void>;
  getLatestItemValuation(
    itemId: string,
    itemVariantKey?: string,
  ): Promise<ItemValuationRecord | null>;
}

export interface FeatureFlagResult {
  key: string;
  enabled: boolean;
  lifecycle: "production" | "experimental" | "deferred" | "retired";
  config: JsonRecord | null;
  source: "default" | "global" | "user" | "profile";
}

export interface FeatureOverrideInput {
  id: string;
  flagKey: string;
  scopeType: "global" | "user" | "profile";
  scopeKey: string;
  enabled: boolean;
  config?: JsonRecord | null;
  reason?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdByUserId?: string | null;
}

export interface FeatureRepository {
  upsertFlag(input: {
    key: string;
    description: string;
    defaultEnabled?: boolean;
    lifecycle?: "production" | "experimental" | "deferred" | "retired";
    defaultConfig?: JsonRecord | null;
  }): Promise<void>;
  resolveFlag(
    key: string,
    scopes?: { userId?: string; profileId?: string },
    at?: Date,
  ): Promise<FeatureFlagResult | null>;
  setOverride(input: FeatureOverrideInput): Promise<void>;
}

export interface CacheMetadataRepository {
  upsert(input: {
    id: string;
    namespace: string;
    cacheKey: string;
    providerKey?: string | null;
    state: "fresh" | "stale" | "refreshing" | "error";
    etag?: string | null;
    byteSize?: number | null;
    staleAt: Date;
    expiresAt: Date;
    lastRefreshAt?: Date | null;
    lastErrorCode?: string | null;
  }): Promise<void>;
  recordAccess(namespace: string, cacheKey: string, hit: boolean, at?: Date): Promise<void>;
}

export type JobRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface JobRepository {
  upsertJob(input: {
    id: string;
    name: string;
    queue?: string;
    isEnabled?: boolean;
    maxAttempts?: number;
    timeoutMs?: number;
    scheduleHint?: string | null;
    defaultPayload?: JsonRecord | null;
  }): Promise<void>;
  createRun(input: {
    id: string;
    jobId: string;
    payload?: JsonRecord | null;
    scheduler?: string | null;
    scheduledAt?: Date | null;
  }): Promise<void>;
  updateRun(
    runId: string,
    update: {
      status: JobRunStatus;
      startedAt?: Date | null;
      finishedAt?: Date | null;
      result?: JsonRecord | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ): Promise<void>;
}

export interface TelemetryRepository {
  recordAnalyticsEvent(input: {
    id: string;
    eventName: string;
    userId?: string | null;
    anonymousIdHash?: string | null;
    route?: string | null;
    properties?: JsonRecord | null;
    occurredAt: Date;
  }): Promise<void>;
  recordAdminAudit(input: {
    id: string;
    adminUserId?: string | null;
    action: string;
    outcome: "success" | "denied" | "failure";
    targetType?: string | null;
    targetId?: string | null;
    requestId?: string | null;
    ipHash?: string | null;
    details?: JsonRecord | null;
  }): Promise<void>;
  incrementApiMetric(input: {
    id: string;
    provider: string;
    endpoint: string;
    resolution: "minute" | "hour" | "day";
    windowStartedAt: Date;
    requestCount?: number;
    successCount?: number;
    errorCount?: number;
    rateLimitedCount?: number;
    cacheHitCount?: number;
    latencyTotalMs?: number;
    latencyMaxMs?: number;
    rateLimitRemaining?: number | null;
  }): Promise<void>;
  incrementAiMetric(input: {
    id: string;
    provider: string;
    model: string;
    category?: string;
    resolution: "hour" | "day";
    windowStartedAt: Date;
    requestCount?: number;
    failureCount?: number;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
    latencyTotalMs?: number;
    latencyMaxMs?: number;
  }): Promise<void>;
  recordError(input: {
    id: string;
    fingerprint: string;
    source: string;
    severity: "info" | "warning" | "error" | "critical";
    errorCode?: string | null;
    safeMessage: string;
    context?: JsonRecord | null;
    occurredAt: Date;
  }): Promise<void>;
}

export interface RepositoryProvider {
  identity: IdentityRepository;
  profiles: ProfileRepository;
  goals: GoalRepository;
  userContent: UserContentRepository;
  economy: EconomyRepository;
  cacheMetadata: CacheMetadataRepository;
  features: FeatureRepository;
  jobs: JobRepository;
  telemetry: TelemetryRepository;
}

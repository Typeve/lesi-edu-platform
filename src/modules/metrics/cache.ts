import type {
  AggregateByDimensionInput,
  DashboardDimensionAggregationResult,
  DashboardDimensionAggregationService,
  DashboardFilters
} from "./aggregation.js";
import type {
  DashboardTrendFunnelResult,
  DashboardTrendFunnelService,
  GetDashboardTrendFunnelInput
} from "./trend-funnel.js";

export type DashboardCacheInvalidationStrategy = "ttl" | "disabled";

export interface DashboardCacheConfig {
  ttlMs: number;
  invalidationStrategy: DashboardCacheInvalidationStrategy;
}

export interface DashboardCacheStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  clear(): void;
}

export interface CreateInMemoryDashboardCacheStoreInput {
  nowProvider?: () => number;
  maxEntries?: number;
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

interface NormalizedDashboardFilters {
  schoolId: number | null;
  collegeId: number | null;
  majorId: number | null;
  classId: number | null;
}

const normalizeFilters = (filters: DashboardFilters): NormalizedDashboardFilters => {
  return {
    schoolId: filters.schoolId ?? null,
    collegeId: filters.collegeId ?? null,
    majorId: filters.majorId ?? null,
    classId: filters.classId ?? null
  };
};

const toDimensionCacheKey = ({ dimension, filters }: AggregateByDimensionInput): string => {
  return JSON.stringify({
    scope: "dashboard-dimension",
    dimension,
    filters: normalizeFilters(filters)
  });
};

const toTrendFunnelCacheKey = ({
  filters,
  startDate,
  endDate
}: GetDashboardTrendFunnelInput): string => {
  return JSON.stringify({
    scope: "dashboard-trend-funnel",
    filters: normalizeFilters(filters),
    startDate: startDate ?? null,
    endDate: endDate ?? null
  });
};

export const createInMemoryDashboardCacheStore = ({
  nowProvider = () => Date.now(),
  maxEntries = 1000
}: CreateInMemoryDashboardCacheStoreInput = {}): DashboardCacheStore => {
  const store = new Map<string, CacheEntry>();

  const removeExpired = (key: string, entry: CacheEntry): boolean => {
    if (entry.expiresAt > nowProvider()) {
      return false;
    }

    store.delete(key);
    return true;
  };

  const evictIfNeeded = (): void => {
    if (store.size < maxEntries) {
      return;
    }

    const firstKey = store.keys().next().value;
    if (typeof firstKey === "string") {
      store.delete(firstKey);
    }
  };

  return {
    get<T>(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) {
        return undefined;
      }

      if (removeExpired(key, entry)) {
        return undefined;
      }

      return entry.value as T;
    },
    set<T>(key: string, value: T, ttlMs: number): void {
      if (ttlMs <= 0) {
        store.delete(key);
        return;
      }

      evictIfNeeded();
      store.set(key, {
        value,
        expiresAt: nowProvider() + ttlMs
      });
    },
    clear(): void {
      store.clear();
    }
  };
};

export interface CreateCachedDashboardDimensionAggregationServiceInput {
  dashboardDimensionAggregationService: Pick<
    DashboardDimensionAggregationService,
    "aggregateByDimension"
  >;
  cacheStore: DashboardCacheStore;
  cacheConfig: DashboardCacheConfig;
}

export const createCachedDashboardDimensionAggregationService = ({
  dashboardDimensionAggregationService,
  cacheStore,
  cacheConfig
}: CreateCachedDashboardDimensionAggregationServiceInput): Pick<
  DashboardDimensionAggregationService,
  "aggregateByDimension"
> => {
  return {
    async aggregateByDimension(
      input: AggregateByDimensionInput
    ): Promise<DashboardDimensionAggregationResult> {
      if (cacheConfig.invalidationStrategy === "disabled") {
        return dashboardDimensionAggregationService.aggregateByDimension(input);
      }

      const cacheKey = toDimensionCacheKey(input);
      const cached = cacheStore.get<DashboardDimensionAggregationResult>(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await dashboardDimensionAggregationService.aggregateByDimension(input);
      cacheStore.set(cacheKey, result, cacheConfig.ttlMs);
      return result;
    }
  };
};

export interface CreateCachedDashboardTrendFunnelServiceInput {
  dashboardTrendFunnelService: Pick<DashboardTrendFunnelService, "getTrendAndFunnel">;
  cacheStore: DashboardCacheStore;
  cacheConfig: DashboardCacheConfig;
}

export const createCachedDashboardTrendFunnelService = ({
  dashboardTrendFunnelService,
  cacheStore,
  cacheConfig
}: CreateCachedDashboardTrendFunnelServiceInput): Pick<
  DashboardTrendFunnelService,
  "getTrendAndFunnel"
> => {
  return {
    async getTrendAndFunnel(input: GetDashboardTrendFunnelInput): Promise<DashboardTrendFunnelResult> {
      if (cacheConfig.invalidationStrategy === "disabled") {
        return dashboardTrendFunnelService.getTrendAndFunnel(input);
      }

      const cacheKey = toTrendFunnelCacheKey(input);
      const cached = cacheStore.get<DashboardTrendFunnelResult>(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await dashboardTrendFunnelService.getTrendAndFunnel(input);
      cacheStore.set(cacheKey, result, cacheConfig.ttlMs);
      return result;
    }
  };
};

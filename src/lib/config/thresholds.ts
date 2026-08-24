/**
 * Range and rebalance thresholds. Defaults live here; per-user overrides are
 * persisted on `UserSettings` and merged at read time.
 *
 * "Within N% of the edge" means N% of the remaining distance across the range,
 * measured in tick space — not N% of the price. Ticks are linear in log-price,
 * so this behaves correctly near both edges of a wide range.
 */
export interface RangeThresholds {
  /** Above this distance-to-edge (% of range) the position is IN_RANGE_SAFE. */
  safeEdgePercent: number
  /** At or below this, the position is NEAR_LOWER / NEAR_UPPER. */
  nearEdgePercent: number
  /** At or below this, rebalancing becomes urgent. */
  criticalEdgePercent: number
}

export interface RebalanceThresholds {
  /**
   * Below this position size, gas dominates any yield improvement and the
   * engine recommends EXIT_REVIEW rather than REBALANCE.
   */
  minPositionSizeUsd: number
  /** Recommendation is downgraded if estimated cost exceeds this share of 30d fees. */
  maxCostToFeeRatio: number
  /** A position out of range for longer than this is flagged regardless of size. */
  outOfRangeGraceHours: number
}

export interface FeeThresholds {
  /** Windows (days) for which fee APR is computed. */
  aprWindowsDays: number[]
}

export interface AppThresholds {
  range: RangeThresholds
  rebalance: RebalanceThresholds
  fees: FeeThresholds
  /** Minutes between position snapshots for active positions. */
  snapshotIntervalMinutes: number
}

export const DEFAULT_THRESHOLDS: AppThresholds = {
  range: {
    safeEdgePercent: 20,
    nearEdgePercent: 15,
    criticalEdgePercent: 5,
  },
  rebalance: {
    minPositionSizeUsd: 500,
    maxCostToFeeRatio: 1,
    outOfRangeGraceHours: 24,
  },
  fees: {
    aprWindowsDays: [1, 7, 30, 90],
  },
  snapshotIntervalMinutes: 15,
}

export function mergeThresholds(overrides: Partial<{
  safeEdgePercent: number
  nearEdgePercent: number
  criticalEdgePercent: number
  minPositionSizeUsd: number
  snapshotIntervalMinutes: number
}>): AppThresholds {
  return {
    ...DEFAULT_THRESHOLDS,
    range: {
      safeEdgePercent: overrides.safeEdgePercent ?? DEFAULT_THRESHOLDS.range.safeEdgePercent,
      nearEdgePercent: overrides.nearEdgePercent ?? DEFAULT_THRESHOLDS.range.nearEdgePercent,
      criticalEdgePercent:
        overrides.criticalEdgePercent ?? DEFAULT_THRESHOLDS.range.criticalEdgePercent,
    },
    rebalance: {
      ...DEFAULT_THRESHOLDS.rebalance,
      minPositionSizeUsd:
        overrides.minPositionSizeUsd ?? DEFAULT_THRESHOLDS.rebalance.minPositionSizeUsd,
    },
    snapshotIntervalMinutes:
      overrides.snapshotIntervalMinutes ?? DEFAULT_THRESHOLDS.snapshotIntervalMinutes,
  }
}

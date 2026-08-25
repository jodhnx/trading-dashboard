import { isFiniteNumber, mean } from "../utils/math";
import { VOLUME_THRESHOLDS } from "../technical/thresholds";

export const VOLUME_TRENDS = [
  "INCREASING",
  "DECREASING",
  "NEUTRAL",
  "UNKNOWN",
] as const;
export type VolumeTrend = (typeof VOLUME_TRENDS)[number];

export type VolumeMetrics = {
  currentVolume: number | null;
  averageVolume20: number | null;
  volumeRatio: number | null;
  volumeTrend: VolumeTrend;
};

/**
 * Volume metrics from the trailing bars.
 *
 * averageVolume20: arithmetic mean of the last 20 finite volumes. Null if fewer
 * than 20 finite volumes are available. Never filled with zeros.
 *
 * volumeRatio: currentVolume / averageVolume20. Null if either side is null or
 * averageVolume20 === 0.
 *
 * volumeTrend (last 5 vs prior 5 finite volumes, relative change vs 10%):
 * - fewer than 10 finite volumes → UNKNOWN
 * - priorAvg === 0 and recentAvg === 0 → NEUTRAL
 * - priorAvg === 0 and recentAvg > 0 → INCREASING
 * - (recent − prior) / prior > 0.10 → INCREASING
 * - (recent − prior) / prior < −0.10 → DECREASING
 * - otherwise → NEUTRAL
 */
export function analyzeVolume(
  volumes: readonly (number | null)[],
  averagePeriod: number = VOLUME_THRESHOLDS.averagePeriod,
  trendWindow: number = VOLUME_THRESHOLDS.trendWindow,
  trendRelative: number = VOLUME_THRESHOLDS.trendRelative,
): VolumeMetrics {
  const finite = volumes.filter(isFiniteNumber);
  const currentVolume =
    finite.length > 0 ? (finite[finite.length - 1] ?? null) : null;

  let averageVolume20: number | null = null;
  if (finite.length >= averagePeriod) {
    averageVolume20 = mean(finite.slice(-averagePeriod));
  }

  let volumeRatio: number | null = null;
  if (
    currentVolume !== null &&
    averageVolume20 !== null &&
    averageVolume20 !== 0
  ) {
    volumeRatio = currentVolume / averageVolume20;
  }

  return {
    currentVolume,
    averageVolume20,
    volumeRatio,
    volumeTrend: classifyVolumeTrend(finite, trendWindow, trendRelative),
  };
}

export function classifyVolumeTrend(
  finiteVolumes: readonly number[],
  trendWindow: number = VOLUME_THRESHOLDS.trendWindow,
  trendRelative: number = VOLUME_THRESHOLDS.trendRelative,
): VolumeTrend {
  if (finiteVolumes.length < trendWindow * 2) {
    return "UNKNOWN";
  }
  const recent = mean(finiteVolumes.slice(-trendWindow));
  const prior = mean(
    finiteVolumes.slice(-trendWindow * 2, -trendWindow),
  );
  if (recent === null || prior === null) {
    return "UNKNOWN";
  }
  if (prior === 0 && recent === 0) {
    return "NEUTRAL";
  }
  if (prior === 0 && recent > 0) {
    return "INCREASING";
  }
  const relative = (recent - prior) / prior;
  if (relative > trendRelative) {
    return "INCREASING";
  }
  if (relative < -trendRelative) {
    return "DECREASING";
  }
  return "NEUTRAL";
}

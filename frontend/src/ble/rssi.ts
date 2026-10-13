import { AggregatedRSSI, RSSIReading } from './types';

export const DEFAULT_MIN_RSSI_SAMPLES = 3;
export const DEFAULT_RSSI_THRESHOLD = -75; // dBm

/**
 * Robust median calculation with outlier rejection.
 * Ignores readings outside the plausible physical range (-100 dBm to -20 dBm).
 */
export function aggregateRSSI(
  readings: RSSIReading[],
  minSamples: number = DEFAULT_MIN_RSSI_SAMPLES
): AggregatedRSSI | null {
  // Filter plausible BLE RSSI readings
  const plausible = readings
    .map((r) => r.value)
    .filter((val) => val >= -100 && val <= -20);

  if (plausible.length < minSamples) {
    return null;
  }

  const sorted = [...plausible].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  return {
    median,
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    samples: sorted,
  };
}

/**
 * Checks whether an aggregated RSSI reading meets the proximity threshold.
 */
export function isWithinProximity(
  aggregated: AggregatedRSSI | null,
  threshold: number = DEFAULT_RSSI_THRESHOLD
): boolean {
  if (!aggregated) {
    return false;
  }
  return aggregated.median >= threshold;
}

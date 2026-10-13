import { test } from 'node:test';
import assert from 'node:assert';
import { aggregateRSSI, isWithinProximity } from '../src/ble/rssi';
import { RSSIReading } from '../src/ble/types';

test('aggregateRSSI returns null if fewer than minSamples plausible readings', () => {
  const readings: RSSIReading[] = [
    { value: -65, timestamp: 1 },
    { value: -70, timestamp: 2 },
  ];
  assert.strictEqual(aggregateRSSI(readings, 3), null);
});

test('aggregateRSSI filters out unrealistic outliers (< -100 or > -20 dBm)', () => {
  const readings: RSSIReading[] = [
    { value: -120, timestamp: 1 }, // impossible weak outlier
    { value: -10, timestamp: 2 },  // impossible strong outlier
    { value: -68, timestamp: 3 },
    { value: -72, timestamp: 4 },
    { value: -70, timestamp: 5 },
  ];
  const agg = aggregateRSSI(readings, 3);
  assert.notStrictEqual(agg, null);
  assert.strictEqual(agg?.count, 3);
  assert.strictEqual(agg?.median, -70);
});

test('aggregateRSSI computes odd and even median correctly', () => {
  // Odd count: 5 readings -> [-80, -75, -70, -65, -60] -> median -70
  const oddReadings: RSSIReading[] = [
    { value: -80, timestamp: 1 },
    { value: -75, timestamp: 2 },
    { value: -70, timestamp: 3 },
    { value: -65, timestamp: 4 },
    { value: -60, timestamp: 5 },
  ];
  const oddAgg = aggregateRSSI(oddReadings, 3);
  assert.strictEqual(oddAgg?.median, -70);

  // Even count: 4 readings -> [-80, -74, -70, -66] -> median (-74 + -70)/2 = -72
  const evenReadings: RSSIReading[] = [
    { value: -80, timestamp: 1 },
    { value: -74, timestamp: 2 },
    { value: -70, timestamp: 3 },
    { value: -66, timestamp: 4 },
  ];
  const evenAgg = aggregateRSSI(evenReadings, 3);
  assert.strictEqual(evenAgg?.median, -72);
});

test('isWithinProximity enforces configurable threshold', () => {
  const passAgg = aggregateRSSI(
    [
      { value: -65, timestamp: 1 },
      { value: -70, timestamp: 2 },
      { value: -68, timestamp: 3 },
    ],
    3
  );
  assert.strictEqual(isWithinProximity(passAgg, -75), true);

  const failAgg = aggregateRSSI(
    [
      { value: -85, timestamp: 1 },
      { value: -80, timestamp: 2 },
      { value: -78, timestamp: 3 },
    ],
    3
  );
  assert.strictEqual(isWithinProximity(failAgg, -75), false);
  // Edge boundary: exactly -75 dBm satisfies >= -75 dBm
  const boundaryAgg = aggregateRSSI(
    [
      { value: -75, timestamp: 1 },
      { value: -75, timestamp: 2 },
      { value: -75, timestamp: 3 },
    ],
    3
  );
  assert.strictEqual(isWithinProximity(boundaryAgg, -75), true);
});

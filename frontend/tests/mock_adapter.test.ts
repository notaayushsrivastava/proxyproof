import { test } from 'node:test';
import assert from 'node:assert';
import { MockBeaconAdapter } from '../src/ble/mock-adapter';
import { DiscoveredBeacon, AdapterState } from '../src/ble/types';

test('MockBeaconAdapter manages advertising lifecycle', async () => {
  const adapter = new MockBeaconAdapter();
  assert.strictEqual(adapter.getState(), 'ready');

  const started = await adapter.startAdvertising('session-uuid-1', 'secret-key-1');
  assert.strictEqual(started, true);
  assert.strictEqual(adapter.getState(), 'advertising');

  const stopped = await adapter.stopAdvertising();
  assert.strictEqual(stopped, true);
  assert.strictEqual(adapter.getState(), 'ready');
});

test('MockBeaconAdapter manages scanning lifecycle and emits beacons', async () => {
  const adapter = new MockBeaconAdapter();
  adapter.simulatedRSSI = -65;

  const discovered: DiscoveredBeacon[] = [];
  const unsubscribe = adapter.onBeaconDiscovered((beacon) => {
    discovered.push(beacon);
  });

  const started = await adapter.startScanning();
  assert.strictEqual(started, true);
  assert.strictEqual(adapter.getState(), 'scanning');

  // Wait for simulated beacon emission (interval is 1500ms)
  await new Promise((resolve) => setTimeout(resolve, 2200));

  assert.ok(discovered.length >= 1, `Expected at least 1 beacon, got ${discovered.length}`);
  const b = discovered[0];
  assert.ok(b.sessionId.length > 0);
  assert.strictEqual(b.proof.length, 32);
  assert.strictEqual(b.protocolVersion, 1);
  assert.ok(b.rssi <= -20 && b.rssi >= -100);

  unsubscribe();
  await adapter.stopScanning();
  assert.strictEqual(adapter.getState(), 'ready');
});

test('MockBeaconAdapter reports state changes and errors correctly', async () => {
  const adapter = new MockBeaconAdapter();
  const states: AdapterState[] = [];
  adapter.onStateChanged((s) => states.push(s));

  adapter.setSimulatedState('powered_off');
  assert.strictEqual(adapter.getState(), 'powered_off');

  // Starting scan while powered off should fail
  let errorMsg = '';
  adapter.onError((err) => {
    errorMsg = err;
  });

  const scanResult = await adapter.startScanning();
  assert.strictEqual(scanResult, false);
  assert.ok(errorMsg.includes('Bluetooth not available'));
});

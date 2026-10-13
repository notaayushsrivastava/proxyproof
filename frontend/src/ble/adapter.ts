import { BeaconAdapter } from './types';
import { MockBeaconAdapter } from './mock-adapter';

// Singleton instance
let adapterInstance: BeaconAdapter | null = null;

export function getBeaconAdapter(): BeaconAdapter {
  if (!adapterInstance) {
    // In dev / test or environments without custom native modules, default to MockBeaconAdapter
    adapterInstance = new MockBeaconAdapter();
  }
  return adapterInstance;
}

export function setBeaconAdapter(customAdapter: BeaconAdapter): void {
  adapterInstance = customAdapter;
}

export * from './types';
export * from './proof';
export * from './rssi';
export * from './mock-adapter';

export type AdapterState =
  | 'unsupported'
  | 'powered_off'
  | 'unauthorized'
  | 'ready'
  | 'advertising'
  | 'scanning'
  | 'error';

export interface DiscoveredBeacon {
  sessionId: string;
  timeSlot: number;
  proof: string;
  protocolVersion: number;
  rssi: number;
  timestamp: number;
}

export interface RSSIReading {
  value: number;
  timestamp: number;
}

export interface AggregatedRSSI {
  median: number;
  count: number;
  min: number;
  max: number;
  samples: number[];
}

export interface BeaconPayload {
  sessionId: string;
  timeSlot: number;
  proof: string;
  protocolVersion: number;
}

export interface BeaconAdapter {
  initialize(): Promise<AdapterState>;
  getState(): AdapterState;
  startAdvertising(sessionId: string, sessionSecret: string): Promise<boolean>;
  stopAdvertising(): Promise<boolean>;
  startScanning(serviceUuid?: string): Promise<boolean>;
  stopScanning(): Promise<boolean>;
  onBeaconDiscovered(callback: (beacon: DiscoveredBeacon) => void): () => void;
  onStateChanged(callback: (state: AdapterState) => void): () => void;
  onError(callback: (error: string) => void): () => void;
}

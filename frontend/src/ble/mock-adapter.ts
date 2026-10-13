import {
  AdapterState,
  BeaconAdapter,
  DiscoveredBeacon,
} from './types';
import {
  calculateTimeSlot,
  DEFAULT_PROOF_VALIDITY_SECONDS,
  generateProof,
  PROTOCOL_VERSION,
} from './proof';

/**
 * Mock Beacon Adapter for development builds, automated testing,
 * and environments without physical BLE hardware or during UI dev.
 */
export class MockBeaconAdapter implements BeaconAdapter {
  private state: AdapterState = 'ready';
  private advertisingSessionId: string | null = null;
  private advertisingSecret: string | null = null;
  private rotationTimer: ReturnType<typeof setInterval> | null = null;
  private scanTimer: ReturnType<typeof setInterval> | null = null;

  private beaconListeners = new Set<(beacon: DiscoveredBeacon) => void>();
  private stateListeners = new Set<(state: AdapterState) => void>();
  private errorListeners = new Set<(error: string) => void>();

  // Configurable simulation parameters
  public simulatedRSSI = -68;
  public simulatedRSSIJitter = 4; // +/- 4 dBm noise
  public simulatedSlotLag = 0; // Simulate clock drift if needed

  async initialize(): Promise<AdapterState> {
    this.updateState('ready');
    return this.state;
  }

  getState(): AdapterState {
    return this.state;
  }

  async startAdvertising(
    sessionId: string,
    sessionSecret: string
  ): Promise<boolean> {
    if (this.state === 'powered_off' || this.state === 'unauthorized') {
      this.emitError('Bluetooth not available or unauthorized');
      return false;
    }

    this.advertisingSessionId = sessionId;
    this.advertisingSecret = sessionSecret;
    this.updateState('advertising');

    // Rotate proof every 5 seconds
    this.rotationTimer = setInterval(async () => {
      if (this.advertisingSessionId && this.advertisingSecret) {
        const slot = calculateTimeSlot();
        await generateProof(
          this.advertisingSecret,
          this.advertisingSessionId,
          slot
        );
      }
    }, DEFAULT_PROOF_VALIDITY_SECONDS * 1000);

    return true;
  }

  async stopAdvertising(): Promise<boolean> {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
    this.advertisingSessionId = null;
    this.advertisingSecret = null;
    this.updateState('ready');
    return true;
  }

  async startScanning(_serviceUuid?: string): Promise<boolean> {
    if (this.state === 'powered_off' || this.state === 'unauthorized') {
      this.emitError('Bluetooth not available or unauthorized');
      return false;
    }

    this.updateState('scanning');

    // Simulate discovering an active organizer beacon every 1.5 seconds
    this.scanTimer = setInterval(async () => {
      if (this.state !== 'scanning') return;

      // If an organizer session is currently active in this mock instance, or mock session
      const targetSessionId =
        this.advertisingSessionId || 'd3b07384-d113-467a-9a91-4cf1534b12aa';
      const targetSecret =
        this.advertisingSecret || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const slot = calculateTimeSlot() + this.simulatedSlotLag;
      const proof = await generateProof(
        targetSecret,
        targetSessionId,
        slot
      );

      // Add Gaussian/jitter to simulated RSSI
      const jitter =
        (Math.random() * 2 - 1) * this.simulatedRSSIJitter;
      const rssi = Math.round(this.simulatedRSSI + jitter);

      const beacon: DiscoveredBeacon = {
        sessionId: targetSessionId,
        timeSlot: slot,
        proof,
        protocolVersion: PROTOCOL_VERSION,
        rssi,
        timestamp: Date.now(),
      };

      this.beaconListeners.forEach((listener) => listener(beacon));
    }, 1500);

    return true;
  }

  async stopScanning(): Promise<boolean> {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    this.updateState('ready');
    return true;
  }

  onBeaconDiscovered(
    callback: (beacon: DiscoveredBeacon) => void
  ): () => void {
    this.beaconListeners.add(callback);
    return () => this.beaconListeners.delete(callback);
  }

  onStateChanged(callback: (state: AdapterState) => void): () => void {
    this.stateListeners.add(callback);
    callback(this.state);
    return () => this.stateListeners.delete(callback);
  }

  onError(callback: (error: string) => void): () => void {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }

  // Test helpers for simulating error/edge cases
  public setSimulatedState(state: AdapterState) {
    this.updateState(state);
  }

  private updateState(newState: AdapterState) {
    this.state = newState;
    this.stateListeners.forEach((listener) => listener(this.state));
  }

  private emitError(message: string) {
    this.errorListeners.forEach((listener) => listener(message));
  }
}

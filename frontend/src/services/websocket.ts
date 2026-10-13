import { getDefaultBaseUrl, getAuthToken } from './api';

export interface WebSocketEvent<T = unknown> {
  type: 'attendance.marked' | 'attendance.corrected' | 'session.closed';
  data: T;
}

export class SessionWebSocketClient {
  private sessionId: string;
  private ws: WebSocket | null = null;
  private isIntentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(event: WebSocketEvent) => void>();
  private statusListeners = new Set<(isConnected: boolean) => void>();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async connect(): Promise<void> {
    this.isIntentionalClose = false;
    const token = await getAuthToken();
    const httpBase = getDefaultBaseUrl();
    const wsBase = httpBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    const url = `${wsBase}/ws/sessions/${this.sessionId}?token=${token || ''}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emitStatus(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as WebSocketEvent;
          this.listeners.forEach((listener) => listener(parsed));
        } catch (err) {
          console.warn('Failed to parse WS event payload:', err);
        }
      };

      this.ws.onclose = () => {
        this.emitStatus(false);
        if (!this.isIntentionalClose) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.emitStatus(false);
      };
    } catch {
      this.emitStatus(false);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isIntentionalClose) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    this.isIntentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emitStatus(false);
  }

  onEvent(callback: (event: WebSocketEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onStatusChange(callback: (isConnected: boolean) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  private emitStatus(connected: boolean) {
    this.statusListeners.forEach((listener) => listener(connected));
  }
}

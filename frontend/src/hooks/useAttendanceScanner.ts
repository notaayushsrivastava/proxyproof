import { useState, useEffect, useRef, useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import {
  getBeaconAdapter,
  DiscoveredBeacon,
  aggregateRSSI,
  isWithinProximity,
  AdapterState,
  RSSIReading,
} from '../ble';
import { api, ApiError } from '../services/api';
import { AttendanceSubmissionPayload } from '../types/api';

export type ScannerStatus =
  | 'Ready'
  | 'Scanning'
  | 'Session detected'
  | 'Verifying'
  | 'Marked present'
  | 'Already marked'
  | 'Not enrolled'
  | 'Device approval pending'
  | 'Unable to verify'
  | 'Bluetooth off'
  | 'Permission needed';

export interface UseAttendanceScannerReturn {
  status: ScannerStatus;
  isScanning: boolean;
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  currentRSSI: number | null;
  samplesCount: number;
  detectedSessionId: string | null;
  errorMessage: string | null;
  lastMarked: { sessionId: string; markedAt: string; message: string } | null;
  resetState: () => void;
}

export function useAttendanceScanner(): UseAttendanceScannerReturn {
  const [status, setStatus] = useState<ScannerStatus>('Ready');
  const [isScanning, setIsScanning] = useState(false);
  const [currentRSSI, setCurrentRSSI] = useState<number | null>(null);
  const [samplesCount, setSamplesCount] = useState<number>(0);
  const [detectedSessionId, setDetectedSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastMarked, setLastMarked] = useState<{
    sessionId: string;
    markedAt: string;
    message: string;
  } | null>(null);

  const rssiBufferRef = useRef<Map<string, RSSIReading[]>>(new Map());
  const isSubmittingRef = useRef<boolean>(false);
  const adapter = getBeaconAdapter();

  const stopScanning = useCallback(async () => {
    try {
      await adapter.stopScanning();
    } catch (err) {
      console.warn('Error stopping scanner:', err);
    } finally {
      setIsScanning(false);
      if (
        status !== 'Marked present' &&
        status !== 'Already marked' &&
        status !== 'Not enrolled' &&
        status !== 'Device approval pending'
      ) {
        setStatus('Ready');
      }
    }
  }, [adapter, status]);

  const resetState = useCallback(() => {
    rssiBufferRef.current.clear();
    isSubmittingRef.current = false;
    setErrorMessage(null);
    setCurrentRSSI(null);
    setSamplesCount(0);
    setDetectedSessionId(null);
    setStatus('Ready');
  }, []);

  const handleBeaconDiscovered = useCallback(
    async (beacon: DiscoveredBeacon) => {
      if (isSubmittingRef.current) return;

      setDetectedSessionId(beacon.sessionId);
      setCurrentRSSI(beacon.rssi);

      // Buffer RSSI readings
      const currentBuffer = rssiBufferRef.current.get(beacon.sessionId) || [];
      currentBuffer.push({ value: beacon.rssi, timestamp: Date.now() });
      // Keep last 10 readings
      if (currentBuffer.length > 10) currentBuffer.shift();
      rssiBufferRef.current.set(beacon.sessionId, currentBuffer);
      setSamplesCount(currentBuffer.length);

      setStatus('Session detected');

      // Check proximity policy: at least 3 samples, median >= -75 dBm
      const agg = aggregateRSSI(currentBuffer, 3);
      if (agg) {
        if (!isWithinProximity(agg, -75)) {
          // Below threshold
          setStatus('Unable to verify');
          setErrorMessage(
            `Signal too weak (${agg.median} dBm). Move closer to the organizer.`
          );
          return;
        }

        // We have enough samples and proximity is satisfied!
        isSubmittingRef.current = true;
        setStatus('Verifying');

        try {
          const payload: AttendanceSubmissionPayload = {
            proof: beacon.proof,
            time_slot: beacon.timeSlot,
            protocol_version: beacon.protocolVersion,
            rssi_median: agg.median,
            rssi_samples: agg.samples,
            rssi_samples_count: agg.count,
            request_id: Crypto.randomUUID(),
            client_request_id: Crypto.randomUUID(),
          };

          const res = await api.submitAttendanceAttempt(
            beacon.sessionId,
            payload
          );

          const isAlready =
            res.outcome_code === 'ALREADY_MARKED' ||
            res.status === 'already_marked';

          if (isAlready) {
            setStatus('Already marked');
            setLastMarked({
              sessionId: beacon.sessionId,
              markedAt: res.marked_at || new Date().toISOString(),
              message: res.message,
            });
          } else {
            setStatus('Marked present');
            setLastMarked({
              sessionId: beacon.sessionId,
              markedAt: res.marked_at || new Date().toISOString(),
              message: res.message,
            });
          }

          // Stop scanning once verified
          await adapter.stopScanning();
          setIsScanning(false);
        } catch (err: unknown) {
          const apiErr = err as ApiError;
          const data = apiErr?.data as { detail?: { outcome_code?: string; message?: string } } | undefined;
          const outcomeCode = data?.detail?.outcome_code || '';
          const msg = apiErr?.message || 'Attendance verification failed';

          if (outcomeCode === 'NO_ACTIVE_DEVICE' || (apiErr?.status === 403 && msg.toLowerCase().includes('device'))) {
            setStatus('Device approval pending');
          } else if (outcomeCode === 'NOT_ENROLLED' || (apiErr?.status === 403 && msg.toLowerCase().includes('enrolled'))) {
            setStatus('Not enrolled');
          } else if (outcomeCode === 'ALREADY_MARKED' || msg.toLowerCase().includes('already marked')) {
            setStatus('Already marked');
          } else if (outcomeCode === 'SESSION_NOT_FOUND' || outcomeCode === 'SESSION_CLOSED' || outcomeCode === 'SESSION_EXPIRED') {
            setStatus('Unable to verify');
          } else {
            setStatus('Unable to verify');
          }
          setErrorMessage(msg);
        } finally {
          isSubmittingRef.current = false;
        }
      }
    },
    [adapter]
  );

  const startScanning = useCallback(async () => {
    resetState();
    const adapterState = adapter.getState();

    if (adapterState === 'powered_off') {
      setStatus('Bluetooth off');
      setErrorMessage('Please turn on Bluetooth to mark attendance.');
      return;
    }
    if (adapterState === 'unauthorized') {
      setStatus('Permission needed');
      setErrorMessage('Bluetooth permissions are required for attendance scanning.');
      return;
    }

    setStatus('Scanning');
    setIsScanning(true);

    try {
      await adapter.startScanning();
    } catch (err) {
      console.warn('Failed to start scanning:', err);
      setStatus('Unable to verify');
      setErrorMessage('Could not initialize BLE scanner.');
      setIsScanning(false);
    }
  }, [adapter, resetState]);

  useEffect(() => {
    const unsubBeacon = adapter.onBeaconDiscovered(handleBeaconDiscovered);
    const unsubState = adapter.onStateChanged((state: AdapterState) => {
      if (state === 'powered_off') {
        setStatus('Bluetooth off');
        setIsScanning(false);
      } else if (state === 'unauthorized') {
        setStatus('Permission needed');
        setIsScanning(false);
      }
    });

    return () => {
      unsubBeacon();
      unsubState();
      adapter.stopScanning().catch(() => {});
    };
  }, [adapter, handleBeaconDiscovered]);

  return {
    status,
    isScanning,
    startScanning,
    stopScanning,
    currentRSSI,
    samplesCount,
    detectedSessionId,
    errorMessage,
    lastMarked,
    resetState,
  };
}

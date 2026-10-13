import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAttendanceScanner, ScannerStatus } from '../hooks/useAttendanceScanner';
import { api } from '../services/api';
import { SessionItem, StudentAttendanceSummary } from '../types/api';

const STATUS_CONFIG: Record<
  ScannerStatus,
  { bg: string; border: string; text: string; icon: string }
> = {
  Ready: { bg: '#f3f4f6', border: '#d1d5db', text: '#374151', icon: '⏸️' },
  Scanning: { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8', icon: '📡' },
  'Session detected': { bg: '#fef3c7', border: '#fcd34d', text: '#b45309', icon: '🎯' },
  Verifying: { bg: '#fff7ed', border: '#fdba74', text: '#c2410c', icon: '🔐' },
  'Marked present': { bg: '#f0fdf4', border: '#86efac', text: '#15803d', icon: '✅' },
  'Already marked': { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857', icon: 'ℹ️' },
  'Not enrolled': { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c', icon: '🚫' },
  'Device approval pending': { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c', icon: '📱' },
  'Unable to verify': { bg: '#fff1f2', border: '#fda4af', text: '#be123c', icon: '⚠️' },
  'Bluetooth off': { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c', icon: '📶' },
  'Permission needed': { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c', icon: '🔒' },
};

export function StudentHomeView() {
  const {
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
  } = useAttendanceScanner();

  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [activeSessions, setActiveSessions] = useState<SessionItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  const loadStudentData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [sum, active] = await Promise.all([
        api.getMyAttendanceSummary().catch(() => null),
        api.getActiveSessions().catch(() => []),
      ]);
      if (sum) setSummary(sum);
      setActiveSessions(active);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.getMyAttendanceSummary().catch(() => null),
      api.getActiveSessions().catch(() => []),
    ]).then(([sum, active]) => {
      if (!isMounted) return;
      if (sum) setSummary(sum);
      setActiveSessions(active);
      setIsLoadingData(false);
    });
    return () => {
      isMounted = false;
    };
  }, [status]);

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Ready;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Attendance Scanner Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Automatic BLE Attendance</Text>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Text style={styles.statusIcon}>{cfg.icon}</Text>
            <Text style={[styles.statusText, { color: cfg.text }]}>{status}</Text>
          </View>
        </View>

        <Text style={styles.cardDesc}>
          Keep Bluetooth active and app foregrounded. ProxyProof listens for rotating beacons
          and submits cryptographically signed proof automatically.
        </Text>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {lastMarked && (
          <View style={styles.successBanner}>
            <Text style={styles.successTitle}>Attendance Recorded!</Text>
            <Text style={styles.successDetail}>{lastMarked.message}</Text>
            <Text style={styles.successTime}>
              Timestamp: {new Date(lastMarked.markedAt).toLocaleTimeString()}
            </Text>
          </View>
        )}

        {/* Live Diagnostics */}
        <View style={styles.diagnosticsBox}>
          <Text style={styles.diagTitle}>DIAGNOSTICS & TELEMETRY</Text>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Observed RSSI:</Text>
            <Text style={styles.diagValue}>
              {currentRSSI !== null ? `${currentRSSI} dBm` : 'None'}
            </Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Samples Collected:</Text>
            <Text style={styles.diagValue}>{samplesCount} / 3 needed</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Proximity Threshold:</Text>
            <Text style={styles.diagValue}>&ge; -75 dBm</Text>
          </View>
          {detectedSessionId && (
            <View style={styles.diagRow}>
              <Text style={styles.diagLabel}>Session ID:</Text>
              <Text style={styles.diagCode} numberOfLines={1}>
                {detectedSessionId.slice(0, 8)}...
              </Text>
            </View>
          )}
        </View>

        {/* Action Controls */}
        <View style={styles.actionsRow}>
          {isScanning ? (
            <Pressable
              style={({ pressed }) => [styles.stopBtn, pressed && styles.btnPressed]}
              onPress={stopScanning}
            >
              <Text style={styles.stopBtnText}>Stop Scanning</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.scanBtn, pressed && styles.btnPressed]}
              onPress={startScanning}
            >
              <Text style={styles.scanBtnText}>Scan for Session</Text>
            </Pressable>
          )}

          {status !== 'Ready' && (
            <Pressable style={styles.resetBtn} onPress={resetState}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Active Class Sessions Nearby Banner */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Active Campus Sessions</Text>
          <Pressable onPress={loadStudentData}>
            <Text style={styles.refreshLink}>Refresh</Text>
          </Pressable>
        </View>

        {isLoadingData ? (
          <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 12 }} />
        ) : activeSessions.length === 0 ? (
          <Text style={styles.emptyText}>No active attendance sessions for your classes right now.</Text>
        ) : (
          activeSessions.map((s) => (
            <View key={s.id} style={styles.sessionItem}>
              <View>
                <Text style={styles.sessionClass}>{s.class_name || 'Enrolled Class'}</Text>
                <Text style={styles.sessionCode}>{s.class_code || 'CODE'}</Text>
                <Text style={styles.sessionTiming}>
                  Ends at: {new Date(s.ends_at).toLocaleTimeString()}
                </Text>
              </View>
              <View style={styles.liveIndicator}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Attendance Summary Card */}
      {summary && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Overall Attendance</Text>
          <View style={styles.summaryStats}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{summary.overall_percentage}%</Text>
              <Text style={styles.statLabel}>Presence Rate</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{summary.attended_sessions}</Text>
              <Text style={styles.statLabel}>Attended</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{summary.total_eligible_sessions}</Text>
              <Text style={styles.statLabel}>Total Eligible</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
    gap: 16,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  statusIcon: {
    fontSize: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
  },
  successBanner: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803d',
    marginBottom: 2,
  },
  successDetail: {
    fontSize: 12,
    color: '#166534',
  },
  successTime: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 4,
  },
  diagnosticsBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    gap: 6,
  },
  diagTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagLabel: {
    fontSize: 12,
    color: '#4b5563',
  },
  diagValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  diagCode: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#2563eb',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scanBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  stopBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  resetBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  resetBtnText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '600',
  },
  btnPressed: {
    opacity: 0.8,
  },
  refreshLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginVertical: 8,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sessionClass: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  sessionCode: {
    fontSize: 12,
    color: '#6b7280',
  },
  sessionTiming: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  Radio,
  PauseCircle,
  Crosshair,
  Lock,
  CheckCircle2,
  Info,
  Ban,
  Smartphone,
  AlertTriangle,
  BluetoothOff,
  ShieldAlert,
  RotateCcw,
  Square,
} from 'lucide-react-native';
import { useAttendanceScanner, ScannerStatus } from '../hooks/useAttendanceScanner';
import { api } from '../services/api';
import { SessionItem, StudentAttendanceSummary } from '../types/api';

const STATUS_CONFIG: Record<
  ScannerStatus,
  { bg: string; border: string; text: string; icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> }
> = {
  Ready: { bg: 'rgba(142, 142, 147, 0.12)', border: 'transparent', text: '#636366', icon: PauseCircle },
  Scanning: { bg: 'rgba(0, 157, 150, 0.12)', border: 'transparent', text: '#009D96', icon: Radio },
  'Session detected': { bg: 'rgba(11, 40, 76, 0.10)', border: 'transparent', text: '#0B284C', icon: Crosshair },
  Verifying: { bg: 'rgba(255, 149, 0, 0.12)', border: 'transparent', text: '#FF9500', icon: Lock },
  'Marked present': { bg: 'rgba(0, 157, 150, 0.12)', border: 'transparent', text: '#009D96', icon: CheckCircle2 },
  'Already marked': { bg: 'rgba(0, 157, 150, 0.12)', border: 'transparent', text: '#009D96', icon: Info },
  'Not enrolled': { bg: 'rgba(255, 59, 48, 0.12)', border: 'transparent', text: '#FF3B30', icon: Ban },
  'Device approval pending': { bg: 'rgba(255, 59, 48, 0.12)', border: 'transparent', text: '#FF3B30', icon: Smartphone },
  'Unable to verify': { bg: 'rgba(255, 59, 48, 0.12)', border: 'transparent', text: '#FF3B30', icon: AlertTriangle },
  'Bluetooth off': { bg: 'rgba(255, 59, 48, 0.12)', border: 'transparent', text: '#FF3B30', icon: BluetoothOff },
  'Permission needed': { bg: 'rgba(255, 59, 48, 0.12)', border: 'transparent', text: '#FF3B30', icon: ShieldAlert },
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
  const StatusIcon = cfg.icon;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Attendance Scanner Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Classroom Check-In</Text>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <StatusIcon size={14} color={cfg.text} strokeWidth={2.2} />
            <Text style={[styles.statusText, { color: cfg.text }]}>{status}</Text>
          </View>
        </View>

        <Text style={styles.cardDesc}>
          Keep Bluetooth turned on and this screen visible while in class. ProxyProof
          automatically verifies your presence and marks your attendance.
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
              Recorded at {new Date(lastMarked.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          </View>
        )}

        {/* Live Signal Status */}
        <View style={styles.diagnosticsBox}>
          <Text style={styles.diagTitle}>CHECK-IN SIGNAL & STATUS</Text>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Signal Strength:</Text>
            <Text style={styles.diagValue}>
              {!isScanning
                ? 'Idle'
                : currentRSSI === null
                ? 'Searching for instructor...'
                : currentRSSI >= -75
                ? `Strong (${currentRSSI} dBm)`
                : `Weak (${currentRSSI} dBm)`}
            </Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Range Verification:</Text>
            <Text style={styles.diagValue}>
              {samplesCount > 0 ? `${samplesCount} of 3 verified` : isScanning ? 'Waiting for signal' : 'Not scanning'}
            </Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Classroom Proximity:</Text>
            <Text style={styles.diagValue}>
              {detectedSessionId
                ? 'Signal Linked & Verified'
                : currentRSSI !== null && currentRSSI >= -75
                ? 'Inside Classroom'
                : currentRSSI !== null
                ? 'Move closer to instructor'
                : isScanning
                ? 'Detecting...'
                : 'In room'}
            </Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.actionsRow}>
          {isScanning ? (
            <Pressable
              style={({ pressed }) => [styles.stopBtn, pressed && styles.btnPressed]}
              onPress={stopScanning}
              accessibilityRole="button"
            >
              <Square size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.stopBtnText}>Stop Checking In</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.scanBtn, pressed && styles.btnPressed]}
              onPress={startScanning}
              accessibilityRole="button"
            >
              <Radio size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.scanBtnText}>Check In to Class</Text>
            </Pressable>
          )}

          {status !== 'Ready' && (
            <Pressable
              style={({ pressed }) => [styles.resetBtn, pressed && styles.btnPressed]}
              onPress={resetState}
              accessibilityRole="button"
            >
              <RotateCcw size={15} color="#007AFF" strokeWidth={2.2} />
              <Text style={styles.resetBtnText}>Reset</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Active Class Sessions Nearby */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Active Campus Sessions</Text>
          <Pressable onPress={loadStudentData} accessibilityRole="button">
            <Text style={styles.refreshLink}>Refresh</Text>
          </Pressable>
        </View>

        {isLoadingData ? (
          <ActivityIndicator size="small" color="#007AFF" style={{ marginVertical: 14 }} />
        ) : activeSessions.length === 0 ? (
          <Text style={styles.emptyText}>No active attendance sessions for your classes right now.</Text>
        ) : (
          activeSessions.map((s) => (
            <View key={s.id} style={styles.sessionItem}>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionClass} numberOfLines={1} ellipsizeMode="tail">
                  {s.class_name || 'Enrolled Class'}
                </Text>
                <Text style={styles.sessionCode} numberOfLines={1}>
                  {s.class_code || 'CODE'}
                </Text>
                <Text style={styles.sessionTiming} numberOfLines={1}>
                  Ends at: {new Date(s.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{summary.attended_sessions}</Text>
              <Text style={styles.statLabel}>Attended</Text>
            </View>
            <View style={styles.statDivider} />
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
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
    gap: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    gap: 5,
  },
  statusIcon: {
    fontSize: 11,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '500',
  },
  successBanner: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34C759',
    marginBottom: 2,
  },
  successDetail: {
    fontSize: 12,
    color: '#248A3D',
  },
  successTime: {
    fontSize: 11,
    color: '#34C759',
    marginTop: 4,
  },
  diagnosticsBox: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  diagTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagLabel: {
    fontSize: 13,
    color: '#636366',
  },
  diagValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  diagCode: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#007AFF',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scanBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#0B284C',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0B284C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  stopBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  resetBtn: {
    height: 48,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 18,
    backgroundColor: '#E5E5EA',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  refreshLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  emptyText: {
    fontSize: 13,
    color: '#8E8E93',
    paddingVertical: 12,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  sessionInfo: {
    flex: 1,
    marginRight: 10,
    minWidth: 0,
  },
  sessionClass: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  sessionCode: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  sessionTiming: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 3,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34C759',
    letterSpacing: 0.4,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: '#E5E5EA',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 3,
    fontWeight: '500',
  },
});

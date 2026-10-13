import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from 'react-native';
import { api } from '../services/api';

export function AdminOverviewView() {
  const [stats, setStats] = useState<{
    pendingRequests: number;
    classesCount: number;
    auditCount: number;
  }>({
    pendingRequests: 0,
    classesCount: 0,
    auditCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reqs, cls, logs] = await Promise.all([
        api.getAdminDeviceChangeRequests('pending').catch(() => []),
        api.getClasses().catch(() => []),
        api.getAuditLogs(10, 0).catch(() => []),
      ]);
      setStats({
        pendingRequests: reqs.length,
        classesCount: cls.length,
        auditCount: logs.length,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.getAdminDeviceChangeRequests('pending').catch(() => []),
      api.getClasses().catch(() => []),
      api.getAuditLogs(10, 0).catch(() => []),
    ]).then(([reqs, cls, logs]) => {
      if (!isMounted) return;
      setStats({
        pendingRequests: reqs.length,
        classesCount: cls.length,
        auditCount: logs.length,
      });
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Administrative Overview</Text>
        <Pressable onPress={loadStats}>
          <Text style={styles.refreshLink}>Refresh</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.pendingRequests}</Text>
              <Text style={styles.statLabel}>Pending Device Requests</Text>
              <Text style={styles.statSub}>Requires approval</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.classesCount}</Text>
              <Text style={styles.statLabel}>Active Classes</Text>
              <Text style={styles.statSub}>Campus roster</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.auditCount}</Text>
              <Text style={styles.statLabel}>Recent Audit Events</Text>
              <Text style={styles.statSub}>Immutable log</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>System Architecture & Security Policy</Text>
            <View style={styles.policyList}>
              <Text style={styles.policyItem}>
                &bull; <Text style={styles.bold}>1-Active-Device Rule:</Text> Enforced at the
                PostgreSQL database level with a partial unique index. A student cannot mark
                attendance from an unapproved secondary device.
              </Text>
              <Text style={styles.policyItem}>
                &bull; <Text style={styles.bold}>Rotating HMAC-SHA-256 Proof:</Text> Organizer beacons
                refresh every 5 seconds. Stale or relayed proofs outside clock drift (&plusmn;1 slot)
                are strictly rejected by the server validation engine.
              </Text>
              <Text style={styles.policyItem}>
                &bull; <Text style={styles.bold}>Client-Reported RSSI Policy:</Text> Attendance attempts
                require at least 3 samples with a median signal &ge; -75 dBm to verify physical
                classroom proximity.
              </Text>
              <Text style={styles.policyItem}>
                &bull; <Text style={styles.bold}>Auditable Corrections:</Text> Any manual attendance
                mark or removal requires a written reason and is permanently recorded.
              </Text>
            </View>
          </View>
        </>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  refreshLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4b5563',
    textAlign: 'center',
    marginTop: 2,
  },
  statSub: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  policyList: {
    gap: 8,
  },
  policyItem: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
    color: '#111827',
  },
});

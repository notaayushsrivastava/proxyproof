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
            <Text style={styles.cardTitle}>Campus Attendance & Integrity Rules</Text>
            <View style={styles.policyList}>
              <Text style={styles.policyItem}>
                &bull; <Text style={styles.bold}>One Phone Per Student:</Text> Strictly enforced across
                student accounts. Students cannot submit attendance from an unapproved secondary phone.
              </Text>
              <Text style={styles.policyItem}>
                &bull; <Text style={styles.bold}>Real-Time Verification:</Text> Instructor check-in signals
                refresh every few seconds. Shared or relayed links are automatically rejected.
              </Text>
              <Text style={styles.policyItem}>
                &bull; <Text style={styles.bold}>Classroom Presence:</Text> Check-in requires verified in-room
                Bluetooth proximity near the instructor&apos;s phone.
              </Text>
              <Text style={styles.policyItem}>
                &bull; <Text style={styles.bold}>Audited Corrections:</Text> Any manual attendance addition or
                removal requires a written reason and is logged in the permanent audit trail.
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
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
    gap: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  refreshLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#636366',
    textAlign: 'center',
    marginTop: 4,
  },
  statSub: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
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
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  policyList: {
    gap: 10,
  },
  policyItem: {
    fontSize: 13,
    color: '#636366',
    lineHeight: 18,
  },
  bold: {
    fontWeight: '600',
    color: '#000000',
  },
});

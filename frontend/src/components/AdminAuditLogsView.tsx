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
import { AuditLogItem } from '../types/api';

export function AdminAuditLogsView() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getAuditLogs(100, 0);
      setLogs(data);
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    api.getAuditLogs(100, 0).then((data) => {
      if (!isMounted) return;
      setLogs(data);
      setIsLoading(false);
    }).catch(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Institutional Audit Log</Text>
        <Pressable onPress={fetchLogs}>
          <Text style={styles.refreshLink}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Append-Only System Audit Trail</Text>
        <Text style={styles.cardDesc}>
          Immutable event log tracking device approvals, manual attendance overrides, class
          membership alterations, and session lifecycle changes.
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
      ) : logs.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No audit log events recorded yet.</Text>
        </View>
      ) : (
        logs.map((item) => (
          <View key={item.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <View style={styles.actionPill}>
                <Text style={styles.actionText}>{item.action.toUpperCase()}</Text>
              </View>
              <Text style={styles.logTime}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
            </View>

            <View style={styles.logBody}>
              <Text style={styles.logTarget}>
                Target: {item.target_type} ({item.target_id ? item.target_id.slice(0, 8) + '...' : 'System'})
              </Text>
              {item.actor_user_id && (
                <Text style={styles.logActor}>
                  Actor: {item.actor_user_id.slice(0, 8)}...
                </Text>
              )}
              {item.reason && (
                <Text style={styles.logReason}>Reason: {item.reason}</Text>
              )}
            </View>

            {item.metadata_json && Object.keys(item.metadata_json).length > 0 && (
              <View style={styles.metaBox}>
                <Text style={styles.metaTitle}>METADATA</Text>
                <Text style={styles.metaContent}>
                  {JSON.stringify(item.metadata_json, null, 2)}
                </Text>
              </View>
            )}
          </View>
        ))
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
    gap: 12,
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
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  logCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionPill: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.5,
  },
  logTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  logBody: {
    gap: 2,
  },
  logTarget: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  logActor: {
    fontSize: 12,
    color: '#6b7280',
  },
  logReason: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 2,
  },
  metaBox: {
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  metaTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaContent: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#374151',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});

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
        <Text style={styles.cardTitle}>Security Audit Trail</Text>
        <Text style={styles.cardDesc}>
          Verified event log tracking device approvals, manual attendance overrides, and
          session lifecycle changes.
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
              <Text style={styles.logTime} numberOfLines={1}>
                {new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </Text>
            </View>

            <View style={styles.logBody}>
              <Text style={styles.logTarget} numberOfLines={1} ellipsizeMode="tail">
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
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
    gap: 14,
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
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 10,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionPill: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 0.4,
  },
  logTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  logBody: {
    gap: 3,
  },
  logTarget: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  logActor: {
    fontSize: 12,
    color: '#636366',
  },
  logReason: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 2,
    fontWeight: '500',
  },
  metaBox: {
    backgroundColor: '#F2F2F7',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  metaTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metaContent: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#1C1C1E',
  },
  emptyText: {
    fontSize: 13,
    color: '#8E8E93',
    paddingVertical: 12,
  },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { api } from '../services/api';
import { ClassItem, SessionItem } from '../types/api';

export function OrganizerHistoryView() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const cls = await api.getClasses();
      setClasses(cls);
      if (cls.length > 0) {
        const defaultId = selectedClassId || cls[0].id;
        setSelectedClassId(defaultId);
        const active = await api.getActiveSessions().catch(() => []);
        setSessions(active);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    let isMounted = true;
    api.getClasses().then(async (cls) => {
      if (!isMounted) return;
      setClasses(cls);
      if (cls.length > 0) {
        setSelectedClassId((prev) => prev || cls[0].id);
        const active = await api.getActiveSessions().catch(() => []);
        if (!isMounted) return;
        setSessions(active);
      }
      setIsLoading(false);
    }).catch(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleExportCsv = (sessionId: string) => {
    const url = api.getExportCsvUrl(sessionId);
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Past Sessions & Exports</Text>
        <Pressable onPress={loadData}>
          <Text style={styles.refreshLink}>Refresh</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>RFC 4180 Secure CSV Export</Text>
            <Text style={styles.cardDesc}>
              ProxyProof exports contain full attendance records sanitized against spreadsheet
              formula injection attacks (=, +, -, @ prefix protection).
            </Text>
          </View>

          {classes.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {classes.map((c) => {
                const isSelected = c.id === selectedClassId;
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.exportBtn, isSelected && { backgroundColor: '#2563eb' }, { marginRight: 8 }]}
                    onPress={() => setSelectedClassId(c.id)}
                  >
                    <Text style={[styles.exportBtnText, isSelected && { color: '#ffffff' }]}>
                      {c.code}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Sessions</Text>
            {sessions.length === 0 ? (
              <Text style={styles.emptyText}>
                No attendance sessions recorded yet. Start a session from the Dashboard to record attendance.
              </Text>
            ) : (
              sessions.map((s) => (
                <View key={s.id} style={styles.sessionRow}>
                  <View style={styles.sessionLeft}>
                    <Text style={styles.sessionName}>{s.class_name || 'Class Session'}</Text>
                    <Text style={styles.sessionMeta}>
                      Started: {new Date(s.started_at).toLocaleString()}
                    </Text>
                    <Text style={styles.sessionStatus}>Status: {s.status.toUpperCase()}</Text>
                  </View>

                  <View style={styles.sessionRight}>
                    <Pressable
                      style={styles.exportBtn}
                      onPress={() => handleExportCsv(s.id)}
                    >
                      <Text style={styles.exportBtnText}>Download CSV</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
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
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sessionLeft: {
    gap: 2,
    flex: 1,
  },
  sessionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  sessionMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  sessionStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 2,
  },
  sessionRight: {
    alignItems: 'flex-end',
  },
  exportBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});

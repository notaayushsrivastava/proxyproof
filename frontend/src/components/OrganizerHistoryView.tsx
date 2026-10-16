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
            <Text style={styles.cardTitle}>Attendance Spreadsheets</Text>
            <Text style={styles.cardDesc}>
              Export official class attendance logs formatted for Microsoft Excel, Apple Numbers,
              and Google Sheets.
            </Text>
          </View>

          {classes.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
              {classes.map((c) => {
                const isSelected = c.id === selectedClassId;
                return (
                  <Pressable
                    key={c.id}
                    style={({ pressed }) => [
                      styles.classPill,
                      isSelected && styles.classPillSelected,
                      pressed && styles.classPillPressed,
                    ]}
                    onPress={() => setSelectedClassId(c.id)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.classPillText, isSelected && styles.classPillTextSelected]}>
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
                No attendance sessions recorded yet. Start a session from the Live tab to begin.
              </Text>
            ) : (
              sessions.map((s) => (
                <View key={s.id} style={styles.sessionRow}>
                  <View style={styles.sessionLeft}>
                    <Text style={styles.sessionName} numberOfLines={1} ellipsizeMode="tail">
                      {s.class_name || 'Class Session'}
                    </Text>
                    <Text style={styles.sessionMeta} numberOfLines={1}>
                      Started: {new Date(s.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.sessionStatus}>{s.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.sessionRight}>
                    <Pressable
                      style={({ pressed }) => [styles.exportBtn, pressed && styles.exportBtnPressed]}
                      onPress={() => handleExportCsv(s.id)}
                      accessibilityRole="button"
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
  pillsScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  classPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginRight: 8,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  classPillSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  classPillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  classPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  classPillTextSelected: {
    color: '#FFFFFF',
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
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  sessionLeft: {
    gap: 4,
    flex: 1,
    marginRight: 10,
    minWidth: 0,
  },
  sessionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  sessionMeta: {
    fontSize: 12,
    color: '#8E8E93',
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  sessionStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 0.4,
  },
  sessionRight: {
    alignItems: 'flex-end',
  },
  exportBtn: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  exportBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: -0.1,
  },
  emptyText: {
    fontSize: 13,
    color: '#8E8E93',
    paddingVertical: 12,
  },
});

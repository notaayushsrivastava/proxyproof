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
import { StudentAttendanceSummary, StudentAttendanceRecord } from '../types/api';

export function StudentClassesView() {
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [history, setHistory] = useState<StudentAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sum, hist] = await Promise.all([
        api.getMyAttendanceSummary().catch(() => null),
        api.getMyAttendanceHistory().catch(() => []),
      ]);
      setSummary(sum);
      setHistory(hist);
      const classesList = sum?.classes || [];
      if (classesList.length > 0 && !selectedClassId) {
        setSelectedClassId(classesList[0].class_id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.getMyAttendanceSummary().catch(() => null),
      api.getMyAttendanceHistory().catch(() => []),
    ]).then(([sum, hist]) => {
      if (!isMounted) return;
      setSummary(sum);
      setHistory(hist);
      const classesList = sum?.classes || [];
      if (classesList.length > 0) {
        setSelectedClassId((prev) => prev || classesList[0].class_id);
      }
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredHistory = selectedClassId
    ? history.filter((h) => h.class_id === selectedClassId)
    : history;

  const currentClassSummary = (summary?.classes || []).find((c) => c.class_id === selectedClassId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>My Enrolled Classes</Text>
        <Pressable onPress={loadData}>
          <Text style={styles.refreshLink}>Refresh</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
      ) : !summary || !summary.classes || summary.classes.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>You are not currently enrolled in any classes.</Text>
        </View>
      ) : (
        <>
          {/* Class Selectors / Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
            {summary.classes.map((cls) => {
              const isSelected = cls.class_id === selectedClassId;
              return (
                <Pressable
                  key={cls.class_id}
                  style={({ pressed }) => [
                    styles.classPill,
                    isSelected && styles.classPillSelected,
                    pressed && styles.classPillPressed,
                  ]}
                  onPress={() => setSelectedClassId(cls.class_id)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.classPillCode, isSelected && styles.classPillTextSelected]}>
                    {cls.class_code}
                  </Text>
                  <Text style={[styles.classPillRate, isSelected && styles.classPillRateSelected]}>
                    {cls.attendance_percentage}%
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Active Class Metrics Card */}
          {currentClassSummary && (
            <View style={styles.card}>
              <View style={styles.classDetailsHeader}>
                <Text style={styles.className} numberOfLines={1} ellipsizeMode="tail">
                  {currentClassSummary.class_name}
                </Text>
                <Text style={styles.classCode}>{currentClassSummary.class_code}</Text>
              </View>

              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricBig}>{currentClassSummary.attendance_percentage}%</Text>
                  <Text style={styles.metricLabel}>Verified Attendance</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricBig}>
                    {currentClassSummary.attended_sessions} / {currentClassSummary.total_completed_sessions}
                  </Text>
                  <Text style={styles.metricLabel}>Attended / Completed</Text>
                </View>
              </View>

              <View style={styles.formulaNote}>
                <Text style={styles.formulaText}>
                  Attendance is calculated from all concluded class sessions. In-progress sessions are counted once closed.
                </Text>
              </View>
            </View>
          )}

          {/* Session History List */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Session History</Text>
            {filteredHistory.length === 0 ? (
              <Text style={styles.emptyText}>
                No completed session records found for this class yet. Records appear once sessions close.
              </Text>
            ) : (
              filteredHistory.map((rec, idx) => {
                const isPresent = rec.status === 'present' || rec.status === 'manual_present';
                const rowKey = rec.id || rec.session_id || `session-history-${rec.class_id || ''}-${rec.session_date || ''}-${idx}`;
                return (
                  <View key={rowKey} style={styles.historyRow}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyDate}>
                        {new Date(rec.session_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <Text style={styles.historyTime}>
                        {new Date(rec.session_date).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      {rec.reason ? (
                        <Text style={styles.historyReason} numberOfLines={2}>
                          Note: {rec.reason}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.historyRight}>
                      <View
                        style={[
                          styles.statusBadge,
                          isPresent ? styles.badgePresent : styles.badgeOther,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isPresent ? styles.textPresent : styles.textOther,
                          ]}
                        >
                          {isPresent ? 'PRESENT' : rec.status.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.sourceText}>
                        {rec.source === 'ble' ? 'Via Bluetooth' : 'Instructor Override'}
                      </Text>
                    </View>
                  </View>
                );
              })
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
  classPillCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  classPillRate: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
    fontWeight: '500',
  },
  classPillTextSelected: {
    color: '#FFFFFF',
  },
  classPillRateSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
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
  classDetailsHeader: {
    marginBottom: 14,
  },
  className: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.4,
  },
  classCode: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: '#E5E5EA',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricBig: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.8,
  },
  metricLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 3,
    fontWeight: '500',
  },
  formulaNote: {
    marginTop: 12,
    backgroundColor: '#F2F2F7',
    padding: 10,
    borderRadius: 10,
  },
  formulaText: {
    fontSize: 11,
    color: '#8E8E93',
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#8E8E93',
    paddingVertical: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  historyLeft: {
    gap: 2,
    flex: 1,
    marginRight: 10,
    minWidth: 0,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  historyTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  historyReason: {
    fontSize: 11,
    color: '#FF9500',
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePresent: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  badgeOther: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textPresent: {
    color: '#34C759',
  },
  textOther: {
    color: '#FF3B30',
  },
  sourceText: {
    fontSize: 10,
    color: '#8E8E93',
  },
});

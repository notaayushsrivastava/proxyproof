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
      if (sum && sum.classes.length > 0 && !selectedClassId) {
        setSelectedClassId(sum.classes[0].class_id);
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
      if (sum && sum.classes.length > 0) {
        setSelectedClassId((prev) => prev || sum.classes[0].class_id);
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

  const currentClassSummary = summary?.classes.find((c) => c.class_id === selectedClassId);

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
      ) : !summary || summary.classes.length === 0 ? (
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
                  style={[styles.classPill, isSelected && styles.classPillSelected]}
                  onPress={() => setSelectedClassId(cls.class_id)}
                >
                  <Text style={[styles.classPillCode, isSelected && styles.classPillTextSelected]}>
                    {cls.class_code}
                  </Text>
                  <Text style={[styles.classPillRate, isSelected && styles.classPillTextSelected]}>
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
                <Text style={styles.className}>{currentClassSummary.class_name}</Text>
                <Text style={styles.classCode}>{currentClassSummary.class_code}</Text>
              </View>

              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricBig}>{currentClassSummary.attendance_percentage}%</Text>
                  <Text style={styles.metricLabel}>Verified Attendance</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricBig}>
                    {currentClassSummary.attended_sessions} / {currentClassSummary.total_completed_sessions}
                  </Text>
                  <Text style={styles.metricLabel}>Attended / Completed</Text>
                </View>
              </View>

              <View style={styles.formulaNote}>
                <Text style={styles.formulaText}>
                  Policy: Attendance % = (attended sessions / completed eligible sessions) &times; 100.
                  Currently active sessions are not counted in the denominator until closed.
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
              filteredHistory.map((rec) => {
                const isPresent = rec.status === 'present' || rec.status === 'manual_present';
                return (
                  <View key={rec.id} style={styles.historyRow}>
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
                      {rec.reason && (
                        <Text style={styles.historyReason}>Note: {rec.reason}</Text>
                      )}
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
                          {rec.status.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.sourceText}>Source: {rec.source.toUpperCase()}</Text>
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
  pillsScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  classPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  classPillSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  classPillCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  classPillRate: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  classPillTextSelected: {
    color: '#ffffff',
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
  classDetailsHeader: {
    marginBottom: 12,
  },
  className: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  classCode: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricBig: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  formulaNote: {
    marginTop: 10,
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 6,
  },
  formulaText: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  historyLeft: {
    gap: 2,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  historyTime: {
    fontSize: 11,
    color: '#6b7280',
  },
  historyReason: {
    fontSize: 11,
    color: '#b45309',
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
    backgroundColor: '#dcfce7',
  },
  badgeOther: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textPresent: {
    color: '#15803d',
  },
  textOther: {
    color: '#b91c1c',
  },
  sourceText: {
    fontSize: 10,
    color: '#9ca3af',
  },
});

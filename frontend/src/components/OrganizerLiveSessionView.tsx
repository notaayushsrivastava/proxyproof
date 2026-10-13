import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { getBeaconAdapter } from '../ble';
import { api } from '../services/api';
import { SessionWebSocketClient } from '../services/websocket';
import {
  ClassItem,
  SessionItem,
  AttendanceRecord,
  RosterMember,
} from '../types/api';

export function OrganizerLiveSessionView() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Start Session Modal / Controls
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(5);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Manual Add Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualStudentId, setManualStudentId] = useState<string>('');
  const [manualReason, setManualReason] = useState<string>('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [isManualSubmitting, setIsManualSubmitting] = useState<boolean>(false);

  // Remove Modal
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState<boolean>(false);
  const [removeTargetStudent, setRemoveTargetStudent] = useState<AttendanceRecord | null>(null);
  const [removeReason, setRemoveReason] = useState<string>('');
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoveSubmitting, setIsRemoveSubmitting] = useState<boolean>(false);

  // Search filter
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Timer State
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isAdvertisingActive, setIsAdvertisingActive] = useState<boolean>(false);

  const wsClientRef = useRef<SessionWebSocketClient | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const adapter = getBeaconAdapter();

  const cleanupLiveSubscriptions = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const loadSessionDetails = useCallback(async (session: SessionItem) => {
    try {
      const [att, rost] = await Promise.all([
        api.getSessionAttendance(session.id).catch(() => []),
        api.getClassRoster(session.class_id).catch(() => []),
      ]);
      setAttendance(att);
      setRoster(rost);
    } catch (err) {
      console.warn('Failed to load session details:', err);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const clsList = await api.getClasses();
      setClasses(clsList);
      if (clsList.length > 0 && !selectedClassId) {
        setSelectedClassId(clsList[0].id);
      }

      // Check for active sessions across classes
      const activeList = await api.getActiveSessions();
      if (activeList.length > 0) {
        const current = activeList[0];
        setActiveSession(current);
        await loadSessionDetails(current);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.warn('Failed to fetch organizer initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId, loadSessionDetails]);

  useEffect(() => {
    let isMounted = true;
    api.getClasses().then(async (clsList) => {
      if (!isMounted) return;
      setClasses(clsList);
      if (clsList.length > 0) {
        setSelectedClassId((prev) => prev || clsList[0].id);
      }
      const activeList = await api.getActiveSessions().catch(() => []);
      if (!isMounted) return;
      if (activeList.length > 0) {
        const current = activeList[0];
        setActiveSession(current);
        const [att, rost] = await Promise.all([
          api.getSessionAttendance(current.id).catch(() => []),
          api.getClassRoster(current.class_id).catch(() => []),
        ]);
        if (!isMounted) return;
        setAttendance(att);
        setRoster(rost);
      }
      setIsLoading(false);
    }).catch(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
      cleanupLiveSubscriptions();
    };
  }, [cleanupLiveSubscriptions]);

  // Setup WebSocket and fallback polling when session is active
  const setupLiveSessionTracking = useCallback((session: SessionItem) => {
    cleanupLiveSubscriptions();

    // 1. WebSocket
    const ws = new SessionWebSocketClient(session.id);
    wsClientRef.current = ws;
    ws.connect();

    ws.onEvent((event) => {
      if (event.type === 'attendance.marked' || event.type === 'attendance.corrected') {
        // Refresh authoritative list
        api.getSessionAttendance(session.id).then(setAttendance).catch(() => {});
      } else if (event.type === 'session.closed') {
        setActiveSession(null);
        adapter.stopAdvertising().catch(() => {});
        setIsAdvertisingActive(false);
      }
    });

    // 2. Polling Fallback (every 5 seconds)
    pollTimerRef.current = setInterval(() => {
      api.getSessionAttendance(session.id).then(setAttendance).catch(() => {});
    }, 5000);
  }, [adapter, cleanupLiveSubscriptions]);

  useEffect(() => {
    if (activeSession) {
      setupLiveSessionTracking(activeSession);
    } else {
      cleanupLiveSubscriptions();
    }
  }, [activeSession, setupLiveSessionTracking, cleanupLiveSubscriptions]);

  // Countdown timer effect
  useEffect(() => {
    if (!activeSession) {
      return;
    }

    const interval = setInterval(() => {
      const endsAt = new Date(activeSession.ends_at).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endsAt - now) / 1000));
      setRemainingSeconds(diff);

      if (diff === 0) {
        // Expired
        adapter.stopAdvertising().catch(() => {});
        setIsAdvertisingActive(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession, adapter]);

  const handleStartSession = async () => {
    if (!selectedClassId) {
      setStartError('Please select a class.');
      return;
    }
    setStartError(null);
    setIsStarting(true);

    try {
      const res = await api.createSession(selectedClassId, durationMinutes, sessionNotes);
      setActiveSession(res.session);

      // Start BLE Advertising with beacon secret
      const started = await adapter.startAdvertising(res.session.id, res.beacon_secret);
      setIsAdvertisingActive(started);

      await loadSessionDetails(res.session);
    } catch (err: unknown) {
      const e = err as Error;
      setStartError(e.message || 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    setIsClosing(true);
    try {
      await api.closeSession(activeSession.id);
      await adapter.stopAdvertising();
      setIsAdvertisingActive(false);
      setActiveSession(null);
      await fetchInitialData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Could not close session: ${e.message}`);
    } finally {
      setIsClosing(false);
    }
  };

  const handleManualAdd = async () => {
    if (!activeSession || !manualStudentId || !manualReason.trim()) {
      setManualError('Please select a student and provide a reason.');
      return;
    }
    setManualError(null);
    setIsManualSubmitting(true);
    try {
      await api.markManualAttendance(activeSession.id, {
        student_id: manualStudentId,
        action: 'mark_present',
        reason: manualReason.trim(),
      });
      setIsManualModalOpen(false);
      setManualReason('');
      setManualStudentId('');
      // Refresh
      const att = await api.getSessionAttendance(activeSession.id);
      setAttendance(att);
    } catch (err: unknown) {
      const e = err as Error;
      setManualError(e.message || 'Failed to manually mark attendance');
    } finally {
      setIsManualSubmitting(false);
    }
  };

  const handleRemoveStudent = async () => {
    if (!activeSession || !removeTargetStudent || !removeReason.trim()) {
      setRemoveError('Please provide a reason for removal.');
      return;
    }
    setRemoveError(null);
    setIsRemoveSubmitting(true);
    try {
      await api.deleteAttendance(
        activeSession.id,
        removeTargetStudent.student_id,
        removeReason.trim()
      );
      setIsRemoveModalOpen(false);
      setRemoveTargetStudent(null);
      setRemoveReason('');
      // Refresh
      const att = await api.getSessionAttendance(activeSession.id);
      setAttendance(att);
    } catch (err: unknown) {
      const e = err as Error;
      setRemoveError(e.message || 'Failed to remove attendance');
    } finally {
      setIsRemoveSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    if (!activeSession) return;
    const url = api.getExportCsvUrl(activeSession.id);
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const filteredAttendance = attendance.filter((a) => {
    const q = searchFilter.toLowerCase();
    return (
      (a.student_name && a.student_name.toLowerCase().includes(q)) ||
      (a.student_number && a.student_number.toLowerCase().includes(q)) ||
      (a.student_email && a.student_email.toLowerCase().includes(q))
    );
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
      ) : activeSession ? (
        /* ACTIVE SESSION DASHBOARD */
        <>
          <View style={styles.card}>
            <View style={styles.sessionHeaderRow}>
              <View>
                <Text style={styles.activeLabel}>ACTIVE ATTENDANCE SESSION</Text>
                <Text style={styles.sessionClassName}>
                  {activeSession.class_name || 'Class Session'}
                </Text>
                <Text style={styles.sessionClassCode}>{activeSession.class_code}</Text>
              </View>

              <View style={styles.timerBox}>
                <Text style={styles.timerValue}>{formatTimer(remainingSeconds)}</Text>
                <Text style={styles.timerLabel}>REMAINING</Text>
              </View>
            </View>

            {/* Hardware & Server Status Indicators */}
            <View style={styles.statusBanners}>
              <View style={styles.statusBadge}>
                <View style={styles.dotGreen} />
                <Text style={styles.statusBadgeText}>Session active on server</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  !isAdvertisingActive && styles.statusBadgeWarning,
                ]}
              >
                <View
                  style={isAdvertisingActive ? styles.dotGreen : styles.dotOrange}
                />
                <Text style={styles.statusBadgeText}>
                  {isAdvertisingActive
                    ? 'BLE advertising active on this phone'
                    : 'BLE advertising stopped / pending'}
                </Text>
              </View>
            </View>

            {/* Attendance Progress Metrics */}
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricBig}>
                  {attendance.length} / {roster.length}
                </Text>
                <Text style={styles.metricSub}>Present / Enrolled</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricBig}>
                  {roster.length > 0
                    ? Math.round((attendance.length / roster.length) * 100)
                    : 0}
                  %
                </Text>
                <Text style={styles.metricSub}>Turnout Rate</Text>
              </View>
            </View>

            {/* Session Action Controls */}
            <View style={styles.actionsBar}>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                onPress={() => setIsManualModalOpen(true)}
              >
                <Text style={styles.actionBtnText}>+ Manual Add</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                onPress={handleExportCsv}
              >
                <Text style={styles.actionBtnText}>Export CSV</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.closeBtn,
                  isClosing && styles.disabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleCloseSession}
                disabled={isClosing}
              >
                {isClosing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.closeBtnText}>End Session</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Live Attendance List */}
          <View style={styles.card}>
            <View style={styles.listHeaderRow}>
              <Text style={styles.cardTitle}>Live Attendance Roster</Text>
              <Text style={styles.countText}>{attendance.length} recorded</Text>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search by student name, roll number..."
              placeholderTextColor="#9ca3af"
              value={searchFilter}
              onChangeText={setSearchFilter}
            />

            {filteredAttendance.length === 0 ? (
              <Text style={styles.emptyText}>
                No verified attendees matching filter yet. Students will appear automatically when in BLE range.
              </Text>
            ) : (
              filteredAttendance.map((rec) => {
                const isBle = rec.source === 'ble';
                return (
                  <View key={rec.id} style={styles.studentRow}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>
                        {rec.student_name || 'Enrolled Student'}
                      </Text>
                      <Text style={styles.studentNumber}>
                        {rec.student_number || rec.student_email || 'Verified'}
                      </Text>
                      <Text style={styles.studentTime}>
                        {new Date(rec.marked_at).toLocaleTimeString()}
                      </Text>
                    </View>

                    <View style={styles.studentRight}>
                      <View
                        style={[
                          styles.sourcePill,
                          isBle ? styles.sourceBle : styles.sourceManual,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sourcePillText,
                            isBle ? styles.textBle : styles.textManual,
                          ]}
                        >
                          {isBle ? 'BLE' : 'MANUAL'}
                        </Text>
                      </View>

                      <Pressable
                        style={styles.removeLink}
                        onPress={() => {
                          setRemoveTargetStudent(rec);
                          setIsRemoveModalOpen(true);
                        }}
                      >
                        <Text style={styles.removeLinkText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </>
      ) : (
        /* START NEW SESSION FLOW */
        <View style={styles.card}>
          <Text style={styles.screenTitle}>Start Attendance Session</Text>
          <Text style={styles.cardDesc}>
            Initiate a time-bounded attendance window. Your phone will broadcast rotating
            cryptographic HMAC proofs over BLE for nearby enrolled students to capture.
          </Text>

          {startError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{startError}</Text>
            </View>
          )}

          {classes.length === 0 ? (
            <Text style={styles.emptyText}>You do not have any assigned classes yet.</Text>
          ) : (
            <>
              {/* Select Class */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Select Class</Text>
                <View style={styles.chipsRow}>
                  {classes.map((cls) => {
                    const isSelected = cls.id === selectedClassId;
                    return (
                      <Pressable
                        key={cls.id}
                        style={[styles.classChip, isSelected && styles.classChipSelected]}
                        onPress={() => setSelectedClassId(cls.id)}
                      >
                        <Text
                          style={[
                            styles.classChipText,
                            isSelected && styles.classChipTextSelected,
                          ]}
                        >
                          {cls.code} - {cls.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Select Duration */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Session Duration</Text>
                <View style={styles.chipsRow}>
                  {[1, 3, 5, 10, 15].map((mins) => {
                    const isSelected = durationMinutes === mins;
                    return (
                      <Pressable
                        key={mins}
                        style={[styles.minChip, isSelected && styles.minChipSelected]}
                        onPress={() => setDurationMinutes(mins)}
                      >
                        <Text
                          style={[
                            styles.minChipText,
                            isSelected && styles.minChipTextSelected,
                          ]}
                        >
                          {mins} min
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Optional Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Session Notes (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Lecture 4: Distributed Systems"
                  placeholderTextColor="#9ca3af"
                  value={sessionNotes}
                  onChangeText={setSessionNotes}
                />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.startBtn,
                  isStarting && styles.disabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleStartSession}
                disabled={isStarting}
              >
                {isStarting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.startBtnText}>Broadcast & Start Session</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* Manual Add Student Modal */}
      <Modal visible={isManualModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Manual Attendance Mark</Text>
            <Text style={styles.modalSubtitle}>
              Manual marks are permanently recorded in the institutional audit log.
            </Text>

            {manualError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{manualError}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Select Enrolled Student</Text>
              <ScrollView style={styles.rosterSelectBox}>
                {roster.map((m) => {
                  const isSelected = m.student_id === manualStudentId;
                  return (
                    <Pressable
                      key={m.student_id}
                      style={[
                        styles.rosterSelectItem,
                        isSelected && styles.rosterSelectItemActive,
                      ]}
                      onPress={() => setManualStudentId(m.student_id)}
                    >
                      <Text
                        style={[
                          styles.rosterSelectName,
                          isSelected && styles.rosterSelectActiveText,
                        ]}
                      >
                        {m.full_name} ({m.student_number || m.email})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Required Justification / Reason</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g. Student phone battery died, verified physically present"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                value={manualReason}
                onChangeText={setManualReason}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setIsManualModalOpen(false)}
                disabled={isManualSubmitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, isManualSubmitting && styles.disabled]}
                onPress={handleManualAdd}
                disabled={isManualSubmitting}
              >
                {isManualSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Mark Present</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove / Correction Student Modal */}
      <Modal visible={isRemoveModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Remove Attendance Record</Text>
            <Text style={styles.modalSubtitle}>
              Removals update the status and create an auditable correction log.
            </Text>

            {removeError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{removeError}</Text>
              </View>
            )}

            {removeTargetStudent && (
              <View style={styles.removeTargetBox}>
                <Text style={styles.removeTargetName}>
                  Student: {removeTargetStudent.student_name}
                </Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reason for Removal (Required)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g. Student left early without permission"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                value={removeReason}
                onChangeText={setRemoveReason}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setIsRemoveModalOpen(false)}
                disabled={isRemoveSubmitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.deleteBtn, isRemoveSubmitting && styles.disabled]}
                onPress={handleRemoveStudent}
                disabled={isRemoveSubmitting}
              >
                {isRemoveSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.deleteBtnText}>Confirm Removal</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
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
    marginBottom: 16,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  sessionClassName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  sessionClassCode: {
    fontSize: 12,
    color: '#6b7280',
  },
  timerBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  timerValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1d4ed8',
    fontFamily: 'monospace',
  },
  timerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3b82f6',
    letterSpacing: 0.5,
  },
  statusBanners: {
    gap: 6,
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  statusBadgeWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  dotOrange: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d97706',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 16,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricBig: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  metricSub: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  actionsBar: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    height: 38,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  closeBtn: {
    flex: 1,
    height: 38,
    backgroundColor: '#dc2626',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  countText: {
    fontSize: 12,
    color: '#6b7280',
  },
  searchInput: {
    height: 38,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#111827',
    marginBottom: 12,
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  studentInfo: {
    gap: 2,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  studentNumber: {
    fontSize: 12,
    color: '#6b7280',
  },
  studentTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  studentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  sourcePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceBle: {
    backgroundColor: '#e0f2fe',
  },
  sourceManual: {
    backgroundColor: '#fef3c7',
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textBle: {
    color: '#0369a1',
  },
  textManual: {
    color: '#b45309',
  },
  removeLink: {
    paddingVertical: 2,
  },
  removeLinkText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classChip: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  classChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  classChipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  classChipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  minChip: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  minChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  minChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  minChipTextSelected: {
    color: '#ffffff',
  },
  input: {
    height: 42,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#111827',
  },
  textArea: {
    height: 64,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  startBtn: {
    height: 44,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 14,
  },
  rosterSelectBox: {
    maxHeight: 140,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    backgroundColor: '#f9fafb',
  },
  rosterSelectItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rosterSelectItemActive: {
    backgroundColor: '#dbeafe',
  },
  rosterSelectName: {
    fontSize: 12,
    color: '#1f2937',
  },
  rosterSelectActiveText: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
  removeTargetBox: {
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  removeTargetName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991b1b',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
});

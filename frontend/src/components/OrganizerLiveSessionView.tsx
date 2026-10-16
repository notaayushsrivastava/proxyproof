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
import {
  Radio,
  UserPlus,
  Download,
  StopCircle,
  Trash2,
} from 'lucide-react-native';
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
      const sessionObj = res.session || res;
      const secret = res.beacon_secret || res.session_secret || '';

      if (!sessionObj || !sessionObj.id) {
        throw new Error('Server returned an invalid session response without an ID.');
      }

      setActiveSession(sessionObj);

      // Start BLE Advertising with beacon secret
      const started = await adapter.startAdvertising(sessionObj.id, secret);
      setIsAdvertisingActive(started);

      await loadSessionDetails(sessionObj);
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
              <View style={styles.sessionTitleGroup}>
                <Text style={styles.activeLabel}>ACTIVE ATTENDANCE SESSION</Text>
                <Text style={styles.sessionClassName} numberOfLines={1} ellipsizeMode="tail">
                  {activeSession.class_name || 'Class Session'}
                </Text>
                <Text style={styles.sessionClassCode} numberOfLines={1}>{activeSession.class_code}</Text>
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
                <Text style={styles.statusBadgeText}>Attendance session active on campus network</Text>
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
                    ? 'Bluetooth check-in signal broadcasting'
                    : 'Check-in signal paused or standby'}
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
                <UserPlus size={14} color="#007AFF" strokeWidth={2.2} />
                <Text style={styles.actionBtnText}>Manual Add</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                onPress={handleExportCsv}
              >
                <Download size={14} color="#007AFF" strokeWidth={2.2} />
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
                  <>
                    <StopCircle size={15} color="#ffffff" strokeWidth={2.2} />
                    <Text style={styles.closeBtnText}>End Session</Text>
                  </>
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
                        <Trash2 size={13} color="#FF3B30" strokeWidth={2.2} />
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
            Open an attendance window for your class. Your phone broadcasts a secure signal so
            enrolled students physically present in the room can check in automatically.
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
                          numberOfLines={1}
                          ellipsizeMode="tail"
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
                  <>
                    <Radio size={16} color="#ffffff" strokeWidth={2.4} />
                    <Text style={styles.startBtnText}>Broadcast & Start Session</Text>
                  </>
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
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: 4,
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
    marginBottom: 16,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sessionTitleGroup: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 0.6,
  },
  sessionClassName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  sessionClassCode: {
    fontSize: 13,
    color: '#8E8E93',
  },
  timerBox: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  timerValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    fontFamily: 'monospace',
    letterSpacing: -0.5,
  },
  timerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 0.6,
  },
  statusBanners: {
    gap: 8,
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
  },
  statusBadgeWarning: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  dotGreen: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34C759',
  },
  dotOrange: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF9500',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    marginBottom: 16,
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
  metricSub: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 3,
    fontWeight: '500',
  },
  actionsBar: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  closeBtn: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  countText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  searchInput: {
    height: 42,
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#000000',
    marginBottom: 12,
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  studentInfo: {
    gap: 2,
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  studentNumber: {
    fontSize: 12,
    color: '#8E8E93',
  },
  studentTime: {
    fontSize: 11,
    color: '#8E8E93',
  },
  studentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sourceBle: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
  sourceManual: {
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textBle: {
    color: '#007AFF',
  },
  textManual: {
    color: '#FF9500',
  },
  removeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  removeLinkText: {
    fontSize: 11,
    color: '#FF3B30',
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
    letterSpacing: -0.1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classChip: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  classChipSelected: {
    backgroundColor: '#0B284C',
    borderColor: '#0B284C',
  },
  classChipText: {
    fontSize: 13,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  classChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  minChip: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  minChipSelected: {
    backgroundColor: '#0B284C',
    borderColor: '#0B284C',
  },
  minChipText: {
    fontSize: 13,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  minChipTextSelected: {
    color: '#FFFFFF',
  },
  input: {
    height: 46,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#000000',
  },
  textArea: {
    height: 72,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  startBtn: {
    height: 48,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#0B284C',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0B284C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 13,
    color: '#8E8E93',
    paddingVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 18,
  },
  rosterSelectBox: {
    maxHeight: 140,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  rosterSelectItem: {
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  rosterSelectItemActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
  rosterSelectName: {
    fontSize: 13,
    color: '#000000',
  },
  rosterSelectActiveText: {
    fontWeight: '600',
    color: '#007AFF',
  },
  removeTargetBox: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  removeTargetName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF3B30',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  submitBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  deleteBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

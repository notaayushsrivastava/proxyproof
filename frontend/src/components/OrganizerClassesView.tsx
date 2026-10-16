import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import { api } from '../services/api';
import { ClassItem, RosterMember } from '../types/api';

export function OrganizerClassesView() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);

  // Add Member Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [studentIdInput, setStudentIdInput] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const selectClass = useCallback(async (cls: ClassItem) => {
    setSelectedClass(cls);
    setIsLoadingRoster(true);
    try {
      const r = await api.getClassRoster(cls.id);
      setRoster(r);
    } finally {
      setIsLoadingRoster(false);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      const cls = await api.getClasses();
      setClasses(cls);
      if (cls.length > 0 && !selectedClass) {
        selectClass(cls[0]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedClass, selectClass]);

  useEffect(() => {
    let isMounted = true;
    api.getClasses().then(async (cls) => {
      if (!isMounted) return;
      setClasses(cls);
      if (cls.length > 0) {
        setSelectedClass(cls[0]);
        const r = await api.getClassRoster(cls[0].id).catch(() => []);
        if (!isMounted) return;
        setRoster(r);
      }
      setIsLoading(false);
    }).catch(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddMember = async () => {
    if (!selectedClass || !studentIdInput.trim()) {
      setAddError('Student ID is required.');
      return;
    }
    setAddError(null);
    setIsAdding(true);
    try {
      await api.addMember(selectedClass.id, studentIdInput.trim());
      setIsAddModalOpen(false);
      setStudentIdInput('');
      await selectClass(selectedClass);
    } catch (err: unknown) {
      const e = err as Error;
      setAddError(e.message || 'Failed to add student to roster');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (studentId: string) => {
    if (!selectedClass) return;
    try {
      await api.removeMember(selectedClass.id, studentId);
      await selectClass(selectedClass);
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Could not remove student: ${e.message}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Class Rosters</Text>
        <Pressable onPress={fetchClasses}>
          <Text style={styles.refreshLink}>Refresh</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
      ) : classes.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No classes assigned to your organizer account.</Text>
        </View>
      ) : (
        <>
          {/* Class Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {classes.map((cls) => {
              const isSelected = selectedClass?.id === cls.id;
              return (
                <Pressable
                  key={cls.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => selectClass(cls)}
                >
                  <Text style={[styles.chipTitle, isSelected && styles.chipTitleSelected]}>
                    {cls.code}
                  </Text>
                  <Text style={[styles.chipSub, isSelected && styles.chipSubSelected]}>
                    {cls.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Roster Card */}
          {selectedClass && (
            <View style={styles.card}>
              <View style={styles.rosterHeader}>
                <View style={styles.rosterHeaderLeft}>
                  <Text style={styles.className} numberOfLines={1} ellipsizeMode="tail">
                    {selectedClass.name}
                  </Text>
                  <Text style={styles.classCode} numberOfLines={1}>
                    Code: {selectedClass.code} &bull; {roster.length} Enrolled Students
                  </Text>
                </View>

                <Pressable
                  style={styles.addStudentBtn}
                  onPress={() => setIsAddModalOpen(true)}
                >
                  <Text style={styles.addStudentBtnText}>+ Enrol Student</Text>
                </Pressable>
              </View>

              {isLoadingRoster ? (
                <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 16 }} />
              ) : roster.length === 0 ? (
                <Text style={styles.emptyText}>No students are enrolled in this class yet.</Text>
              ) : (
                roster.map((m) => (
                  <View key={m.student_id} style={styles.memberRow}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName} numberOfLines={1} ellipsizeMode="tail">
                        {m.full_name}
                      </Text>
                      <Text style={styles.memberDetails} numberOfLines={1} ellipsizeMode="tail">
                        Roll: {m.student_number || 'N/A'} &bull; {m.email}
                      </Text>
                      <Text style={styles.joinedDate}>
                        Enrolled: {new Date(m.joined_at).toLocaleDateString()}
                      </Text>
                    </View>

                    <View style={styles.memberRight}>
                      <View
                        style={[
                          styles.devicePill,
                          m.has_active_device ? styles.devActive : styles.devNone,
                        ]}
                      >
                        <Text
                          style={[
                            styles.devicePillText,
                            m.has_active_device ? styles.devActiveText : styles.devNoneText,
                          ]}
                        >
                          {m.has_active_device ? 'PHONE READY' : 'NO PHONE'}
                        </Text>
                      </View>

                      <Pressable
                        style={styles.removeBtn}
                        onPress={() => handleRemoveMember(m.student_id)}
                      >
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </>
      )}

      {/* Enrol Student Modal */}
      <Modal visible={isAddModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Enrol Student</Text>
            <Text style={styles.modalSubtitle}>
              Enter the student ID to enroll them in {selectedClass?.code}.
            </Text>

            {addError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{addError}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Student ID (UUID)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 74d75d68-075b-426b-9c76-5a415ff6eb5d"
                placeholderTextColor="#9ca3af"
                value={studentIdInput}
                onChangeText={setStudentIdInput}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setIsAddModalOpen(false)}
                disabled={isAdding}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, isAdding && styles.disabled]}
                onPress={handleAddMember}
                disabled={isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Enrol</Text>
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
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  chipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  chipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  chipTitleSelected: {
    color: '#FFFFFF',
  },
  chipSub: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
    fontWeight: '500',
  },
  chipSubSelected: {
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
  rosterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    paddingBottom: 14,
  },
  rosterHeaderLeft: {
    flex: 1,
    marginRight: 10,
    minWidth: 0,
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
  addStudentBtn: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addStudentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: -0.1,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  memberInfo: {
    gap: 2,
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  memberDetails: {
    fontSize: 12,
    color: '#8E8E93',
  },
  joinedDate: {
    fontSize: 11,
    color: '#8E8E93',
  },
  memberRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  devicePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  devActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  devNone: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
  },
  devicePillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  devActiveText: {
    color: '#34C759',
  },
  devNoneText: {
    color: '#FF3B30',
  },
  removeBtn: {
    paddingVertical: 2,
  },
  removeBtnText: {
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
  formGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
    letterSpacing: -0.1,
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
  errorBox: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '500',
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
  disabled: {
    opacity: 0.6,
  },
});

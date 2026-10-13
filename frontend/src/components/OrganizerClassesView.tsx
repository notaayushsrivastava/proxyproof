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
                <View>
                  <Text style={styles.className}>{selectedClass.name}</Text>
                  <Text style={styles.classCode}>
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
                      <Text style={styles.memberName}>{m.full_name}</Text>
                      <Text style={styles.memberDetails}>
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
                          {m.has_active_device ? 'DEVICE READY' : 'NO DEVICE'}
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
              Enter the student&apos;s unique UUID identifier to enrol them in {selectedClass?.code}.
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
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  chipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  chipTitleSelected: {
    color: '#ffffff',
  },
  chipSub: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  chipSubSelected: {
    color: '#bfdbfe',
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
  rosterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 12,
  },
  className: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  classCode: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  addStudentBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addStudentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  memberInfo: {
    gap: 2,
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  memberDetails: {
    fontSize: 12,
    color: '#6b7280',
  },
  joinedDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  memberRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  devicePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  devActive: {
    backgroundColor: '#dcfce7',
  },
  devNone: {
    backgroundColor: '#fee2e2',
  },
  devicePillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  devActiveText: {
    color: '#15803d',
  },
  devNoneText: {
    color: '#b91c1c',
  },
  removeBtn: {
    paddingVertical: 2,
  },
  removeBtnText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600',
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
    marginBottom: 16,
    lineHeight: 16,
  },
  formGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
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
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
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
  disabled: {
    opacity: 0.6,
  },
});

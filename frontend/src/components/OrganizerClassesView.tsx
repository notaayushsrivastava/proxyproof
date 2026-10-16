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
  Platform,
} from 'react-native';
import {
  Plus,
  FileSpreadsheet,
  UserPlus,
  Users,
  Copy,
  X,
  AlertCircle,
  CheckCircle2,
  Trash2,
  BookOpen,
} from 'lucide-react-native';
import { api } from '../services/api';
import { ClassItem, RosterMember, StudentCreatePayload } from '../types/api';

export function OrganizerClassesView() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Class Modal
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [createClassError, setCreateClassError] = useState<string | null>(null);

  // Add Student Modal (Single)
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [studentForm, setStudentForm] = useState<StudentCreatePayload>({
    full_name: '',
    email: '',
    student_number: '',
    department: '',
    password: '',
  });
  const [addMode, setAddMode] = useState<'create' | 'existing'>('create');
  const [existingStudentId, setExistingStudentId] = useState('');
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState<string | null>(null);

  // Bulk CSV Roster Modal
  const [isBulkCsvOpen, setIsBulkCsvOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [isSubmittingCsv, setIsSubmittingCsv] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    created_count: number;
    enrolled_count: number;
    failed_count: number;
    errors: string[];
    message: string;
  } | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const selectClass = useCallback(async (cls: ClassItem) => {
    setSelectedClass(cls);
    setIsLoadingRoster(true);
    try {
      const r = await api.getClassRoster(cls.id);
      setRoster(r);
    } catch (err: unknown) {
      console.warn('Failed to load roster:', err);
    } finally {
      setIsLoadingRoster(false);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      const cls = await api.getClasses();
      setClasses(cls);
      if (cls.length > 0) {
        // If current selected class is in list, keep it, else pick first
        const match = selectedClass ? cls.find((c) => c.id === selectedClass.id) : null;
        await selectClass(match || cls[0]);
      } else {
        setSelectedClass(null);
        setRoster([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedClass, selectClass]);

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleCreateClass = async () => {
    if (!newClassName.trim() || !newClassCode.trim()) {
      setCreateClassError('Course name and code are required.');
      return;
    }
    setCreateClassError(null);
    setIsCreatingClass(true);
    try {
      const created = await api.createClass({
        name: newClassName.trim(),
        code: newClassCode.trim().toUpperCase(),
      });
      setIsCreateClassOpen(false);
      setNewClassName('');
      setNewClassCode('');
      setStatusMessage({ type: 'success', text: `Course "${created.name}" created successfully!` });
      await fetchClasses();
      setSelectedClass(created);
    } catch (err: unknown) {
      const e = err as Error;
      setCreateClassError(e.message || 'Failed to create class.');
    } finally {
      setIsCreatingClass(false);
    }
  };

  const handleAddStudent = async () => {
    if (!selectedClass) return;

    if (addMode === 'existing') {
      if (!existingStudentId.trim()) {
        setAddStudentError('Student ID is required.');
        return;
      }
      setAddStudentError(null);
      setIsSubmittingStudent(true);
      try {
        await api.addMember(selectedClass.id, existingStudentId.trim());
        setIsAddStudentOpen(false);
        setExistingStudentId('');
        setStatusMessage({ type: 'success', text: 'Student enrolled successfully.' });
        await selectClass(selectedClass);
      } catch (err: unknown) {
        const e = err as Error;
        setAddStudentError(e.message || 'Failed to enroll student.');
      } finally {
        setIsSubmittingStudent(false);
      }
      return;
    }

    // Create & Enroll Mode
    if (!studentForm.full_name.trim() || !studentForm.email.trim() || !studentForm.student_number.trim()) {
      setAddStudentError('Full Name, Email, and Student ID/Roll Number are required.');
      return;
    }
    setAddStudentError(null);
    setIsSubmittingStudent(true);
    try {
      await api.createAndEnrollStudent(selectedClass.id, {
        full_name: studentForm.full_name.trim(),
        email: studentForm.email.trim(),
        student_number: studentForm.student_number.trim(),
        department: studentForm.department?.trim() || undefined,
        password: studentForm.password?.trim() || undefined,
      });
      setIsAddStudentOpen(false);
      setStudentForm({ full_name: '', email: '', student_number: '', department: '', password: '' });
      setStatusMessage({ type: 'success', text: `Enrolled ${studentForm.full_name} in ${selectedClass.code}.` });
      await selectClass(selectedClass);
    } catch (err: unknown) {
      const e = err as Error;
      setAddStudentError(e.message || 'Failed to register and enroll student.');
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const sampleStudentCsv = `Full Name,Email,Student ID,Department
Grace Hopper,grace.hopper@univ.edu,CS101,Computer Science
Katherine Johnson,katherine.j@univ.edu,MATH204,Mathematics
Alan Turing,alan.turing@univ.edu,CS102,Information Theory`;

  const handleCopyTemplate = () => {
    setCsvContent(sampleStudentCsv);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  const handleBulkCsvUpload = async () => {
    if (!selectedClass || !csvContent.trim()) return;
    setIsSubmittingCsv(true);
    setBulkResult(null);
    try {
      const res = await api.bulkUploadRosterCsv(selectedClass.id, csvContent);
      setBulkResult(res);
      if (res.enrolled_count > 0 || res.created_count > 0) {
        await selectClass(selectedClass);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setBulkResult({
        created_count: 0,
        enrolled_count: 0,
        failed_count: 1,
        errors: [e.message || 'Failed to upload roster CSV.'],
        message: 'Roster import failed.',
      });
    } finally {
      setIsSubmittingCsv(false);
    }
  };

  const handleRemoveMember = async (studentId: string) => {
    if (!selectedClass) return;
    try {
      await api.removeMember(selectedClass.id, studentId);
      setStatusMessage({ type: 'success', text: 'Student removed from course roster.' });
      await selectClass(selectedClass);
    } catch (err: unknown) {
      const e = err as Error;
      setStatusMessage({ type: 'error', text: `Could not remove student: ${e.message}` });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenTitle}>Class Rosters</Text>
          <Text style={styles.screenSub}>
            Manage enrolled students, device status, and course enrollment
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.newClassBtn, pressed && styles.btnPressed]}
          onPress={() => {
            setCreateClassError(null);
            setIsCreateClassOpen(true);
          }}
          accessibilityRole="button"
        >
          <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.newClassBtnText}>New Course</Text>
        </Pressable>
      </View>

      {/* Status banner */}
      {statusMessage && (
        <View
          style={[
            styles.banner,
            statusMessage.type === 'success' ? styles.bannerSuccess : styles.bannerError,
          ]}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={16} color="#009D96" />
          ) : (
            <AlertCircle size={16} color="#FF3B30" />
          )}
          <Text
            style={[
              styles.bannerText,
              statusMessage.type === 'success' ? styles.bannerTextSuccess : styles.bannerTextError,
            ]}
          >
            {statusMessage.text}
          </Text>
          <Pressable onPress={() => setStatusMessage(null)}>
            <X size={14} color="#636366" />
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0B284C" />
          <Text style={styles.loadingText}>Loading courses...</Text>
        </View>
      ) : classes.length === 0 ? (
        <View style={styles.emptyCard}>
          <BookOpen size={40} color="#8E8E93" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No courses created yet</Text>
          <Text style={styles.emptyDesc}>
            Create your first course to begin adding student rosters and broadcasting verification sessions.
          </Text>
          <Pressable
            style={styles.emptyActionBtn}
            onPress={() => setIsCreateClassOpen(true)}
          >
            <Text style={styles.emptyActionBtnText}>Create First Course</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Course Selector Tabs */}
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
                  <Text style={[styles.chipSub, isSelected && styles.chipSubSelected]} numberOfLines={1}>
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
                  <Text style={styles.className} numberOfLines={1}>
                    {selectedClass.name}
                  </Text>
                  <Text style={styles.classCode} numberOfLines={1}>
                    Code: {selectedClass.code} &bull; {roster.length} Enrolled Student{roster.length === 1 ? '' : 's'}
                  </Text>
                </View>

                <View style={styles.rosterActionBtns}>
                  <Pressable
                    style={({ pressed }) => [styles.csvBtn, pressed && styles.btnPressed]}
                    onPress={() => {
                      setBulkResult(null);
                      setIsBulkCsvOpen(true);
                    }}
                    accessibilityRole="button"
                  >
                    <FileSpreadsheet size={15} color="#0B284C" strokeWidth={2} />
                    <Text style={styles.csvBtnText}>Upload CSV</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.addStudentBtn, pressed && styles.btnPressed]}
                    onPress={() => {
                      setAddStudentError(null);
                      setIsAddStudentOpen(true);
                    }}
                    accessibilityRole="button"
                  >
                    <UserPlus size={15} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.addStudentBtnText}>Add Student</Text>
                  </Pressable>
                </View>
              </View>

              {isLoadingRoster ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#0B284C" />
                </View>
              ) : roster.length === 0 ? (
                <View style={styles.emptyRosterBox}>
                  <Users size={32} color="#8E8E93" strokeWidth={1.5} />
                  <Text style={styles.emptyRosterText}>No students are enrolled in this course yet.</Text>
                  <Text style={styles.emptyRosterSub}>
                    Add students individually or mass-upload an enrollment CSV roster.
                  </Text>
                </View>
              ) : (
                roster.map((m) => (
                  <View key={m.student_id} style={styles.memberRow}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {m.full_name}
                      </Text>
                      <Text style={styles.memberDetails} numberOfLines={1}>
                        ID: {m.student_number || 'N/A'} &bull; {m.email}
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
                        hitSlop={8}
                      >
                        <Trash2 size={15} color="#FF3B30" />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </>
      )}

      {/* CREATE COURSE MODAL */}
      <Modal visible={isCreateClassOpen} transparent animationType="fade" onRequestClose={() => setIsCreateClassOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Course</Text>
              <Pressable onPress={() => setIsCreateClassOpen(false)}>
                <X size={20} color="#8E8E93" />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Set up a course section to broadcast verified Bluetooth attendance.
            </Text>

            {createClassError && (
              <View style={styles.errorBox}>
                <AlertCircle size={14} color="#FF3B30" />
                <Text style={styles.errorText}>{createClassError}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Course Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Distributed Systems & Networks"
                placeholderTextColor="#8E8E93"
                value={newClassName}
                onChangeText={setNewClassName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Course Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. CS401"
                placeholderTextColor="#8E8E93"
                autoCapitalize="characters"
                value={newClassCode}
                onChangeText={setNewClassCode}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setIsCreateClassOpen(false)}
                disabled={isCreatingClass}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.submitBtn, isCreatingClass && styles.disabled]}
                onPress={handleCreateClass}
                disabled={isCreatingClass}
              >
                {isCreatingClass ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Course</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADD STUDENT MODAL */}
      <Modal visible={isAddStudentOpen} transparent animationType="fade" onRequestClose={() => setIsAddStudentOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Student to {selectedClass?.code}</Text>
              <Pressable onPress={() => setIsAddStudentOpen(false)}>
                <X size={20} color="#8E8E93" />
              </Pressable>
            </View>

            <View style={styles.modeToggleRow}>
              <Pressable
                style={[styles.modeToggleBtn, addMode === 'create' && styles.modeToggleActive]}
                onPress={() => setAddMode('create')}
              >
                <Text style={[styles.modeToggleText, addMode === 'create' && styles.modeToggleTextActive]}>
                  Register &amp; Enrol
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeToggleBtn, addMode === 'existing' && styles.modeToggleActive]}
                onPress={() => setAddMode('existing')}
              >
                <Text style={[styles.modeToggleText, addMode === 'existing' && styles.modeToggleTextActive]}>
                  Existing Student ID
                </Text>
              </Pressable>
            </View>

            {addStudentError && (
              <View style={styles.errorBox}>
                <AlertCircle size={14} color="#FF3B30" />
                <Text style={styles.errorText}>{addStudentError}</Text>
              </View>
            )}

            {addMode === 'create' ? (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Grace Hopper"
                    placeholderTextColor="#8E8E93"
                    value={studentForm.full_name}
                    onChangeText={(val) => setStudentForm((p) => ({ ...p, full_name: val }))}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="grace@institution.edu"
                    placeholderTextColor="#8E8E93"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={studentForm.email}
                    onChangeText={(val) => setStudentForm((p) => ({ ...p, email: val }))}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Student ID / Roll Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2024CS042"
                    placeholderTextColor="#8E8E93"
                    autoCapitalize="characters"
                    value={studentForm.student_number}
                    onChangeText={(val) => setStudentForm((p) => ({ ...p, student_number: val }))}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Department (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Computer Science"
                    placeholderTextColor="#8E8E93"
                    value={studentForm.department}
                    onChangeText={(val) => setStudentForm((p) => ({ ...p, department: val }))}
                  />
                </View>
              </>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Student UUID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Paste student UUID..."
                  placeholderTextColor="#8E8E93"
                  value={existingStudentId}
                  onChangeText={setExistingStudentId}
                />
              </View>
            )}

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setIsAddStudentOpen(false)}
                disabled={isSubmittingStudent}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.submitBtn, isSubmittingStudent && styles.disabled]}
                onPress={handleAddStudent}
                disabled={isSubmittingStudent}
              >
                {isSubmittingStudent ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Enrol Student</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* BULK CSV ROSTER MODAL */}
      <Modal visible={isBulkCsvOpen} transparent animationType="fade" onRequestClose={() => setIsBulkCsvOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 520 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Roster CSV ({selectedClass?.code})</Text>
              <Pressable onPress={() => setIsBulkCsvOpen(false)}>
                <X size={20} color="#8E8E93" />
              </Pressable>
            </View>

            <Text style={styles.modalSub}>
              Batch register and enroll students in one go. Columns: Full Name, Email, Student ID, Department.
            </Text>

            <View style={styles.templateBox}>
              <View style={styles.templateHeader}>
                <Text style={styles.templateTitle}>Sample CSV Format</Text>
                <Pressable style={styles.copyBtn} onPress={handleCopyTemplate}>
                  <Copy size={13} color="#0B284C" />
                  <Text style={styles.copyBtnText}>
                    {copiedTemplate ? 'Copied into input!' : 'Copy Sample'}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.templateCode}>
                Full Name,Email,Student ID,Department{'\n'}
                Grace Hopper,hopper@univ.edu,CS101,Computer Science{'\n'}
                Katherine Johnson,katherine@univ.edu,MATH204,Mathematics
              </Text>
            </View>

            <TextInput
              style={styles.csvTextArea}
              multiline
              numberOfLines={6}
              placeholder="Paste comma-separated student rows here..."
              placeholderTextColor="#8E8E93"
              value={csvContent}
              onChangeText={setCsvContent}
            />

            {bulkResult && (
              <View
                style={[
                  styles.resultBox,
                  bulkResult.enrolled_count > 0 ? styles.resultBoxSuccess : styles.resultBoxWarn,
                ]}
              >
                <Text style={styles.resultTitle}>{bulkResult.message}</Text>
                {bulkResult.errors && bulkResult.errors.length > 0 && (
                  <View style={styles.errorList}>
                    {bulkResult.errors.slice(0, 4).map((err, idx) => (
                      <Text key={idx} style={styles.errorItem}>
                        &bull; {err}
                      </Text>
                    ))}
                    {bulkResult.errors.length > 4 && (
                      <Text style={styles.errorItemMore}>
                        +{bulkResult.errors.length - 4} more errors
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setIsBulkCsvOpen(false)}
                disabled={isSubmittingCsv}
              >
                <Text style={styles.cancelBtnText}>Done</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.submitBtn,
                  (!csvContent.trim() || isSubmittingCsv) && styles.disabled,
                ]}
                onPress={handleBulkCsvUpload}
                disabled={!csvContent.trim() || isSubmittingCsv}
              >
                {isSubmittingCsv ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Import Students</Text>
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
    paddingBottom: 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    minWidth: 200,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.4,
  },
  screenSub: {
    fontSize: 13,
    color: '#636366',
    marginTop: 2,
  },
  newClassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0B284C',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    minHeight: 44,
  },
  newClassBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  btnPressed: {
    opacity: 0.75,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  bannerSuccess: {
    backgroundColor: 'rgba(0, 157, 150, 0.1)',
  },
  bannerError: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  bannerTextSuccess: {
    color: '#009D96',
  },
  bannerTextError: {
    color: '#FF3B30',
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#636366',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 18,
    backgroundColor: '#0B284C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  chipsScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#0B284C',
    borderColor: '#0B284C',
  },
  chipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  chipTitleSelected: {
    color: '#FFFFFF',
  },
  chipSub: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
    maxWidth: 120,
  },
  chipSubSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 10,
  },
  rosterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  rosterHeaderLeft: {
    flex: 1,
    minWidth: 160,
  },
  className: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  classCode: {
    fontSize: 12,
    color: '#636366',
    marginTop: 2,
  },
  rosterActionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  csvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(11, 40, 76, 0.08)',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    minHeight: 38,
  },
  csvBtnText: {
    color: '#0B284C',
    fontSize: 12,
    fontWeight: '600',
  },
  addStudentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0B284C',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    minHeight: 38,
  },
  addStudentBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyRosterBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  emptyRosterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  emptyRosterSub: {
    fontSize: 12,
    color: '#8E8E93',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  memberDetails: {
    fontSize: 12,
    color: '#636366',
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
    paddingHorizontal: 7,
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
    fontSize: 10,
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
    padding: 4,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 440,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  modalSub: {
    fontSize: 13,
    color: '#636366',
    marginBottom: 14,
    lineHeight: 18,
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 3,
    marginBottom: 14,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeToggleActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#636366',
  },
  modeToggleTextActive: {
    fontWeight: '600',
    color: '#0B284C',
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    flex: 1,
  },
  templateBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  templateTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#48484A',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(11, 40, 76, 0.08)',
    borderRadius: 4,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0B284C',
  },
  templateCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#3A3A3C',
    lineHeight: 16,
  },
  csvTextArea: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    height: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  resultBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  resultBoxSuccess: {
    backgroundColor: 'rgba(0, 157, 150, 0.1)',
  },
  resultBoxWarn: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  errorList: {
    marginTop: 6,
  },
  errorItem: {
    fontSize: 12,
    color: '#FF3B30',
  },
  errorItemMore: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  submitBtn: {
    backgroundColor: '#0B284C',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});

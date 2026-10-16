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
  Users,
  UserPlus,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  X,
  Building,
  Mail,
  Lock,
} from 'lucide-react-native';
import { api } from '../services/api';
import { FacultyMember, FacultyCreatePayload } from '../types/api';

export function AdminFacultyView() {
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [filteredFaculty, setFilteredFaculty] = useState<FacultyMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Single Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addForm, setAddForm] = useState<FacultyCreatePayload>({
    full_name: '',
    email: '',
    department: '',
    password: '',
  });
  const [addError, setAddError] = useState<string | null>(null);

  // Bulk CSV Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    created_count: number;
    failed_count: number;
    errors: string[];
    message: string;
  } | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const loadFaculty = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.listFaculty();
      setFacultyList(data);
      setFilteredFaculty(data);
    } catch (err: unknown) {
      const e = err as Error;
      setStatusMessage({ type: 'error', text: e.message || 'Failed to load faculty directory.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFaculty();
  }, [loadFaculty]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFaculty(facultyList);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredFaculty(
        facultyList.filter(
          (f) =>
            f.full_name.toLowerCase().includes(q) ||
            f.email.toLowerCase().includes(q) ||
            (f.department && f.department.toLowerCase().includes(q))
        )
      );
    }
  }, [searchQuery, facultyList]);

  const handleCreateFaculty = async () => {
    if (!addForm.full_name.trim() || !addForm.email.trim()) {
      setAddError('Full name and email are required.');
      return;
    }
    setAddError(null);
    setIsSubmittingAdd(true);
    try {
      const created = await api.createFaculty(addForm);
      setIsAddModalOpen(false);
      setAddForm({ full_name: '', email: '', department: '', password: '' });
      setStatusMessage({ type: 'success', text: `Faculty member ${created.full_name} created successfully.` });
      await loadFaculty();
    } catch (err: unknown) {
      const e = err as Error;
      setAddError(e.message || 'Failed to create faculty member.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const sampleCsv = `Name,Email,Department,Password
Dr. Alan Turing,alan.turing@institution.edu,Computer Science,SecurePass@123
Dr. Katherine Johnson,katherine@institution.edu,Mathematics,SecurePass@123
Prof. Richard Feynman,feynman@institution.edu,Physics,SecurePass@123`;

  const handleCopyTemplate = () => {
    setCsvContent(sampleCsv);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  const handleBulkCsvUpload = async () => {
    if (!csvContent.trim()) {
      return;
    }
    setIsSubmittingBulk(true);
    setBulkResult(null);
    try {
      const res = await api.bulkUploadFacultyCsv(csvContent);
      setBulkResult(res);
      if (res.created_count > 0) {
        await loadFaculty();
      }
    } catch (err: unknown) {
      const e = err as Error;
      setBulkResult({
        created_count: 0,
        failed_count: 1,
        errors: [e.message || 'Failed to upload CSV.'],
        message: 'CSV processing failed.',
      });
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header & Action Bar */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenTitle}>Faculty &amp; Staff</Text>
          <Text style={styles.screenSub}>
            {facultyList.length} registered instructor{facultyList.length === 1 ? '' : 's'} across departments
          </Text>
        </View>

        <View style={styles.actionButtonsRow}>
          <Pressable
            style={({ pressed }) => [styles.secondaryActionBtn, pressed && styles.btnPressed]}
            onPress={() => {
              setBulkResult(null);
              setIsBulkModalOpen(true);
            }}
            accessibilityRole="button"
          >
            <FileSpreadsheet size={16} color="#0B284C" strokeWidth={2} />
            <Text style={styles.secondaryActionBtnText}>Import CSV</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.primaryActionBtn, pressed && styles.btnPressed]}
            onPress={() => {
              setAddError(null);
              setIsAddModalOpen(true);
            }}
            accessibilityRole="button"
          >
            <UserPlus size={16} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.primaryActionBtnText}>Add Faculty</Text>
          </Pressable>
        </View>
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
          <Pressable onPress={() => setStatusMessage(null)} style={styles.bannerClose}>
            <X size={14} color="#636366" />
          </Pressable>
        </View>
      )}

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Search size={18} color="#8E8E93" />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter faculty by name, email, or department..."
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <X size={16} color="#8E8E93" />
          </Pressable>
        )}
      </View>

      {/* Faculty List */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0B284C" />
          <Text style={styles.loadingText}>Loading faculty directory...</Text>
        </View>
      ) : filteredFaculty.length === 0 ? (
        <View style={styles.emptyCard}>
          <Users size={40} color="#8E8E93" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching faculty members found' : 'No faculty accounts created yet'}
          </Text>
          <Text style={styles.emptyDesc}>
            {searchQuery
              ? 'Try adjusting your search criteria.'
              : 'Add instructors individually or import them in bulk using a CSV roster.'}
          </Text>
          {!searchQuery && (
            <Pressable
              style={styles.emptyActionBtn}
              onPress={() => setIsAddModalOpen(true)}
            >
              <Text style={styles.emptyActionBtnText}>Create First Faculty Account</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.facultyList}>
          {filteredFaculty.map((fac) => (
            <View key={fac.id} style={styles.facultyCard}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(fac.full_name)}</Text>
                </View>

                <View style={styles.nameBlock}>
                  <Text style={styles.facultyName} numberOfLines={1}>
                    {fac.full_name}
                  </Text>
                  <Text style={styles.facultyEmail} numberOfLines={1}>
                    {fac.email}
                  </Text>
                </View>

                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>FACULTY</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.deptBadge}>
                  <Building size={12} color="#48484A" />
                  <Text style={styles.deptText}>
                    {fac.department || 'General Academic'}
                  </Text>
                </View>

                <View style={styles.statusPill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.statusPillText}>Active</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* SINGLE ADD MODAL */}
      <Modal visible={isAddModalOpen} transparent animationType="fade" onRequestClose={() => setIsAddModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Faculty Member</Text>
              <Pressable onPress={() => setIsAddModalOpen(false)}>
                <X size={20} color="#8E8E93" />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Create an instructor account. They can immediately log in to create classes and manage student rosters.
            </Text>

            {addError && (
              <View style={styles.modalErrorBox}>
                <AlertCircle size={14} color="#FF3B30" />
                <Text style={styles.modalErrorText}>{addError}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Dr. Ada Lovelace"
                placeholderTextColor="#8E8E93"
                value={addForm.full_name}
                onChangeText={(val) => setAddForm((prev) => ({ ...prev, full_name: val }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ada@institution.edu"
                placeholderTextColor="#8E8E93"
                keyboardType="email-address"
                autoCapitalize="none"
                value={addForm.email}
                onChangeText={(val) => setAddForm((prev) => ({ ...prev, email: val }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Department (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Computer Science & Engineering"
                placeholderTextColor="#8E8E93"
                value={addForm.department}
                onChangeText={(val) => setAddForm((prev) => ({ ...prev, department: val }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Initial Password (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Leave blank for secure default (FacultyPass@2026)"
                placeholderTextColor="#8E8E93"
                secureTextEntry
                value={addForm.password}
                onChangeText={(val) => setAddForm((prev) => ({ ...prev, password: val }))}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setIsAddModalOpen(false)}
                disabled={isSubmittingAdd}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.saveBtn, isSubmittingAdd && styles.saveBtnDisabled]}
                onPress={handleCreateFaculty}
                disabled={isSubmittingAdd}
              >
                {isSubmittingAdd ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Create Account</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* BULK CSV MODAL */}
      <Modal visible={isBulkModalOpen} transparent animationType="fade" onRequestClose={() => setIsBulkModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 540 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mass Upload Faculty (CSV)</Text>
              <Pressable onPress={() => setIsBulkModalOpen(false)}>
                <X size={20} color="#8E8E93" />
              </Pressable>
            </View>

            <Text style={styles.modalSub}>
              Paste your CSV spreadsheet rows below. Columns can be ordered as Name, Email, Department, Password.
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
                Name,Email,Department,Password{'\n'}
                Prof. Ada Lovelace,ada@univ.edu,Computer Science,AdaPass@123{'\n'}
                Prof. John von Neumann,john@univ.edu,Applied Math,JohnPass@123
              </Text>
            </View>

            <TextInput
              style={styles.csvTextArea}
              multiline
              numberOfLines={6}
              placeholder="Paste comma-separated rows here..."
              placeholderTextColor="#8E8E93"
              value={csvContent}
              onChangeText={setCsvContent}
            />

            {bulkResult && (
              <View
                style={[
                  styles.resultBox,
                  bulkResult.created_count > 0 ? styles.resultBoxSuccess : styles.resultBoxWarn,
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

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setIsBulkModalOpen(false)}
                disabled={isSubmittingBulk}
              >
                <Text style={styles.cancelBtnText}>Done</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.saveBtn,
                  (!csvContent.trim() || isSubmittingBulk) && styles.saveBtnDisabled,
                ]}
                onPress={handleBulkCsvUpload}
                disabled={!csvContent.trim() || isSubmittingBulk}
              >
                {isSubmittingBulk ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Import Roster</Text>
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
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
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0B284C',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    minHeight: 44,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(11, 40, 76, 0.08)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    minHeight: 44,
  },
  secondaryActionBtnText: {
    color: '#0B284C',
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
    marginBottom: 16,
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
  bannerClose: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    padding: 0,
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
    borderRadius: 14,
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
    textAlign: 'center',
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
  facultyList: {
    gap: 10,
  },
  facultyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0B284C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  nameBlock: {
    flex: 1,
  },
  facultyName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  facultyEmail: {
    fontSize: 13,
    color: '#636366',
    marginTop: 1,
  },
  roleBadge: {
    backgroundColor: 'rgba(11, 40, 76, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B284C',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  deptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deptText: {
    fontSize: 12,
    color: '#48484A',
    fontWeight: '500',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#248A3D',
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
    }),
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
    marginBottom: 16,
    lineHeight: 18,
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  modalErrorText: {
    fontSize: 13,
    color: '#FF3B30',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  textInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
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
    marginBottom: 14,
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  saveBtn: {
    backgroundColor: '#0B284C',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

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
import { DeviceChangeRequestDetail } from '../types/api';

export function AdminDeviceQueueView() {
  const [requests, setRequests] = useState<DeviceChangeRequestDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');

  // Reject Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Action Loading
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getAdminDeviceChangeRequests(filterStatus);
      setRequests(data);
    } catch (err) {
      console.warn('Failed to load device change requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    let isMounted = true;
    api.getAdminDeviceChangeRequests(filterStatus).then((data) => {
      if (!isMounted) return;
      setRequests(data);
      setIsLoading(false);
    }).catch(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [filterStatus]);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await api.approveDeviceChangeRequest(id);
      await loadRequests();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Approval failed: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenReject = (id: string) => {
    setSelectedReqId(id);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedReqId) return;
    setIsRejecting(true);
    try {
      await api.rejectDeviceChangeRequest(selectedReqId, rejectReason.trim() || undefined);
      setIsRejectModalOpen(false);
      setSelectedReqId(null);
      await loadRequests();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Rejection failed: ${e.message}`);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Device Approval Queue</Text>
        <Pressable onPress={loadRequests}>
          <Text style={styles.refreshLink}>Refresh</Text>
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {['pending', 'approved', 'rejected'].map((s) => {
          const isSelected = filterStatus === s;
          return (
            <Pressable
              key={s}
              style={[styles.filterTab, isSelected && styles.filterTabActive]}
              onPress={() => setFilterStatus(s)}
            >
              <Text style={[styles.filterTabText, isSelected && styles.filterTabTextActive]}>
                {s.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
      ) : requests.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            No {filterStatus} device change requests found.
          </Text>
        </View>
      ) : (
        requests.map((r) => {
          const isPending = r.status === 'pending';
          const isWorking = processingId === r.id;

          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.studentName}>
                    {r.student_name || 'Enrolled Student'}
                  </Text>
                  <Text style={styles.studentEmail}>
                    {r.student_email || r.student_id}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    r.status === 'approved'
                      ? styles.pillApproved
                      : r.status === 'rejected'
                      ? styles.pillRejected
                      : styles.pillPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      r.status === 'approved'
                        ? styles.textApproved
                        : r.status === 'rejected'
                        ? styles.textRejected
                        : styles.textPending,
                    ]}
                  >
                    {r.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.deviceComparison}>
                <View style={styles.compBox}>
                  <Text style={styles.compLabel}>PREVIOUS DEVICE (REVOKING)</Text>
                  <Text style={styles.compValue}>
                    {r.old_device_label || 'Existing registered device'}
                  </Text>
                </View>
                <View style={styles.compBox}>
                  <Text style={styles.compLabel}>REQUESTED DEVICE (ACTIVATING)</Text>
                  <Text style={styles.compValue}>
                    {r.new_device_label || 'New device proposal'}
                  </Text>
                </View>
              </View>

              {r.reason && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Student Stated Reason:</Text>
                  <Text style={styles.reasonText}>{r.reason}</Text>
                </View>
              )}

              <Text style={styles.submittedDate}>
                Submitted: {new Date(r.created_at).toLocaleString()}
              </Text>

              {isPending && (
                <View style={styles.actionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.approveBtn,
                      isWorking && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleApprove(r.id)}
                    disabled={isWorking}
                  >
                    {isWorking ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.approveBtnText}>Approve & Activate</Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.rejectBtn, pressed && styles.pressed]}
                    onPress={() => handleOpenReject(r.id)}
                    disabled={isWorking}
                  >
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })
      )}

      {/* Reject Reason Modal */}
      <Modal visible={isRejectModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reject Device Change</Text>
            <Text style={styles.modalSubtitle}>
              Provide an optional justification for the audit log and student notification.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Unverified identity or suspicious replacement request"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              value={rejectReason}
              onChangeText={setRejectReason}
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setIsRejectModalOpen(false)}
                disabled={isRejecting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmRejectBtn, isRejecting && styles.disabled]}
                onPress={handleConfirmReject}
                disabled={isRejecting}
              >
                {isRejecting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmRejectBtnText}>Confirm Rejection</Text>
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
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 3,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: '#ffffff',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  filterTabTextActive: {
    color: '#111827',
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
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  studentEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillPending: {
    backgroundColor: '#fef3c7',
  },
  pillApproved: {
    backgroundColor: '#dcfce7',
  },
  pillRejected: {
    backgroundColor: '#fee2e2',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textPending: {
    color: '#b45309',
  },
  textApproved: {
    color: '#15803d',
  },
  textRejected: {
    color: '#b91c1c',
  },
  deviceComparison: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  compBox: {
    gap: 2,
  },
  compLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  compValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  reasonBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 12,
    color: '#78350f',
  },
  submittedDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  approveBtn: {
    flex: 2,
    height: 40,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  rejectBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '700',
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
  modalInput: {
    height: 72,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    textAlignVertical: 'top',
    fontSize: 13,
    color: '#111827',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
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
  confirmRejectBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  confirmRejectBtnText: {
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

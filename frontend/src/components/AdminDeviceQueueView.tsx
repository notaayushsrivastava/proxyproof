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
import { Check, X } from 'lucide-react-native';
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
                <View style={styles.studentInfoGroup}>
                  <Text style={styles.studentName} numberOfLines={1} ellipsizeMode="tail">
                    {r.student_name || 'Enrolled Student'}
                  </Text>
                  <Text style={styles.studentEmail} numberOfLines={1} ellipsizeMode="tail">
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
                  <Text style={styles.compLabel}>CURRENT PHONE</Text>
                  <Text style={styles.compValue} numberOfLines={1} ellipsizeMode="tail">
                    {r.old_device_label || 'Existing registered phone'}
                  </Text>
                </View>
                <View style={styles.compBox}>
                  <Text style={styles.compLabel}>REQUESTED PHONE</Text>
                  <Text style={styles.compValue} numberOfLines={1} ellipsizeMode="tail">
                    {r.new_device_label || 'New phone proposal'}
                  </Text>
                </View>
              </View>

              {r.reason && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Student Reason:</Text>
                  <Text style={styles.reasonText}>{r.reason}</Text>
                </View>
              )}

              <Text style={styles.submittedDate}>
                Submitted {new Date(r.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
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
                      <>
                        <Check size={15} color="#ffffff" strokeWidth={2.4} />
                        <Text style={styles.approveBtnText}>Approve & Activate</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.rejectBtn, pressed && styles.pressed]}
                    onPress={() => handleOpenReject(r.id)}
                    disabled={isWorking}
                  >
                    <X size={15} color="#FF3B30" strokeWidth={2.4} />
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
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    padding: 3,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 9,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636366',
    letterSpacing: -0.1,
  },
  filterTabTextActive: {
    color: '#000000',
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
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  studentInfoGroup: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  studentEmail: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillPending: {
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
  },
  pillApproved: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  pillRejected: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textPending: {
    color: '#FF9500',
  },
  textApproved: {
    color: '#34C759',
  },
  textRejected: {
    color: '#FF3B30',
  },
  deviceComparison: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  compBox: {
    gap: 2,
  },
  compLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.6,
  },
  compValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  reasonBox: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 10,
    padding: 10,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF9500',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 12,
    color: '#B45309',
  },
  submittedDate: {
    fontSize: 11,
    color: '#8E8E93',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  approveBtn: {
    flex: 2,
    height: 44,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#34C759',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  approveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  rejectBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
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
    marginBottom: 14,
    lineHeight: 18,
  },
  modalInput: {
    height: 76,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#000000',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
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
  confirmRejectBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  confirmRejectBtnText: {
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

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
import * as Crypto from 'expo-crypto';
import { RefreshCw } from 'lucide-react-native';
import { api } from '../services/api';
import { Device, DeviceChangeRequest } from '../types/api';

export function StudentDeviceView() {
  const [device, setDevice] = useState<Device | null>(null);
  const [requests, setRequests] = useState<DeviceChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newLabel, setNewLabel] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dev, reqs] = await Promise.all([
        api.getMyDevice().catch(() => null),
        api.getMyDeviceChangeRequests().catch(() => []),
      ]);
      setDevice(dev);
      setRequests(reqs);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.getMyDevice().catch(() => null),
      api.getMyDeviceChangeRequests().catch(() => []),
    ]).then(([dev, reqs]) => {
      if (!isMounted) return;
      setDevice(dev);
      setRequests(reqs);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRequestChange = async () => {
    if (!newLabel.trim() || !reason.trim()) {
      setModalError('Both new device label and reason are required.');
      return;
    }
    setModalError(null);
    setIsSubmitting(true);
    try {
      // Generate unique public key for requested replacement
      const dummyEntropy = `${Date.now()}-${newLabel}-${Platform.OS}`;
      const newPublicKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        dummyEntropy
      );

      await api.requestDeviceChange({
        new_device_label: newLabel.trim(),
        new_public_key: newPublicKey,
        platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other',
        reason: reason.trim(),
      });

      setIsModalOpen(false);
      setNewLabel('');
      setReason('');
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setModalError(e.message || 'Failed to submit change request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'approved':
        return { bg: 'rgba(52, 199, 89, 0.12)', text: '#34C759' };
      case 'pending':
        return { bg: 'rgba(255, 149, 0, 0.12)', text: '#FF9500' };
      case 'revoked':
      case 'rejected':
        return { bg: 'rgba(255, 59, 48, 0.12)', text: '#FF3B30' };
      default:
        return { bg: 'rgba(142, 142, 147, 0.12)', text: '#8E8E93' };
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Registered Phone & Security</Text>
        <Pressable onPress={loadData} accessibilityRole="button">
          <Text style={styles.refreshLink}>Refresh</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 24 }} />
      ) : (
        <>
          {/* Active Device Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Linked Campus Phone</Text>
              {device && (
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: getStatusBadgeStyle(device.status).bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: getStatusBadgeStyle(device.status).text },
                    ]}
                  >
                    {device.status.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {device ? (
              <View style={styles.deviceDetails}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Device Name</Text>
                  <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">
                    {device.device_label}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Platform</Text>
                  <Text style={styles.infoValue}>
                    {device.platform === 'ios' ? 'Apple iOS' : device.platform === 'android' ? 'Android' : device.platform.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Device Security Key</Text>
                  <Text style={styles.infoKey} numberOfLines={1} ellipsizeMode="middle">
                    {device.public_key.slice(0, 10)}...{device.public_key.slice(-8)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Registered On</Text>
                  <Text style={styles.infoValue}>
                    {new Date(device.registered_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>Last Active</Text>
                  <Text style={styles.infoValue}>
                    {device.last_seen_at
                      ? new Date(device.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Recently active'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>
                No phone is linked yet. Your current phone will be automatically linked on your first class check-in.
              </Text>
            )}

            <Pressable
              style={({ pressed }) => [styles.requestBtn, pressed && styles.btnPressed]}
              onPress={() => setIsModalOpen(true)}
              accessibilityRole="button"
            >
              <RefreshCw size={15} color="#007AFF" strokeWidth={2.2} />
              <Text style={styles.requestBtnText}>Request Phone Change</Text>
            </Pressable>
          </View>

          {/* Change Requests History */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Device Change Requests</Text>
            {requests.length === 0 ? (
              <Text style={styles.emptyText}>No device change requests submitted.</Text>
            ) : (
              requests.map((r) => {
                const sStyle = getStatusBadgeStyle(r.status);
                return (
                  <View key={r.id} style={styles.requestItem}>
                    <View style={styles.reqLeft}>
                      <Text style={styles.reqDate}>
                        Submitted {new Date(r.created_at).toLocaleDateString()}
                      </Text>
                      {r.reason ? (
                        <Text style={styles.reqReason} numberOfLines={2}>
                          Reason: {r.reason}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: sStyle.bg }]}>
                      <Text style={[styles.statusPillText, { color: sStyle.text }]}>
                        {r.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Guidance & Policies */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Class Check-In & Device Rules</Text>
            <View style={styles.helpList}>
              <Text style={styles.helpItem}>
                &bull; <Text style={styles.helpBold}>One Phone Per Student:</Text> To guarantee fair and
                honest attendance, your student account is linked to your primary phone. If you get a new
                phone, submit a request above for approval.
              </Text>
              <Text style={styles.helpItem}>
                &bull; <Text style={styles.helpBold}>Keep App Visible:</Text> Mobile operating systems pause
                Bluetooth in the background. Keep this screen open during class check-in.
              </Text>
              <Text style={styles.helpItem}>
                &bull; <Text style={styles.helpBold}>In-Classroom Proximity:</Text> You must be physically
                present in the classroom near your instructor to be checked in.
              </Text>
              <Text style={styles.helpItem}>
                &bull; <Text style={styles.helpBold}>Anti-Proxy Protection:</Text> Attendance signals update
                in real time. Forwarding or proxy attendance attempts are automatically rejected and flagged.
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Modal for Device Change Request */}
      <Modal visible={isModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Request Device Change</Text>
            <Text style={styles.modalSubtitle}>
              Administrators verify replacements to ensure academic integrity.
            </Text>

            {modalError && (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{modalError}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Device Model / Label</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. iPhone 16 Pro, Pixel 9"
                placeholderTextColor="#8E8E93"
                value={newLabel}
                onChangeText={setNewLabel}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason for Change</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="e.g. Upgraded phone, previous device broken"
                placeholderTextColor="#8E8E93"
                multiline
                numberOfLines={3}
                value={reason}
                onChangeText={setReason}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                accessibilityRole="button"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleRequestChange}
                disabled={isSubmitting}
                accessibilityRole="button"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Request</Text>
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.4,
  },
  deviceDetails: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  infoLabel: {
    fontSize: 14,
    color: '#636366',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  infoKey: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#007AFF',
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  requestBtn: {
    height: 44,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  emptyText: {
    fontSize: 13,
    color: '#8E8E93',
    paddingVertical: 12,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  reqLeft: {
    gap: 2,
    flex: 1,
  },
  reqDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  reqReason: {
    fontSize: 12,
    color: '#8E8E93',
  },
  helpList: {
    gap: 10,
    marginTop: 8,
  },
  helpItem: {
    fontSize: 13,
    color: '#636366',
    lineHeight: 18,
  },
  helpBold: {
    fontWeight: '600',
    color: '#000000',
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
  modalErrorBox: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  modalErrorText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  modalInput: {
    height: 46,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#000000',
  },
  modalTextArea: {
    height: 76,
    paddingTop: 10,
    textAlignVertical: 'top',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

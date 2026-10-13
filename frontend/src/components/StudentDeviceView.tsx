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
        return { bg: '#dcfce7', text: '#15803d' };
      case 'pending':
        return { bg: '#fef3c7', text: '#b45309' };
      case 'revoked':
      case 'rejected':
        return { bg: '#fee2e2', text: '#b91c1c' };
      default:
        return { bg: '#f3f4f6', text: '#374151' };
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Device Binding & Security</Text>
        <Pressable onPress={loadData}>
          <Text style={styles.refreshLink}>Refresh</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
      ) : (
        <>
          {/* Active Device Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Registered Active Device</Text>
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
                  <Text style={styles.infoLabel}>Device Name:</Text>
                  <Text style={styles.infoValue}>{device.device_label}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Platform:</Text>
                  <Text style={styles.infoValue}>{device.platform.toUpperCase()}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Public Key Fingerprint:</Text>
                  <Text style={styles.infoKey}>
                    {device.public_key.slice(0, 16)}...{device.public_key.slice(-8)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Registered On:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(device.registered_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Last Seen:</Text>
                  <Text style={styles.infoValue}>
                    {device.last_seen_at
                      ? new Date(device.last_seen_at).toLocaleTimeString()
                      : 'Just now'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>
                No device is registered yet. One will be bound on your first scan.
              </Text>
            )}

            <Pressable
              style={({ pressed }) => [styles.requestBtn, pressed && styles.btnPressed]}
              onPress={() => setIsModalOpen(true)}
            >
              <Text style={styles.requestBtnText}>Request Device Change</Text>
            </Pressable>
          </View>

          {/* Change Requests History */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Device Change Requests</Text>
            {requests.length === 0 ? (
              <Text style={styles.emptyText}>No device change requests found.</Text>
            ) : (
              requests.map((r) => {
                const sStyle = getStatusBadgeStyle(r.status);
                return (
                  <View key={r.id} style={styles.requestItem}>
                    <View style={styles.reqLeft}>
                      <Text style={styles.reqDate}>
                        Submitted: {new Date(r.created_at).toLocaleDateString()}
                      </Text>
                      {r.reason && (
                        <Text style={styles.reqReason}>Reason: {r.reason}</Text>
                      )}
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

          {/* Security & Troubleshooting Guidance */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Security & Troubleshooting</Text>
            <View style={styles.helpList}>
              <Text style={styles.helpItem}>
                &bull; <Text style={styles.helpBold}>One Active Device Constraint:</Text> Each student
                may have only 1 registered device. Swapping devices requires administrative approval to
                prevent proxy attendance.
              </Text>
              <Text style={styles.helpItem}>
                &bull; <Text style={styles.helpBold}>Foreground Scanning:</Text> OS policies restrict
                Bluetooth scanning in the background. Keep the app open when attendance is initiated.
              </Text>
              <Text style={styles.helpItem}>
                &bull; <Text style={styles.helpBold}>Proximity Policy:</Text> You must be within &ge;
                -75 dBm of the instructor. Sit in the designated classroom area.
              </Text>
              <Text style={styles.helpItem}>
                &bull; <Text style={styles.helpBold}>Live Relay Notice:</Text> Rotating proof prevents
                replay attacks; real-time relay across network hops is audited and monitored via attempt
                telemetry.
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
                placeholder="e.g. iPhone 15 Pro, Pixel 8"
                placeholderTextColor="#9ca3af"
                value={newLabel}
                onChangeText={setNewLabel}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason for Change</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="e.g. Upgraded phone, previous device broken"
                placeholderTextColor="#9ca3af"
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
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleRequestChange}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  deviceDetails: {
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  infoKey: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#2563eb',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  requestBtn: {
    height: 40,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  btnPressed: {
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  reqLeft: {
    gap: 2,
    flex: 1,
  },
  reqDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  reqReason: {
    fontSize: 12,
    color: '#6b7280',
  },
  helpList: {
    gap: 10,
    marginTop: 8,
  },
  helpItem: {
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 18,
  },
  helpBold: {
    fontWeight: '700',
    color: '#111827',
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
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
  },
  modalErrorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  modalErrorText: {
    fontSize: 12,
    color: '#b91c1c',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  modalInput: {
    height: 42,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#111827',
  },
  modalTextArea: {
    height: 72,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

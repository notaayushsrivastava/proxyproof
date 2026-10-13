import * as Crypto from 'expo-crypto';
import * as DeviceInfo from 'expo-device';
import { Platform } from 'react-native';
import { storage } from './storage';
import { api } from './api';

const DEVICE_KEY_STORAGE = 'proxyproof_device_public_key';
const DEVICE_ID_STORAGE = 'proxyproof_device_client_id';

export interface LocalDeviceIdentity {
  publicKey: string;
  platform: 'ios' | 'android' | 'other';
  deviceLabel: string;
}

export async function getOrCreateLocalDeviceIdentity(): Promise<LocalDeviceIdentity> {
  let publicKey = await storage.getItem(DEVICE_KEY_STORAGE);
  let clientId = await storage.getItem(DEVICE_ID_STORAGE);

  if (!publicKey || !clientId) {
    clientId = Crypto.randomUUID();
    // Simulate / generate a high-entropy device public key string
    const entropy = `${clientId}-${Date.now()}-${Platform.OS}`;
    publicKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      entropy
    );
    await storage.setItem(DEVICE_ID_STORAGE, clientId);
    await storage.setItem(DEVICE_KEY_STORAGE, publicKey);
  }

  const modelName = DeviceInfo.modelName || (Platform.OS === 'web' ? 'Web Browser' : 'Mobile Device');
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';

  return {
    publicKey,
    platform,
    deviceLabel: `${modelName} (${Platform.OS})`,
  };
}

export async function ensureStudentDeviceRegistered(): Promise<void> {
  try {
    // Check if device already exists on server
    const currentDevice = await api.getMyDevice();
    if (currentDevice) {
      return; // Already registered
    }
  } catch {
    // If not found (404), register
  }

  try {
    const local = await getOrCreateLocalDeviceIdentity();
    await api.registerDevice({
      public_key: local.publicKey,
      platform: local.platform,
      device_label: local.deviceLabel,
    });
  } catch (err) {
    console.warn('Device auto-registration notice:', err);
  }
}

import { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { api } from '../services/api';

type BackendStatus = 'checking' | 'online' | 'offline';

interface BackendStatusDotProps {
  style?: StyleProp<ViewStyle>;
}

const STATUS_COLORS: Record<BackendStatus, string> = {
  checking: '#FF9500',
  online: '#34C759',
  offline: '#FF3B30',
};

export function BackendStatusDot({ style }: BackendStatusDotProps) {
  const [status, setStatus] = useState<BackendStatus>('checking');

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        await api.checkHealth();
        if (active) setStatus('online');
      } catch {
        if (active) setStatus('offline');
      }
    };

    void checkStatus();
    const interval = setInterval(() => void checkStatus(), 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Service ${status}`}
      style={[styles.dot, { backgroundColor: STATUS_COLORS[status] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

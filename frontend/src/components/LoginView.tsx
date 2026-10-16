import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useAuth } from '../store/auth';
import { api, getDefaultBaseUrl } from '../services/api';
import { Logo } from './ui/Logo';

export function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiHost = getDefaultBaseUrl();
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    api.checkHealth()
      .then(() => { if (mounted) setIsHealthy(true); })
      .catch(() => { if (mounted) setIsHealthy(false); });
    return () => { mounted = false; };
  }, [apiHost]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillQuickAccount = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.headerBox}>
            <View style={styles.logoWrapper}>
              <Logo size={62} variant="full" />
            </View>
            <View style={styles.badgeBox}>
              <Text style={styles.badgeText}>VERIFIED ATTENDANCE SYSTEM</Text>
            </View>
            <Text style={styles.subtitle}>
              Cryptographically verified check-in for students and faculty
            </Text>
          </View>

          {isHealthy === false && (
            <View style={styles.warningBox}>
              <AlertCircle size={15} color="#FF9500" strokeWidth={2.2} />
              <Text style={styles.warningText}>
                Cannot reach server at {apiHost}. Make sure the backend service is running.
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Institutional Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. student1@proxyproof.local"
              placeholderTextColor="#8E8E93"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#8E8E93"
              secureTextEntry
              autoCapitalize="none"
              editable={!isSubmitting}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              isSubmitting && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleLogin}
            disabled={isSubmitting}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>QUICK DEMO ACCOUNTS</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.quickButtons}>
            <Pressable
              style={({ pressed }) => [styles.quickButton, pressed && styles.quickButtonPressed]}
              onPress={() =>
                fillQuickAccount('student1@proxyproof.local', 'Password123!')
              }
              accessibilityRole="button"
            >
              <View style={styles.quickRolePill}>
                <Text style={styles.quickRoleText}>Student (Alice)</Text>
              </View>
              <Text style={styles.quickEmailText}>student1@proxyproof.local</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.quickButton, pressed && styles.quickButtonPressed]}
              onPress={() =>
                fillQuickAccount('organizer@proxyproof.local', 'Password123!')
              }
              accessibilityRole="button"
            >
              <View style={[styles.quickRolePill, styles.quickRoleOrg]}>
                <Text style={[styles.quickRoleText, styles.quickRoleTextOrg]}>Organizer (Turing)</Text>
              </View>
              <Text style={styles.quickEmailText}>organizer@proxyproof.local</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.quickButton, pressed && styles.quickButtonPressed]}
              onPress={() =>
                fillQuickAccount('admin@proxyproof.local', 'Password123!')
              }
              accessibilityRole="button"
            >
              <View style={[styles.quickRolePill, styles.quickRoleAdmin]}>
                <Text style={[styles.quickRoleText, styles.quickRoleTextAdmin]}>Admin (System)</Text>
              </View>
              <Text style={styles.quickEmailText}>admin@proxyproof.local</Text>
            </Pressable>
          </View>

          <View style={styles.footerNote}>
            <View style={styles.statusPillBadge}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isHealthy ? '#34C759' : isHealthy === false ? '#FF3B30' : '#FF9500' },
                ]}
              />
              <Text style={styles.footerNoteText}>
                {apiHost} ({isHealthy ? 'Connected' : isHealthy === false ? 'Offline' : 'Connecting...'})
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoWrapper: {
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 157, 150, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#009D96',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 14,
    color: '#5A697E',
    textAlign: 'center',
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    textAlign: 'center',
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B192C',
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  input: {
    height: 48,
    backgroundColor: '#F2F4F7',
    borderWidth: 1,
    borderColor: '#E2E6ED',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0B192C',
  },
  primaryButton: {
    height: 50,
    backgroundColor: '#0B284C',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#0B284C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D1D1D6',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.6,
  },
  quickButtons: {
    gap: 8,
  },
  quickButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },
  quickRolePill: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  quickRoleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
  },
  quickRoleOrg: {
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
  },
  quickRoleTextOrg: {
    color: '#FF9500',
  },
  quickRoleAdmin: {
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
  },
  quickRoleTextAdmin: {
    color: '#FF2D55',
  },
  quickEmailText: {
    fontSize: 12,
    color: '#636366',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#D97706',
    textAlign: 'left',
    lineHeight: 17,
  },
  footerNote: {
    marginTop: 20,
    alignItems: 'center',
  },
  statusPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footerNoteText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
});

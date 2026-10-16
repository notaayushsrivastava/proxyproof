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
import { AlertCircle, ArrowLeft, Building2 } from 'lucide-react-native';
import { useAuth } from '../store/auth';
import { api, getDefaultBaseUrl } from '../services/api';
import { Logo } from './ui/Logo';

interface LoginViewProps {
  onNavigateToRegister?: () => void;
  onNavigateToLanding?: () => void;
}

export function LoginView({
  onNavigateToRegister,
  onNavigateToLanding,
}: LoginViewProps) {
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          {/* Back Navigation Button */}
          {onNavigateToLanding && (
            <Pressable
              style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
              onPress={onNavigateToLanding}
              accessibilityRole="button"
            >
              <ArrowLeft size={16} color="#0B284C" strokeWidth={2.4} />
              <Text style={styles.backBtnText}>Back to Welcome</Text>
            </Pressable>
          )}

          <View style={styles.headerBox}>
            <View style={styles.logoWrapper}>
              <Logo size={58} variant="full" />
            </View>
            <View style={styles.badgeBox}>
              <Text style={styles.badgeText}>INSTITUTIONAL LOGIN</Text>
            </View>
            <Text style={styles.subtitle}>
              Sign in with your campus student, faculty, or administrator credentials
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
            <Text style={styles.label}>Campus Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. yourname@university.edu"
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

          {/* Real Register Institution Banner */}
          {onNavigateToRegister && (
            <View style={styles.instBanner}>
              <View style={styles.instBannerLeft}>
                <Building2 size={18} color="#009D96" strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.instBannerTitle}>Registering an Institution?</Text>
                  <Text style={styles.instBannerSub}>
                    Setup your campus console &amp; access policy controls
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.instBannerBtn,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onNavigateToRegister}
                accessibilityRole="button"
              >
                <Text style={styles.instBannerBtnText}>Register</Text>
              </Pressable>
            </View>
          )}

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
    padding: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B284C',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    marginBottom: 12,
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
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#009D96',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.25)',
  },
  warningText: {
    flex: 1,
    fontSize: 11.5,
    color: '#D97706',
    lineHeight: 15,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000000',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  primaryButton: {
    backgroundColor: '#009D96',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#009D96',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  btnPressed: {
    opacity: 0.7,
  },
  instBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 157, 150, 0.07)',
    borderRadius: 14,
    padding: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 157, 150, 0.2)',
    gap: 10,
  },
  instBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  instBannerTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0B284C',
  },
  instBannerSub: {
    fontSize: 10.5,
    color: '#636366',
    marginTop: 1,
  },
  instBannerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#009D96',
  },
  instBannerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerNote: {
    alignItems: 'center',
    marginTop: 20,
  },
  statusPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footerNoteText: {
    fontSize: 10.5,
    color: '#8E8E93',
    fontWeight: '500',
  },
});

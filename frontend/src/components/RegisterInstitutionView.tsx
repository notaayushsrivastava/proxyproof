import React, { useState } from 'react';
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
import {
  Building2,
  ShieldCheck,
  ArrowLeft,
  Lock,
  Mail,
  User as UserIcon,
  Globe,
  Layers,
  CheckCircle2,
} from 'lucide-react-native';
import { useAuth } from '../store/auth';
import { Logo } from './ui/Logo';

interface RegisterInstitutionViewProps {
  onBackToLanding: () => void;
  onNavigateToLogin: () => void;
}

export function RegisterInstitutionView({
  onBackToLanding,
  onNavigateToLogin,
}: RegisterInstitutionViewProps) {
  const { registerInstitution } = useAuth();

  const [institutionName, setInstitutionName] = useState('');
  const [institutionCode, setInstitutionCode] = useState('');
  const [domain, setDomain] = useState('');
  const [department, setDepartment] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (
      !institutionName.trim() ||
      !institutionCode.trim() ||
      !domain.trim() ||
      !adminName.trim() ||
      !adminEmail.trim() ||
      !password
    ) {
      setError('Please fill in all required institutional and administrator fields.');
      return;
    }

    if (password.length < 8) {
      setError('Administrator password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password entry.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await registerInstitution({
        institution_name: institutionName.trim(),
        institution_code: institutionCode.trim().toUpperCase(),
        domain: domain.trim().toLowerCase(),
        department: department.trim() || undefined,
        admin_name: adminName.trim(),
        admin_email: adminEmail.trim().toLowerCase(),
        admin_password: password,
      });
      // Upon successful registration, AuthProvider automatically logs in the admin user
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Institution registration failed. Please verify your inputs.');
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
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
            onPress={onBackToLanding}
            accessibilityRole="button"
          >
            <ArrowLeft size={16} color="#0B284C" strokeWidth={2.4} />
            <Text style={styles.backBtnText}>Back to Welcome</Text>
          </Pressable>

          {/* Header */}
          <View style={styles.headerBox}>
            <View style={styles.logoRow}>
              <Logo size={48} variant="mark" />
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle}>Register Institution</Text>
                <Text style={styles.headerSub}>
                  University, College &amp; Campus Management Console
                </Text>
              </View>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Section 1: Institution Profile */}
          <View style={styles.sectionTitleRow}>
            <Building2 size={16} color="#009D96" strokeWidth={2.2} />
            <Text style={styles.sectionTitleText}>INSTITUTION INFORMATION</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Institution / University Name *</Text>
            <TextInput
              style={styles.input}
              value={institutionName}
              onChangeText={setInstitutionName}
              placeholder="e.g. Vellore Institute of Technology"
              placeholderTextColor="#8E8E93"
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.rowTwoCols}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Campus Code *</Text>
              <TextInput
                style={styles.input}
                value={institutionCode}
                onChangeText={setInstitutionCode}
                placeholder="e.g. VIT"
                placeholderTextColor="#8E8E93"
                autoCapitalize="characters"
                editable={!isSubmitting}
              />
            </View>

            <View style={[styles.formGroup, { flex: 1.3 }]}>
              <Text style={styles.label}>Campus Domain *</Text>
              <TextInput
                style={styles.input}
                value={domain}
                onChangeText={setDomain}
                placeholder="e.g. vit.ac.in"
                placeholderTextColor="#8E8E93"
                autoCapitalize="none"
                keyboardType="url"
                editable={!isSubmitting}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Department / Faculty Division (Optional)</Text>
            <TextInput
              style={styles.input}
              value={department}
              onChangeText={setDepartment}
              placeholder="e.g. School of Computer Science & Engineering"
              placeholderTextColor="#8E8E93"
              editable={!isSubmitting}
            />
          </View>

          {/* Section 2: Administrator Profile */}
          <View style={[styles.sectionTitleRow, { marginTop: 12 }]}>
            <ShieldCheck size={16} color="#009D96" strokeWidth={2.2} />
            <Text style={styles.sectionTitleText}>CAMPUS ADMINISTRATOR ACCOUNT</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Administrator Full Name *</Text>
            <TextInput
              style={styles.input}
              value={adminName}
              onChangeText={setAdminName}
              placeholder="e.g. Dean of Academic Affairs"
              placeholderTextColor="#8E8E93"
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Official Campus Email *</Text>
            <TextInput
              style={styles.input}
              value={adminEmail}
              onChangeText={setAdminEmail}
              placeholder="e.g. dean.academics@vit.ac.in"
              placeholderTextColor="#8E8E93"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.rowTwoCols}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Password *</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min 8 chars"
                placeholderTextColor="#8E8E93"
                secureTextEntry
                editable={!isSubmitting}
              />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Confirm Password *</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat password"
                placeholderTextColor="#8E8E93"
                secureTextEntry
                editable={!isSubmitting}
              />
            </View>
          </View>

          {/* Security Features Activated */}
          <View style={styles.securityBox}>
            <View style={styles.securityRow}>
              <CheckCircle2 size={14} color="#34C759" strokeWidth={2.4} />
              <Text style={styles.securityText}>
                Hardware-Level Device Binding (1-Student-1-Phone) Enforced
              </Text>
            </View>
            <View style={styles.securityRow}>
              <CheckCircle2 size={14} color="#34C759" strokeWidth={2.4} />
              <Text style={styles.securityText}>
                5s Rotating Cryptographic Beacons &amp; Tamper-Proof Logs
              </Text>
            </View>
            <View style={styles.securityRow}>
              <CheckCircle2 size={14} color="#34C759" strokeWidth={2.4} />
              <Text style={styles.securityText}>
                Full Administrator Console Access Provided Instantly
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              isSubmitting && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleRegister}
            disabled={isSubmitting}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Register &amp; Launch Console</Text>
            )}
          </Pressable>

          {/* Switch to Login */}
          <View style={styles.switchLoginWrap}>
            <Text style={styles.switchLoginText}>Already registered your campus?</Text>
            <Pressable onPress={onNavigateToLogin}>
              <Text style={styles.switchLoginLink}>Sign in here</Text>
            </Pressable>
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
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 24 : 32,
    paddingBottom: 40,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B284C',
  },
  headerBox: {
    marginBottom: 20,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0B284C',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  sectionTitleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#009D96',
    letterSpacing: 0.6,
  },
  formGroup: {
    marginBottom: 14,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#000000',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  securityBox: {
    backgroundColor: 'rgba(0, 157, 150, 0.06)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 157, 150, 0.18)',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  securityText: {
    fontSize: 11.5,
    color: '#0B284C',
    fontWeight: '600',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#009D96',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#009D96',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
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
  switchLoginWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },
  switchLoginText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  switchLoginLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#009D96',
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
});

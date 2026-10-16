import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import {
  Radio,
  Smartphone,
  ShieldCheck,
  Building2,
  ArrowRight,
  Zap,
  Download,
  Users,
} from 'lucide-react-native';
import { Logo } from './ui/Logo';
import { BackendStatusDot } from './BackendStatusDot';

const APK_DOWNLOAD_URL =
  'https://github.com/notaayushsrivastava/proxyproof/releases/latest/download/proxyproof.apk';

interface LandingViewProps {
  onSignIn: () => void;
  onRegisterInstitution: () => void;
}

export function LandingView({ onSignIn, onRegisterInstitution }: LandingViewProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Navigation */}
      <View style={styles.navbar}>
        <View style={styles.brandRow}>
          <Logo size={36} variant="mark" dark={false} />
          <View>
            <Text style={styles.brandTitle}>ProxyProof</Text>
            <Text style={styles.brandTagline}>Verified BLE Attendance</Text>
          </View>
        </View>

        <View style={styles.navActions}>
          <Pressable
            style={({ pressed }) => [styles.navBtnSecondary, pressed && styles.btnPressed]}
            onPress={onRegisterInstitution}
            accessibilityRole="button"
          >
            <Building2 size={14} color="#0B284C" strokeWidth={2.2} />
            <Text style={styles.navBtnSecondaryText}>Register</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.navBtnPrimary, pressed && styles.btnPressed]}
            onPress={onSignIn}
            accessibilityRole="button"
          >
            <Text style={styles.navBtnPrimaryText}>Sign In</Text>
          </Pressable>
          <BackendStatusDot style={styles.navStatusDot} />
        </View>
      </View>

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.badgePill}>
          <ShieldCheck size={13} color="#009D96" strokeWidth={2.4} />
          <Text style={styles.badgePillText}>ZERO-FRAUD CLASSROOM CHECK-IN</Text>
        </View>

        <Text style={styles.heroTitle}>
          Attendance That Can’t Be Faked.
        </Text>

        <Text style={styles.heroSubtitle}>
          Rotating Bluetooth Low Energy beacons verify student physical presence in under 350ms. No QR code sharing, no WhatsApp forwarding, no proxy attendance.
        </Text>

        <View style={styles.heroButtonGroup}>
          <Pressable
            style={({ pressed }) => [styles.heroPrimaryBtn, pressed && styles.btnPressed]}
            onPress={onSignIn}
            accessibilityRole="button"
          >
            <Text style={styles.heroPrimaryBtnText}>Launch Portal</Text>
            <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.heroSecondaryBtn, pressed && styles.btnPressed]}
            onPress={onRegisterInstitution}
            accessibilityRole="button"
          >
            <Building2 size={16} color="#0B284C" strokeWidth={2.2} />
            <Text style={styles.heroSecondaryBtnText}>Register Your Institution</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.heroDownloadBtn, pressed && styles.btnPressed]}
            onPress={() => {
              if (Platform.OS === 'web') {
                window.location.href = '/download';
              } else {
                Linking.openURL(APK_DOWNLOAD_URL).catch(() => {});
              }
            }}
            accessibilityRole="button"
          >
            <Download size={15} color="#009D96" strokeWidth={2.2} />
            <Text style={styles.heroDownloadBtnText}>Download Mobile App</Text>
          </Pressable>
        </View>
      </View>

      {/* Key Architectural Pillars */}
      <View style={styles.section}>
        <Text style={styles.sectionKicker}>SECURITY ARCHITECTURE</Text>
        <Text style={styles.sectionHeader}>Why Legacy Methods Fail</Text>

        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(0, 157, 150, 0.12)' }]}>
              <Radio size={24} color="#009D96" strokeWidth={2.2} />
            </View>
            <Text style={styles.featureTitle}>5-Second Rotating Beacon</Text>
            <Text style={styles.featureDesc}>
              The instructor’s device broadcasts rotating cryptographic nonces that expire immediately. Codes cannot be shared on WhatsApp or screenshotted.
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(11, 40, 76, 0.08)' }]}>
              <Smartphone size={24} color="#0B284C" strokeWidth={2.2} />
            </View>
            <Text style={styles.featureTitle}>1 Student = 1 Phone</Text>
            <Text style={styles.featureDesc}>
              Strict hardware-level identity binding. A student cannot carry a classmate’s phone or mark attendance on multiple accounts.
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(52, 199, 89, 0.12)' }]}>
              <Zap size={24} color="#34C759" strokeWidth={2.2} />
            </View>
            <Text style={styles.featureTitle}>Instant Classroom Sync</Text>
            <Text style={styles.featureDesc}>
              Roll-call completes seamlessly in the background as students walk into the lecture hall. Zero class disruption or roll-call queues.
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(0, 122, 255, 0.10)' }]}>
              <Users size={24} color="#007AFF" strokeWidth={2.2} />
            </View>
            <Text style={styles.featureTitle}>Roster &amp; Faculty Management</Text>
            <Text style={styles.featureDesc}>
              Single-click CSV roster imports, individual instructor onboarding, and automatic student roll-number synchronization across courses.
            </Text>
          </View>
        </View>
      </View>

      {/* How it Works */}
      <View style={styles.section}>
        <Text style={styles.sectionKicker}>STREAMLINED WORKFLOW</Text>
        <Text style={styles.sectionHeader}>Three Simple Steps</Text>

        <View style={styles.stepsList}>
          <View style={styles.stepItem}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepTextContent}>
              <Text style={styles.stepTitle}>Instructor Starts Session</Text>
              <Text style={styles.stepSub}>
                Professor taps &quot;Start Session&quot; in their app. The phone begins transmitting an encrypted micro-beacon across the lecture hall.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepTextContent}>
              <Text style={styles.stepTitle}>Student Phones Listen</Text>
              <Text style={styles.stepSub}>
                Students open ProxyProof. The app receives the beacon, proves proximity cryptographically, and records attendance instantly.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepTextContent}>
              <Text style={styles.stepTitle}>Live Dashboard Updates</Text>
              <Text style={styles.stepSub}>
                The instructor views real-time attendance counts on screen and closes the session when the lecture begins.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Institutional Callout */}
      <View style={styles.institutionCalloutCard}>
        <View style={styles.calloutHeader}>
          <Building2 size={24} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.calloutTitle}>Deploy Across Your Campus</Text>
        </View>
        <Text style={styles.calloutBody}>
          Replace expensive biometric turnstiles and paper rosters with high-speed Bluetooth verification. Designed for university lectures, laboratories, and institutional audits.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.calloutBtn, pressed && styles.btnPressed]}
          onPress={onRegisterInstitution}
          accessibilityRole="button"
        >
          <Text style={styles.calloutBtnText}>Register Institution Free</Text>
          <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLinks}>
          <Pressable onPress={() => Linking.openURL('https://proxyproof.aayushsrivastava.com/privacy')}>
            <Text style={styles.footerLinkText}>Privacy</Text>
          </Pressable>
          <Text style={{ color: '#8E8E93' }}>&bull;</Text>
          <Pressable onPress={() => Linking.openURL('https://proxyproof.aayushsrivastava.com/terms')}>
            <Text style={styles.footerLinkText}>Terms</Text>
          </Pressable>
          <Text style={{ color: '#8E8E93' }}>&bull;</Text>
          <Pressable onPress={() => Linking.openURL('https://proxyproof.aayushsrivastava.com/contact')}>
            <Text style={styles.footerLinkText}>Contact</Text>
          </Pressable>
          <Text style={{ color: '#8E8E93' }}>&bull;</Text>
          <Pressable onPress={() => Linking.openURL('https://proxyproof.aayushsrivastava.com/download')}>
            <Text style={styles.footerLinkText}>Download</Text>
          </Pressable>
        </View>
        <Text style={styles.copyrightText}>
          &copy; {new Date().getFullYear()} ProxyProof &bull; Cryptographic Attendance Verification
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingBottom: 48,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 14 : 18,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0B284C',
    letterSpacing: -0.4,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(11, 40, 76, 0.06)',
  },
  navBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B284C',
  },
  navBtnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#009D96',
  },
  navBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSection: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 32,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 157, 150, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0, 157, 150, 0.25)',
    marginBottom: 16,
  },
  badgePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#009D96',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0B284C',
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: 36,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 14.5,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 420,
    marginBottom: 26,
  },
  heroButtonGroup: {
    width: '100%',
    maxWidth: 380,
    gap: 12,
    marginBottom: 12,
  },
  heroPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#009D96',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#009D96',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  heroPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(11, 40, 76, 0.06)',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(11, 40, 76, 0.12)',
  },
  heroSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B284C',
  },
  heroDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 157, 150, 0.08)',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 157, 150, 0.20)',
  },
  heroDownloadBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#009D96',
  },
  navStatusDot: {
    marginLeft: 2,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  sectionKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#009D96',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionHeader: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B284C',
    letterSpacing: -0.4,
    marginBottom: 18,
  },
  featuresGrid: {
    gap: 14,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B284C',
    marginBottom: 6,
  },
  featureDesc: {
    fontSize: 13,
    color: '#636366',
    lineHeight: 19,
  },
  stepsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  stepItem: {
    flexDirection: 'row',
    gap: 16,
  },
  stepNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 157, 150, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#009D96',
  },
  stepTextContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B284C',
    marginBottom: 4,
  },
  stepSub: {
    fontSize: 12.5,
    color: '#636366',
    lineHeight: 18,
  },
  institutionCalloutCard: {
    marginHorizontal: 20,
    marginTop: 32,
    backgroundColor: '#0B284C',
    borderRadius: 22,
    padding: 24,
    shadowColor: '#0B284C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  calloutTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  calloutBody: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
    marginBottom: 18,
  },
  calloutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#009D96',
    paddingVertical: 13,
    borderRadius: 12,
  },
  calloutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 36,
    alignItems: 'center',
    gap: 8,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#009D96',
  },
  copyrightText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

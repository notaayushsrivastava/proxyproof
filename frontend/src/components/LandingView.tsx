import React, { useEffect, useState } from 'react';
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
  CheckCircle2,
  Mail,
  Lock,
  Layers,
} from 'lucide-react-native';
import { Logo } from './ui/Logo';
import { api, getDefaultBaseUrl } from '../services/api';

interface LandingViewProps {
  onSignIn: () => void;
  onRegisterInstitution: () => void;
}

export function LandingView({ onSignIn, onRegisterInstitution }: LandingViewProps) {
  const [isServerHealthy, setIsServerHealthy] = useState<boolean | null>(null);
  const apiHost = getDefaultBaseUrl();

  useEffect(() => {
    let mounted = true;
    api.checkHealth()
      .then(() => { if (mounted) setIsServerHealthy(true); })
      .catch(() => { if (mounted) setIsServerHealthy(false); });
    return () => { mounted = false; };
  }, [apiHost]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Navigation */}
      <View style={styles.navbar}>
        <View style={styles.brandRow}>
          <Logo size={36} variant="mark" />
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
          Cryptographic Bluetooth Low Energy beacons combined with hardware-locked device identity. 100% verified physical presence, zero buddy punching.
        </Text>

        {/* CTA Button Group */}
        <View style={styles.heroButtonGroup}>
          <Pressable
            style={({ pressed }) => [styles.heroPrimaryBtn, pressed && styles.btnPressed]}
            onPress={onSignIn}
            accessibilityRole="button"
          >
            <Text style={styles.heroPrimaryBtnText}>Sign In to Campus</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.heroSecondaryBtn, pressed && styles.btnPressed]}
            onPress={onRegisterInstitution}
            accessibilityRole="button"
          >
            <Building2 size={18} color="#0B284C" strokeWidth={2.2} />
            <Text style={styles.heroSecondaryBtnText}>Register Institution</Text>
          </Pressable>
        </View>

        {/* Server Status Pill */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isServerHealthy ? '#34C759' : isServerHealthy === false ? '#FF3B30' : '#FF9500' },
            ]}
          />
          <Text style={styles.statusText}>
            Campus Core: {isServerHealthy ? 'Connected & Active' : isServerHealthy === false ? 'Offline' : 'Connecting...'}
          </Text>
        </View>
      </View>

      {/* Value Pillars */}
      <View style={styles.section}>
        <Text style={styles.sectionKicker}>SECURITY ARCHITECTURE</Text>
        <Text style={styles.sectionHeader}>Why Universities Trust ProxyProof</Text>

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
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(11, 40, 76, 0.10)' }]}>
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
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 45, 85, 0.10)' }]}>
              <Lock size={24} color="#FF2D55" strokeWidth={2.2} />
            </View>
            <Text style={styles.featureTitle}>Immutable Audit Trail</Text>
            <Text style={styles.featureDesc}>
              Every verification attempt, device change, and manual modification is logged with timestamps and cryptographic proof for academic compliance.
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
                Professor taps "Start Session" in their app. The phone begins transmitting an encrypted micro-beacon across the lecture hall.
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
              <Text style={styles.stepTitle}>Live Ledger &amp; Export</Text>
              <Text style={styles.stepSub}>
                Faculty view live check-ins on their screen and export clean attendance sheets or integrate directly with campus LMS systems.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Institutional Callout */}
      <View style={styles.institutionCalloutCard}>
        <View style={styles.calloutHeader}>
          <Building2 size={24} color="#009D96" strokeWidth={2.2} />
          <Text style={styles.calloutTitle}>Deploy Across Your Campus</Text>
        </View>
        <Text style={styles.calloutBody}>
          Setup takes less than 2 minutes. Register your university, college, or department to grant management access, enforce device policies, and eliminate attendance fraud.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.calloutBtn, pressed && styles.btnPressed]}
          onPress={onRegisterInstitution}
          accessibilityRole="button"
        >
          <Text style={styles.calloutBtnText}>Register Your Institution</Text>
          <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLinks}>
          <Pressable onPress={() => Linking.openURL('mailto:aayush@aayushsrivastava.com')}>
            <Text style={styles.footerLinkText}>Inquiries: aayush@aayushsrivastava.com</Text>
          </Pressable>
        </View>
        <Text style={styles.copyrightText}>
          Copyright © 2026 ProxyProof. Created by Aayush Srivastava.
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
    borderBottomColor: 'rgba(0,0,0,0.08)',
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
    backgroundColor: 'rgba(11, 40, 76, 0.08)',
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
    borderBottomColor: 'rgba(0,0,0,0.06)',
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
    marginBottom: 20,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
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
    borderColor: 'rgba(0,0,0,0.06)',
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
    borderColor: 'rgba(0,0,0,0.06)',
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

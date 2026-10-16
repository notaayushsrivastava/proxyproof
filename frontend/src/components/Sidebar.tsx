import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import {
  X,
  LogOut,
  Settings,
  Shield,
  Radio,
  Smartphone,
  CheckCircle2,
  Mail,
  ExternalLink,
} from 'lucide-react-native';
import { useAuth } from '../store/auth';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();

  if (!user) return null;

  const roleColors: Record<string, { bg: string; text: string; label: string }> = {
    student: { bg: 'rgba(0, 157, 150, 0.12)', text: '#009D96', label: 'STUDENT' },
    organizer: { bg: 'rgba(11, 40, 76, 0.10)', text: '#0B284C', label: 'INSTRUCTOR' },
    admin: { bg: 'rgba(255, 45, 85, 0.12)', text: '#FF2D55', label: 'ADMINISTRATOR' },
  };

  const currentRole = roleColors[user.role] || {
    bg: 'rgba(142, 142, 147, 0.12)',
    text: '#8E8E93',
    label: user.role.toUpperCase(),
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close sidebar"
        />

        <View style={styles.drawerContainer}>
          {/* Drawer Header */}
          <View style={styles.drawerHeader}>
            <View style={styles.headerTitleRow}>
              <Settings size={18} color="#000000" strokeWidth={2.2} />
              <Text style={styles.drawerTitle}>Settings & Profile</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color="#636366" strokeWidth={2.4} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* User Profile Card */}
            <View style={styles.userCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{getInitials(user.full_name)}</Text>
              </View>

              <View style={styles.userTextInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.full_name}
                </Text>
                <Text style={styles.userEmail} numberOfLines={1}>
                  {user.email}
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: currentRole.bg }]}>
                  <Shield size={11} color={currentRole.text} strokeWidth={2.2} />
                  <Text style={[styles.roleBadgeText, { color: currentRole.text }]}>
                    {currentRole.label}
                  </Text>
                </View>
              </View>
            </View>

            {/* Device Status */}
            <View style={styles.sectionCard}>
              <View style={styles.statusRow}>
                <View style={styles.statusRowLeft}>
                  <Radio size={16} color="#34C759" strokeWidth={2.2} />
                  <View>
                    <Text style={styles.statusRowTitle}>Bluetooth Low Energy</Text>
                    <Text style={styles.statusRowSub}>Hardware ready for check-in</Text>
                  </View>
                </View>
                <View style={styles.badgeReady}>
                  <CheckCircle2 size={12} color="#34C759" strokeWidth={2.2} />
                  <Text style={styles.badgeReadyText}>Ready</Text>
                </View>
              </View>

              <View style={[styles.statusRow, { borderBottomWidth: 0 }]}>
                <View style={styles.statusRowLeft}>
                  <Smartphone size={16} color="#8E8E93" strokeWidth={2.2} />
                  <View>
                    <Text style={styles.statusRowTitle}>ProxyProof App</Text>
                    <Text style={styles.statusRowSub}>Version 1.0.0 (Build 2026.1)</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Support & Contact Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Mail size={14} color="#009D96" strokeWidth={2.2} />
                <Text style={styles.sectionHeader}>SUPPORT & CONTACT</Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.contactCard,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => {
                  Linking.openURL('mailto:aayush@aayushsrivastava.com?subject=ProxyProof%20Mobile%20App%20Support');
                }}
                accessibilityRole="button"
                accessibilityLabel="Contact Support at aayush@aayushsrivastava.com"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactTitle}>Need Help or Device Reset?</Text>
                  <Text style={styles.contactEmail}>aayush@aayushsrivastava.com</Text>
                </View>
                <ExternalLink size={16} color="#009D96" strokeWidth={2} />
              </Pressable>
            </View>

            {/* Logout Action Button */}
            <Pressable
              style={({ pressed }) => [styles.logoutBtn, pressed && styles.btnPressed]}
              onPress={() => {
                onClose();
                logout();
              }}
              accessibilityRole="button"
              accessibilityLabel="Log out of account"
            >
              <LogOut size={16} color="#FF3B30" strokeWidth={2.2} />
              <Text style={styles.logoutBtnText}>Log Out</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContainer: {
    width: '84%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    height: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F2F2F7',
    borderRadius: 18,
    padding: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0B284C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  userTextInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 12,
    color: '#8E8E93',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  statusRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  statusRowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  statusRowSub: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 1,
  },
  badgeReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  badgeReadyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34C759',
  },
  switchAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 12,
  },
  switchAccountBtnActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  switchAccountName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  switchAccountEmail: {
    fontSize: 11,
    color: '#8E8E93',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F7',
    padding: 14,
    borderRadius: 14,
  },
  contactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.2,
  },
  contactEmail: {
    fontSize: 12,
    color: '#009D96',
    fontWeight: '600',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3B30',
    letterSpacing: -0.2,
  },
});

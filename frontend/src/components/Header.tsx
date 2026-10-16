import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Menu } from 'lucide-react-native';
import { useAuth } from '../store/auth';
import { Logo } from './ui/Logo';
import { BackendStatusDot } from './BackendStatusDot';

interface HeaderProps {
  pageTitle: string;
  pageSubtitle?: string;
  onOpenSidebar: () => void;
}

export function Header({ pageTitle, pageSubtitle, onOpenSidebar }: HeaderProps) {
  const { user } = useAuth();

  if (!user) return null;

  const roleColors: Record<string, { bg: string; text: string }> = {
    student: { bg: 'rgba(0, 157, 150, 0.12)', text: '#009D96' },
    organizer: { bg: 'rgba(11, 40, 76, 0.10)', text: '#0B284C' },
    admin: { bg: 'rgba(255, 45, 85, 0.12)', text: '#FF2D55' },
  };

  const currentRoleStyle = roleColors[user.role] || {
    bg: 'rgba(142, 142, 147, 0.12)',
    text: '#8E8E93',
  };

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.appBrandRow}>
          <Logo size={18} variant="mark" />
          <Text style={styles.brandTitle}>ProxyProof</Text>
          <View style={[styles.roleBadge, { backgroundColor: currentRoleStyle.bg }]}>
            <Text style={[styles.roleText, { color: currentRoleStyle.text }]}>
              {user.role.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.pageTitle} numberOfLines={1}>
          {pageTitle}
        </Text>
        {pageSubtitle ? (
          <Text style={styles.pageSubtitle} numberOfLines={1}>
            {pageSubtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightControls}>
        <Pressable
          style={({ pressed }) => [styles.sidebarButton, pressed && styles.sidebarButtonPressed]}
          onPress={onOpenSidebar}
          accessibilityRole="button"
          accessibilityLabel="Open settings and profile"
        >
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <Menu size={18} color="#1C1C1E" strokeWidth={2.2} />
        </Pressable>
        <BackendStatusDot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D1D6',
  },
  left: {
    flex: 1,
    marginRight: 12,
  },
  appBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 100,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  sidebarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F2F2F7',
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sidebarButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0B284C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMiniText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

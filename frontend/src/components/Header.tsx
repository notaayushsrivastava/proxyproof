import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAuth } from '../store/auth';

interface HeaderProps {
  title?: string;
}

export function Header({ title = 'ProxyProof' }: HeaderProps) {
  const { user, logout } = useAuth();

  if (!user) return null;

  const roleColors: Record<string, { bg: string; text: string }> = {
    student: { bg: '#e0f2fe', text: '#0369a1' },
    organizer: { bg: '#fef3c7', text: '#b45309' },
    admin: { bg: '#fce7f3', text: '#be185d' },
  };

  const currentRoleStyle = roleColors[user.role] || { bg: '#f3f4f6', text: '#374151' };

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.roleBadge, { backgroundColor: currentRoleStyle.bg }]}>
          <Text style={[styles.roleText, { color: currentRoleStyle.text }]}>
            {user.role.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {user.full_name}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    alignItems: 'flex-end',
    maxWidth: 160,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  userEmail: {
    fontSize: 11,
    color: '#6b7280',
  },
  logoutButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  pressed: {
    opacity: 0.7,
  },
});

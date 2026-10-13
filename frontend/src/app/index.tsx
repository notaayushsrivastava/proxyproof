import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../store/auth';
import { Header } from '../components/Header';
import { LoginView } from '../components/LoginView';
import { StudentHomeView } from '../components/StudentHomeView';
import { StudentClassesView } from '../components/StudentClassesView';
import { StudentDeviceView } from '../components/StudentDeviceView';
import { OrganizerLiveSessionView } from '../components/OrganizerLiveSessionView';
import { OrganizerClassesView } from '../components/OrganizerClassesView';
import { OrganizerHistoryView } from '../components/OrganizerHistoryView';
import { AdminOverviewView } from '../components/AdminOverviewView';
import { AdminDeviceQueueView } from '../components/AdminDeviceQueueView';
import { AdminAuditLogsView } from '../components/AdminAuditLogsView';

type StudentTab = 'scanner' | 'classes' | 'device';
type OrganizerTab = 'live' | 'classes' | 'history';
type AdminTab = 'overview' | 'queue' | 'audit';

export default function AppEntry() {
  const { user, isAuthenticated, isLoading } = useAuth();

  const [studentTab, setStudentTab] = useState<StudentTab>('scanner');
  const [organizerTab, setOrganizerTab] = useState<OrganizerTab>('live');
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Initializing ProxyProof...</Text>
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="ProxyProof" />

      {/* Role Navigation Bar */}
      <View style={styles.navBar}>
        {user.role === 'student' && (
          <View style={styles.tabGroup}>
            <Pressable
              style={[styles.tabButton, studentTab === 'scanner' && styles.tabButtonActive]}
              onPress={() => setStudentTab('scanner')}
            >
              <Text
                style={[styles.tabText, studentTab === 'scanner' && styles.tabTextActive]}
              >
                📡 Scan
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, studentTab === 'classes' && styles.tabButtonActive]}
              onPress={() => setStudentTab('classes')}
            >
              <Text
                style={[styles.tabText, studentTab === 'classes' && styles.tabTextActive]}
              >
                📚 Classes
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, studentTab === 'device' && styles.tabButtonActive]}
              onPress={() => setStudentTab('device')}
            >
              <Text
                style={[styles.tabText, studentTab === 'device' && styles.tabTextActive]}
              >
                📱 Device
              </Text>
            </Pressable>
          </View>
        )}

        {user.role === 'organizer' && (
          <View style={styles.tabGroup}>
            <Pressable
              style={[styles.tabButton, organizerTab === 'live' && styles.tabButtonActive]}
              onPress={() => setOrganizerTab('live')}
            >
              <Text
                style={[styles.tabText, organizerTab === 'live' && styles.tabTextActive]}
              >
                ⚡ Live Session
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, organizerTab === 'classes' && styles.tabButtonActive]}
              onPress={() => setOrganizerTab('classes')}
            >
              <Text
                style={[styles.tabText, organizerTab === 'classes' && styles.tabTextActive]}
              >
                👥 Rosters
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, organizerTab === 'history' && styles.tabButtonActive]}
              onPress={() => setOrganizerTab('history')}
            >
              <Text
                style={[styles.tabText, organizerTab === 'history' && styles.tabTextActive]}
              >
                📊 Exports
              </Text>
            </Pressable>
          </View>
        )}

        {user.role === 'admin' && (
          <View style={styles.tabGroup}>
            <Pressable
              style={[styles.tabButton, adminTab === 'overview' && styles.tabButtonActive]}
              onPress={() => setAdminTab('overview')}
            >
              <Text
                style={[styles.tabText, adminTab === 'overview' && styles.tabTextActive]}
              >
                🏛️ Overview
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, adminTab === 'queue' && styles.tabButtonActive]}
              onPress={() => setAdminTab('queue')}
            >
              <Text
                style={[styles.tabText, adminTab === 'queue' && styles.tabTextActive]}
              >
                🛡️ Device Queue
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, adminTab === 'audit' && styles.tabButtonActive]}
              onPress={() => setAdminTab('audit')}
            >
              <Text
                style={[styles.tabText, adminTab === 'audit' && styles.tabTextActive]}
              >
                📜 Audit Logs
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Screen Body */}
      <View style={styles.mainContent}>
        {user.role === 'student' && (
          <>
            {studentTab === 'scanner' && <StudentHomeView />}
            {studentTab === 'classes' && <StudentClassesView />}
            {studentTab === 'device' && <StudentDeviceView />}
          </>
        )}

        {user.role === 'organizer' && (
          <>
            {organizerTab === 'live' && <OrganizerLiveSessionView />}
            {organizerTab === 'classes' && <OrganizerClassesView />}
            {organizerTab === 'history' && <OrganizerHistoryView />}
          </>
        )}

        {user.role === 'admin' && (
          <>
            {adminTab === 'overview' && <AdminOverviewView />}
            {adminTab === 'queue' && <AdminDeviceQueueView />}
            {adminTab === 'audit' && <AdminAuditLogsView />}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  navBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabGroup: {
    flexDirection: 'row',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});

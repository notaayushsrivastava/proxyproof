import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Radio,
  BookOpen,
  Smartphone,
  Zap,
  Users,
  BarChart3,
  LayoutDashboard,
  ShieldCheck,
  FileText,
} from 'lucide-react-native';
import { useAuth } from '../store/auth';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { LandingView } from '../components/LandingView';
import { LoginView } from '../components/LoginView';
import { RegisterInstitutionView } from '../components/RegisterInstitutionView';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unauthScreen, setUnauthScreen] = useState<'landing' | 'login' | 'register'>('landing');

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#009D96" />
        <Text style={styles.loadingText}>Initializing ProxyProof...</Text>
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    if (unauthScreen === 'login') {
      return (
        <LoginView
          onNavigateToRegister={() => setUnauthScreen('register')}
          onNavigateToLanding={() => setUnauthScreen('landing')}
        />
      );
    }
    if (unauthScreen === 'register') {
      return (
        <RegisterInstitutionView
          onBackToLanding={() => setUnauthScreen('landing')}
          onNavigateToLogin={() => setUnauthScreen('login')}
        />
      );
    }
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <LandingView
          onSignIn={() => setUnauthScreen('login')}
          onRegisterInstitution={() => setUnauthScreen('register')}
        />
      </SafeAreaView>
    );
  }

  const getPageInfo = () => {
    if (user.role === 'student') {
      switch (studentTab) {
        case 'scanner':
          return { title: 'Classroom Check-In', subtitle: 'Automatic Bluetooth Attendance' };
        case 'classes':
          return { title: 'Enrolled Classes', subtitle: 'Verified History & Performance' };
        case 'device':
          return { title: 'Registered Phone', subtitle: 'Security Binding & Integrity' };
      }
    } else if (user.role === 'organizer') {
      switch (organizerTab) {
        case 'live':
          return { title: 'Live Session', subtitle: 'Active Classroom Broadcast' };
        case 'classes':
          return { title: 'Class Rosters', subtitle: 'Enrolled Students & Device Status' };
        case 'history':
          return { title: 'Session History', subtitle: 'Export Attendance Spreadsheets' };
      }
    } else {
      switch (adminTab) {
        case 'overview':
          return { title: 'Admin Overview', subtitle: 'System Metrics & Rules' };
        case 'queue':
          return { title: 'Device Queue', subtitle: 'Student Phone Change Requests' };
        case 'audit':
          return { title: 'Security Audit', subtitle: 'Immutable System Audit Trail' };
      }
    }
  };

  const pageInfo = getPageInfo();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Header: Clear page indication & Sidebar trigger (No cluttered logout or settings at top) */}
      <Header
        pageTitle={pageInfo.title}
        pageSubtitle={pageInfo.subtitle}
        onOpenSidebar={() => setIsSidebarOpen(true)}
      />

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

      {/* Bottom Navigation Bar: Buttons moved to the bottom of the screen with Apple HIG styling */}
      <View style={styles.bottomBar} accessibilityRole="tablist">
        {user.role === 'student' && (
          <>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: studentTab === 'scanner' }}
              style={({ pressed }) => [
                styles.bottomTabButton,
                pressed && styles.tabButtonPressed,
              ]}
              onPress={() => setStudentTab('scanner')}
            >
              <View
                style={[
                  styles.tabIconBadge,
                  studentTab === 'scanner' && styles.tabIconBadgeActive,
                ]}
              >
                <Radio
                  size={20}
                  color={studentTab === 'scanner' ? '#0B284C' : '#8E8E93'}
                  strokeWidth={studentTab === 'scanner' ? 2.4 : 2}
                />
              </View>
              <Text
                style={[
                  styles.bottomTabText,
                  studentTab === 'scanner' && styles.bottomTabTextActive,
                ]}
                numberOfLines={1}
              >
                Check In
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: studentTab === 'classes' }}
              style={({ pressed }) => [
                styles.bottomTabButton,
                pressed && styles.tabButtonPressed,
              ]}
              onPress={() => setStudentTab('classes')}
            >
              <View
                style={[
                  styles.tabIconBadge,
                  studentTab === 'classes' && styles.tabIconBadgeActive,
                ]}
              >
                <BookOpen
                  size={20}
                  color={studentTab === 'classes' ? '#0B284C' : '#8E8E93'}
                  strokeWidth={studentTab === 'classes' ? 2.4 : 2}
                />
              </View>
              <Text
                style={[
                  styles.bottomTabText,
                  studentTab === 'classes' && styles.bottomTabTextActive,
                ]}
                numberOfLines={1}
              >
                Classes
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: studentTab === 'device' }}
              style={({ pressed }) => [
                styles.bottomTabButton,
                pressed && styles.tabButtonPressed,
              ]}
              onPress={() => setStudentTab('device')}
            >
              <View
                style={[
                  styles.tabIconBadge,
                  studentTab === 'device' && styles.tabIconBadgeActive,
                ]}
              >
                <Smartphone
                  size={20}
                  color={studentTab === 'device' ? '#0B284C' : '#8E8E93'}
                  strokeWidth={studentTab === 'device' ? 2.4 : 2}
                />
              </View>
              <Text
                style={[
                  styles.bottomTabText,
                  studentTab === 'device' && styles.bottomTabTextActive,
                ]}
                numberOfLines={1}
              >
                My Phone
              </Text>
            </Pressable>
          </>
        )}

        {user.role === 'organizer' && (
          <>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: organizerTab === 'live' }}
              style={({ pressed }) => [
                styles.bottomTabButton,
                pressed && styles.tabButtonPressed,
              ]}
              onPress={() => setOrganizerTab('live')}
            >
              <View
                style={[
                  styles.tabIconBadge,
                  organizerTab === 'live' && styles.tabIconBadgeActive,
                ]}
              >
                <Zap
                  size={20}
                  color={organizerTab === 'live' ? '#0B284C' : '#8E8E93'}
                  strokeWidth={organizerTab === 'live' ? 2.4 : 2}
                />
              </View>
              <Text
                style={[
                  styles.bottomTabText,
                  organizerTab === 'live' && styles.bottomTabTextActive,
                ]}
                numberOfLines={1}
              >
                Live Session
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: organizerTab === 'classes' }}
              style={({ pressed }) => [
                styles.bottomTabButton,
                pressed && styles.tabButtonPressed,
              ]}
              onPress={() => setOrganizerTab('classes')}
            >
              <View
                style={[
                  styles.tabIconBadge,
                  organizerTab === 'classes' && styles.tabIconBadgeActive,
                ]}
              >
                <Users
                  size={20}
                  color={organizerTab === 'classes' ? '#0B284C' : '#8E8E93'}
                  strokeWidth={organizerTab === 'classes' ? 2.4 : 2}
                />
              </View>
              <Text
                style={[
                  styles.bottomTabText,
                  organizerTab === 'classes' && styles.bottomTabTextActive,
                ]}
                numberOfLines={1}
              >
                Rosters
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: organizerTab === 'history' }}
              style={({ pressed }) => [
                styles.bottomTabButton,
                pressed && styles.tabButtonPressed,
              ]}
              onPress={() => setOrganizerTab('history')}
            >
              <View
                style={[
                  styles.tabIconBadge,
                  organizerTab === 'history' && styles.tabIconBadgeActive,
                ]}
              >
                <BarChart3
                  size={20}
                  color={organizerTab === 'history' ? '#0B284C' : '#8E8E93'}
                  strokeWidth={organizerTab === 'history' ? 2.4 : 2}
                />
              </View>
              <Text
                style={[
                  styles.bottomTabText,
                  organizerTab === 'history' && styles.bottomTabTextActive,
                ]}
                numberOfLines={1}
              >
                Exports
              </Text>
            </Pressable>
          </>
        )}

        {user.role === 'admin' && (
          <>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: adminTab === 'overview' }}
              style={({ pressed }) => [
                styles.bottomTabButton,
                pressed && styles.tabButtonPressed,
              ]}
              onPress={() => setAdminTab('overview')}
            >
              <View
                style={[
                  styles.tabIconBadge,
                  adminTab === 'overview' && styles.tabIconBadgeActive,
                ]}
              >
                <LayoutDashboard
                  size={20}
                  color={adminTab === 'overview' ? '#0B284C' : '#8E8E93'}
                  strokeWidth={adminTab === 'overview' ? 2.4 : 2}
                />
              </View>
              <Text
                style={[
                  styles.bottomTabText,
                  adminTab === 'overview' && styles.bottomTabTextActive,
                ]}
                numberOfLines={1}
              >
                Overview
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: adminTab === 'queue' }}
              style={({ pressed }) => [
                styles.bottomTabButton,
                pressed && styles.tabButtonPressed,
              ]}
              onPress={() => setAdminTab('queue')}
            >
              <View
                style={[
                  styles.tabIconBadge,
                  adminTab === 'queue' && styles.tabIconBadgeActive,
                ]}
              >
                <ShieldCheck
                  size={20}
                  color={adminTab === 'queue' ? '#0B284C' : '#8E8E93'}
                  strokeWidth={adminTab === 'queue' ? 2.4 : 2}
                />
              </View>
              <Text
                style={[
                  styles.bottomTabText,
                  adminTab === 'queue' && styles.bottomTabTextActive,
                ]}
                numberOfLines={1}
              >
                Queue
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: adminTab === 'audit' }}
              style={({ pressed }) => [
                styles.bottomTabButton,
                pressed && styles.tabButtonPressed,
              ]}
              onPress={() => setAdminTab('audit')}
            >
              <View
                style={[
                  styles.tabIconBadge,
                  adminTab === 'audit' && styles.tabIconBadgeActive,
                ]}
              >
                <FileText
                  size={20}
                  color={adminTab === 'audit' ? '#0B284C' : '#8E8E93'}
                  strokeWidth={adminTab === 'audit' ? 2.4 : 2}
                />
              </View>
              <Text
                style={[
                  styles.bottomTabText,
                  adminTab === 'audit' && styles.bottomTabTextActive,
                ]}
                numberOfLines={1}
              >
                Audit
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Sidebar Drawer: Contains user profile, connection settings, role switcher, and logout */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    gap: 14,
  },
  loadingText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D1D1D6',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    minWidth: 0,
    gap: 3,
  },
  tabIconBadge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconBadgeActive: {
    backgroundColor: 'rgba(11, 40, 76, 0.10)',
  },
  tabButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  bottomTabText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: -0.1,
  },
  bottomTabTextActive: {
    color: '#0B284C',
    fontWeight: '700',
  },
});

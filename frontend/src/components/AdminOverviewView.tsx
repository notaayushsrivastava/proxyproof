import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import {
  Building2,
  ShieldCheck,
  Smartphone,
  Users,
  BookOpen,
  FileText,
  Clock,
  CheckCircle2,
  Radio,
} from 'lucide-react-native';
import { api } from '../services/api';
import { Institution, InstitutionOverviewStats } from '../types/api';

export function AdminOverviewView() {
  const [overview, setOverview] = useState<InstitutionOverviewStats | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ovData, instData] = await Promise.all([
        api.getInstitutionOverview().catch(() => null),
        api.getMyInstitution().catch(() => null),
      ]);
      if (ovData) {
        setOverview(ovData);
        setInstitution(ovData.institution);
      } else if (instData) {
        setInstitution(instData);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleHardwareBinding = async (val: boolean) => {
    if (!institution) return;
    setIsUpdatingPolicy(true);
    try {
      const updated = await api.updateInstitutionSettings({
        hardware_binding_enforced: val,
      });
      setInstitution(updated);
    } catch (err) {
      console.warn('Failed to update institution policy:', err);
    } finally {
      setIsUpdatingPolicy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.screenTitle}>Institution Console</Text>
          <Text style={styles.screenSub}>Campus Policy &amp; Security Administration</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.refreshBtn, pressed && styles.btnPressed]}
          onPress={loadData}
          accessibilityRole="button"
        >
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#009D96" style={{ marginTop: 28 }} />
      ) : (
        <>
          {/* Institution Card */}
          {institution && (
            <View style={styles.institutionCard}>
              <View style={styles.institutionHeader}>
                <View style={styles.institutionIcon}>
                  <Building2 size={24} color="#009D96" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.institutionTitleRow}>
                    <Text style={styles.institutionName} numberOfLines={1}>
                      {institution.name}
                    </Text>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeBadgeText}>{institution.code}</Text>
                    </View>
                  </View>
                  <Text style={styles.institutionDomain}>
                    {institution.domain} &bull; {institution.department || 'All Departments'}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.instMetaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>CAMPUS CONTACT</Text>
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {institution.contact_email}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>STATUS</Text>
                  <View style={styles.statusBadge}>
                    <CheckCircle2 size={11} color="#34C759" strokeWidth={2.4} />
                    <Text style={styles.statusBadgeText}>ACTIVE</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Telemetry Metrics */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Users size={18} color="#007AFF" strokeWidth={2.2} />
              <Text style={styles.statNumber}>{overview?.total_students ?? 0}</Text>
              <Text style={styles.statLabel}>Enrolled Students</Text>
              <Text style={styles.statSub}>Bound devices</Text>
            </View>

            <View style={styles.statCard}>
              <ShieldCheck size={18} color="#FF9500" strokeWidth={2.2} />
              <Text style={styles.statNumber}>{overview?.total_faculty ?? 0}</Text>
              <Text style={styles.statLabel}>Faculty Instructors</Text>
              <Text style={styles.statSub}>Authorized broadcasters</Text>
            </View>

            <View style={styles.statCard}>
              <BookOpen size={18} color="#34C759" strokeWidth={2.2} />
              <Text style={styles.statNumber}>{overview?.total_classes ?? 0}</Text>
              <Text style={styles.statLabel}>Active Courses</Text>
              <Text style={styles.statSub}>Campus roster</Text>
            </View>

            <View style={styles.statCard}>
              <Smartphone size={18} color="#FF2D55" strokeWidth={2.2} />
              <Text style={styles.statNumber}>{overview?.pending_device_requests ?? 0}</Text>
              <Text style={styles.statLabel}>Device Queue</Text>
              <Text style={styles.statSub}>Needs approval</Text>
            </View>
          </View>

          {/* Authorized Broadcasters under this Institution */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Radio size={18} color="#FF9500" strokeWidth={2.4} />
                <Text style={styles.cardTitle}>Authorized Broadcasters</Text>
              </View>
              <View style={styles.broadcasterCountBadge}>
                <Text style={styles.broadcasterCountText}>
                  {overview?.broadcasters?.length ?? 0} Registered
                </Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>
              Faculty members authorized to broadcast attendance beacons on campus under {institution?.name || 'this institution'}.
            </Text>

            {overview?.broadcasters && overview.broadcasters.length > 0 ? (
              <View style={styles.broadcasterList}>
                {overview.broadcasters.map((broadcaster) => (
                  <View key={broadcaster.id} style={styles.broadcasterRow}>
                    <View style={styles.broadcasterAvatar}>
                      <Text style={styles.broadcasterAvatarText}>
                        {broadcaster.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.broadcasterName}>{broadcaster.full_name}</Text>
                      <Text style={styles.broadcasterEmail}>{broadcaster.email}</Text>
                      {broadcaster.department ? (
                        <Text style={styles.broadcasterDept}>{broadcaster.department}</Text>
                      ) : null}
                    </View>
                    <View style={styles.broadcasterBadge}>
                      <View style={styles.beaconPulseDot} />
                      <Text style={styles.broadcasterBadgeText}>BROADCASTER</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyBroadcastersBox}>
                <Radio size={24} color="#8E8E93" strokeWidth={1.8} />
                <Text style={styles.emptyBroadcastersText}>
                  No faculty broadcasters registered yet under this institution.
                </Text>
                <Text style={styles.emptyBroadcastersSub}>
                  Use the Faculty tab to add instructors.
                </Text>
              </View>
            )}
          </View>

          {/* Institutional Policy Controls */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Campus Security &amp; Policy Controls</Text>

            <View style={styles.policyRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.policyTitle}>Hardware Binding Lock (1 Student = 1 Phone)</Text>
                <Text style={styles.policySub}>
                  Rejects student attendance submissions from secondary or unapproved devices.
                </Text>
              </View>
              <Switch
                value={institution?.hardware_binding_enforced ?? true}
                onValueChange={handleToggleHardwareBinding}
                disabled={isUpdatingPolicy}
                trackColor={{ false: '#767577', true: '#009D96' }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.policyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.policyTitle}>Beacon Refresh Window</Text>
                <Text style={styles.policySub}>
                  Rotating cryptographic token expiration: {institution?.attendance_window_seconds ?? 15} seconds.
                </Text>
              </View>
              <View style={styles.windowBadge}>
                <Clock size={13} color="#0B284C" strokeWidth={2.2} />
                <Text style={styles.windowBadgeText}>
                  {institution?.attendance_window_seconds ?? 15}s
                </Text>
              </View>
            </View>
          </View>

          {/* Integrity Rules */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Campus Integrity Guidelines</Text>
            <View style={styles.policyList}>
              <Text style={styles.policyItem}>
                &bull; <Text style={styles.bold}>Zero Relays:</Text> Tokens cannot be screenshotted or sent over chat apps; codes expire within 5 seconds.
              </Text>
              <Text style={styles.policyItem}>
                &bull; <Text style={styles.bold}>Device Substitution:</Text> If a student replaces their phone, they must submit a hardware change request through the Device Queue.
              </Text>
              <Text style={styles.policyItem}>
                &bull; <Text style={styles.bold}>Audited Corrections:</Text> Every manual override requires an instructor reason and creates an immutable audit record.
              </Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
    gap: 16,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B284C',
    letterSpacing: -0.5,
  },
  screenSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 157, 150, 0.1)',
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#009D96',
  },
  institutionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  institutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  institutionIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 157, 150, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  institutionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  institutionName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0B284C',
    flex: 1,
  },
  codeBadge: {
    backgroundColor: 'rgba(11, 40, 76, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0B284C',
  },
  institutionDomain: {
    fontSize: 12,
    color: '#636366',
    marginTop: 3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginVertical: 14,
  },
  instMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34C759',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 4,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0B284C',
    letterSpacing: -0.6,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statSub: {
    fontSize: 10.5,
    color: '#8E8E93',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B284C',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  policyTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  policySub: {
    fontSize: 11.5,
    color: '#636366',
    marginTop: 3,
    lineHeight: 16,
  },
  windowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(11, 40, 76, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  windowBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B284C',
  },
  policyList: {
    gap: 10,
  },
  policyItem: {
    fontSize: 12.5,
    color: '#636366',
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
    color: '#0B284C',
  },
  btnPressed: {
    opacity: 0.7,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  broadcasterCountBadge: {
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  broadcasterCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF9500',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 14,
    lineHeight: 16,
  },
  broadcasterList: {
    gap: 10,
  },
  broadcasterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F8F9FB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  broadcasterAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0B284C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcasterAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  broadcasterName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  broadcasterEmail: {
    fontSize: 11.5,
    color: '#636366',
    marginTop: 1,
  },
  broadcasterDept: {
    fontSize: 10.5,
    color: '#009D96',
    fontWeight: '600',
    marginTop: 2,
  },
  broadcasterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  beaconPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF9500',
  },
  broadcasterBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FF9500',
    letterSpacing: 0.3,
  },
  emptyBroadcastersBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyBroadcastersText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  emptyBroadcastersSub: {
    fontSize: 11.5,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

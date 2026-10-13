export type UserRole = 'student' | 'organizer' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'disabled';
export type DeviceStatus = 'pending' | 'active' | 'revoked';
export type DevicePlatform = 'ios' | 'android' | 'other';
export type DeviceChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type SessionStatus = 'active' | 'closed' | 'expired';
export type AttendanceRecordStatus = 'present' | 'manual_present' | 'excused' | 'removed';
export type AttendanceRecordSource = 'ble' | 'manual' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  account_status: AccountStatus;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Device {
  id: string;
  user_id: string;
  public_key: string;
  platform: DevicePlatform;
  device_label: string;
  status: DeviceStatus;
  registered_at: string;
  last_seen_at?: string;
  revoked_at?: string;
}

export interface DeviceChangeRequest {
  id: string;
  student_id: string;
  old_device_id: string;
  new_device_id: string;
  status: DeviceChangeStatus;
  reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface DeviceChangeRequestDetail extends DeviceChangeRequest {
  student_name?: string;
  student_email?: string;
  student_number?: string;
  old_device_label?: string;
  new_device_label?: string;
}

export interface ClassItem {
  id: string;
  name: string;
  code: string;
  owner_organizer_id: string;
  created_at: string;
  enrolled_count?: number;
}

export interface RosterMember {
  student_id: string;
  full_name: string;
  email: string;
  student_number?: string;
  joined_at: string;
  has_active_device: boolean;
}

export interface SessionItem {
  id: string;
  class_id: string;
  organizer_id: string;
  status: SessionStatus;
  started_at: string;
  ends_at: string;
  closed_at?: string;
  protocol_version: number;
  notes?: string;
  class_name?: string;
  class_code?: string;
  attendance_count?: number;
}

export interface SessionCreateResponse {
  session: SessionItem;
  beacon_secret: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceRecordStatus;
  source: AttendanceRecordSource;
  marked_at: string;
  marked_by?: string;
  reason?: string;
  student_name?: string;
  student_number?: string;
  student_email?: string;
}

export interface AttendanceSubmissionPayload {
  proof: string;
  time_slot: number;
  protocol_version: number;
  rssi_median: number;
  rssi_samples_count: number;
  client_request_id: string;
  device_signature?: string | null;
}

export interface AttendanceSubmissionResponse {
  status: string;
  message: string;
  attendance_record_id: string;
  marked_at: string;
}

export interface StudentAttendanceSummary {
  total_eligible_sessions: number;
  attended_sessions: number;
  overall_percentage: number;
  classes: {
    class_id: string;
    class_name: string;
    class_code: string;
    total_completed_sessions: number;
    attended_sessions: number;
    attendance_percentage: number;
  }[];
}

export interface StudentAttendanceRecord {
  id: string;
  session_id: string;
  class_id: string;
  class_name: string;
  class_code: string;
  session_date: string;
  status: AttendanceRecordStatus;
  source: AttendanceRecordSource;
  marked_at: string;
  reason?: string;
}

export interface AuditLogItem {
  id: string;
  actor_user_id?: string;
  action: string;
  target_type: string;
  target_id?: string;
  timestamp: string;
  reason?: string;
  metadata_json?: Record<string, unknown>;
}

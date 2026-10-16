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
  current_token?: string;
  current_time_slot?: number;
}

export interface SessionCreateResponse extends SessionItem {
  session_secret: string;
  beacon_secret?: string;
  proof_validity_seconds?: number;
  session?: SessionItem;
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
  request_id?: string;
  client_request_id?: string;
  rssi_median: number;
  rssi_samples?: number[];
  rssi_samples_count?: number;
  protocol_version?: number;
  device_signature?: string | null;
}

export interface AttendanceSubmissionResponse {
  outcome_code?: string;
  status?: string;
  message: string;
  session_id?: string;
  student_id?: string;
  attendance_record_id?: string;
  marked_at?: string;
}

export interface ClassAttendanceSummary {
  class_id: string;
  class_name: string;
  class_code: string;
  total_completed_sessions: number;
  attended_sessions: number;
  percentage: number;
  attendance_percentage?: number; // Normalized alias
}

export interface StudentAttendanceSummary {
  total_eligible_sessions: number;
  attended_sessions: number;
  overall_percentage: number;
  classes: ClassAttendanceSummary[];
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

export interface Institution {
  id: string;
  name: string;
  code: string;
  domain: string;
  contact_email: string;
  department?: string;
  hardware_binding_enforced: boolean;
  attendance_window_seconds: number;
  status: string;
  created_at: string;
}

export interface InstitutionRegisterPayload {
  institution_name: string;
  institution_code: string;
  domain: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  department?: string;
}

export interface InstitutionRegisterResponse {
  institution: Institution;
  admin_user: User;
  access_token: string;
  token_type: string;
  message: string;
}

export interface InstitutionOverviewStats {
  institution: Institution;
  total_classes: number;
  total_faculty: number;
  total_students: number;
  total_sessions: number;
  pending_device_requests: number;
}

export interface FacultyMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department?: string | null;
  account_status: string;
  created_at?: string;
}

export interface FacultyCreatePayload {
  full_name: string;
  email: string;
  department?: string;
  password?: string;
}

export interface BulkFacultyCsvPayload {
  csv_content: string;
}

export interface BulkFacultyResult {
  created_count: number;
  failed_count: number;
  errors: string[];
  message: string;
  created_faculty: FacultyMember[];
}

export interface StudentCreatePayload {
  full_name: string;
  email: string;
  student_number: string;
  department?: string;
  password?: string;
}

export interface BulkStudentCsvPayload {
  csv_content: string;
  class_id?: string;
}

export interface BulkStudentResult {
  created_count: number;
  enrolled_count: number;
  failed_count: number;
  errors: string[];
  message: string;
}

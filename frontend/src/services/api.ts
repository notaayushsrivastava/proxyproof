import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { storage } from './storage';
import {
  AuthResponse,
  ClassItem,
  Device,
  DeviceChangeRequest,
  DeviceChangeRequestDetail,
  RosterMember,
  SessionCreateResponse,
  SessionItem,
  AttendanceRecord,
  AttendanceSubmissionPayload,
  AttendanceSubmissionResponse,
  StudentAttendanceSummary,
  ClassAttendanceSummary,
  StudentAttendanceRecord,
  AuditLogItem,
  User,
} from '../types/api';

const TOKEN_STORAGE_KEY = 'proxyproof_auth_token';

let inMemoryToken: string | null = null;
let customBaseUrl: string | null = null;

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function getDefaultBaseUrl(): string {
  if (customBaseUrl) return customBaseUrl;
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // On Web: use current browser hostname
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:8000/api/v1`;
  }

  // On Native: dynamically resolve development machine IP from Expo bundler connection
  try {
    const hostUri = Constants.expoConfig?.hostUri || (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:8000/api/v1`;
      }
    }
  } catch {}

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return 'http://127.0.0.1:8000/api/v1';
}

export function setCustomBaseUrl(url: string | null) {
  customBaseUrl = url;
}

export async function getAuthToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  inMemoryToken = await storage.getItem(TOKEN_STORAGE_KEY);
  return inMemoryToken;
}

export async function setAuthToken(token: string | null): Promise<void> {
  inMemoryToken = token;
  if (token) {
    await storage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    await storage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const baseUrl = getDefaultBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: unknown) {
    const msg = (err as Error)?.message || 'Network request failed';
    throw new ApiError(
      `Cannot connect to API server at ${baseUrl}. Ensure backend server is running. (${msg})`,
      0,
      err
    );
  }

  if (!response.ok) {
    let errorDetail = response.statusText;
    let data: unknown = null;
    try {
      data = await response.json();
      if (data && typeof data === 'object') {
        const d = data as {
          detail?: string | { msg?: string }[] | { message?: string; outcome_code?: string; [key: string]: unknown };
          message?: string;
        };
        if (typeof d.detail === 'string') {
          errorDetail = d.detail;
        } else if (Array.isArray(d.detail)) {
          errorDetail = d.detail.map((err) => (typeof err === 'object' && err?.msg) || JSON.stringify(err)).join(', ');
        } else if (d.detail && typeof d.detail === 'object') {
          errorDetail = d.detail.message || d.detail.outcome_code || JSON.stringify(d.detail);
        } else if (typeof d.message === 'string') {
          errorDetail = d.message;
        }
      }
    } catch {
      // response wasn't JSON
    }
    throw new ApiError(errorDetail || `Request failed with status ${response.status}`, response.status, data);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // --- AUTH ---
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await setAuthToken(res.access_token);
    return res;
  },

  async getMe(): Promise<User> {
    return request<User>('/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await request<{ message: string }>('/auth/logout', { method: 'POST' });
    } catch {
      // Proceed with local logout regardless of network
    } finally {
      await setAuthToken(null);
    }
  },

  // --- DEVICES ---
  async registerDevice(payload: {
    public_key: string;
    platform: string;
    device_label: string;
  }): Promise<Device> {
    return request<Device>('/devices/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMyDevice(): Promise<Device | null> {
    const res = await request<Device | Device[]>('/devices/me');
    if (Array.isArray(res)) {
      if (res.length === 0) return null;
      const active = res.find((d) => d.status === 'active');
      return active || res[0];
    }
    return res || null;
  },

  async requestDeviceChange(payload: {
    new_device_label: string;
    new_public_key: string;
    platform: string;
    reason: string;
  }): Promise<DeviceChangeRequest> {
    return request<DeviceChangeRequest>('/devices/change-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMyDeviceChangeRequests(): Promise<DeviceChangeRequest[]> {
    return request<DeviceChangeRequest[]>('/devices/change-requests/me');
  },

  // --- CLASSES ---
  async getClasses(): Promise<ClassItem[]> {
    return request<ClassItem[]>('/classes');
  },

  async getClass(classId: string): Promise<ClassItem> {
    return request<ClassItem>(`/classes/${classId}`);
  },

  async getClassRoster(classId: string): Promise<RosterMember[]> {
    return request<RosterMember[]>(`/classes/${classId}/roster`);
  },

  async addMember(classId: string, studentId: string): Promise<RosterMember> {
    return request<RosterMember>(`/classes/${classId}/members`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId }),
    });
  },

  async removeMember(classId: string, studentId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/classes/${classId}/members/${studentId}`, {
      method: 'DELETE',
    });
  },

  // --- SESSIONS ---
  async createSession(
    classId: string,
    durationMinutes: number = 5,
    notes?: string
  ): Promise<SessionCreateResponse> {
    const raw = await request<SessionCreateResponse & { session?: SessionItem }>(`/classes/${classId}/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        duration_minutes: durationMinutes,
        notes: notes || undefined,
      }),
    });

    const sessionObj: SessionItem = raw.session || raw;
    const secret = raw.beacon_secret || raw.session_secret || '';

    return {
      ...sessionObj,
      session: sessionObj,
      session_secret: secret,
      beacon_secret: secret,
      proof_validity_seconds: raw.proof_validity_seconds ?? 5,
    };
  },

  async getActiveSessions(): Promise<SessionItem[]> {
    return request<SessionItem[]>('/sessions/active');
  },

  async getSession(sessionId: string): Promise<SessionItem> {
    return request<SessionItem>(`/sessions/${sessionId}`);
  },

  async closeSession(sessionId: string): Promise<SessionItem> {
    return request<SessionItem>(`/sessions/${sessionId}/close`, {
      method: 'POST',
    });
  },

  async getSessionAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    return request<AttendanceRecord[]>(`/sessions/${sessionId}/attendance`);
  },

  getExportCsvUrl(sessionId: string): string {
    const baseUrl = getDefaultBaseUrl();
    return `${baseUrl}/sessions/${sessionId}/export.csv`;
  },

  // --- ATTENDANCE ATTEMPTS & MANUAL ---
  async submitAttendanceAttempt(
    sessionId: string,
    payload: AttendanceSubmissionPayload
  ): Promise<AttendanceSubmissionResponse> {
    const requestId =
      payload.request_id ||
      payload.client_request_id ||
      (typeof Crypto !== 'undefined' && 'randomUUID' in Crypto
        ? Crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`);

    const body = {
      proof: payload.proof,
      time_slot: payload.time_slot,
      request_id: requestId,
      rssi_median: Math.round(payload.rssi_median),
      rssi_samples: payload.rssi_samples || undefined,
      device_signature: payload.device_signature || null,
    };

    return request<AttendanceSubmissionResponse>(
      `/sessions/${sessionId}/attendance-attempts`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  },

  async markManualAttendance(
    sessionId: string,
    payload: { student_id: string; action: 'mark_present' | 'excuse'; reason: string }
  ): Promise<AttendanceRecord> {
    return request<AttendanceRecord>(`/sessions/${sessionId}/attendance/manual`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteAttendance(
    sessionId: string,
    studentId: string,
    reason: string
  ): Promise<{ message: string; record: AttendanceRecord }> {
    return request<{ message: string; record: AttendanceRecord }>(
      `/sessions/${sessionId}/attendance/${studentId}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      }
    );
  },

  // --- STUDENTS ---
  async getMyAttendanceSummary(): Promise<StudentAttendanceSummary> {
    const raw = await request<ClassAttendanceSummary[] | StudentAttendanceSummary>(
      '/students/me/attendance-summary'
    );

    // If backend returns array of ClassAttendanceSummary directly
    if (Array.isArray(raw)) {
      const classesList = raw.map((c) => ({
        ...c,
        attendance_percentage: c.attendance_percentage ?? c.percentage ?? 0,
      }));

      const totalCompleted = classesList.reduce(
        (acc, c) => acc + (c.total_completed_sessions || 0),
        0
      );
      const totalAttended = classesList.reduce(
        (acc, c) => acc + (c.attended_sessions || 0),
        0
      );
      const overallPct =
        totalCompleted > 0
          ? Math.round((totalAttended / totalCompleted) * 1000) / 10
          : 0;

      return {
        total_eligible_sessions: totalCompleted,
        attended_sessions: totalAttended,
        overall_percentage: overallPct,
        classes: classesList,
      };
    }

    // If already in object shape
    const classes = (raw.classes || []).map((c) => ({
      ...c,
      attendance_percentage: c.attendance_percentage ?? c.percentage ?? 0,
    }));

    return {
      total_eligible_sessions: raw.total_eligible_sessions ?? 0,
      attended_sessions: raw.attended_sessions ?? 0,
      overall_percentage: raw.overall_percentage ?? 0,
      classes,
    };
  },

  async getMyAttendanceHistory(): Promise<StudentAttendanceRecord[]> {
    return request<StudentAttendanceRecord[]>('/students/me/attendance-history');
  },

  // --- ADMIN ---
  async getAdminDeviceChangeRequests(status?: string): Promise<DeviceChangeRequestDetail[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<DeviceChangeRequestDetail[]>(`/admin/device-change-requests${query}`);
  },

  async approveDeviceChangeRequest(requestId: string, reason?: string): Promise<DeviceChangeRequest> {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return request<DeviceChangeRequest>(`/admin/device-change-requests/${requestId}/approve${query}`, {
      method: 'POST',
    });
  },

  async rejectDeviceChangeRequest(requestId: string, reason?: string): Promise<DeviceChangeRequest> {
    return request<DeviceChangeRequest>(`/admin/device-change-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async getAuditLogs(limit: number = 50, offset: number = 0): Promise<AuditLogItem[]> {
    return request<AuditLogItem[]>(`/admin/audit-logs?limit=${limit}&offset=${offset}`);
  },

  async checkHealth(): Promise<{ status: string; database: string }> {
    return request<{ status: string; database: string }>('/health');
  },
};

export type UserType = 'admin' | 'employee';
export type AdminRole = 'super_admin' | 'admin' | 'hr';

export interface AdminUser {
  id: string;
  adminCode: string;
  fullName: string;
  email: string;
  role: AdminRole;
}

export interface EmployeeUser {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
}

export type AttendanceStatus =
  | 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'holiday' | 'work_from_home';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: AttendanceStatus;
  working_hours: string | null;
  full_name?: string;
  employee_code?: string;
  department_name?: string;
}

// Response shape from POST /attendance/punch and POST /attendance/public-face.
// The backend — never the frontend — decides whether a punch was an IN or an OUT.
export interface PunchResponse {
  success: boolean;
  action: 'IN' | 'OUT';
  message: string;
  data: AttendanceRecord;
}

export type LeaveType = 'casual' | 'medical' | 'paid' | 'unpaid' | 'emergency';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  full_name?: string;
  employee_code?: string;
  department_name?: string;
}

export interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  designation: string | null;
  joining_date: string;
  status: 'active' | 'disabled';
  department_name?: string;
  shift_name?: string;
  face_image_url?: string | null;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  employee_count?: number;
}

export interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  is_overnight: boolean;
  duty_hours: number;
}

export interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  description: string | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

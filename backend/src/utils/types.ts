export type UserType = 'admin' | 'employee';

export type AdminRole = 'super_admin' | 'admin' | 'hr';

export interface JwtAccessPayload {
  sub: string; // user id
  userType: UserType;
  role?: AdminRole;
  employeeId?: string; // human-readable employee_id, only for employees
}

export interface AuthenticatedRequestUser {
  id: string;
  userType: UserType;
  role?: AdminRole;
  employeeId?: string;
}

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'half_day'
  | 'leave'
  | 'holiday'
  | 'work_from_home';

export type LeaveType = 'casual' | 'medical' | 'paid' | 'unpaid' | 'emergency';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

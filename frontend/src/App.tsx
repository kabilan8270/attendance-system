import { Routes, Route } from 'react-router-dom';
import LoginSelect from './pages/auth/LoginSelect';
import AdminLogin from './pages/auth/AdminLogin';
import EmployeeLogin from './pages/auth/EmployeeLogin';
import ForgotPassword from './pages/auth/ForgotPassword';
import { ProtectedRoute } from './components/common/ProtectedRoute';

import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminEmployees from './pages/admin/Employees';
import AdminAttendance from './pages/admin/AttendanceView';
import AdminLeave from './pages/admin/LeaveManagement';
import AdminShifts from './pages/admin/ShiftManagement';
import AdminHolidays from './pages/admin/HolidayManagement';
import AdminDepartments from './pages/admin/Departments';
import AdminOfficeLocations from './pages/admin/OfficeLocations';
import AdminReports from './pages/admin/Reports';

import EmployeeLayout from './components/layout/EmployeeLayout';
import EmployeeDashboard from './pages/employee/Dashboard';
import MarkAttendance from './pages/employee/MarkAttendance';
import AttendanceCalendar from './pages/employee/AttendanceCalendar';
import LeaveRequests from './pages/employee/LeaveRequests';
import EmployeeProfile from './pages/employee/Profile';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginSelect />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/employee/login" element={<EmployeeLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allow="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="employees" element={<AdminEmployees />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="leave" element={<AdminLeave />} />
        <Route path="shifts" element={<AdminShifts />} />
        <Route path="holidays" element={<AdminHolidays />} />
        <Route path="departments" element={<AdminDepartments />} />
        <Route path="office-locations" element={<AdminOfficeLocations />} />
        <Route path="reports" element={<AdminReports />} />
      </Route>

      <Route
        path="/employee"
        element={
          <ProtectedRoute allow="employee">
            <EmployeeLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<EmployeeDashboard />} />
        <Route path="mark-attendance" element={<MarkAttendance />} />
        <Route path="calendar" element={<AttendanceCalendar />} />
        <Route path="leave" element={<LeaveRequests />} />
        <Route path="profile" element={<EmployeeProfile />} />
      </Route>

      <Route path="*" element={<LoginSelect />} />
    </Routes>
  );
}

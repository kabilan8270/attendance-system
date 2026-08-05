import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarCheck, CalendarClock, Building2,
  MapPin, FileBarChart, Sun, Moon, LogOut, Fingerprint, Bell, CalendarDays, Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/employees', label: 'Employees', icon: Users },
  { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/admin/leave', label: 'Leave Requests', icon: CalendarClock },
  { to: '/admin/shifts', label: 'Shifts', icon: CalendarDays },
  { to: '/admin/holidays', label: 'Holidays', icon: CalendarDays },
  { to: '/admin/departments', label: 'Departments', icon: Building2 },
  { to: '/admin/office-locations', label: 'Office Locations', icon: MapPin },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const { data: notifications } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => (await api.get('/notifications?unreadOnly=true')).data.data,
    refetchInterval: 30000,
  });

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      <aside className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-200 dark:border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Fingerprint className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">Attendance Admin</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <button onClick={handleLogout} className="btn-secondary w-full">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-10">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back,</p>
            <p className="font-semibold">{user && 'fullName' in user ? user.fullName : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <Bell className="w-5 h-5" />
              {notifications?.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarCheck, CalendarClock, Building2,
  MapPin, FileBarChart, Sun, Moon, LogOut, Fingerprint, Bell, CalendarDays, Settings, Menu, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import toast from 'react-hot-toast';
import { useState } from 'react';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => (await api.get('/notifications?unreadOnly=true')).data.data,
    refetchInterval: 30000,
  });

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-col">
        <div className="flex items-center gap-2 px-5 h-16 shrink-0 border-b border-gray-200 dark:border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Fingerprint className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">Attendance Admin</span>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto py-4 px-3 space-y-1">
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
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 shrink-0 border-t border-gray-200 dark:border-gray-800">
          <button onClick={handleLogout} className="btn-secondary w-full">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative h-full w-[82vw] max-w-xs bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 shrink-0 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Fingerprint className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-sm truncate">Attendance Admin</span>
              </div>
              <button
                aria-label="Close menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="p-3 shrink-0 border-t border-gray-200 dark:border-gray-800">
              <button onClick={handleLogout} className="btn-secondary w-full">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur flex items-center justify-between px-3 sm:px-6 sticky top-0 z-40">
          <div className="flex items-center gap-2 min-w-0">
            <button
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden shrink-0 p-2 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">Welcome back,</p>
              <p className="font-semibold text-sm sm:text-base truncate">
                {user && 'fullName' in user ? user.fullName : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <Bell className="w-5 h-5" />
              {notifications?.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0 p-3 sm:p-6 overflow-x-auto overflow-y-auto">
          <div className="min-w-0 max-w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

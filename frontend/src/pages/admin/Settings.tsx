import { useState, FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Laptop, Smartphone, ShieldCheck, LogOut, Save, KeyRound } from 'lucide-react';
import { api, getStoredAuth, setStoredAuth } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface AdminProfile {
  id: string;
  adminCode: string;
  fullName: string;
  email: string;
  role: string;
  lastLogin: string | null;
}

interface Session {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

const deviceIcon = (deviceInfo: string) => {
  const ua = deviceInfo.toLowerCase();
  if (/android|iphone|mobile/.test(ua)) return Smartphone;
  return Laptop;
};

const summarizeDevice = (deviceInfo: string): string => {
  if (/android/i.test(deviceInfo)) return 'Android device';
  if (/windows/i.test(deviceInfo)) return 'Windows PC';
  if (/mac os/i.test(deviceInfo)) return 'Mac';
  if (/iphone|ipad/i.test(deviceInfo)) return 'iOS device';
  if (/linux/i.test(deviceInfo)) return 'Linux PC';
  return deviceInfo.slice(0, 60) || 'Unknown device';
};

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { logout, clearSession } = useAuth();
  const navigate = useNavigate();

  const { data: profile, isLoading: profileLoading } = useQuery<AdminProfile>({
    queryKey: ['admin-profile'],
    queryFn: async () => (await api.get('/admin/profile')).data.data,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['admin-sessions'],
    queryFn: async () => {
      const stored = getStoredAuth();
      return (
        await api.get('/admin/sessions', {
          headers: stored?.refreshToken ? { 'X-Refresh-Token': stored.refreshToken } : undefined,
        })
      ).data.data;
    },
  });

  const [profileForm, setProfileForm] = useState<{ adminCode: string; fullName: string; email: string } | null>(
    null
  );
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const form = profileForm ?? (profile ? { adminCode: profile.adminCode, fullName: profile.fullName, email: profile.email } : null);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSavingProfile(true);
    try {
      const { data } = await api.put('/admin/profile', form);
      toast.success('Profile updated successfully');
      queryClient.setQueryData(['admin-profile'], data.data);
      setProfileForm(null);

      // Keep the local session's cached user in sync so the sidebar /
      // header greeting reflects the new name immediately.
      const stored = getStoredAuth();
      if (stored) {
        setStoredAuth({
          ...stored,
          user: {
            ...stored.user,
            adminCode: data.data.adminCode,
            fullName: data.data.fullName,
            email: data.data.email,
          },
        });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }
    if (passwords.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setSavingPassword(true);
    try {
      const stored = getStoredAuth();
      await api.put('/admin/change-password', passwords, {
        headers: stored?.refreshToken ? { 'X-Refresh-Token': stored.refreshToken } : undefined,
      });
      toast.success('Password changed. Other devices have been logged out.');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-sessions'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    setRevokingId(sessionId);
    try {
      if (isCurrent) {
        await handleLogoutCurrentDevice();
        return;
      }
      await api.delete('/admin/logout-device', { data: { sessionId } });
      toast.success('Device logged out');
      queryClient.invalidateQueries({ queryKey: ['admin-sessions'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to log out that device');
    } finally {
      setRevokingId(null);
    }
  };

  const handleLogoutCurrentDevice = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/');
  };

  const handleLogoutAll = async () => {
    setLoggingOutAll(true);
    try {
      await api.delete('/admin/logout-all');
      toast.success('Logged out of all devices');
      clearSession();
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to log out all devices');
    } finally {
      setLoggingOutAll(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your admin profile, security and active sessions.</p>
      </div>

      {/* ---------------- Profile ---------------- */}
      <section className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" /> Profile
        </h2>

        {profileLoading || !form ? (
          <p className="text-sm text-gray-500">Loading profile...</p>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Admin ID</label>
              <input
                className="input"
                required
                value={form.adminCode}
                onChange={(e) => setProfileForm({ ...form, adminCode: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">3-50 characters: letters, numbers, hyphens, underscores. Must be unique.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Full Name</label>
              <input
                className="input"
                required
                value={form.fullName}
                onChange={(e) => setProfileForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Email</label>
              <input
                type="email"
                className="input"
                required
                value={form.email}
                onChange={(e) => setProfileForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400">
                Role: <span className="font-medium text-gray-600 dark:text-gray-300">{profile?.role}</span>
              </span>
              <button type="submit" disabled={savingProfile} className="btn-primary">
                <Save className="w-4 h-4" /> {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ---------------- Security ---------------- */}
      <section className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-blue-600" /> Security
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Current Password</label>
            <input
              type="password"
              className="input"
              required
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">New Password</label>
            <input
              type="password"
              className="input"
              required
              minLength={8}
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Confirm New Password</label>
            <input
              type="password"
              className="input"
              required
              minLength={8}
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
            />
          </div>
          <p className="text-xs text-gray-400">
            At least 8 characters, with a letter and a number. Changing your password logs you out of every other device.
          </p>
          <div className="flex justify-end">
            <button type="submit" disabled={savingPassword} className="btn-primary">
              {savingPassword ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        </form>
      </section>

      {/* ---------------- Sessions ---------------- */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Laptop className="w-4 h-4 text-blue-600" /> Active Devices
          </h2>
          <button
            onClick={handleLogoutAll}
            disabled={loggingOutAll}
            className="btn-secondary text-sm"
          >
            <LogOut className="w-4 h-4" /> {loggingOutAll ? 'Logging out...' : 'Logout All Devices'}
          </button>
        </div>

        {sessionsLoading ? (
          <p className="text-sm text-gray-500">Loading sessions...</p>
        ) : !sessions || sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No active sessions found.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {sessions.map((session) => {
              const Icon = deviceIcon(session.deviceInfo);
              return (
                <li key={session.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-2">
                        {summarizeDevice(session.deviceInfo)}
                        {session.isCurrent && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                            This device
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {session.ipAddress || 'Unknown IP'} · Signed in {new Date(session.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(session.id, session.isCurrent)}
                    disabled={revokingId === session.id}
                    className="btn-secondary text-xs shrink-0"
                  >
                    {revokingId === session.id ? '...' : session.isCurrent ? 'Logout' : 'Logout Device'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

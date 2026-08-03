import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../api/client';

export default function EmployeeProfile() {
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => (await api.get('/employees/me')).data.data,
  });

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast.success('Password changed successfully');
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      {profile && (
        <div className="card space-y-3">
          <div className="flex items-center gap-4">
            {profile.face_image_url ? (
              <img src={profile.face_image_url} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800" />
            )}
            <div>
              <p className="font-semibold text-lg">{profile.full_name}</p>
              <p className="text-sm text-gray-500">{profile.employee_id}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-gray-100 dark:border-gray-800">
            <div><p className="text-gray-500">Email</p><p>{profile.email}</p></div>
            <div><p className="text-gray-500">Mobile</p><p>{profile.mobile_number}</p></div>
            <div><p className="text-gray-500">Department</p><p>{profile.department_name || '—'}</p></div>
            <div><p className="text-gray-500">Designation</p><p>{profile.designation || '—'}</p></div>
            <div><p className="text-gray-500">Shift</p><p>{profile.shift_name || '—'}</p></div>
            <div><p className="text-gray-500">Joined</p><p>{profile.joining_date}</p></div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input
            type="password" placeholder="Current password" className="input" required
            value={passwords.currentPassword}
            onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
          />
          <input
            type="password" placeholder="New password" className="input" required minLength={8}
            value={passwords.newPassword}
            onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
          />
          <input
            type="password" placeholder="Confirm new password" className="input" required minLength={8}
            value={passwords.confirm}
            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
          />
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

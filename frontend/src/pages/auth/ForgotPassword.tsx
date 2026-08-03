import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KeyRound, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../api/client';

export default function ForgotPassword() {
  const location = useLocation();
  const defaultType = (location.state as { userType?: string })?.userType || 'employee';

  const [userType, setUserType] = useState(defaultType);
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { identifier, userType });
      setSent(true);
      toast.success('If the account exists, a reset link has been sent');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>

        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Reset Password</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">We'll email you a reset link</p>
            </div>
          </div>

          {sent ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              If an account matches those details, a password reset link has been sent to the registered email.
              Please check your inbox.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Account type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUserType('admin')}
                    className={userType === 'admin' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserType('employee')}
                    className={userType === 'employee' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
                  >
                    Employee
                  </button>
                </div>
              </div>
              <div>
                <label className="label">{userType === 'admin' ? 'Admin ID' : 'Employee ID'}</label>
                <input className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

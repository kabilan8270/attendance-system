import { Link } from 'react-router-dom';
import { ShieldCheck, Users, Fingerprint } from 'lucide-react';

export default function LoginSelect() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-3xl px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 mb-4">
            <Fingerprint className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Management System</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Face-verified, GPS-secured, enterprise ready</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <Link to="/admin/login" className="card group hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Admin / HR Login</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage employees, attendance & reports</p>
              </div>
            </div>
          </Link>

          <Link to="/employee/login" className="card group hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Employee Login</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Mark attendance & manage your profile</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

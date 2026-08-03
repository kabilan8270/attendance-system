import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import StatCard from '../../components/ui/StatCard';
import { Users, UserCheck, UserX, Clock, CalendarClock } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function AdminDashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => (await api.get('/dashboard/summary')).data.data,
    refetchInterval: 60000,
  });

  const { data: trend } = useQuery({
    queryKey: ['dashboard-trend'],
    queryFn: async () => (await api.get('/dashboard/trend?days=30')).data.data,
  });

  const { data: deptAttendance } = useQuery({
    queryKey: ['dashboard-dept'],
    queryFn: async () => (await api.get('/dashboard/department-attendance')).data.data,
  });

  if (isLoading) {
    return <div className="animate-pulse text-gray-400">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Today's attendance overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Employees" value={summary?.totalEmployees ?? 0} icon={Users} color="blue" />
        <StatCard label="Present" value={summary?.present ?? 0} icon={UserCheck} color="green" />
        <StatCard label="Absent" value={summary?.absent ?? 0} icon={UserX} color="red" />
        <StatCard label="Late" value={summary?.late ?? 0} icon={Clock} color="amber" />
        <StatCard label="On Leave" value={summary?.leave ?? 0} icon={CalendarClock} color="purple" />
        <StatCard label="Pending Leave Requests" value={summary?.pendingLeaveRequests ?? 0} icon={CalendarClock} color="gray" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-4">Attendance Trend (30 days)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend || []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="attendance_date" tick={{ fontSize: 11 }} tickFormatter={(v) => v?.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="present" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="leave" stroke="#a855f7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Department-wise Attendance (Today)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={deptAttendance || []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="department_name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

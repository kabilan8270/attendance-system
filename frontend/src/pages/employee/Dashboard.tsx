import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Camera, CalendarClock, TrendingUp } from 'lucide-react';
import { api } from '../../api/client';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';

export default function EmployeeDashboard() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: monthAttendance } = useQuery({
    queryKey: ['my-attendance-month', month, year],
    queryFn: async () => (await api.get(`/attendance/me?month=${month}&year=${year}`)).data.data,
  });

  const { data: leaveData } = useQuery({
    queryKey: ['my-leaves-summary'],
    queryFn: async () => (await api.get('/leaves/me')).data.data,
  });

  const present = monthAttendance?.filter((a: any) => a.status === 'present').length || 0;
  const late = monthAttendance?.filter((a: any) => a.status === 'late').length || 0;
  const leave = monthAttendance?.filter((a: any) => a.status === 'leave').length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">This month's summary</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Present Days" value={present} icon={TrendingUp} color="green" />
        <StatCard label="Late Days" value={late} icon={CalendarClock} color="amber" />
        <StatCard label="Leave Days" value={leave} icon={CalendarClock} color="purple" />
      </div>

      <Link to="/employee/mark-attendance" className="card flex items-center gap-4 hover:shadow-lg transition">
        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
          <Camera className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <p className="font-semibold">Mark Today's Attendance</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Face + GPS verified check-in / check-out</p>
        </div>
      </Link>

      {leaveData?.balance && (
        <div className="card">
          <h2 className="font-semibold mb-3">Leave Balance ({year})</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Casual</p>
              <p className="font-semibold">{leaveData.balance.casual_total - leaveData.balance.casual_used} / {leaveData.balance.casual_total}</p>
            </div>
            <div>
              <p className="text-gray-500">Medical</p>
              <p className="font-semibold">{leaveData.balance.medical_total - leaveData.balance.medical_used} / {leaveData.balance.medical_total}</p>
            </div>
            <div>
              <p className="text-gray-500">Paid</p>
              <p className="font-semibold">{leaveData.balance.paid_total - leaveData.balance.paid_used} / {leaveData.balance.paid_total}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-3">Recent Leave Requests</h2>
        <div className="space-y-2">
          {leaveData?.requests?.slice(0, 5).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span>{r.leave_type} · {r.start_date} to {r.end_date}</span>
              <StatusBadge status={r.status} />
            </div>
          ))}
          {(!leaveData?.requests || leaveData.requests.length === 0) && (
            <p className="text-sm text-gray-400">No leave requests yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { api } from '../../api/client';
import StatusBadge from '../../components/ui/StatusBadge';
import { Department } from '../../types';

export default function AdminAttendance() {
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    employeeName: '',
    departmentId: '',
    status: '',
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get('/departments')).data.data as Department[],
  });

  const queryParams = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  ).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-attendance', filters],
    queryFn: async () => (await api.get(`/attendance?${queryParams}`)).data,
  });

  const exportFile = (format: 'pdf' | 'excel') => {
    const params = new URLSearchParams({
      type: 'daily',
      format,
      from: filters.date,
      to: filters.date,
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    }).toString();
    window.open(`${import.meta.env.VITE_API_URL || '/api'}/reports/attendance?${params}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <div className="flex gap-2">
          <button onClick={() => exportFile('excel')} className="btn-secondary"><Download className="w-4 h-4" /> Excel</button>
          <button onClick={() => exportFile('pdf')} className="btn-secondary"><FileText className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      <div className="card flex flex-wrap gap-3">
        <input type="date" className="input max-w-[160px]" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        <input placeholder="Search employee name" className="input max-w-[220px]" value={filters.employeeName} onChange={(e) => setFilters({ ...filters, employeeName: e.target.value })} />
        <select className="input max-w-[180px]" value={filters.departmentId} onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}>
          <option value="">All Departments</option>
          {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="input max-w-[160px]" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
          <option value="half_day">Half Day</option>
          <option value="leave">Leave</option>
          <option value="holiday">Holiday</option>
          <option value="work_from_home">Work From Home</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="py-2 pr-4">Employee</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Check In</th>
                <th className="py-2 pr-4">Check Out</th>
                <th className="py-2 pr-4">Hours</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((row: any) => (
                <tr key={row.id} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-2.5 pr-4">{row.full_name} <span className="text-xs text-gray-400">({row.employee_code})</span></td>
                  <td className="py-2.5 pr-4">{row.department_name || '—'}</td>
                  <td className="py-2.5 pr-4">{row.attendance_date}</td>
                  <td className="py-2.5 pr-4">{row.check_in_time ? new Date(row.check_in_time).toLocaleTimeString() : '—'}</td>
                  <td className="py-2.5 pr-4">{row.check_out_time ? new Date(row.check_out_time).toLocaleTimeString() : '—'}</td>
                  <td className="py-2.5 pr-4">{row.working_hours || '—'}</td>
                  <td className="py-2.5"><StatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data?.data?.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No records found</p>}
      </div>
    </div>
  );
}

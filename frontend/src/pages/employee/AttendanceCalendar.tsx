import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../api/client';
import { AttendanceRecord } from '../../types';

const statusColor: Record<string, string> = {
  present: 'bg-green-500',
  absent: 'bg-red-500',
  late: 'bg-orange-500',
  half_day: 'bg-yellow-500',
  leave: 'bg-purple-500',
  holiday: 'bg-blue-500',
  work_from_home: 'bg-teal-500',
};

export default function AttendanceCalendar() {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);

  const month = cursor.getMonth() + 1;
  const year = cursor.getFullYear();

  const { data: records } = useQuery({
    queryKey: ['my-attendance-calendar', month, year],
    queryFn: async () => (await api.get(`/attendance/me?month=${month}&year=${year}`)).data.data as AttendanceRecord[],
  });

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records?.forEach((r) => map.set(r.attendance_date, r));
    return map;
  }, [records]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const cells = [...Array(firstDayOfWeek).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const changeMonth = (delta: number) => {
    setCursor(new Date(year, month - 1 + delta, 1));
    setSelected(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-medium w-32 text-center">
            {cursor.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-7 gap-2 mb-2 text-xs font-medium text-gray-500 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const record = recordMap.get(dateStr);
            return (
              <button
                key={dateStr}
                onClick={() => record && setSelected(record)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition
                  ${record ? 'hover:ring-2 hover:ring-blue-400' : 'text-gray-400'}
                  bg-gray-50 dark:bg-gray-800/50`}
              >
                {day}
                {record && (
                  <span className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${statusColor[record.status] || 'bg-gray-400'}`} />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs">
          {Object.entries(statusColor).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${color}`} /> {status.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>

      {selected && (
        <div className="card space-y-2">
          <h3 className="font-semibold">{selected.attendance_date}</h3>
          <p className="text-sm flex justify-between"><span className="text-gray-500">Status</span> <span className="capitalize">{selected.status.replace('_', ' ')}</span></p>
          <p className="text-sm flex justify-between"><span className="text-gray-500">Check In</span> <span>{selected.check_in_time ? new Date(selected.check_in_time).toLocaleTimeString() : '—'}</span></p>
          <p className="text-sm flex justify-between"><span className="text-gray-500">Check Out</span> <span>{selected.check_out_time ? new Date(selected.check_out_time).toLocaleTimeString() : '—'}</span></p>
          <p className="text-sm flex justify-between"><span className="text-gray-500">Working Hours</span> <span>{selected.working_hours || '—'}</span></p>
        </div>
      )}
    </div>
  );
}

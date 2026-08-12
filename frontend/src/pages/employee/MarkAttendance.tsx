import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MapPin, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { api } from '../../api/client';
import { useGeolocation } from '../../hooks/useGeolocation';
import FaceCapture from '../../components/attendance/FaceCapture';

type Step = 'idle' | 'locating' | 'capturing' | 'submitting' | 'done';

export default function MarkAttendance() {
  const [mode, setMode] = useState<'check-in' | 'check-out' | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const { getLocation, error: geoError } = useGeolocation();
  const queryClient = useQueryClient();

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const yesterday = (() => {
    const d = new Date(`${today}T12:00:00+05:30`);
    d.setDate(d.getDate() - 1);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  })();
  const { data: attendanceRecords } = useQuery({
    queryKey: ['my-attendance-today', today],
    queryFn: async () => {
      const res = await api.get(`/attendance/me?from=${yesterday}&to=${today}`);
      return res.data.data || [];
    },
  });

  const todayRecord = attendanceRecords?.find((record: any) => record.attendance_date === today) || null;
  const openRecord = attendanceRecords?.find((record: any) => record.check_in_time && !record.check_out_time) || null;

  // An open record from yesterday can be an overnight shift. In that case
  // the morning punch must be treated as check-out for the same record.
  const hasOpenOvernightRecord = !!openRecord && openRecord.attendance_date !== today;
  const alreadyCheckedIn = !!todayRecord?.check_in_time || !!openRecord;
  const alreadyCheckedOut = !!todayRecord?.check_out_time;

  const beginFlow = async (selectedMode: 'check-in' | 'check-out') => {
    setMode(selectedMode);
    setStep('locating');
    try {
      await getLocation();
      setStep('capturing');
    } catch (err: any) {
      toast.error(err.message || 'Could not get your location');
      setStep('idle');
      setMode(null);
    }
  };

  const handleFaceCapture = async (result: {
    descriptor: number[];
    livenessScore: number;
    livenessPassed: boolean;
  }) => {
    if (!mode) return;
    setStep('submitting');
    try {
      const coords = await getLocation();
      const { data } = await api.post(`/attendance/${mode}`, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        faceDescriptor: result.descriptor,
        livenessScore: result.livenessScore,
        livenessPassed: result.livenessPassed,
      });
      toast.success(data.message);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Verification failed. Attendance not recorded.');
      setStep('idle');
      setMode(null);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mark Attendance</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Face + location verified check-in</p>
      </div>

      {openRecord && (
        <div className="card space-y-1 text-sm">
          <p className="font-medium mb-2">Open attendance · {openRecord.attendance_date}</p>
          <p className="flex justify-between">
            <span className="text-gray-500">In Time</span>
            <span className="font-medium">{new Date(openRecord.check_in_time).toLocaleTimeString()}</span>
          </p>
          <p className="text-xs text-amber-600">{hasOpenOvernightRecord ? 'Morning punch will check out this same overnight attendance.' : 'Checkout will update this same attendance record.'}</p>
        </div>
      )}

      {todayRecord && !openRecord && (
        <div className="card space-y-1 text-sm">
          <p className="flex justify-between">
            <span className="text-gray-500">Check-in</span>
            <span className="font-medium">{todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString() : '—'}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-gray-500">Check-out</span>
            <span className="font-medium">{todayRecord.check_out_time ? new Date(todayRecord.check_out_time).toLocaleTimeString() : '—'}</span>
          </p>
        </div>
      )}

      {step === 'idle' && (
        <div className="grid grid-cols-2 gap-4">
          <button
            disabled={!!openRecord || alreadyCheckedIn}
            onClick={() => beginFlow('check-in')}
            className="card flex flex-col items-center gap-2 py-8 hover:shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LogIn className="w-8 h-8 text-green-600" />
            <span className="font-medium">Check In</span>
          </button>
          <button
            disabled={!openRecord || alreadyCheckedOut}
            onClick={() => beginFlow('check-out')}
            className="card flex flex-col items-center gap-2 py-8 hover:shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LogOut className="w-8 h-8 text-red-600" />
            <span className="font-medium">Check Out</span>
          </button>
        </div>
      )}

      {step === 'locating' && (
        <div className="card flex flex-col items-center gap-3 py-10">
          <MapPin className="w-8 h-8 text-blue-600 animate-bounce" />
          <p className="text-sm text-gray-500">Verifying your location...</p>
          {geoError && <p className="text-sm text-red-500">{geoError}</p>}
        </div>
      )}

      {step === 'capturing' && (
        <div className="card">
          <p className="text-sm text-gray-500 mb-4 text-center">
            Location confirmed. Now let's verify it's really you.
          </p>
          <FaceCapture requireLiveness onCapture={handleFaceCapture} />
        </div>
      )}

      {step === 'submitting' && (
        <div className="card flex flex-col items-center gap-3 py-10">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          <p className="text-sm text-gray-500">Verifying and recording attendance...</p>
        </div>
      )}

      {step === 'done' && (
        <div className="card flex flex-col items-center gap-3 py-10">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
          <p className="font-medium">
            {mode === 'check-in' ? 'Checked in successfully!' : 'Checked out successfully!'}
          </p>
          <button onClick={() => { setStep('idle'); setMode(null); }} className="btn-secondary">
            Done
          </button>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MapPin, LogIn, LogOut, CheckCircle2, Fingerprint } from 'lucide-react';
import { api } from '../../api/client';
import { useGeolocation } from '../../hooks/useGeolocation';
import FaceCapture from '../../components/attendance/FaceCapture';
import { AttendanceRecord, PunchResponse } from '../../types';
import { formatISTTime } from '../../utils/date';

type Step = 'idle' | 'locating' | 'capturing' | 'submitting' | 'done';

export default function MarkAttendance() {
  const [step, setStep] = useState<Step>('idle');
  const [result, setResult] = useState<PunchResponse | null>(null);
  const { getLocation, error: geoError } = useGeolocation();
  const queryClient = useQueryClient();

  // Informational only — this is NOT used to decide IN vs OUT. That
  // decision is made entirely by the backend on every punch.
  const { data: recentRecords } = useQuery({
    queryKey: ['my-attendance-recent'],
    queryFn: async () => {
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
      const res = await api.get(`/attendance/me?from=${from}&to=${to}`);
      return (res.data.data || []) as AttendanceRecord[];
    },
  });

  const openRecord = recentRecords?.find((r) => r.check_in_time && !r.check_out_time) || null;
  const latestRecord = recentRecords?.[0] || null;

  const beginFlow = async () => {
    setResult(null);
    setStep('locating');
    try {
      await getLocation();
      setStep('capturing');
    } catch (err: any) {
      toast.error(err.message || 'Could not get your location');
      setStep('idle');
    }
  };

  const handleFaceCapture = async (captured: {
    descriptor: number[];
    livenessScore: number;
    livenessPassed: boolean;
  }) => {
    setStep('submitting');
    try {
      const coords = await getLocation();
      const { data } = await api.post<PunchResponse>('/attendance/punch', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        faceDescriptor: captured.descriptor,
        livenessScore: captured.livenessScore,
        livenessPassed: captured.livenessPassed,
      });
      toast.success(data.message);
      setResult(data);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['my-attendance-recent'] });
      queryClient.invalidateQueries({ queryKey: ['my-attendance-calendar'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Verification failed. Attendance not recorded.');
      setStep('idle');
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mark Attendance</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Face + location verified · one tap, backend decides IN or OUT</p>
      </div>

      {openRecord && step === 'idle' && (
        <div className="card space-y-1 text-sm">
          <p className="font-medium mb-2">Open attendance · {openRecord.attendance_date}</p>
          <p className="flex justify-between">
            <span className="text-gray-500">In Time</span>
            <span className="font-medium">{formatISTTime(openRecord.check_in_time)}</span>
          </p>
          <p className="text-xs text-amber-600">Your next punch will close this out as your check-out.</p>
        </div>
      )}

      {!openRecord && latestRecord && step === 'idle' && (
        <div className="card space-y-1 text-sm">
          <p className="font-medium mb-2">Last attendance · {latestRecord.attendance_date}</p>
          <p className="flex justify-between">
            <span className="text-gray-500">Check-in</span>
            <span className="font-medium">{formatISTTime(latestRecord.check_in_time)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-gray-500">Check-out</span>
            <span className="font-medium">{formatISTTime(latestRecord.check_out_time)}</span>
          </p>
        </div>
      )}

      {step === 'idle' && (
        <button
          onClick={beginFlow}
          className="card w-full flex flex-col items-center gap-3 py-10 hover:shadow-lg transition"
        >
          <Fingerprint className="w-10 h-10 text-blue-600" />
          <span className="font-semibold text-lg">Mark Attendance</span>
          <span className="text-xs text-gray-500">We'll verify your location and face, then record it automatically</span>
        </button>
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

      {step === 'done' && result && (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
          <p className="font-medium flex items-center gap-2">
            {result.action === 'IN'
              ? <><LogIn className="w-4 h-4 text-green-600" /> Checked in successfully</>
              : <><LogOut className="w-4 h-4 text-red-600" /> Checked out successfully</>}
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm w-full max-w-xs">
            <p className="flex flex-col"><span className="text-gray-500 text-xs">Date</span>{result.data.attendance_date}</p>
            <p className="flex flex-col"><span className="text-gray-500 text-xs">Status</span><span className="capitalize">{result.data.status.replace('_', ' ')}</span></p>
            <p className="flex flex-col"><span className="text-gray-500 text-xs">In Time</span>{formatISTTime(result.data.check_in_time)}</p>
            <p className="flex flex-col"><span className="text-gray-500 text-xs">Out Time</span>{formatISTTime(result.data.check_out_time)}</p>
          </div>
          <button onClick={() => { setStep('idle'); setResult(null); }} className="btn-secondary mt-2">
            Done
          </button>
        </div>
      )}
    </div>
  );
}

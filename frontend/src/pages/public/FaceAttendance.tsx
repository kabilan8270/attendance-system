import { useState } from 'react';
import { Camera, CheckCircle2, XCircle, LogIn, LogOut, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import FaceCapture from '../../components/attendance/FaceCapture';
import { api } from '../../api/client';
import { useGeolocation } from '../../hooks/useGeolocation';

type Result = {
  action: 'IN' | 'OUT';
  message: string;
  employee: { employeeId: string; fullName: string };
  data: {
    attendance_date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    working_hours: string | null;
  };
};

export default function PublicFaceAttendance() {
  const [captureKey, setCaptureKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const { getLocation, error: geoError } = useGeolocation();

  const handleCapture = async (face: {
    descriptor: number[];
    imageBase64: string;
    livenessScore: number;
    livenessPassed: boolean;
  }) => {
    setSubmitting(true);
    try {
      const coords = await getLocation();
      const response = await api.post('/attendance/public-face', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        faceDescriptor: face.descriptor,
        livenessScore: face.livenessScore,
        livenessPassed: face.livenessPassed,
      });
      setResult(response.data);
      toast.success(response.data.message);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || geoError || 'Attendance could not be recorded.');
      setCaptureKey((key) => key + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setCaptureKey((key) => key + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-3">
            <Camera className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">Face Attendance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            No employee login required. Look at the camera and blink once.
          </p>
        </div>

        {submitting && (
          <div className="card flex items-center justify-center gap-3 py-5">
            <div className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full" />
            <span className="text-sm">Recognizing employee and recording attendance...</span>
          </div>
        )}

        {!result && !submitting && (
          <div className="card">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-4">
              <MapPin className="w-4 h-4" />
              <span>Office location verification is required</span>
            </div>
            <FaceCapture key={captureKey} requireLiveness onCapture={handleCapture} />
          </div>
        )}

        {result && (
          <div className="card text-center space-y-5">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold">{result.employee.fullName}</h2>
              <p className="text-sm text-gray-500">{result.employee.employeeId}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4">
                <p className="text-xs text-gray-500 mb-1">Action</p>
                <p className="font-semibold flex items-center gap-2">
                  {result.action === 'IN'
                    ? <><LogIn className="w-4 h-4 text-green-600" /> CHECK IN</>
                    : <><LogOut className="w-4 h-4 text-red-600" /> CHECK OUT</>}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4">
                <p className="text-xs text-gray-500 mb-1">Date</p>
                <p className="font-semibold">{result.data.attendance_date}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <p className="flex justify-between"><span className="text-gray-500">In Time</span><span>{result.data.check_in_time ? new Date(result.data.check_in_time).toLocaleTimeString() : '—'}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Out Time</span><span>{result.data.check_out_time ? new Date(result.data.check_out_time).toLocaleTimeString() : '—'}</span></p>
            </div>

            <p className="text-sm text-green-600 font-medium">{result.message}</p>
            <button onClick={reset} className="btn-primary w-full">
              <Camera className="w-4 h-4" /> Ready for Next Employee
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Face data is matched against enrolled active employees.
        </p>
      </div>
    </div>
  );
}

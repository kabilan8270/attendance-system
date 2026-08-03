import { useEffect, useRef, useState, useCallback } from 'react';
import { faceapi, useFaceApiModels } from '../../hooks/useFaceApiModels';
import { Camera, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface FaceCaptureProps {
  requireLiveness: boolean;
  onCapture: (result: { descriptor: number[]; imageBase64: string; livenessScore: number; livenessPassed: boolean }) => void;
}

// Eye Aspect Ratio from 6 landmark points around an eye — standard blink-detection formula.
const eyeAspectRatio = (eye: faceapi.Point[]): number => {
  const dist = (a: faceapi.Point, b: faceapi.Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const vertical1 = dist(eye[1], eye[5]);
  const vertical2 = dist(eye[2], eye[4]);
  const horizontal = dist(eye[0], eye[3]);
  return (vertical1 + vertical2) / (2 * horizontal);
};

const EAR_BLINK_THRESHOLD = 0.23;
const REQUIRED_BLINKS = 1;

export default function FaceCapture({ requireLiveness, onCapture }: FaceCaptureProps) {
  const { loaded, error: modelError } = useFaceApiModels();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<'idle' | 'starting' | 'detecting' | 'blink-prompt' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [blinkCount, setBlinkCount] = useState(0);
  const earHistory = useRef<number[]>([]);
  const wasClosed = useRef(false);
  const latestDescriptor = useRef<Float32Array | null>(null);
  const detectionLoopId = useRef<number | null>(null);

  const startCamera = useCallback(async () => {
    setStatus('starting');
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 360 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus(requireLiveness ? 'blink-prompt' : 'detecting');
    } catch (err) {
      setStatus('error');
      setErrorMsg('Camera access denied or unavailable. Please allow camera permissions.');
    }
  }, [requireLiveness]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (detectionLoopId.current) window.clearTimeout(detectionLoopId.current);
    };
  }, []);

  useEffect(() => {
    if (!loaded || status === 'idle' || status === 'starting' || status === 'error') return;

    let cancelled = false;

    const runDetection = async () => {
      if (cancelled || !videoRef.current) return;

      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        latestDescriptor.current = detection.descriptor;

        if (requireLiveness) {
          const landmarks = detection.landmarks;
          const leftEAR = eyeAspectRatio(landmarks.getLeftEye());
          const rightEAR = eyeAspectRatio(landmarks.getRightEye());
          const avgEAR = (leftEAR + rightEAR) / 2;
          earHistory.current.push(avgEAR);
          if (earHistory.current.length > 30) earHistory.current.shift();

          if (avgEAR < EAR_BLINK_THRESHOLD) {
            wasClosed.current = true;
          } else if (wasClosed.current && avgEAR >= EAR_BLINK_THRESHOLD) {
            wasClosed.current = false;
            setBlinkCount((c) => c + 1);
          }
        } else {
          setStatus('ready');
        }
      }

      if (!cancelled) {
        detectionLoopId.current = window.setTimeout(runDetection, 150);
      }
    };

    runDetection();

    return () => {
      cancelled = true;
    };
  }, [loaded, status, requireLiveness]);

  useEffect(() => {
    if (requireLiveness && blinkCount >= REQUIRED_BLINKS && status === 'blink-prompt') {
      setStatus('ready');
    }
  }, [blinkCount, requireLiveness, status]);

  const handleCapture = () => {
    if (!latestDescriptor.current || !videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);

    const livenessScore = requireLiveness ? Math.min(1, blinkCount / REQUIRED_BLINKS) : 1;
    const livenessPassed = requireLiveness ? blinkCount >= REQUIRED_BLINKS : true;

    onCapture({
      descriptor: Array.from(latestDescriptor.current),
      imageBase64,
      livenessScore,
      livenessPassed,
    });

    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStatus('idle');
    setBlinkCount(0);
    earHistory.current = [];
  };

  if (modelError) {
    return (
      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" /> Failed to load face recognition models: {modelError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] max-w-sm mx-auto bg-gray-900 rounded-2xl overflow-hidden">
        <video ref={videoRef} muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button onClick={startCamera} disabled={!loaded} className="btn-primary">
              <Camera className="w-4 h-4" /> {loaded ? 'Start Camera' : 'Loading models...'}
            </button>
          </div>
        )}
        {status === 'blink-prompt' && (
          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-sm p-3 text-center">
            Please blink naturally to verify liveness ({blinkCount}/{REQUIRED_BLINKS})
          </div>
        )}
        {status === 'ready' && (
          <div className="absolute bottom-0 inset-x-0 bg-green-600/80 text-white text-sm p-3 text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Face verified — ready to capture
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5 justify-center">
          <AlertTriangle className="w-4 h-4" /> {errorMsg}
        </p>
      )}

      <div className="flex justify-center gap-3">
        {status !== 'idle' && status !== 'ready' && status !== 'error' && (
          <p className="text-sm text-gray-500 flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4 animate-spin" /> Detecting face...
          </p>
        )}
        {status === 'ready' && (
          <button onClick={handleCapture} className="btn-primary">
            <Camera className="w-4 h-4" /> Capture
          </button>
        )}
        {status === 'error' && (
          <button onClick={startCamera} className="btn-secondary">Retry</button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import * as faceapi from "face-api.js";

export { faceapi };

export function useFaceApiModels() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadModels() {
      try {
        const MODEL_URL = "/models";

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);

        if (mounted) {
          setLoaded(true);
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setError("Unable to load face-api.js models.");
        }
      }
    }

    loadModels();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    loaded,
    error,
  };
}
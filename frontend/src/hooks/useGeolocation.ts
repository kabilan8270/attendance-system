import { useState } from "react";

interface Coordinates {
  latitude: number;
  longitude: number;
}

export function useGeolocation() {
  const [error, setError] = useState<string | null>(null);

  const getLocation = (): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = "Geolocation is not supported by this browser.";
        setError(msg);
        reject(new Error(msg));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setError(null);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (err) => {
          let msg = "Unable to get your location.";

          switch (err.code) {
            case err.PERMISSION_DENIED:
              msg = "Location permission denied.";
              break;
            case err.POSITION_UNAVAILABLE:
              msg = "Location unavailable.";
              break;
            case err.TIMEOUT:
              msg = "Location request timed out.";
              break;
          }

          setError(msg);
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  return {
    getLocation,
    error,
  };
}
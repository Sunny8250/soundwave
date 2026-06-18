import { useState, useEffect, useRef } from "react";
import { Platform } from "react-native";

const CHECK_INTERVAL = 10000;

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // On web — use browser's built-in online/offline events (no CORS issues)
    if (Platform.OS === "web") {
      setIsOnline(navigator.onLine);

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    // On native — poll with a CORS-friendly endpoint
    const check = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        // Use your own backend as the check URL — no CORS issues
        const API_URL = process.env.EXPO_PUBLIC_API_URL || "";
        const API_PREFIX = process.env.EXPO_PUBLIC_API_PREFIX || "/api/v2";
        const API_BASE = API_URL ? `${API_URL}${API_PREFIX}` : "";
        await fetch(`${API_BASE}/health`, {
          method: "HEAD",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    };

    check();
    timerRef.current = setInterval(check, CHECK_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { isOnline };
};

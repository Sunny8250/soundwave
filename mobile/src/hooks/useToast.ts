import { useState, useCallback } from "react";

interface ToastState {
  visible: boolean;
  message: string;
  type: "success" | "error" | "info";
  actionLabel?: string | null;
  action?: (() => void) | null;
  duration?: number;
}

export const useToast = () => {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "success",
    actionLabel: null,
    action: null,
    duration: 2500,
  });

  const showToast = useCallback(
    (
      message: string,
      type: "success" | "error" | "info" = "success",
      opts?: { actionLabel?: string; action?: () => void; duration?: number },
    ) => {
      setToast({
        visible: true,
        message,
        type,
        actionLabel: opts?.actionLabel ?? null,
        action: opts?.action ?? null,
        duration: opts?.duration ?? 2500,
      });
    },
    [],
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return { toast, showToast, hideToast };
};

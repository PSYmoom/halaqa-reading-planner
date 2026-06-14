import { useState, useEffect, useRef } from "react";
import { TOAST_MS, TOAST_ACTION_MS } from "../config/constants.ts";
import type { Toast, ToastAction } from "../types.ts";

export interface UseToast {
  toast: Toast | null;
  flash: (message: string, action?: ToastAction | null) => void;
  dismiss: () => void;
}

/**
 * Transient toast: `flash(text)` shows it and it self-clears (re-flashing restarts
 * the timer). Pass an action to render a button; such toasts linger longer.
 */
export function useToast(): UseToast {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = (message: string, action: ToastAction | null = null) => {
    clearTimeout(timer.current);
    setToast({ message, action });
    timer.current = setTimeout(() => setToast(null), action ? TOAST_ACTION_MS : TOAST_MS);
  };

  const dismiss = () => {
    clearTimeout(timer.current);
    setToast(null);
  };

  return { toast, flash, dismiss };
}

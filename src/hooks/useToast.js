import { useState, useEffect, useRef } from "react";
import { TOAST_MS } from "../constants.js";

/**
 * A transient notification: flash(text) shows it, and it clears itself.
 * Re-flashing restarts the timer (so a quick second toast gets its full
 * duration); the pending timer is cleared on unmount.
 */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = (text) => {
    clearTimeout(timer.current);
    setToast(text);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  return { toast, flash };
}

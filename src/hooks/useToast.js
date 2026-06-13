import { useState, useEffect, useRef } from "react";
import { TOAST_MS, TOAST_ACTION_MS } from "../config/constants.js";

/**
 * A transient notification: flash(text) shows it, and it clears itself.
 * Re-flashing restarts the timer (so a quick second toast gets its full
 * duration); the pending timer is cleared on unmount.
 *
 * Pass an optional action — flash("Imported", { label: "Undo", onClick }) — to
 * render a button in the toast; an actionable toast lingers longer so there's
 * time to use it. `dismiss()` hides it early (e.g. once the action is taken).
 */
export function useToast() {
  const [toast, setToast] = useState(null); // { message, action } | null
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = (message, action = null) => {
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

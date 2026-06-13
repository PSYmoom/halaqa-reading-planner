import { useState } from "react";
import { loadConfig, saveConfig } from "../lib/storage.js";

/** App configuration state, persisted to localStorage on every change. */
export function useConfig() {
  const [config, setConfigState] = useState(loadConfig);

  const setConfig = (next) => {
    setConfigState(next);
    saveConfig(next);
  };

  return [config, setConfig];
}

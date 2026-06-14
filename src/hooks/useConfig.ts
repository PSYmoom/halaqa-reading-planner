import { useState } from "react";
import { loadConfig, saveConfig } from "../lib/storage.ts";
import type { Config } from "../types.ts";

/** App configuration state, persisted to localStorage on every change. */
export function useConfig(): [Config, (next: Config) => void] {
  const [config, setConfigState] = useState<Config>(loadConfig);

  const setConfig = (next: Config) => {
    setConfigState(next);
    saveConfig(next);
  };

  return [config, setConfig];
}

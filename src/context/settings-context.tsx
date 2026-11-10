import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, runSimulation, type JalWattSettings, type SimulationResult } from "@/engine";

interface SettingsContextValue {
  settings: JalWattSettings;
  updateSettings: (patch: Partial<JalWattSettings>) => void;
  updateHour: (key: "ambientTempC" | "tariffINR" | "gridCO2KgPerKWh", hour: number, value: number) => void;
  result: SimulationResult;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<JalWattSettings>(DEFAULT_SETTINGS);
  const updateSettings = (patch: Partial<JalWattSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));
  const updateHour: SettingsContextValue["updateHour"] = (key, hour, value) =>
    setSettings((current) => {
      const values = [...current[key]];
      values[hour] = value;
      return { ...current, [key]: values };
    });
  const value = useMemo(
    () => ({ settings, updateSettings, updateHour, result: runSimulation(settings) }),
    [settings],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}
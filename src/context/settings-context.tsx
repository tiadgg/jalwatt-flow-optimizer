import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { applyCityProfile, DEFAULT_SETTINGS, runSimulation, type CityName, type CityProfile, type FieldQuote, type JalWattSettings, type SimulationResult } from "@/engine";

interface SettingsContextValue {
  settings: JalWattSettings;
  updateSettings: (patch: Partial<JalWattSettings>) => void;
  updateHour: (key: "ambientTempC" | "tariffINR" | "gridCO2KgPerKWh", hour: number, value: number) => void;
  updateCityProfile: (city: CityName, patch: Partial<CityProfile>) => void;
  updateFieldVoice: (index: number, patch: Partial<FieldQuote>) => void;
  result: SimulationResult;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<JalWattSettings>(DEFAULT_SETTINGS);
  const updateSettings = (patch: Partial<JalWattSettings>) =>
    setSettings((current) => {
      const next = { ...current, ...patch };
      return patch.city ? applyCityProfile(next, patch.city) : next;
    });
  const updateCityProfile: SettingsContextValue["updateCityProfile"] = (city, patch) =>
    setSettings((current) => {
      const cityProfiles = {
        ...current.cityProfiles,
        [city]: { ...current.cityProfiles[city], ...patch },
      };
      const next = { ...current, cityProfiles };
      return current.city === city ? applyCityProfile(next, city) : next;
    });
  const updateFieldVoice: SettingsContextValue["updateFieldVoice"] = (index, patch) =>
    setSettings((current) => ({
      ...current,
      fieldVoices: current.fieldVoices.map((voice, voiceIndex) =>
        voiceIndex === index ? { ...voice, ...patch } : voice,
      ),
    }));
  const updateHour: SettingsContextValue["updateHour"] = (key, hour, value) =>
    setSettings((current) => {
      const values = [...current[key]];
      values[hour] = value;
      return { ...current, [key]: values };
    });
  const value = useMemo(
    () => ({ settings, updateSettings, updateHour, updateCityProfile, updateFieldVoice, result: runSimulation(settings) }),
    [settings],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}
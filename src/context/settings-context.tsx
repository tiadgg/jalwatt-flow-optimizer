import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  applyCityProfile,
  DEFAULT_SETTINGS,
  judgeScenario,
  runSimulation,
  type CityName,
  type CityProfile,
  type FieldQuote,
  type JalWattSettings,
  type SimulationResult,
  type TelemetryRow,
} from "@/engine";

interface SettingsContextValue {
  settings: JalWattSettings;
  updateSettings: (patch: Partial<JalWattSettings>) => void;
  updateHour: (key: "ambientTempC" | "tariffINR" | "gridCO2KgPerKWh", hour: number, value: number) => void;
  updateCityProfile: (city: CityName, patch: Partial<CityProfile>) => void;
  updateFieldVoice: (index: number, patch: Partial<FieldQuote>) => void;
  /** Replace the hourly profile with uploaded telemetry, or pass null to return to the simulated profile. */
  setTelemetry: (rows: TelemetryRow[] | null) => void;
  judgeMode: boolean;
  setJudgeMode: (on: boolean) => void;
  result: SimulationResult;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<JalWattSettings>(DEFAULT_SETTINGS);
  const [ambientBeforeTelemetry, setAmbientBeforeTelemetry] = useState<number[] | null>(null);
  const [beforeJudge, setBeforeJudge] = useState<JalWattSettings | null>(null);

  const updateSettings = (patch: Partial<JalWattSettings>) =>
    setSettings((current) => {
      const next = { ...current, ...patch };
      return patch.city ? applyCityProfile(next, patch.city) : next;
    });
  const updateCityProfile: SettingsContextValue["updateCityProfile"] = (city, patch) =>
    setSettings((current) => {
      const cityProfiles = { ...current.cityProfiles, [city]: { ...current.cityProfiles[city], ...patch } };
      const next = { ...current, cityProfiles };
      return current.city === city ? applyCityProfile(next, city) : next;
    });
  const updateFieldVoice: SettingsContextValue["updateFieldVoice"] = (index, patch) =>
    setSettings((current) => ({
      ...current,
      fieldVoices: current.fieldVoices.map((voice, voiceIndex) => (voiceIndex === index ? { ...voice, ...patch } : voice)),
    }));
  const updateHour: SettingsContextValue["updateHour"] = (key, hour, value) =>
    setSettings((current) => {
      const values = [...current[key]];
      values[hour] = value;
      return { ...current, [key]: values };
    });
  const setTelemetry: SettingsContextValue["setTelemetry"] = (rows) => {
    if (rows) {
      setAmbientBeforeTelemetry((saved) => saved ?? settings.ambientTempC);
      setSettings((current) => ({ ...current, telemetry: rows, ambientTempC: rows.map((row) => row.ambientC) }));
    } else {
      const restore = ambientBeforeTelemetry;
      setAmbientBeforeTelemetry(null);
      setSettings((current) => ({ ...current, telemetry: null, ambientTempC: restore ?? DEFAULT_SETTINGS.ambientTempC }));
    }
  };
  const setJudgeMode = (on: boolean) => {
    if (on) {
      setBeforeJudge(settings);
      setSettings((current) => judgeScenario(current));
    } else {
      if (beforeJudge) setSettings(beforeJudge);
      setBeforeJudge(null);
    }
  };

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      updateHour,
      updateCityProfile,
      updateFieldVoice,
      setTelemetry,
      judgeMode: beforeJudge !== null,
      setJudgeMode,
      result: runSimulation(settings),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, beforeJudge, ambientBeforeTelemetry],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}

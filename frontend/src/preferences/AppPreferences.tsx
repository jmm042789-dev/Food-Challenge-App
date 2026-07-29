import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { storage } from "../utils/storage";

export type AppPreferences = {
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  cameraEffectsEnabled: boolean;
  largeText: boolean;
};

const STORAGE_KEY = "fire_feast_app_preferences_v1";
const DEFAULT_PREFERENCES: AppPreferences = {
  hapticsEnabled: true,
  reducedMotion: false,
  cameraEffectsEnabled: true,
  largeText: false,
};

type PreferenceContextValue = {
  preferences: AppPreferences;
  ready: boolean;
  updatePreferences: (update: Partial<AppPreferences>) => Promise<void>;
};

const PreferenceContext = createContext<PreferenceContextValue>({
  preferences: DEFAULT_PREFERENCES,
  ready: false,
  updatePreferences: async () => {},
});

function parsePreferences(serialized: string | null): AppPreferences {
  if (!serialized) return DEFAULT_PREFERENCES;
  try {
    const value = JSON.parse(serialized) as Partial<AppPreferences>;
    return {
      hapticsEnabled: value.hapticsEnabled !== false,
      reducedMotion: value.reducedMotion === true,
      cameraEffectsEnabled: value.cameraEffectsEnabled !== false,
      largeText: value.largeText === true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    storage.getItem(STORAGE_KEY, "").then((stored) => {
      if (mounted) {
        setPreferences(parsePreferences(stored));
        setReady(true);
      }
    });
    return () => { mounted = false; };
  }, []);

  const updatePreferences = useCallback(async (update: Partial<AppPreferences>) => {
    let next = DEFAULT_PREFERENCES;
    setPreferences((current) => {
      next = { ...current, ...update };
      return next;
    });
    await storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const value = useMemo(() => ({ preferences, ready, updatePreferences }), [preferences, ready, updatePreferences]);
  return <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>;
}

export function useAppPreferences() {
  return useContext(PreferenceContext);
}

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { loadPlayerIdentity, savePlayerIdentity, type PlayerIdentity } from "./PlayerIdentity";
import { syncPublicIdentity } from "../social/publicIdentitySync";

type PlayerIdentityContextValue = {
  identity: PlayerIdentity | null;
  hydrated: boolean;
  saveIdentity: (identity: PlayerIdentity) => ReturnType<typeof savePlayerIdentity>;
  refreshIdentity: () => Promise<void>;
};

const PlayerIdentityContext = createContext<PlayerIdentityContextValue | null>(null);

export function PlayerIdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<PlayerIdentity | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);

  const refreshIdentity = useCallback(async () => {
    const request = ++generation.current;
    const loaded = await loadPlayerIdentity();
    if (mounted.current && request === generation.current) setIdentity(loaded);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refreshIdentity();
    return () => { mounted.current = false; generation.current += 1; };
  }, [refreshIdentity]);

  const saveIdentity = useCallback(async (next: PlayerIdentity) => {
    const request = ++generation.current;
    const result = await savePlayerIdentity(next);
    if (mounted.current && request === generation.current) {
      if (result.ok) {
        setIdentity(result.identity);
        void syncPublicIdentity(result.identity);
      }
      else void refreshIdentity();
    }
    return result;
  }, [refreshIdentity]);

  return <PlayerIdentityContext.Provider value={{ identity, hydrated: identity !== null, saveIdentity, refreshIdentity }}>{children}</PlayerIdentityContext.Provider>;
}

export function usePlayerIdentity() {
  const value = useContext(PlayerIdentityContext);
  if (!value) throw new Error("usePlayerIdentity must be used inside PlayerIdentityProvider");
  return value;
}

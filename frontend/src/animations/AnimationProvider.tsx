import React, { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

type AnimationContextValue = {
  enabled: boolean;
};

const AnimationContext = createContext<AnimationContextValue>({ enabled: true });

export function AnimationProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const value = useMemo(() => ({ enabled }), [enabled]);

  return (
    <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>
  );
}

export function useAnimationContext() {
  return useContext(AnimationContext);
}

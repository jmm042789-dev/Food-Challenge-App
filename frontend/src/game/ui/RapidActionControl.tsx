import React, { memo, useEffect, useRef, useState } from "react";
import { Image, StyleSheet } from "react-native";

import type { HeatTier } from "../heartburn";
import TapActionControl from "./TapActionControl";

type Props = {
  active: boolean;
  combo: number;
  heatTier: HeatTier;
  overheatWarningActive: boolean;
  reducedMotion: boolean;
  resetKey: string;
  onAction: () => number | null;
};

export const RAPID_MIN_INTERVAL_MS = 90;
export const RAPID_CHAIN_TIMEOUT_MS = 600;
const SPEED_LINES = require("../../assets/ui/effects/speed-lines.png");

function RapidActionControl({ active, combo, heatTier, overheatWarningActive, reducedMotion, resetKey, onAction }: Props) {
  const [rapidChain, setRapidChain] = useState(0);
  const lastAttemptAt = useRef(0);
  const chainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetChain = () => {
    if (chainTimer.current) clearTimeout(chainTimer.current);
    chainTimer.current = null;
    lastAttemptAt.current = 0;
    setRapidChain(0);
  };

  useEffect(() => {
    resetChain();
    return () => {
      if (chainTimer.current) clearTimeout(chainTimer.current);
    };
  }, [active, resetKey]);

  const tryRapidAction = (): number | null => {
    const now = Date.now();
    if (!active || now - lastAttemptAt.current < RAPID_MIN_INTERVAL_MS) return null;
    lastAttemptAt.current = now;
    return onAction();
  };

  const handleAccepted = () => {
    if (chainTimer.current) clearTimeout(chainTimer.current);
    setRapidChain((current) => current + 1);
    chainTimer.current = setTimeout(() => {
      setRapidChain(0);
      chainTimer.current = null;
    }, RAPID_CHAIN_TIMEOUT_MS);
  };

  const energyTier = rapidChain >= 20 ? 3 : rapidChain >= 10 ? 2 : rapidChain >= 5 ? 1 : 0;
  const accent = energyTier >= 2 ? (
    <Image
      accessibilityIgnoresInvertColors
      resizeMode="cover"
      source={SPEED_LINES}
      style={[styles.speedLines, { opacity: reducedMotion ? 0.08 : energyTier >= 3 ? 0.2 : 0.13 }]}
    />
  ) : undefined;

  return (
    <TapActionControl
      accessibilityHint="Tap repeatedly. Accepted presses build the rapid chain."
      accessibilityLabel={active ? `Rapid bite control${rapidChain ? `, rapid chain ${rapidChain}` : ""}` : "Rapid bite unavailable until gameplay starts"}
      accent={accent}
      active={active}
      combo={combo}
      energyTier={energyTier}
      heatTier={heatTier}
      overheatWarningActive={overheatWarningActive}
      reducedMotion={reducedMotion}
      subtitle={rapidChain > 0 ? `RAPID x${rapidChain}` : active ? "TAP FAST" : "WAITING FOR MATCH"}
      title="CHOMP!"
      onAccepted={handleAccepted}
      onAction={tryRapidAction}
    />
  );
}

export default memo(RapidActionControl);

const styles = StyleSheet.create({
  speedLines: { ...StyleSheet.absoluteFillObject, height: "100%", width: "100%" },
});

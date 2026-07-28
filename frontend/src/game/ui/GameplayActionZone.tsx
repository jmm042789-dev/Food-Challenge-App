import React, { memo } from "react";
import { StyleSheet, View } from "react-native";

import type { BiteMechanic } from "../../api";
import type { HeatTier } from "../heartburn";
import { resolveActionControlKind } from "./actionControlSelection";
import HoldReleaseActionControl from "./HoldReleaseActionControl";
import RapidActionControl from "./RapidActionControl";
import SwipeActionControl from "./SwipeActionControl";
import TapActionControl from "./TapActionControl";

type Props = {
  mechanic?: BiteMechanic;
  active: boolean;
  combo: number;
  heatTier: HeatTier;
  overheatWarningActive: boolean;
  reducedMotion: boolean;
  resetKey: string;
  onAction: () => number | null;
  onHoldStateChange?: (holding: boolean) => void;
};

export const GAMEPLAY_ACTION_ZONE_HEIGHT = 96;

function GameplayActionZone({ mechanic, active, combo, heatTier, overheatWarningActive, reducedMotion, resetKey, onAction, onHoldStateChange }: Props) {
  const sharedProps = {
    active,
    combo,
    heatTier,
    overheatWarningActive,
    reducedMotion,
    onAction,
  };

  // Planned: tap, rapid, swipe, and hold_release select an input UI here.
  // Every validated input calls the same shared accepted-action path.
  const controlKind = resolveActionControlKind(mechanic);
  const control = controlKind === "rapid"
    ? <RapidActionControl {...sharedProps} resetKey={resetKey} />
    : controlKind === "hold_release"
      ? <HoldReleaseActionControl {...sharedProps} resetKey={resetKey} onHoldStateChange={onHoldStateChange} />
      : controlKind === "swipe"
        ? <SwipeActionControl {...sharedProps} resetKey={resetKey} />
        : <TapActionControl {...sharedProps} />;

  return <View style={styles.zone}>{control}</View>;
}

export default memo(GameplayActionZone);

const styles = StyleSheet.create({
  zone: { alignItems: "center", alignSelf: "stretch", flexShrink: 0, height: GAMEPLAY_ACTION_ZONE_HEIGHT, justifyContent: "center", paddingHorizontal: 12, width: "100%" },
});

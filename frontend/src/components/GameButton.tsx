import React from "react";
import FireButton from "./fire/FireButton";

export default function GameButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <FireButton title={title} onPress={onPress} disabled={disabled} variant="secondary" fullWidth />;
}

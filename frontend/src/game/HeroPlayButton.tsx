import React from "react";
import FireButton from "../components/fire/FireButton";

type Props = { title?: string; onPress: () => void; disabled?: boolean };

/** Legacy hero-action API backed by the shared premium button system. */
export default function HeroPlayButton({ title = "START CHALLENGE", onPress, disabled = false }: Props) {
  return <FireButton title={title} onPress={onPress} disabled={disabled} size="large" variant="gold" fullWidth />;
}

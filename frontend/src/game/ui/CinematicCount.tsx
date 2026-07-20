import React, { memo, useEffect, useRef, useState } from "react";
import { Animated, Text, type TextStyle, type StyleProp } from "react-native";

function CinematicCount({ value, active, immediate, prefix = "", suffix = "", style }: { value: number; active: boolean; immediate: boolean; prefix?: string; suffix?: string; style?: StyleProp<TextStyle> }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(active && immediate ? value : 0);

  useEffect(() => {
    progress.stopAnimation();
    if (!active) { progress.setValue(0); setDisplay(0); return; }
    if (immediate) { progress.setValue(value); setDisplay(value); return; }
    progress.setValue(0);
    const listener = progress.addListener(({ value: next }) => setDisplay(Math.round(next)));
    const animation = Animated.timing(progress, { toValue: Math.max(0, value), duration: 680, useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) setDisplay(Math.max(0, value)); });
    return () => { animation.stop(); progress.removeListener(listener); };
  }, [active, immediate, progress, value]);

  useEffect(() => () => progress.stopAnimation(), [progress]);
  return <Text style={style}>{prefix}{Math.max(0, display).toLocaleString()}{suffix}</Text>;
}

export default memo(CinematicCount);

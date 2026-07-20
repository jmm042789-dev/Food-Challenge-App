import { useCallback, useEffect, useMemo, useRef } from "react";
import { PanResponder } from "react-native";

type SwipeDirection = "any" | "down";
export type SwipeCompletionResult = "SUCCESS" | "TIMEOUT";

type Options = {
  direction: SwipeDirection;
  minDistance: number;
  timeoutMs: number;
  onComplete: (result: SwipeCompletionResult) => void;
};

export function useSwipeCompletion({ direction, minDistance, timeoutMs, onComplete }: Options) {
  const completed = useRef(false);

  const complete = useCallback((result: SwipeCompletionResult) => {
    if (completed.current) return;
    completed.current = true;
    onComplete(result);
  }, [onComplete]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, gesture) => {
      const isComplete = direction === "down"
        ? gesture.dy >= minDistance && Math.abs(gesture.dx) <= gesture.dy * 1.1
        : Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) >= minDistance;
      if (isComplete) complete("SUCCESS");
    },
  }), [complete, direction, minDistance]);

  useEffect(() => {
    const timeout = setTimeout(() => complete("TIMEOUT"), timeoutMs);
    return () => clearTimeout(timeout);
  }, [complete, timeoutMs]);

  return panResponder.panHandlers;
}

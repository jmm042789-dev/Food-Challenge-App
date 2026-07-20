import { useCallback, useEffect, useRef, useState } from "react";
import { COMMENTARY_CATALOG } from "./CommentaryCatalog";
import type { CommentaryEvent, CommentaryEventType, CommentaryItem } from "./CommentaryTypes";

const MAX_QUEUE_LENGTH = 5;
const MAX_MESSAGE_AGE_MS = 4500;
const DISPLAY_DURATION_MS = 1450;

export function useCommentaryEngine(resetKey: string) {
  const [current, setCurrent] = useState<CommentaryItem | null>(null);
  const currentRef = useRef<CommentaryItem | null>(null);
  const queue = useRef<CommentaryItem[]>([]);
  const lastEventAt = useRef<Partial<Record<CommentaryEventType, number>>>({});
  const lastMessage = useRef<string | null>(null);
  const nextId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const display = useRef<(item: CommentaryItem) => void>(() => undefined);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  display.current = (item) => {
    clearTimer();
    currentRef.current = item;
    setCurrent(item);
    timer.current = setTimeout(() => {
      const now = Date.now();
      currentRef.current = null;
      const next = queue.current
        .filter((queued) => now - queued.createdAt <= MAX_MESSAGE_AGE_MS)
        .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0];
      queue.current = next ? queue.current.filter((queued) => queued.id !== next.id) : [];
      if (next) display.current(next);
      else setCurrent(null);
    }, DISPLAY_DURATION_MS);
  };

  const reset = useCallback(() => {
    clearTimer();
    queue.current = [];
    currentRef.current = null;
    lastEventAt.current = {};
    lastMessage.current = null;
    setCurrent(null);
  }, [clearTimer]);

  useEffect(() => { reset(); }, [reset, resetKey]);
  useEffect(() => () => {
    clearTimer();
    queue.current = [];
    currentRef.current = null;
  }, [clearTimer]);

  const commentate = useCallback((event: CommentaryEvent) => {
    const now = event.occurredAt ?? Date.now();
    const entry = COMMENTARY_CATALOG[event.type];
    if (now - (lastEventAt.current[event.type] ?? 0) < entry.cooldownMs) return;
    lastEventAt.current[event.type] = now;
    const candidates = entry.messages.filter((message) => message !== lastMessage.current);
    const pool = candidates.length ? candidates : entry.messages;
    const text = pool[Math.floor(Math.random() * pool.length)];
    if (!text) return;
    lastMessage.current = text;
    const item: CommentaryItem = {
      id: ++nextId.current,
      eventType: event.type,
      text,
      priority: entry.priority,
      createdAt: now,
      playbackMode: entry.playbackMode ?? "text",
      soundClipId: entry.soundClipId,
      voiceClipId: entry.voiceClipId,
    };
    if (!currentRef.current) {
      display.current(item);
    } else if (item.priority > currentRef.current.priority) {
      display.current(item);
    } else {
      queue.current = [...queue.current, item]
        .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)
        .slice(0, MAX_QUEUE_LENGTH);
    }
  }, []);

  return { commentary: current, commentate, reset };
}

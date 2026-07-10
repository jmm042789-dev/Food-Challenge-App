type GameEvent =
  | "MATCH_START"
  | "MATCH_END"
  | "MATCH_WIN"
  | "MATCH_LOSE"
  | "MATCH_DRAW"

  | "PLAYER_TAP"
  | "PERFECT_BITE"
  | "CRITICAL_BITE"

  | "COMBO"
  | "COMBO_BREAK"

  | "BELLY_FULL"
  | "HEARTBURN"
  | "HEARTBURN_MAX"

  | "COINS_GAINED"
  | "XP_GAINED"

  | "LEVEL_UP"

  | "POWERUP_USED"

  | "SHAKE"
  | "FIRE_BURST"
  | "COIN_BURST"
  | "XP_BURST";

type Listener = (payload?: any) => void;

class GameEventBus {

  private listeners =
    new Map<GameEvent, Set<Listener>>();

  emit(
    event: GameEvent,
    payload?: any
  ) {

    const callbacks =
      this.listeners.get(event);

    if (!callbacks) return;

    callbacks.forEach((callback) => {

      callback(payload);

    });

  }

  on(
    event: GameEvent,
    callback: Listener
  ) {

    if (!this.listeners.has(event)) {

      this.listeners.set(
        event,
        new Set()
      );

    }

    this.listeners
      .get(event)!
      .add(callback);

    return () => {

      this.listeners
        .get(event)
        ?.delete(callback);

    };

  }

}

export const GameEvents =
  new GameEventBus();
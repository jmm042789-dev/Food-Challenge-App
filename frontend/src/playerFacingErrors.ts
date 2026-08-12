export type PlayerErrorKind = "already_owned" | "insufficient_funds" | "not_found" | "validation" | "network" | "server" | "unknown";

export function classifyPlayerError(error: unknown): PlayerErrorKind {
  if (error instanceof Error && /not enough coins|insufficient/i.test(error.message)) return "insufficient_funds";
  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    const message = error.message.toLowerCase();
    if (message.includes("item already owned")) return "already_owned";
    if (message.includes("not enough coins")) return "insufficient_funds";
    if (error.status === 404) return "not_found";
    if (error.status >= 500) return "server";
    if (error.status >= 400) return "validation";
  }
  if (error instanceof Error && (error.name === "AbortError" || /network|fetch|timeout|connection/i.test(error.message))) return "network";
  return "unknown";
}

export function playerFacingErrorMessage(error: unknown): string {
  switch (classifyPlayerError(error)) {
    case "already_owned": return "This item is already in your Locker. Your balance was not changed.";
    case "insufficient_funds": return "You do not have enough coins for this item.";
    case "not_found": return "This item is no longer available.";
    case "validation": return "The server could not accept that action. Refresh and try again.";
    case "network": return "Fire Feast could not reach the arena. Check your connection and try again.";
    case "server": return "The arena service is temporarily unavailable. Please try again.";
    default: return "Something went wrong. Please try again.";
  }
}

export function isTransientPlayerError(error: unknown): boolean {
  const kind = classifyPlayerError(error);
  return kind === "network" || kind === "server";
}

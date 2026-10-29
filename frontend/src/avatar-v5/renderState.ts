export type AvatarV5RenderState = Readonly<{
  generation: number;
  pending: readonly string[];
  status: "loading" | "ready" | "fallback";
}>;
export type AvatarV5ImageEvent = Readonly<{
  generation: number; key: string; type: "loaded" | "error";
}>;
export function createAvatarV5RenderState(generation: number, keys: readonly string[]): AvatarV5RenderState {
  return { generation, pending: [...keys], status: keys.length ? "loading" : "fallback" };
}
export function advanceAvatarV5RenderState(state: AvatarV5RenderState, event: AvatarV5ImageEvent): AvatarV5RenderState {
  if (event.generation !== state.generation || state.status === "fallback") return state;
  // Errors remain fatal after load; successful duplicates cannot alter readiness.
  if (event.type === "error") return { ...state, status: "fallback" };
  if (!state.pending.includes(event.key)) return state;
  const pending = state.pending.filter((key) => key !== event.key);
  return { ...state, pending, status: pending.length ? "loading" : "ready" };
}

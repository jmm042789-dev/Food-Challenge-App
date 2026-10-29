import React from "react";
import AvatarV5Renderer from "../AvatarV5Renderer";
import type { AvatarV5RenderPlan } from "../renderPlan";

// Proof-only transport plan, not a resolved appearance or catalog item. The layer
// label orders one complete composite; it does not claim independent body coverage.
const plan: AvatarV5RenderPlan = Object.freeze({
  status: "ready", mode: "FULL_BODY", selections: Object.freeze([]),
  passes: Object.freeze([Object.freeze({
    key: "proof:flattened-standard", itemId: "proof:flattened-standard",
    partId: "complete-composite", passId: "authored-detail",
    layer: "bodySkin", treatment: "detail",
    source: require("../../assets/avatar-v5/proofs/flattened-standard/fire-feast-avatar-v5-standard-master-1024.png"),
  } as const)]),
});

// Deliberately unregistered and unexported by the production foundation barrel.
export default function FlattenedStandardProof({ size, fallback }: Readonly<{
  size: number; fallback: React.ReactNode;
}>) {
  return <AvatarV5Renderer plan={plan} size={size} fallback={fallback} />;
}

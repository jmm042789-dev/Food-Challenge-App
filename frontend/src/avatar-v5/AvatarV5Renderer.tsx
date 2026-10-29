import React from "react";
import { Image, View } from "react-native";
import type { AvatarV5RenderPlan } from "./renderPlan";
import { advanceAvatarV5RenderState, createAvatarV5RenderState, type AvatarV5ImageEvent, type AvatarV5RenderState } from "./renderState";

export type AvatarV5RendererProps = Readonly<{
  // Supply a new immutable plan when appearance/art changes; never mutate a mounted plan.
  plan: AvatarV5RenderPlan;
  size: number;
  fallback: React.ReactNode;
  accessibilityLabel?: string;
}>;
type State = { plan: AvatarV5RenderPlan; images: AvatarV5RenderState };
const initial = (plan: AvatarV5RenderPlan, generation: number): State => ({
  plan, images: createAvatarV5RenderState(generation, plan.status === "ready" ? plan.passes.map((pass) => pass.key) : []),
});

// Intentionally not exported by the pure foundation barrel or used by production screens.
export default class AvatarV5Renderer extends React.PureComponent<AvatarV5RendererProps, State> {
  state: State = initial(this.props.plan, 0);
  static getDerivedStateFromProps(props: AvatarV5RendererProps, state: State): State | null {
    return props.plan === state.plan ? null : initial(props.plan, state.images.generation + 1);
  }
  private imageEvent = (event: AvatarV5ImageEvent) => {
    this.setState((state) => ({ images: advanceAvatarV5RenderState(state.images, event) }));
  };
  render() {
    const { plan, fallback, size, accessibilityLabel = "Fire Feast avatar" } = this.props;
    const { images } = this.state;
    if (!Number.isFinite(size) || size <= 0 || plan.status === "fallback" || images.status === "fallback") return fallback;
    const ready = images.status === "ready";
    const rectangle = { position: "absolute" as const, left: 0, top: 0, width: size, height: size };
    return <View style={{ width: size, height: size }}>
      {!ready ? fallback : null}
      <View pointerEvents="none" accessible={ready} accessibilityRole="image" accessibilityLabel={accessibilityLabel}
        accessibilityElementsHidden={!ready} importantForAccessibility={ready ? "yes" : "no-hide-descendants"}
        style={[rectangle, { opacity: ready ? 1 : 0 }]}>
        {plan.passes.map((pass) => <Image key={`${images.generation}:${pass.key}`} source={pass.source}
          accessible={false} fadeDuration={0} resizeMode="contain"
          style={[rectangle, pass.tintColor === undefined ? undefined : { tintColor: pass.tintColor }]}
          onLoad={() => this.imageEvent({ generation: images.generation, key: pass.key, type: "loaded" })}
          onError={() => this.imageEvent({ generation: images.generation, key: pass.key, type: "error" })} />)}
      </View>
    </View>;
  }
}

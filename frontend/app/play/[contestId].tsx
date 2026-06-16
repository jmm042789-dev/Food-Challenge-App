import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, withRepeat, Easing, runOnJS } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { sfx } from "@/src/audio";

// Tuning
const CHOMPS_PER_ITEM = 3;
const BELLY_PER_CHOMP = 3;
const BASE_MAX_BELLY = 100;
const BELLY_DIGEST_PER_SEC = 5;
const TUMS_REDUCE = 50;
const DUNK_BELLY_REDUCE = 45;
const DUNK_HEARTBURN_REDUCE = 15;
const DUNK_COOLDOWN_MS = 1200;
const MAX_DUNKS = 4;
const MAX_HEARTBURN = 100;
const COUNTDOWN_SEC = 3;
const COMBO_WINDOW_MS = 450;
const COMBO_BONUS_THRESHOLD = 5;
const HOLD_RELEASE_MIN_MS = 250;
const HOLD_RELEASE_MAX_MS = 900;

type Mechanic = "tap" | "swipe" | "hold_release" | "rapid";

export default function PlayScreen() {
  const { contestId, tournament } = useLocalSearchParams<{ contestId: string; tournament?: string }>();
  const router = useRouter();
  const isTournament = tournament === "1";

  const [state, setState] = useState<"loading" | "countdown" | "playing" | "submitting">("loading");
  const [match, setMatch] = useState<any>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [chomps, setChomps] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentChomps, setOpponentChomps] = useState(0);
  const [heartburn, setHeartburn] = useState(0);
  const [belly, setBelly] = useState(0);
  const [tumsLeft, setTumsLeft] = useState(0);
  const [tumsUsed, setTumsUsed] = useState(0);
  const [dunksLeft, setDunksLeft] = useState(MAX_DUNKS);
  const [combo, setCombo] = useState(0);
  const [floatPlus, setFloatPlus] = useState<{ id: number; text: string } | null>(null);
  const [trash, setTrash] = useState<string>("");
  const [mcLine, setMcLine] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stuffed, setStuffed] = useState(false);
  const [hint, setHint] = useState<string>("TAP TO CHOMP!");
  const [revived, setRevived] = useState(false);

  const scoreAnim = useSharedValue(1);
  const foodAnim = useSharedValue(1);
  const heartburnAnim = useSharedValue(0);
  const bellyAnim = useSharedValue(0);
  const timerPulse = useSharedValue(1);
  const dunkAnim = useSharedValue(0);
  const holdProgress = useSharedValue(0);

  const lastTapRef = useRef<number>(0);
  const dunkCooldownRef = useRef<number>(0);
  const trashEventsRef = useRef<{ ahead: boolean; behind: boolean }>({ ahead: false, behind: false });
  const mcEventsRef = useRef<{ half: boolean; final10: boolean; final5: boolean }>({ half: false, final10: false, final5: false });
  const finishedRef = useRef(false);
  const floatIdRef = useRef(0);
  const holdStartRef = useRef<number>(0);

  const mechanic: Mechanic = (match?.contest?.bite_mechanic as Mechanic) || "tap";
  const equipped = match?.equipped_perk;
  const maxBelly = equipped === "stretchy_belt" ? BASE_MAX_BELLY + 20 : BASE_MAX_BELLY;
  const heartburnPerBite = match?.contest?.heartburn_per_bite ?? 2;
  const effectiveHbPerBite = equipped === "iron_stomach" ? Math.max(1, heartburnPerBite * 0.75) : heartburnPerBite;

  useEffect(() => {
    (async () => {
      try {
        const m = await api.startMatch(contestId as string);
        setMatch(m);
        setTimeLeft(m.contest.duration_sec);
        setTumsLeft(m.player_tums);
        const mech = m.contest.bite_mechanic;
        setHint(
          mech === "swipe" ? "TAP THEN SWIPE!" :
          mech === "hold_release" ? "HOLD, THEN RELEASE!" :
          mech === "rapid" ? "RAPID TAP!" :
          "TAP TO CHOMP!"
        );
        setState("countdown");
        api.trashTalk({ opponent_id: m.opponent.id, contest_id: contestId as string, event: "start" })
          .then((r) => setTrash(r.line))
          .catch(() => {});
      } catch (e: any) {
        setErrorMsg(e?.message?.includes("400") ? "Not enough coins for entry fee." : "Failed to start match");
      }
    })();
  }, [contestId]);

  useEffect(() => {
    if (state !== "countdown") return;
    if (countdown <= 0) {
      setState("playing");
      sfx.play("countdown");
      setMcLine("🎤 ANNOUNCER: THE BELL HAS RUNG — CHOMP!");
      setTimeout(() => setMcLine(""), 2500);
      return;
    }
    sfx.play("click");
    const t = setTimeout(() => setCountdown((v) => v - 1), 800);
    return () => clearTimeout(t);
  }, [state, countdown]);

  useEffect(() => {
    if (state !== "playing" || !match) return;
    const tickMs = 250;
    const oppChompPerTick = (match.opp_pace_per_sec * tickMs) / 1000;
    let oppFractional = 0;
    const id = setInterval(() => {
      oppFractional += oppChompPerTick + (Math.random() - 0.4) * 0.5;
      const whole = Math.floor(oppFractional);
      if (whole > 0) {
        oppFractional -= whole;
        setOpponentChomps((c) => {
          let newC = c + whole;
          let itemsDelta = 0;
          while (newC >= CHOMPS_PER_ITEM) { newC -= CHOMPS_PER_ITEM; itemsDelta += 1; }
          if (itemsDelta) setOpponentScore((s) => s + itemsDelta);
          return newC;
        });
      }
      setHeartburn((hb) => Math.max(0, hb - 2.5));
      setBelly((b) => Math.max(0, b - (BELLY_DIGEST_PER_SEC * tickMs) / 1000));
      setTimeLeft((t) => Math.max(0, t - tickMs / 1000));
    }, tickMs);
    return () => clearInterval(id);
  }, [state, match]);

  useEffect(() => {
    if (state !== "playing" || finishedRef.current) return;
    if (heartburn >= MAX_HEARTBURN) {
      // Lucky Bib revive
      if (equipped === "lucky_bib" && !revived) {
        setRevived(true);
        setHeartburn(MAX_HEARTBURN - 30);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMcLine("🎽 LUCKY BIB SAVED YOU! −30 HEARTBURN");
        setTimeout(() => setMcLine(""), 2500);
        return;
      }
      finishedRef.current = true;
      finishMatch("heartburn");
      return;
    }
    if (timeLeft <= 0) { finishedRef.current = true; finishMatch("time"); }
  }, [timeLeft, heartburn, state, equipped, revived]);

  useEffect(() => {
    if (state !== "playing") return;
    if (timeLeft <= 10 && timerPulse.value === 1) {
      timerPulse.value = withRepeat(withTiming(1.18, { duration: 350, easing: Easing.inOut(Easing.quad) }), -1, true);
    }
  }, [timeLeft, state]);

  useEffect(() => {
    if (state !== "playing" || !match) return;
    const total = match.contest.duration_sec;
    const elapsedRatio = 1 - timeLeft / total;
    if (!mcEventsRef.current.half && elapsedRatio >= 0.5) {
      mcEventsRef.current.half = true;
      const ahead = score > opponentScore;
      setMcLine(ahead ? "🎤 ANNOUNCER: YOU'RE PULLING AHEAD!" : "🎤 ANNOUNCER: HALFWAY — IT'S A NAILBITER!");
      setTimeout(() => setMcLine(""), 2500);
    }
    if (!mcEventsRef.current.final10 && timeLeft <= 10) {
      mcEventsRef.current.final10 = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setMcLine("🎤 ANNOUNCER: LAST 10 SECONDS!");
      setTimeout(() => setMcLine(""), 2500);
    }
    if (!mcEventsRef.current.final5 && timeLeft <= 5) {
      mcEventsRef.current.final5 = true;
      setMcLine("🎤 ANNOUNCER: FIVE… FOUR… SHOVE IT IN!");
      setTimeout(() => setMcLine(""), 3500);
    }
  }, [timeLeft, state, match, score, opponentScore]);

  useEffect(() => {
    if (state !== "playing" || !match) return;
    const diff = opponentScore - score;
    if (diff >= 2 && !trashEventsRef.current.ahead) {
      trashEventsRef.current.ahead = true;
      api.trashTalk({ opponent_id: match.opponent.id, contest_id: contestId as string, event: "midmatch_ahead", player_score: score, opponent_score: opponentScore })
        .then((r) => setTrash(r.line)).catch(() => {});
    } else if (diff <= -2 && !trashEventsRef.current.behind) {
      trashEventsRef.current.behind = true;
      api.trashTalk({ opponent_id: match.opponent.id, contest_id: contestId as string, event: "midmatch_behind", player_score: score, opponent_score: opponentScore })
        .then((r) => setTrash(r.line)).catch(() => {});
    }
  }, [score, opponentScore, state, match, contestId]);

  useEffect(() => { heartburnAnim.value = withTiming(Math.min(100, heartburn) / 100, { duration: 200 }); }, [heartburn]);
  useEffect(() => { bellyAnim.value = withTiming(Math.min(maxBelly, belly) / maxBelly, { duration: 200 }); }, [belly, maxBelly]);
  useEffect(() => { setStuffed(belly >= maxBelly); }, [belly, maxBelly]);

  const showFloat = (text: string) => {
    const id = ++floatIdRef.current;
    setFloatPlus({ id, text });
    setTimeout(() => setFloatPlus((cur) => (cur && cur.id === id ? null : cur)), 700);
  };

  // ----- Universal "do a bite" function called by all mechanics -----
  const performBite = useCallback((isBonusMove: boolean = false) => {
    if (state !== "playing" || !match) return;
    if (stuffed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setMcLine("🤢 TOO STUFFED! DUNK OR WAIT TO DIGEST!");
      setTimeout(() => setMcLine(""), 1200);
      return;
    }
    const now = Date.now();
    const sinceLast = now - lastTapRef.current;
    lastTapRef.current = now;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sfx.play("chomp");

    let newCombo = combo;
    if (sinceLast < COMBO_WINDOW_MS) newCombo = combo + 1; else newCombo = 1;
    setCombo(newCombo);

    setChomps((c) => {
      let next = c + 1 + (isBonusMove ? 1 : 0);
      let itemsAdded = 0;
      while (next >= CHOMPS_PER_ITEM) { next -= CHOMPS_PER_ITEM; itemsAdded += 1; }
      if (newCombo > 0 && newCombo % COMBO_BONUS_THRESHOLD === 0) {
        itemsAdded += 1;
        showFloat(`+1 COMBO!`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (itemsAdded) {
        setScore((s) => s + itemsAdded);
        scoreAnim.value = withSequence(withTiming(1.35, { duration: 80 }), withSpring(1));
        if (newCombo % COMBO_BONUS_THRESHOLD !== 0) showFloat(`+${itemsAdded}`);
      }
      return next;
    });
    setHeartburn((hb) => Math.min(MAX_HEARTBURN, hb + effectiveHbPerBite));
    setBelly((b) => Math.min(maxBelly, b + BELLY_PER_CHOMP));
    foodAnim.value = withSequence(withTiming(0.78, { duration: 60 }), withSpring(1));
  }, [state, match, stuffed, combo, effectiveHbPerBite, maxBelly]);

  // ----- Gesture callbacks (must be declared BEFORE gesture builders for TDZ-safe worklet closure capture) -----
  const setHoldStart = useCallback(() => {
    holdStartRef.current = Date.now();
    holdProgress.value = withTiming(1, { duration: HOLD_RELEASE_MAX_MS });
  }, []);
  const handleHoldRelease = useCallback((success: boolean) => {
    const dur = Date.now() - holdStartRef.current;
    holdProgress.value = withTiming(0, { duration: 200 });
    if (success && dur >= HOLD_RELEASE_MIN_MS && dur <= HOLD_RELEASE_MAX_MS) {
      performBite(false);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setHeartburn((hb) => Math.min(MAX_HEARTBURN, hb + 5));
      showFloat("🥶 BRAIN FREEZE!");
    }
  }, [performBite]);

  const handleEat = useCallback(() => {
    if (mechanic === "tap" || mechanic === "rapid") performBite(false);
    // for swipe & hold_release, taps alone do nothing — must complete gesture
  }, [mechanic, performBite]);

  // Gesture: swipe (for wings/pizza) — flick down to "tear" then count as bite
  const swipeGesture = Gesture.Pan()
    .activeOffsetY(20)
    .onEnd((e) => {
      if (Math.abs(e.translationY) > 25 || Math.abs(e.velocityY) > 300) {
        runOnJS(performBite)(true);
      }
    });

  // Hold gesture (ice cream): long press; release within window = success
  const longPress = Gesture.LongPress()
    .minDuration(50)
    .onStart(() => { runOnJS(setHoldStart)(); })
    .onEnd((_, success) => { runOnJS(handleHoldRelease)(success); });

  const handleTums = useCallback(() => {
    if (state !== "playing" || tumsLeft <= 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sfx.play("tums");
    setHeartburn((hb) => Math.max(0, hb - TUMS_REDUCE));
    setTumsLeft((t) => t - 1);
    setTumsUsed((u) => u + 1);
    showFloat("🔥 -50");
  }, [state, tumsLeft]);

  const handleDunk = useCallback(() => {
    if (state !== "playing" || dunksLeft <= 0) return;
    if (Date.now() < dunkCooldownRef.current) return;
    dunkCooldownRef.current = Date.now() + DUNK_COOLDOWN_MS;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    sfx.play("dunk");
    setBelly((b) => Math.max(0, b - DUNK_BELLY_REDUCE));
    setHeartburn((hb) => Math.max(0, hb - DUNK_HEARTBURN_REDUCE));
    setDunksLeft((d) => d - 1);
    dunkAnim.value = withSequence(withTiming(1, { duration: 100 }), withTiming(0, { duration: 600 }));
    showFloat("💧 DUNK!");
  }, [state, dunksLeft]);

  const finishMatch = async (reason: "time" | "heartburn") => {
    setState("submitting");
    const won = score > opponentScore && reason === "time";
    sfx.play(won ? "win" : "lose");
    try {
      const res = await api.submitResult({
        contest_id: contestId as string,
        score,
        duration_sec: Math.round(match.contest.duration_sec - timeLeft),
        won,
        opponent_id: match.opponent.id,
        tums_used: tumsUsed,
        is_tournament: isTournament,
      });
      router.replace({
        pathname: "/result",
        params: {
          won: won ? "1" : "0",
          reason, score: String(score), opp: String(opponentScore),
          opp_name: match.opponent.name, opp_id: match.opponent.id,
          contest_id: contestId as string,
          contest_name: match.contest.name,
          coin_reward: String(res.coin_reward), xp_reward: String(res.xp_reward),
          leveled_up: res.leveled_up ? "1" : "0",
          new_belt_name: res.new_belt?.name ?? "",
          new_belt_icon: res.new_belt?.icon ?? "",
          new_belt_color: res.new_belt?.color ?? "",
          is_tournament: isTournament ? "1" : "0",
        },
      } as any);
    } catch { router.back(); }
  };

  const scoreStyle = useAnimatedStyle(() => ({ transform: [{ scale: scoreAnim.value }] }));
  const foodStyle = useAnimatedStyle(() => {
    const chompShrink = 1 - (chomps / CHOMPS_PER_ITEM) * 0.45;
    return { transform: [{ scale: foodAnim.value * chompShrink }] };
  });
  const heartburnStyle = useAnimatedStyle(() => ({ height: `${heartburnAnim.value * 100}%` }));
  const bellyStyle = useAnimatedStyle(() => ({ height: `${bellyAnim.value * 100}%` }));
  const timerStyle = useAnimatedStyle(() => ({ transform: [{ scale: timerPulse.value }] }));
  const dunkSplash = useAnimatedStyle(() => ({ opacity: dunkAnim.value }));
  const holdRing = useAnimatedStyle(() => ({ opacity: holdProgress.value, transform: [{ scale: 1 + holdProgress.value * 0.4 }] }));

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.errContainer}>
        <Text style={styles.errText}>{errorMsg}</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Text style={styles.backBtnText}>GO BACK</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
  if (state === "loading" || !match) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={theme.c.brand} size="large" />
        <Text style={{ color: "#fff", marginTop: 12 }}>Warming up the grill...</Text>
      </View>
    );
  }

  const contest = match.contest;
  const opp = match.opponent;
  const hbColor = heartburn >= 80 ? theme.c.brand : heartburn >= 50 ? theme.c.brandSecondary : theme.c.success;
  const bellyColor = belly >= maxBelly * 0.9 ? theme.c.brand : belly >= maxBelly * 0.6 ? theme.c.brandSecondary : "#7AB8FF";
  const winning = score > opponentScore;
  const finalRush = timeLeft <= 10;

  // Choose the central interaction wrapper based on mechanic
  let centerZone: React.ReactNode;
  if (mechanic === "swipe") {
    centerZone = (
      <GestureDetector gesture={swipeGesture}>
        <Pressable onPress={() => {/* swipe-only */}} style={styles.tapZone} testID="eat-btn">
          <Animated.Text style={[styles.foodEmoji, foodStyle]}>{contest.food_emoji}</Animated.Text>
          <Text style={[styles.tapHint, stuffed && { color: theme.c.brand }]}>{stuffed ? "TOO STUFFED! DUNK!" : "👆 SWIPE DOWN!"}</Text>
          {combo >= 3 && !stuffed && <Text style={styles.comboText}>🔥 COMBO x{combo}</Text>}
          {floatPlus && <Text style={styles.floatPlus} key={floatPlus.id}>{floatPlus.text}</Text>}
        </Pressable>
      </GestureDetector>
    );
  } else if (mechanic === "hold_release") {
    centerZone = (
      <GestureDetector gesture={longPress}>
        <View style={styles.tapZone}>
          <Animated.View style={[styles.holdRing, holdRing]} />
          <Animated.Text style={[styles.foodEmoji, foodStyle]}>{contest.food_emoji}</Animated.Text>
          <Text style={[styles.tapHint, stuffed && { color: theme.c.brand }]}>{stuffed ? "TOO STUFFED!" : "✋ HOLD, THEN RELEASE!"}</Text>
          {combo >= 3 && !stuffed && <Text style={styles.comboText}>🔥 COMBO x{combo}</Text>}
          {floatPlus && <Text style={styles.floatPlus} key={floatPlus.id}>{floatPlus.text}</Text>}
        </View>
      </GestureDetector>
    );
  } else {
    centerZone = (
      <Pressable onPress={handleEat} style={styles.tapZone} testID="eat-btn">
        <Animated.Text style={[styles.foodEmoji, foodStyle]}>{contest.food_emoji}</Animated.Text>
        <Text style={[styles.tapHint, stuffed && { color: theme.c.brand }]}>{stuffed ? "TOO STUFFED! DUNK!" : hint}</Text>
        {combo >= 3 && !stuffed && <Text style={styles.comboText}>🔥 COMBO x{combo}</Text>}
        {floatPlus && <Text style={styles.floatPlus} key={floatPlus.id}>{floatPlus.text}</Text>}
      </Pressable>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.container} testID="play-screen">
      <Image source={{ uri: contest.image }} style={[StyleSheet.absoluteFill, { opacity: 0.18 }]} contentFit="cover" />
      <LinearGradient colors={["rgba(15,17,21,0.5)", "rgba(15,17,21,0.95)"]} style={StyleSheet.absoluteFill} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, dunkSplash, { backgroundColor: "rgba(122,184,255,0.25)" }]} />
      {finalRush && <View pointerEvents="none" style={styles.finalRushVignette} />}

      <View style={styles.hud}>
        <Pressable onPress={() => router.back()} style={styles.exitBtn} testID="exit-btn">
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <Animated.View style={[styles.timerBox, timerStyle]}>
          <Text style={[styles.timerLabel, finalRush && { color: theme.c.brand }]}>{isTournament ? "🏆 TOURNAMENT" : "TIME"}</Text>
          <Text style={[styles.timerValue, finalRush && { color: theme.c.brand }]}>{Math.ceil(timeLeft)}s</Text>
        </Animated.View>
        <View style={styles.tumsBox} testID="tums-counter">
          <Text style={{ fontSize: 16 }}>💊</Text>
          <Text style={styles.tumsText}>{tumsLeft}</Text>
        </View>
      </View>

      <View style={styles.versus}>
        <View style={[styles.versusSide, { backgroundColor: !winning ? "rgba(255,42,0,0.15)" : theme.c.surfaceSecondary }]}>
          <Text style={styles.vsLabel}>{opp.country} {opp.name}</Text>
          <Text style={styles.vsScore}>{opponentScore}</Text>
          <Text style={styles.vsSub}>{opponentChomps}/{CHOMPS_PER_ITEM} chomps</Text>
        </View>
        <Text style={styles.vsX}>VS</Text>
        <Animated.View style={[styles.versusSide, scoreStyle, { backgroundColor: winning ? "rgba(57,255,20,0.18)" : theme.c.surfaceSecondary }]}>
          <Text style={[styles.vsLabel, { color: theme.c.brandSecondary }]}>YOU</Text>
          <Text style={styles.vsScore} testID="player-score">{score}</Text>
          <Text style={styles.vsSub}>{chomps}/{CHOMPS_PER_ITEM} chomps · x{combo}</Text>
        </Animated.View>
      </View>

      {mcLine ? <View style={styles.mcBanner} testID="mc-banner"><Text style={styles.mcText} numberOfLines={2}>{mcLine}</Text></View> : null}
      {trash ? <View style={styles.trashBubble} testID="trash-talk"><Text style={styles.trashText} numberOfLines={3}>💬 {trash}</Text></View> : null}

      <View style={styles.metersContainer}>
        <View style={styles.meterCol}>
          <Text style={styles.meterEmoji}>🔥</Text>
          <View style={styles.meterTrack} testID="heartburn-meter">
            <Animated.View style={[styles.meterFill, heartburnStyle, { backgroundColor: hbColor }]} />
          </View>
          <Text style={[styles.meterValue, { color: hbColor }]}>{Math.round(heartburn)}</Text>
        </View>
        <View style={styles.meterCol}>
          <Text style={styles.meterEmoji}>🍔</Text>
          <View style={styles.meterTrack} testID="belly-meter">
            <Animated.View style={[styles.meterFill, bellyStyle, { backgroundColor: bellyColor }]} />
          </View>
          <Text style={[styles.meterValue, { color: bellyColor }]}>{Math.round(belly)}/{maxBelly}</Text>
        </View>
      </View>

      {centerZone}

      <Pressable onPress={handleDunk} disabled={dunksLeft <= 0} style={[styles.dunkBtn, dunksLeft <= 0 && { opacity: 0.4 }]} testID="dunk-btn">
        <Text style={styles.dunkIcon}>💧</Text>
        <View>
          <Text style={styles.dunkTitle}>DUNK</Text>
          <Text style={styles.dunkSub}>{dunksLeft}/{MAX_DUNKS}</Text>
        </View>
      </Pressable>

      <Pressable onPress={handleTums} disabled={tumsLeft <= 0} style={[styles.tumsBtn, tumsLeft <= 0 && { opacity: 0.4 }]} testID="tums-btn">
        <Text style={styles.tumsBtnIcon}>💊</Text>
        <View>
          <Text style={styles.tumsBtnTitle}>TUMS</Text>
          <Text style={styles.tumsBtnSub}>-{TUMS_REDUCE} 🔥</Text>
        </View>
      </Pressable>

      {state === "countdown" && (
        <View style={styles.countdownOverlay} testID="countdown-overlay">
          <Text style={styles.countdownText}>{countdown === 0 ? "EAT!" : countdown}</Text>
        </View>
      )}
      {state === "submitting" && (
        <View style={styles.countdownOverlay}>
          <ActivityIndicator size="large" color={theme.c.brand} />
        </View>
      )}
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.c.surface },
  errContainer: { flex: 1, backgroundColor: theme.c.surface, alignItems: "center", justifyContent: "center", padding: theme.s.xl },
  errText: { color: theme.c.onSurface, fontSize: 18, textAlign: "center", marginBottom: theme.s.lg },
  backBtn: { backgroundColor: theme.c.brand, paddingHorizontal: theme.s.xl, paddingVertical: theme.s.md, borderRadius: theme.r.pill },
  backBtnText: { color: "#fff", fontWeight: "900" },
  hud: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.s.lg, paddingTop: theme.s.sm },
  exitBtn: { width: 36, height: 36, borderRadius: theme.r.pill, backgroundColor: theme.c.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.c.border },
  timerBox: { alignItems: "center" },
  timerLabel: { color: theme.c.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  timerValue: { color: theme.c.onSurface, fontSize: 32, fontFamily: theme.f.display, fontWeight: "900" },
  tumsBox: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.c.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.r.pill, borderWidth: 1, borderColor: theme.c.border },
  tumsText: { color: "#fff", fontWeight: "900" },
  versus: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.s.lg, marginTop: theme.s.md, gap: theme.s.sm },
  versusSide: { flex: 1, padding: theme.s.md, borderRadius: theme.r.md, borderWidth: 1, borderColor: theme.c.border },
  vsLabel: { color: theme.c.onSurfaceSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  vsScore: { color: "#fff", fontSize: 30, fontFamily: theme.f.display, fontWeight: "900", marginTop: 2 },
  vsSub: { color: theme.c.onSurfaceTertiary, fontSize: 10, fontWeight: "700", marginTop: 1 },
  vsX: { color: theme.c.brand, fontSize: 18, fontWeight: "900" },
  mcBanner: { alignSelf: "center", backgroundColor: theme.c.brandSecondary, paddingHorizontal: theme.s.md, paddingVertical: 6, borderRadius: theme.r.sm, marginTop: theme.s.sm, marginHorizontal: theme.s.lg, maxWidth: width - 32 },
  mcText: { color: "#0F1115", fontSize: 12, fontWeight: "900", letterSpacing: 0.3, textAlign: "center" },
  trashBubble: { alignSelf: "center", backgroundColor: theme.c.surfaceSecondary, padding: theme.s.sm, borderRadius: theme.r.lg, borderWidth: 1, borderColor: theme.c.brand, marginTop: 6, marginHorizontal: theme.s.lg, maxWidth: width - 32 },
  trashText: { color: "#fff", fontSize: 12, fontStyle: "italic" },
  metersContainer: { position: "absolute", left: theme.s.sm, top: "30%", bottom: "20%", flexDirection: "row", gap: 6 },
  meterCol: { alignItems: "center" },
  meterEmoji: { fontSize: 18 },
  meterTrack: { width: 18, flex: 1, marginTop: 4, backgroundColor: theme.c.surfaceSecondary, borderRadius: theme.r.pill, borderWidth: 1, borderColor: theme.c.border, overflow: "hidden", justifyContent: "flex-end" },
  meterFill: { width: "100%", borderRadius: theme.r.pill },
  meterValue: { fontSize: 11, fontWeight: "900", marginTop: 3 },
  tapZone: { flex: 1, alignItems: "center", justifyContent: "center" },
  foodEmoji: { fontSize: 160 },
  tapHint: { color: theme.c.brandSecondary, fontSize: 16, fontWeight: "900", letterSpacing: 2, marginTop: theme.s.md },
  comboText: { color: theme.c.brand, fontSize: 22, fontWeight: "900", marginTop: 6, letterSpacing: 1 },
  floatPlus: { position: "absolute", top: "30%", color: theme.c.success, fontSize: 28, fontWeight: "900" },
  holdRing: { position: "absolute", width: 220, height: 220, borderRadius: 110, borderWidth: 4, borderColor: theme.c.brandSecondary },
  dunkBtn: { position: "absolute", bottom: 24, left: 16, flexDirection: "row", alignItems: "center", gap: theme.s.sm, backgroundColor: "#1f4d8a", paddingHorizontal: theme.s.lg, paddingVertical: theme.s.md, borderRadius: theme.r.pill, borderWidth: 2, borderColor: "#7AB8FF" },
  dunkIcon: { fontSize: 28 },
  dunkTitle: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  dunkSub: { color: "#cce0ff", fontSize: 10, fontWeight: "800" },
  tumsBtn: { position: "absolute", bottom: 24, right: 16, flexDirection: "row", alignItems: "center", gap: theme.s.sm, backgroundColor: theme.c.brand, paddingHorizontal: theme.s.lg, paddingVertical: theme.s.md, borderRadius: theme.r.pill, borderWidth: 2, borderColor: "#fff", shadowColor: theme.c.brand, shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  tumsBtnIcon: { fontSize: 28 },
  tumsBtnTitle: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  tumsBtnSub: { color: "#fff", fontSize: 10, fontWeight: "700" },
  finalRushVignette: { ...StyleSheet.absoluteFillObject, borderColor: "rgba(255,42,0,0.55)", borderWidth: 8 },
  countdownOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  countdownText: { color: theme.c.brand, fontSize: 140, fontFamily: theme.f.display, fontWeight: "900" },
});

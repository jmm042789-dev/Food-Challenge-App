export type OpponentMood =
  | "CALM"
  | "FOCUSED"
  | "CONFIDENT"
  | "PRESSURED"
  | "PANICKING"
  | "VICTORIOUS";

type OpponentMoodInput = {
  playerScore: number;
  opponentScore: number;
  playerCombo: number;
  timeRemaining: number;
  matchDuration: number;
  matchFinished: boolean;
};

export function getOpponentMood({
  playerScore,
  opponentScore,
  playerCombo,
  timeRemaining,
  matchDuration,
  matchFinished,
}: OpponentMoodInput): OpponentMood {
  const scoreGap = opponentScore - playerScore;
  const meaningfulGap = Math.max(12, Math.max(playerScore, opponentScore) * 0.25);
  const elapsedRatio = matchDuration > 0
    ? Math.min(1, Math.max(0, 1 - timeRemaining / matchDuration))
    : 0;
  const closingSeconds = Math.max(8, matchDuration * 0.18);

  if (matchFinished) {
    return opponentScore > playerScore ? "VICTORIOUS" : opponentScore < playerScore ? "PANICKING" : "FOCUSED";
  }

  if (timeRemaining <= closingSeconds && scoreGap <= -meaningfulGap) return "PANICKING";
  if (scoreGap >= meaningfulGap) return "CONFIDENT";
  if (playerCombo >= 10 && scoreGap <= 0) return "PRESSURED";
  if (scoreGap <= -meaningfulGap * 0.55) return "PRESSURED";
  if (scoreGap > 0) return "FOCUSED";
  if (elapsedRatio < 0.22 && Math.abs(scoreGap) < meaningfulGap * 0.4) return "CALM";
  return "FOCUSED";
}

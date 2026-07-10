export class GameEngine {
  state: any;

  private comboResetTimer: any;

  constructor(food: any, opponent: any, difficulty: number) {
    this.state = {
      status: "idle",
      score: 0,
      combo: 0,
      maxCombo: 0,
      timeLeft: 60,
      health: 100,
      food,
      opponent,
      difficulty,
    };
  }

  start() {
    this.state.status = "playing";

    setInterval(() => {
      if (this.state.status !== "playing") return;

      this.state.timeLeft -= 1;
      this.state.health -= this.state.opponent.aggression * 0.5;

      if (this.state.timeLeft <= 0 || this.state.health <= 0) {
        this.state.status = this.state.health <= 0 ? "lost" : "won";
      }
    }, 1000);
  }

  tap() {
    if (this.state.status !== "playing") return;

    this.state.score += 10 * this.state.food.speedFactor;
    this.state.combo += 1;

    if (this.state.combo > this.state.maxCombo) {
      this.state.maxCombo = this.state.combo;
    }

    this.state.health = Math.min(100, this.state.health + 1);

    clearTimeout(this.comboResetTimer);
    this.comboResetTimer = setTimeout(() => {
      this.state.combo = 0;
    }, 1200);
  }
}
export const BOSS_MAX_HP = 3;
export const PLAYER_MAX_HP = 3;
export const BOSS_TOTAL_ROUNDS = 3;

export interface BossState {
  bossHp: number;
  playerHp: number;
  roundsPlayed: number;
  totalRounds: number;
  correctAnswers: number;
  finished: boolean;
  victory: boolean;
}

export function createBossState(): BossState {
  return {
    bossHp: BOSS_MAX_HP,
    playerHp: PLAYER_MAX_HP,
    roundsPlayed: 0,
    totalRounds: BOSS_TOTAL_ROUNDS,
    correctAnswers: 0,
    finished: false,
    victory: false,
  };
}

/**
 * Applies one resolved boss round. A correct answer damages the boss; a wrong
 * answer damages the player's resolve. The encounter ends on KO or after all rounds.
 */
export function resolveBossRound(state: BossState, correct: boolean): BossState {
  if (state.finished) {
    return state;
  }

  const bossHp = correct ? Math.max(0, state.bossHp - 1) : state.bossHp;
  const playerHp = correct ? state.playerHp : Math.max(0, state.playerHp - 1);
  const roundsPlayed = state.roundsPlayed + 1;
  const victory = bossHp === 0;
  const finished = victory || playerHp === 0 || roundsPlayed >= state.totalRounds;

  return {
    ...state,
    bossHp,
    playerHp,
    roundsPlayed,
    correctAnswers: state.correctAnswers + (correct ? 1 : 0),
    finished,
    victory,
  };
}

export function currentRoundNumber(state: BossState): number {
  return Math.min(state.roundsPlayed + 1, state.totalRounds);
}

export function bossHpRatio(state: BossState): number {
  return Math.max(0, state.bossHp / BOSS_MAX_HP);
}

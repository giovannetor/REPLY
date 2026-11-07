import { describe, expect, test } from 'vitest';
import {
  BOSS_MAX_HP,
  BOSS_TOTAL_ROUNDS,
  PLAYER_MAX_HP,
  createBossState,
  currentRoundNumber,
  resolveBossRound,
  type BossState,
} from '../src/domain/boss';

function apply(state: BossState, results: boolean[]): BossState {
  return results.reduce((current, correct) => resolveBossRound(current, correct), state);
}

describe('boss encounter state', () => {
  test('starts at full HP with no rounds played', () => {
    const state = createBossState();
    expect(state.bossHp).toBe(BOSS_MAX_HP);
    expect(state.playerHp).toBe(PLAYER_MAX_HP);
    expect(state.roundsPlayed).toBe(0);
    expect(state.totalRounds).toBe(BOSS_TOTAL_ROUNDS);
    expect(state.finished).toBe(false);
    expect(state.victory).toBe(false);
    expect(currentRoundNumber(state)).toBe(1);
  });

  test('three correct answers defeat the boss', () => {
    const state = apply(createBossState(), [true, true, true]);
    expect(state.bossHp).toBe(0);
    expect(state.playerHp).toBe(PLAYER_MAX_HP);
    expect(state.correctAnswers).toBe(3);
    expect(state.roundsPlayed).toBe(3);
    expect(state.finished).toBe(true);
    expect(state.victory).toBe(true);
  });

  test('a wrong answer costs the player one resolve', () => {
    const state = resolveBossRound(createBossState(), false);
    expect(state.bossHp).toBe(BOSS_MAX_HP);
    expect(state.playerHp).toBe(PLAYER_MAX_HP - 1);
    expect(state.correctAnswers).toBe(0);
    expect(state.roundsPlayed).toBe(1);
    expect(state.finished).toBe(false);
  });

  test('three wrong answers end the run in defeat', () => {
    const state = apply(createBossState(), [false, false, false]);
    expect(state.playerHp).toBe(0);
    expect(state.finished).toBe(true);
    expect(state.victory).toBe(false);
  });

  test('two correct answers are not enough after all rounds', () => {
    const state = apply(createBossState(), [true, false, true]);
    expect(state.bossHp).toBe(1);
    expect(state.playerHp).toBe(PLAYER_MAX_HP - 1);
    expect(state.roundsPlayed).toBe(BOSS_TOTAL_ROUNDS);
    expect(state.finished).toBe(true);
    expect(state.victory).toBe(false);
  });

  test('resolving after the encounter has finished is a no-op', () => {
    const finished = apply(createBossState(), [true, true, true]);
    expect(resolveBossRound(finished, false)).toBe(finished);
  });

  test('round display is capped at the total', () => {
    const state = apply(createBossState(), [true, true]);
    expect(currentRoundNumber(state)).toBe(3);
    const finished = apply(createBossState(), [true, true, true]);
    expect(currentRoundNumber(finished)).toBe(BOSS_TOTAL_ROUNDS);
  });
});

import { BOSS_MAX_HP, PLAYER_MAX_HP, type BossState } from '../domain/boss';
import { gameEvents } from '../game/events';
import { mustGet } from './dom';

/** Presentation only: listens to the existing encounter state and never resolves rounds. */
export class BossPanel {
  private readonly panel = mustGet<HTMLElement>('boss-companion');
  private readonly hp = mustGet<HTMLElement>('companion-hp');
  private readonly feedback = mustGet<HTMLElement>('combat-feedback');

  constructor() {
    gameEvents.on('boss:round-resolved', ({ correct }) => {
      this.panel.classList.remove('boss-hit', 'player-hit');
      void this.panel.offsetWidth;
      this.panel.classList.add(correct ? 'boss-hit' : 'player-hit');
      this.feedback.textContent = correct
        ? '−1 HP · Direct hit!'
        : 'Counterattack · −1 resolve';
    });
  }

  update(state: BossState): void {
    const displayedPhase = Math.min(state.roundsPlayed || 1, state.totalRounds);
    mustGet('companion-phase').textContent =
      `Phase ${displayedPhase} / ${state.totalRounds}`;
    this.hp.style.width = `${(state.bossHp / BOSS_MAX_HP) * 100}%`;
    mustGet('companion-hp-text').textContent =
      `${state.bossHp} / ${BOSS_MAX_HP} HP`;
    mustGet('companion-resolve').textContent =
      `${state.playerHp} / ${PLAYER_MAX_HP}`;
    if (state.roundsPlayed === 0) {
      this.feedback.textContent = 'Your knowledge is your weapon.';
      this.panel.classList.remove('boss-hit', 'player-hit');
    }
  }
}

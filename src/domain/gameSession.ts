import { DOOR_IDS, type DoorId } from './challenge';
import type { BossState } from './boss';

export interface DoorCompletion {
  doorId: DoorId;
  challengeTitle: string;
  attempts: number;
  xp: number;
}

export class GameSession {
  private readonly doorCompletions = new Map<DoorId, DoorCompletion>();
  bossState: BossState | null = null;

  completeDoor(completion: DoorCompletion): void {
    this.doorCompletions.set(completion.doorId, completion);
  }

  isDoorComplete(doorId: DoorId): boolean {
    return this.doorCompletions.has(doorId);
  }

  get completedDoorCount(): number {
    return this.doorCompletions.size;
  }

  get allDoorsComplete(): boolean {
    return DOOR_IDS.every((doorId) => this.doorCompletions.has(doorId));
  }

  get completions(): DoorCompletion[] {
    return DOOR_IDS.map((doorId) => this.doorCompletions.get(doorId)).filter(
      (completion): completion is DoorCompletion => completion !== undefined,
    );
  }

  setBossState(state: BossState): void {
    this.bossState = state;
  }

  reset(): void {
    this.doorCompletions.clear();
    this.bossState = null;
  }
}

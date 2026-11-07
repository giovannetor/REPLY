import type { BossState } from '../domain/boss';
import type { DoorId } from '../domain/challenge';

export interface GameEvents {
  'gameplay:pause': { paused: boolean };
  'door:interact': { doorId: DoorId };
  'door:solved': { doorId: DoorId };
  'boss:enter': Record<string, never>;
  'boss:ready': Record<string, never>;
  'boss:round-resolved': { correct: boolean; state: BossState };
}

type Handler<T> = (payload: T) => void;

export class TypedEventBus<Events extends object> {
  private readonly handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const set = this.handlers.get(event) ?? new Set<Handler<never>>();
    set.add(handler as Handler<never>);
    this.handlers.set(event, set);
    return () => {
      set.delete(handler as Handler<never>);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    for (const handler of set) {
      (handler as Handler<Events[K]>)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const gameEvents = new TypedEventBus<GameEvents>();

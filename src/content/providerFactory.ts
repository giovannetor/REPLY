import { HttpChallengeProvider, type ChallengeProvider } from './ChallengeProvider';
import { MockChallengeProvider } from './mockProvider';

export interface ProviderSetup {
  provider: ChallengeProvider;
  mode: 'mock' | 'api';
  note?: string;
}

export function createChallengeProvider(search = window.location.search): ProviderSetup {
  const apiUrl = import.meta.env.VITE_CHALLENGE_API_URL?.trim();
  if (apiUrl) {
    return {
      provider: new HttpChallengeProvider(apiUrl),
      mode: 'api',
    };
  }

  const simulateError = new URLSearchParams(search).get('simulateError') === '1';
  return {
    provider: new MockChallengeProvider({
      latencyMs: 650,
      failFirstAttempt: simulateError,
    }),
    mode: 'mock',
    note: simulateError
      ? 'Error simulation is on: the first request for each challenge will fail, and Retry will succeed.'
      : undefined,
  };
}

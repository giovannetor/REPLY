// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import markup from '../index.html?raw';
import { createBossState, resolveBossRound } from '../src/domain/boss';
import { gameEvents } from '../src/game/events';
import { BossPanel } from '../src/ui/BossPanel';
let renderMath: typeof import('../src/ui/math').renderMath;
beforeAll(async () => {
  document.open();
  document.write('<!doctype html><html><head></head><body></body></html>');
  document.close();
  // Happy DOM does not implement compatMode; the real app declares an HTML5 doctype.
  Object.defineProperty(document, 'compatMode', { value: 'CSS1Compat', configurable: true });
  ({ renderMath } = await import('../src/ui/math'));
});

beforeEach(() => {
  gameEvents.clear();
  document.body.innerHTML = markup.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script[\s\S]*?<\/script>/g, '');
});

describe('boss presentation follows existing game state', () => {
  test('correct answer updates HP and triggers hit feedback without changing combat rules', () => {
    const panel = new BossPanel();
    panel.update(createBossState());
    const resolved = resolveBossRound(createBossState(), true);
    panel.update(resolved);
    gameEvents.emit('boss:round-resolved', { correct: true, state: resolved });
    expect(document.getElementById('companion-hp-text')?.textContent).toBe(
      '2 / 3 HP',
    );
    expect(document.getElementById('companion-hp')?.style.width).toBe(
      `${(2 / 3) * 100}%`,
    );
    expect(
      document.getElementById('boss-companion')?.classList.contains('boss-hit'),
    ).toBe(true);
    expect(document.getElementById('combat-feedback')?.textContent).toContain(
      'Direct hit',
    );
    expect(document.getElementById('companion-resolve')?.textContent).toBe(
      '3 / 3',
    );
  });
  test('incorrect answer reduces resolve, retains boss HP and shows counterattack', () => {
    const panel = new BossPanel();
    const resolved = resolveBossRound(createBossState(), false);
    panel.update(resolved);
    gameEvents.emit('boss:round-resolved', { correct: false, state: resolved });
    expect(document.getElementById('companion-hp-text')?.textContent).toBe(
      '3 / 3 HP',
    );
    expect(document.getElementById('companion-resolve')?.textContent).toBe(
      '2 / 3',
    );
    expect(
      document
        .getElementById('boss-companion')
        ?.classList.contains('player-hit'),
    ).toBe(true);
    expect(document.getElementById('combat-feedback')?.textContent).toContain(
      'Counterattack',
    );
    panel.update(createBossState());
    expect(
      document
        .getElementById('boss-companion')
        ?.classList.contains('player-hit'),
    ).toBe(false);
  });
});

describe('math presentation', () => {
  test('renders accessible inline and block math while treating prose as text', () => {
    const host = document.createElement('div');
    renderMath(
      host,
      '<img src=x onerror=alert(1)> Force \\(F_N\\), $$\\frac{p_t}{p_0}$$',
    );
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(host.querySelectorAll('.katex')).toHaveLength(2);
    expect(host.querySelector('.katex-display')).not.toBeNull();
    expect(host.querySelector('math')).not.toBeNull();
  });
  test('invalid math stays readable and does not discard surrounding text', () => {
    const host = document.createElement('div');
    renderMath(host, 'Before \\(\\notARealCommand{x}\\) after.');
    expect(host.textContent).toBe('Before \\notARealCommand{x} after.');
  });
});

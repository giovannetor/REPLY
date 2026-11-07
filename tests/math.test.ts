import { describe, expect, test } from 'vitest';
import { mathSegments } from '../src/ui/math';

describe('educational math notation', () => {
  test('recognizes explicit inline and block TeX without changing prose', () => {
    expect(mathSegments('Force \\(F_N\\) then $$\\frac{p_t}{p_0}$$.')).toEqual([
      { text: 'Force ', math: false, block: false },
      { text: 'F_N', math: true, block: false },
      { text: ' then ', math: false, block: false },
      { text: '\\frac{p_t}{p_0}', math: true, block: true },
      { text: '.', math: false, block: false },
    ]);
  });
  test('supports legacy variables, dotted flow, fractions and multi-letter subscripts', () => {
    const formulas = mathSegments(
      'F_N, \\dot{m}, p_t, V_0, \\eta_th, \\eta_p, p_t / p_0',
    )
      .filter((p) => p.math)
      .map((p) => p.text);
    expect(formulas).toEqual([
      'F_N',
      '\\dot{m}',
      'p_t',
      'V_0',
      '\\eta_{th}',
      '\\eta_p',
      '\\frac{p_t}{p_0}',
    ]);
  });
  test('supports legacy Unicode Greek variables in the boss questions', () => {
    expect(mathSegments('Recovery εd and efficiency ηd.').filter(p => p.math).map(p => p.text))
      .toEqual(['\\varepsilon_d', '\\eta_d']);
  });
  test('leaves course ids and ordinary text intact', () => {
    expect(mathSegments('Q_D2 · C2 · pressure remains positive.')).toEqual([
      {
        text: 'Q_D2 · C2 · pressure remains positive.',
        math: false,
        block: false,
      },
    ]);
  });
});

/**
 * Authored prototype content for the Motori per Aeromobili slice.
 *
 * The one-page framework summary names concepts and question themes only. It
 * does not contain verified question text, answers, rubrics or slide
 * references. Everything below is provisional authored content and is marked
 * as such in the UI.
 *
 * These are plain data objects, not code. Every provider response is validated
 * by validateChallenge before it reaches the UI.
 */
export const MOCK_CHALLENGES: Record<string, unknown> = {
  'c1-stream-force': {
    id: 'c1-stream-force',
    type: 'multiple-choice',
    topic: 'logic',
    title: 'The Control-Volume Ledger',
    prompt:
      'A turbojet is enclosed in a control volume. Why does the stream-force formulation let you avoid integrating the unknown pressure distribution over the internal walls?',
    hint: 'Think about which forces are internal to the control volume and which cross its boundary.',
    options: [
      {
        id: 'boundary-only',
        label:
          'Internal wall-pressure forces cancel within the control volume; only boundary momentum and pressure fluxes remain.',
      },
      {
        id: 'ambient',
        label: 'Because every internal wall is at ambient static pressure.',
      },
      {
        id: 'ignore-pressure',
        label: 'Because the momentum equation ignores pressure forces.',
      },
      {
        id: 'choked',
        label: 'Because the exhaust nozzle is always choked.',
      },
    ],
    correctOptionId: 'boundary-only',
    explanation:
      'Internal forces act in equal and opposite pairs inside the control volume. The net stream force follows from the momentum and pressure fluxes across the boundary, plus ram drag, so the internal wall-pressure distribution is not needed.',
    xp: 100,
  },
  'c2-advanced-intake-matching': {
    id: 'c2-advanced-intake-matching',
    type: 'multiple-choice',
    topic: 'order',
    title: 'The Matched Intake',
    prompt:
      'A fixed-geometry supersonic intake must keep its captured mass flow matched to engine demand at a new throttle setting. Which combination best preserves started, matched operation?',
    hint: 'Matching is about passing the demanded flow while keeping the terminal shock stable, not about spilling or unstarting.',
    options: [
      {
        id: 'throat-control',
        label:
          'Adjust the throat/contraction margin, or use a bypass, so the terminal shock stays positioned and only the demanded mass flow passes.',
      },
      {
        id: 'close-throat',
        label: 'Close the throat until the shock is expelled; the resulting unstart reduces mass flow.',
      },
      {
        id: 'increase-capture',
        label: 'Increase the captured stream tube so the engine receives more air than it demands.',
      },
      {
        id: 'ignore-demand',
        label: 'Ignore engine demand; the intake mass flow is fixed by flight speed alone.',
      },
    ],
    correctOptionId: 'throat-control',
    explanation:
      'Mass-flow matching requires the intake to pass the engine’s demanded flow while keeping the terminal shock stable. Throat margin, bypass or variable geometry can absorb the mismatch. Spilling or unstarting is the off-design penalty, not the design goal.',
    xp: 120,
  },
  'c2-counterexample-shock-position': {
    id: 'c2-counterexample-shock-position',
    type: 'true-false',
    topic: 'order',
    title: 'Counterexample: The Upstream Shock',
    prompt:
      'Claim: “Moving the terminal shock upstream of the cowl lip always improves total-pressure recovery because the shock becomes weaker.”',
    hint: 'Separate shock strength from the captured stream tube and additive drag.',
    correctAnswer: false,
    explanation:
      'An upstream terminal shock at the cowl lip is associated with subcritical operation: the intake spills part of the captured stream tube and additive drag rises. Recovery does not automatically improve, and further shock expulsion can unstart the intake.',
    xp: 120,
  },
  'c2-remedial-mass-flow': {
    id: 'c2-remedial-mass-flow',
    type: 'multiple-choice',
    topic: 'order',
    title: 'Remedial: Mass-Flow Ratio',
    prompt: 'For a supersonic intake, what does the mass-flow ratio φd compare?',
    hint: 'φd is a mass-flow ratio. Total-pressure recovery is a different quantity, εd.',
    options: [
      {
        id: 'captured-to-design',
        label: 'The captured mass flow to the design (or reference) mass flow.',
      },
      {
        id: 'pressure-ratio',
        label: 'The intake total pressure to the freestream total pressure.',
      },
      {
        id: 'temperature-ratio',
        label: 'The intake total temperature to the freestream total temperature.',
      },
      {
        id: 'thrust-to-drag',
        label: 'The net thrust to the intake additive drag.',
      },
    ],
    correctOptionId: 'captured-to-design',
    explanation:
      'φd is a mass-flow ratio: captured flow relative to a design or reference value. Total-pressure recovery is εd. The two describe different parts of intake matching and must not be conflated.',
    xp: 100,
  },
  'c3-combustor-stability': {
    id: 'c3-combustor-stability',
    type: 'true-false',
    topic: 'truth',
    title: 'The Stable Branch',
    prompt:
      'In Bragg’s well-stirred reactor model, a stable combustor branch is one where a small temperature perturbation is damped by a restoring balance between heat release and heat removal.',
    hint: 'Compare the slopes of heat release and heat removal around the operating point.',
    correctAnswer: true,
    explanation:
      'On a stable branch, heat removal rises faster than heat release after a positive perturbation (and vice versa after a negative one), so the perturbation decays. The unstable branch shows the opposite slope and can lead to blowout or oscillation.',
    xp: 110,
  },
  'boss-intake-pressure-recovery': {
    id: 'boss-intake-pressure-recovery',
    type: 'multiple-choice',
    topic: 'boss',
    title: 'Phase I · Pressure Recovery',
    prompt:
      'A supersonic intake suffers severe stagnation-pressure dissipation. Which statement correctly distinguishes total-pressure recovery εd from adiabatic efficiency ηd?',
    options: [
      {
        id: 'recovery-vs-temperature',
        label:
          'εd compares intake total pressure with freestream total pressure; ηd compares actual with ideal temperature rise.',
      },
      {
        id: 'same',
        label: 'They are the same quantity expressed in different units.',
      },
      {
        id: 'recovery-temperature',
        label: 'εd is a temperature ratio and ηd is a pressure ratio.',
      },
      {
        id: 'recovery-thrust',
        label: 'εd measures net thrust and ηd measures additive drag.',
      },
    ],
    correctOptionId: 'recovery-vs-temperature',
    explanation:
      'Ram recovery εd is a total-pressure ratio. Adiabatic efficiency ηd relates actual and ideal temperature changes. A severe pressure loss can coexist with a different temperature-efficiency value, so the two must not be conflated.',
    xp: 150,
  },
  'boss-combustor-partitioning': {
    id: 'boss-combustor-partitioning',
    type: 'true-false',
    topic: 'boss',
    title: 'Phase II · The Combustor Partition',
    prompt:
      'Raising primary-zone temperature and residence time can reduce CO, but it also tends to increase thermal NOx; dilution air then sets the exit temperature.',
    correctAnswer: true,
    explanation:
      'Primary-zone conditions control CO burnout, while high temperatures promote thermal (Zeldovich) NOx. Dilution air lowers the exit temperature but adds its own mixing and stability trade-offs. The zones must be partitioned together.',
    xp: 150,
  },
  'boss-intake-offdesign-mismatch': {
    id: 'boss-intake-offdesign-mismatch',
    type: 'sequence',
    topic: 'boss',
    title: 'Phase III · Off-Design Mismatch',
    prompt:
      'Order the events that can follow a reduced throttle demand in a fixed-geometry supersonic intake.',
    items: [
      { id: 'demand-drop', label: 'Engine demand for mass flow falls.' },
      {
        id: 'shock-upstream',
        label: 'The terminal shock moves upstream toward the cowl lip.',
      },
      {
        id: 'spill',
        label: 'Part of the captured stream tube spills and additive drag rises.',
      },
      {
        id: 'unstart',
        label: 'If the shock is expelled, the intake unstarts.',
      },
    ],
    correctOrder: ['demand-drop', 'shock-upstream', 'spill', 'unstart'],
    explanation:
      'Reducing throttle lowers the demanded mass flow. The terminal shock moves upstream, the intake spills excess capture, and further displacement can expel the shock and unstart the intake. Kantrowitz–Donaldson throat constraints limit how far the shock can be swallowed.',
    xp: 160,
  },
};

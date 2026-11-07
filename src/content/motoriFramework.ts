import type {
  BossRound,
  Concept,
  Course,
  DiagnosticQuestion,
  EvaluationRubric,
  LearningChallenge,
  SourceReference,
} from '../domain/learning';
import type { AdaptiveChallengeBank } from '../domain/gameDirector';
import { C2_CONTENT_PACK } from './coursePackAdapter';

/**
 * The only source available for this slice is a one-page framework summary.
 * It is verified as a document, but it does not verify any question, answer,
 * rubric or slide reference. Everything else here is authored prototype content.
 */
export const FRAMEWORK_SOURCE: SourceReference = {
  id: 'motori-framework-summary',
  kind: 'framework-summary',
  title: 'Motori per Aeromobili — Course Assessment Framework (summary)',
  locator: 'p. 1',
  verified: true,
  note: 'One-page summary prepared for BossFight AI. It names concepts and question themes only; it does not contain verified questions, answers, rubrics, or slide references.',
};

const TOPIC_SOURCES: SourceReference[] = [FRAMEWORK_SOURCE];
const NO_ANSWER_SOURCES: SourceReference[] = [];

export const MOTORI_CONCEPTS: Concept[] = [
  {
    id: 'C1',
    title: 'Standard Net Thrust & Stream Force',
    shortTitle: 'Stream Force',
    summary:
      'Evaluation of propulsion performance using control-volume momentum theorems combining internal forces and ram drag.',
    focus:
      'Why the stream-force formulation replaces unknown internal wall-pressure integrations in esoreattori.',
    sourceRefs: TOPIC_SOURCES,
    assessedInThisSlice: true,
  },
  {
    id: 'C2',
    title: 'Supersonic Intake Operation & Matching',
    shortTitle: 'Supersonic Intake',
    summary:
      'Management of mass-flow matching (φd), total-pressure recovery (εd), and unstarting phenomena.',
    focus:
      'Subcritical shock displacement, spillage, additive drag and intake-engine mass-flow matching.',
    sourceRefs: TOPIC_SOURCES,
    assessedInThisSlice: true,
  },
  {
    id: 'C3',
    title: 'Combustor Air Partitioning & Stability',
    shortTitle: 'Combustor Stability',
    summary:
      'Air distribution across primary, secondary and dilution zones, governed by Bragg’s reactor model and chemical kinetics.',
    focus:
      'Stable and unstable branches in the well-stirred reactor model, plus CO/NOx partitioning trade-offs.',
    sourceRefs: TOPIC_SOURCES,
    assessedInThisSlice: true,
  },
  {
    id: 'C4',
    title: 'Working Line & Component Matching',
    shortTitle: 'Component Matching',
    summary:
      'Off-design equilibrium of compressors, turbines and nozzles via corrected parameters and surge limits.',
    focus:
      'Single-spool turbojet compressor-map shifts when throttle advances.',
    sourceRefs: TOPIC_SOURCES,
    assessedInThisSlice: false,
  },
  {
    id: 'C5',
    title: 'Thermal & Propulsive Efficiencies Trade-off',
    shortTitle: 'Efficiency Trade-off',
    summary:
      'Balancing cycle thermal efficiency (ηθ) against propulsive efficiency (ηp) relative to flight speed and exit velocity.',
    focus:
      'The mathematical versus physical fallacy of setting exit velocity equal to flight velocity (we = u).',
    sourceRefs: TOPIC_SOURCES,
    assessedInThisSlice: false,
  },
];

export const MOTORI_COURSE: Course = {
  id: 'motori-per-aeromobili',
  name: 'Motori per Aeromobili',
  code: 'MOTORI',
  institution: 'Politecnico di Torino',
  description:
    'The engine archive has lost its verified answers. Work through a short diagnostic, follow the intake path, then face the Registrar in a three-phase final exam. All questions and mastery estimates in this prototype are provisional and unverified.',
  concepts: MOTORI_CONCEPTS,
};

export const MOTORI_RUBRICS: Record<string, EvaluationRubric> = {
  ...C2_CONTENT_PACK.rubrics,
  'c1-diagnostic-rubric': {
    id: 'c1-diagnostic-rubric',
    conceptId: 'C1',
    title: 'Stream-force reasoning',
    criteria: [
      {
        id: 'control-volume',
        label: 'Control-volume balance',
        description: 'Uses a control-volume momentum balance.',
        weight: 0.34,
        signals: ['control volume', 'control-volume', 'momentum balance', 'momentum theorem'],
        antiSignals: ['ignores momentum', 'no momentum balance'],
      },
      {
        id: 'internal-forces',
        label: 'Internal forces cancel',
        description: 'Explains that internal wall-pressure forces cancel in the net balance.',
        weight: 0.33,
        signals: ['internal', 'cancel', 'wall pressure', 'wall-pressure'],
        antiSignals: ['internal forces do not cancel', 'wall pressure must be integrated'],
      },
      {
        id: 'boundary-fluxes',
        label: 'Boundary fluxes',
        description: 'Identifies the boundary momentum and pressure fluxes.',
        weight: 0.33,
        signals: ['boundary', 'flux', 'pressure force', 'ram drag'],
        antiSignals: ['boundary fluxes are irrelevant'],
      },
    ],
    passThreshold: 0.6,
    provisional: true,
    clarificationPrompt:
      'Which forces are internal to the control volume, and why do they cancel in the net momentum balance?',
  },
  'c2-diagnostic-rubric': {
    id: 'c2-diagnostic-rubric',
    conceptId: 'C2',
    title: 'Subcritical intake reasoning',
    criteria: [
      {
        id: 'shock-motion',
        label: 'Shock displacement',
        description: 'Identifies that the terminal shock moves upstream or forward.',
        weight: 0.25,
        signals: ['shock moves upstream', 'shock moves forward', 'terminal shock', 'upstream', 'forward'],
        antiSignals: ['shock moves downstream', 'shock moves aft', 'shock moves back'],
      },
      {
        id: 'spillage',
        label: 'Spillage',
        description: 'Explains that the captured stream tube is partially spilled.',
        weight: 0.25,
        signals: ['spill', 'captured stream tube', 'stream tube', 'mass-flow capture', 'mass flow capture'],
        antiSignals: ['no spill', 'never spills', 'no mass-flow loss'],
      },
      {
        id: 'additive-drag',
        label: 'Additive drag',
        description: 'Links spillage to positive additive drag.',
        weight: 0.25,
        signals: ['additive drag', 'additive-drag', 'drag rises', 'drag increases'],
        antiSignals: ['drag decreases', 'negative additive drag'],
      },
      {
        id: 'unstart-risk',
        label: 'Unstart risk',
        description: 'Mentions unstart if the shock is expelled.',
        weight: 0.25,
        signals: ['unstart', 'expelled', 'expel the shock'],
        antiSignals: ['cannot unstart', 'never unstart'],
      },
    ],
    passThreshold: 0.6,
    provisional: true,
    clarificationPrompt:
      'State which way the terminal shock moves and what happens to the captured stream tube when engine demand falls.',
  },
  'c3-diagnostic-rubric': {
    id: 'c3-diagnostic-rubric',
    conceptId: 'C3',
    title: 'Combustor stability reasoning',
    criteria: [
      {
        id: 'heat-balance',
        label: 'Heat release vs removal',
        description: 'Compares heat release with heat removal.',
        weight: 0.34,
        signals: ['heat release', 'heat removal', 'heat-release', 'heat-removal'],
        antiSignals: ['ignores heat removal', 'no heat release'],
      },
      {
        id: 'stable-branch',
        label: 'Stable branch',
        description: 'Identifies damping or a restoring tendency.',
        weight: 0.33,
        signals: ['stable', 'damped', 'damping', 'restoring', 'perturbation decays'],
        antiSignals: ['always stable', 'highest efficiency is always stable'],
      },
      {
        id: 'unstable-branch',
        label: 'Unstable branch',
        description: 'Contrasts the unstable branch or its consequences.',
        weight: 0.33,
        signals: ['unstable', 'grows', 'blowout', 'oscillation', 'oscillates'],
        antiSignals: ['no unstable branch'],
      },
    ],
    passThreshold: 0.6,
    provisional: true,
    clarificationPrompt:
      'Which responds faster to a small temperature perturbation: heat release or heat removal? What does that imply for stability?',
  },
  'c2-adaptive-rubric': {
    id: 'c2-adaptive-rubric',
    conceptId: 'C2',
    title: 'Intake matching reasoning',
    criteria: [
      {
        id: 'matching',
        label: 'Mass-flow matching',
        description: 'Connects intake capture to engine demand.',
        weight: 0.34,
        signals: ['match', 'matching', 'mass flow', 'mass-flow'],
        antiSignals: ['ignore matching', 'no matching needed'],
      },
      {
        id: 'throat-margin',
        label: 'Throat margin',
        description: 'Mentions the throat or Kantrowitz-Donaldson constraint.',
        weight: 0.33,
        signals: ['throat', 'kantrowitz', 'donaldson', 'contraction ratio'],
        antiSignals: ['no throat limit', 'ignore kantrowitz'],
      },
      {
        id: 'no-spillage',
        label: 'Avoid spillage/unstart',
        description: 'Explains how started operation avoids spillage or unstart.',
        weight: 0.33,
        signals: ['spill', 'unstart', 'started', 'recovery'],
        antiSignals: ['spill improves', 'unstart is desirable'],
      },
    ],
    passThreshold: 0.6,
    provisional: true,
    clarificationPrompt:
      'How does the intake keep its mass flow matched to engine demand without spilling air or unstarting?',
  },
  'boss-c2-rubric': {
    id: 'boss-c2-rubric',
    conceptId: 'C2',
    title: 'Intake pressure recovery and off-design reasoning',
    criteria: [
      {
        id: 'recovery-definition',
        label: 'Recovery definition',
        description: 'Treats εd as total-pressure recovery.',
        weight: 0.34,
        signals: ['total pressure', 'total-pressure', 'recovery', 'epsilon'],
        antiSignals: ['recovery is temperature', 'epsilon is temperature'],
      },
      {
        id: 'efficiency-distinction',
        label: 'εd vs ηd',
        description: 'Distinguishes ram recovery from adiabatic efficiency.',
        weight: 0.33,
        signals: ['adiabatic', 'temperature', 'efficiency', 'eta'],
        antiSignals: ['same quantity', 'identical efficiency'],
      },
      {
        id: 'off-design-matching',
        label: 'Off-design matching',
        description: 'Links throttle reduction to shock motion and unstart.',
        weight: 0.33,
        signals: ['throttle', 'demand', 'shock', 'unstart', 'kantrowitz'],
        antiSignals: ['geometry changes automatically', 'no off-design effect'],
      },
    ],
    passThreshold: 0.6,
    provisional: true,
    clarificationPrompt:
      'Explain why a reduced throttle demand can move the terminal shock and eventually unstart a fixed-geometry intake.',
  },
  'boss-c3-rubric': {
    id: 'boss-c3-rubric',
    conceptId: 'C3',
    title: 'Combustor partitioning and emissions reasoning',
    criteria: [
      {
        id: 'pz-temperature',
        label: 'Primary-zone temperature',
        description: 'Connects higher PZ temperature to CO burnout.',
        weight: 0.34,
        signals: ['primary zone', 'primary-zone', 'temperature', 'residence time'],
        antiSignals: ['temperature has no effect'],
      },
      {
        id: 'nox',
        label: 'Thermal NOx',
        description: 'Mentions Zeldovich or thermal NOx.',
        weight: 0.33,
        signals: ['nox', 'zeldovich', 'thermal nox'],
        antiSignals: ['nox decreases with temperature'],
      },
      {
        id: 'dilution',
        label: 'Dilution trade-off',
        description: 'Explains the dilution-zone trade-off.',
        weight: 0.33,
        signals: ['dilution', 'quench', 'exit temperature'],
        antiSignals: ['dilution has no trade-off'],
      },
    ],
    passThreshold: 0.6,
    provisional: true,
    clarificationPrompt:
      'Which zone controls CO burnout, which zone controls exit temperature, and where does thermal NOx form?',
  },
};

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: 'diagnostic-c1-stream-force',
    conceptId: 'C1',
    order: 1,
    prompt:
      'A control volume encloses a complete turbojet. Why can the net stream force be computed from boundary momentum and pressure fluxes without integrating the unknown pressure distribution over the internal walls?',
    options: [
      {
        id: 'control-volume',
        label:
          'Because internal wall-pressure forces are internal to the control volume and cancel in the net momentum balance.',
      },
      {
        id: 'ambient-pressure',
        label:
          'Because the static pressure on every internal wall is equal to ambient pressure.',
      },
      {
        id: 'ignores-pressure',
        label: 'Because the momentum equation ignores pressure forces.',
      },
      {
        id: 'choked-nozzle',
        label: 'Because the exhaust nozzle always operates choked.',
      },
    ],
    correctOptionId: 'control-volume',
    explanationPrompt:
      'Explain why the internal wall-pressure distribution is not needed in the stream-force calculation.',
    explanationHint:
      'Use the ideas of control volume, internal forces and boundary momentum/pressure fluxes.',
    rubricId: 'c1-diagnostic-rubric',
    sourceRefs: TOPIC_SOURCES,
    answerSourceRefs: NO_ANSWER_SOURCES,
  },
  C2_CONTENT_PACK.diagnostics.Q_D2 ?? {
    id: 'diagnostic-c2-subcritical-intake',
    conceptId: 'C2',
    order: 2,
    prompt:
      'A supersonic intake is throttled below its design mass flow. The terminal shock moves upstream of the cowl lip. What is the immediate consequence?',
    options: [
      {
        id: 'recovery-improves',
        label: 'Total-pressure recovery improves because the shock becomes weaker.',
      },
      {
        id: 'spill-additive-drag',
        label:
          'The intake spills part of the captured stream tube, producing positive additive drag and reducing mass-flow capture.',
      },
      {
        id: 'stays-started',
        label:
          'The intake is guaranteed to remain started because the shock is still inside the duct.',
      },
      {
        id: 'nozzle-opens',
        label:
          'The nozzle throat automatically opens to restore the design mass flow.',
      },
    ],
    correctOptionId: 'spill-additive-drag',
    explanationPrompt:
      'Explain the shock movement, the captured stream tube, and the drag consequence.',
    explanationHint:
      'Mention the terminal shock, spillage and additive drag. Unstart is the limiting case.',
    rubricId: 'c2-diagnostic-rubric',
    sourceRefs: TOPIC_SOURCES,
    answerSourceRefs: NO_ANSWER_SOURCES,
  },
  {
    id: 'diagnostic-c3-wsr-stability',
    conceptId: 'C3',
    order: 3,
    prompt:
      'In Bragg’s well-stirred reactor model, the combustor stability map has multiple steady branches. Which condition identifies a stable branch?',
    options: [
      {
        id: 'damped-perturbation',
        label:
          'A small temperature perturbation is damped because heat removal increases faster than heat release.',
      },
      {
        id: 'growing-perturbation',
        label:
          'A small temperature perturbation grows because heat release increases faster than heat removal.',
      },
      {
        id: 'highest-efficiency',
        label: 'The branch with the highest combustion efficiency is always stable.',
      },
      {
        id: 'fuel-lhv',
        label: 'Stability depends only on the fuel’s lower heating value.',
      },
    ],
    correctOptionId: 'damped-perturbation',
    explanationPrompt:
      'Explain what happens to a small temperature perturbation on a stable branch.',
    explanationHint:
      'Compare the slopes of heat release and heat removal. Mention damping or a restoring tendency.',
    rubricId: 'c3-diagnostic-rubric',
    sourceRefs: TOPIC_SOURCES,
    answerSourceRefs: NO_ANSWER_SOURCES,
  },
];

export const BOSS_ROUNDS: BossRound[] = [
  {
    id: 'boss-round-1',
    phase: 1,
    conceptId: 'C2',
    challengeId: 'boss-intake-pressure-recovery',
    title: 'The Intake Pressure Recovery Trap',
    difficulty: 1,
    focus:
      'Ram efficiency (εd) versus adiabatic efficiency (ηd) under severe stagnation dissipation.',
    sourceRefs: TOPIC_SOURCES,
  },
  {
    id: 'boss-round-2',
    phase: 2,
    conceptId: 'C3',
    challengeId: 'boss-combustor-partitioning',
    title: 'Combustor Air Partitioning & Pollutant Trade-offs',
    difficulty: 2,
    focus:
      'CO burnout versus thermal NOx through primary-zone temperature, residence time and dilution air.',
    sourceRefs: TOPIC_SOURCES,
  },
  {
    id: 'boss-round-3',
    phase: 3,
    conceptId: 'C2',
    challengeId: 'boss-intake-offdesign-mismatch',
    title: 'The Supersonic Intake-Engine Off-Design Mismatch',
    difficulty: 3,
    focus:
      'Kantrowitz-Donaldson throat constraints, mass rejection and unstarting when throttle is reduced.',
    sourceRefs: TOPIC_SOURCES,
  },
];

export const ADAPTIVE_BANKS: AdaptiveChallengeBank = {
  C2: [
    {
      challengeId: C2_CONTENT_PACK.challenges.Q_A2?.id ?? 'c2-advanced-intake-matching',
      conceptId: 'C2',
      kind: 'advanced',
    },
    {
      challengeId: 'c2-counterexample-shock-position',
      conceptId: 'C2',
      kind: 'counterexample',
    },
    {
      challengeId: C2_CONTENT_PACK.challenges.Q_R1?.id ?? 'c2-remedial-mass-flow',
      conceptId: 'C2',
      kind: 'remedial',
    },
  ],
};

export const LEARNING_CHALLENGES: Record<string, LearningChallenge> = {
  ...C2_CONTENT_PACK.learning,
  'c1-stream-force': {
    challengeId: 'c1-stream-force',
    conceptId: 'C1',
    kind: 'concept-check',
    rubricId: 'c1-diagnostic-rubric',
    learningObjective:
      'Explain why the stream-force formulation avoids internal wall-pressure integration.',
    requiresExplanation: false,
    sourceRefs: TOPIC_SOURCES,
    answerSourceRefs: NO_ANSWER_SOURCES,
  },
  'c2-advanced-intake-matching': {
    challengeId: 'c2-advanced-intake-matching',
    conceptId: 'C2',
    kind: 'advanced',
    rubricId: 'c2-adaptive-rubric',
    learningObjective:
      'Preserve started, matched intake operation while engine demand changes.',
    requiresExplanation: false,
    sourceRefs: TOPIC_SOURCES,
    answerSourceRefs: NO_ANSWER_SOURCES,
  },
  'c2-counterexample-shock-position': {
    challengeId: 'c2-counterexample-shock-position',
    conceptId: 'C2',
    kind: 'counterexample',
    rubricId: 'c2-adaptive-rubric',
    learningObjective:
      'Refute the claim that an upstream terminal shock always improves pressure recovery.',
    requiresExplanation: false,
    sourceRefs: TOPIC_SOURCES,
    answerSourceRefs: NO_ANSWER_SOURCES,
  },
  'c2-remedial-mass-flow': {
    challengeId: 'c2-remedial-mass-flow',
    conceptId: 'C2',
    kind: 'remedial',
    rubricId: 'c2-adaptive-rubric',
    learningObjective:
      'Rebuild the meaning of the intake mass-flow ratio φd and the subcritical branch.',
    requiresExplanation: false,
    sourceRefs: TOPIC_SOURCES,
    answerSourceRefs: NO_ANSWER_SOURCES,
  },
  'c3-combustor-stability': {
    challengeId: 'c3-combustor-stability',
    conceptId: 'C3',
    kind: 'concept-check',
    rubricId: 'c3-diagnostic-rubric',
    learningObjective:
      'Identify a stable well-stirred-reactor branch and the CO/NOx partitioning trade-off.',
    requiresExplanation: false,
    sourceRefs: TOPIC_SOURCES,
    answerSourceRefs: NO_ANSWER_SOURCES,
  },
  'boss-intake-pressure-recovery': {
    challengeId: 'boss-intake-pressure-recovery',
    conceptId: 'C2',
    kind: 'boss',
    rubricId: 'boss-c2-rubric',
    learningObjective:
      'Distinguish total-pressure recovery from adiabatic efficiency under severe dissipation.',
    requiresExplanation: false,
    sourceRefs: TOPIC_SOURCES,
    answerSourceRefs: NO_ANSWER_SOURCES,
  },
  'boss-combustor-partitioning': {
    challengeId: 'boss-combustor-partitioning',
    conceptId: 'C3',
    kind: 'boss',
    rubricId: 'boss-c3-rubric',
    learningObjective:
      'Explain the CO/NOx trade-off of primary-zone temperature and dilution air.',
    requiresExplanation: false,
    sourceRefs: TOPIC_SOURCES,
    answerSourceRefs: NO_ANSWER_SOURCES,
  },
  'boss-intake-offdesign-mismatch': {
    challengeId: 'boss-intake-offdesign-mismatch',
    conceptId: 'C2',
    kind: 'boss',
    rubricId: 'boss-c2-rubric',
    learningObjective:
      'Order the off-design events that lead from throttle reduction to intake unstart.',
    requiresExplanation: false,
    sourceRefs: TOPIC_SOURCES,
    answerSourceRefs: NO_ANSWER_SOURCES,
  },
};

export function getLearningChallenge(
  challengeId: string,
): LearningChallenge | undefined {
  return LEARNING_CHALLENGES[challengeId];
}

export function getRubric(rubricId: string): EvaluationRubric | undefined {
  return MOTORI_RUBRICS[rubricId];
}

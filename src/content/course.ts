import type { DoorId } from '../domain/challenge';
import type { ConceptId } from '../domain/learning';
import { ADAPTIVE_BANKS, BOSS_ROUNDS, MOTORI_COURSE } from './motoriFramework';

export const COURSE = {
  name: MOTORI_COURSE.name,
  code: MOTORI_COURSE.code,
  institution: MOTORI_COURSE.institution,
  lede: MOTORI_COURSE.description,
} as const;

export interface DoorDefinition {
  id: DoorId;
  label: string;
  shortLabel: string;
  challengeId: string;
  conceptId: ConceptId;
  /** When true, the GameDirector may replace challengeId for this door. */
  adaptive: boolean;
  color: number;
  accent: string;
}

export const DOORS: readonly DoorDefinition[] = [
  {
    id: 'logic',
    label: 'Door of Stream Force',
    shortLabel: 'Streams',
    challengeId: 'c1-stream-force',
    conceptId: 'C1',
    adaptive: false,
    color: 0x38bdf8,
    accent: '#38bdf8',
  },
  {
    id: 'order',
    label: 'Door of the Intake',
    shortLabel: 'Intake',
    challengeId: ADAPTIVE_BANKS.C2?.find((ref) => ref.kind === 'remedial')?.challengeId ?? 'c2-remedial-mass-flow',
    conceptId: 'C2',
    adaptive: true,
    color: 0xfbbf24,
    accent: '#fbbf24',
  },
  {
    id: 'truth',
    label: 'Door of the Combustor',
    shortLabel: 'Combustor',
    challengeId: 'c3-combustor-stability',
    conceptId: 'C3',
    adaptive: false,
    color: 0xf472b6,
    accent: '#f472b6',
  },
];

export const DOOR_BY_ID: Record<DoorId, DoorDefinition> = {
  logic: DOORS[0],
  order: DOORS[1],
  truth: DOORS[2],
};

export const BOSS = {
  name: 'The Registrar',
  title: 'Keeper of the Final Exam',
  roundIds: BOSS_ROUNDS.map((round) => round.challengeId),
} as const;

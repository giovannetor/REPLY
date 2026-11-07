import Phaser from 'phaser';
import './style.css';
import './space.css';
import {
  describeProviderError,
  isAbortError as isChallengeAbortError,
  type ChallengeProvider,
} from './content/ChallengeProvider';
import { BOSS, COURSE, DOORS, DOOR_BY_ID, type DoorDefinition } from './content/course';
import {
  createChallengeProvider,
  type ProviderSetup,
} from './content/providerFactory';
import {
  ADAPTIVE_BANKS,
  BOSS_ROUNDS,
  DIAGNOSTIC_QUESTIONS,
  MOTORI_CONCEPTS,
  getLearningChallenge,
  getRubric,
} from './content/motoriFramework';
import { createBossState, resolveBossRound, type BossState } from './domain/boss';
import { DOOR_IDS, type DoorId } from './domain/challenge';
import {
  createDiagnosticState,
  currentDiagnosticQuestion,
  recordDiagnosticAnswer,
  type DiagnosticAnswer,
  type DiagnosticState,
} from './domain/diagnostic';
import {
  decideRoute,
  routeChallengeId,
  type AdaptiveRoute,
} from './domain/gameDirector';
import type {
  Concept,
  ConceptId,
  DiagnosticQuestion,
} from './domain/learning';
import type { ChallengeState } from './domain/challengeState';
import {
  applySkillEvidence,
  createSkillStates,
  type SkillEvidenceInput,
} from './domain/skillState';
import { GameSession } from './domain/gameSession';
import {
  createEvaluationProvider,
  type EvaluationSetup,
} from './evaluation/providerFactory';
import {
  EvaluationProviderError,
  evaluatorLabel,
  isAbortError as isEvaluationAbortError,
  type EvaluationProvider,
  type EvaluationRequest,
  type EvaluationResult,
} from './evaluation/types';
import { BossScene } from './game/BossScene';
import { DungeonScene } from './game/DungeonScene';
import { gameEvents } from './game/events';
import { AppUI, type ResultChallengeView } from './ui/AppUI';
import { ChallengePanel } from './ui/ChallengePanel';
import {
  DiagnosticPanel,
  type DiagnosticFeedbackView,
  type DiagnosticSummaryView,
} from './ui/DiagnosticPanel';

declare global {
  interface Window {
    __BOSSFIGHT_DEV__?: unknown;
  }
}

interface PendingDiagnostic {
  question: DiagnosticQuestion;
  selectedOptionId: string;
  explanation: string;
}

class BossFightApp {
  private readonly session = new GameSession();
  private readonly setup: ProviderSetup = createChallengeProvider();
  private readonly provider: ChallengeProvider = this.setup.provider;
  private readonly evaluationSetup: EvaluationSetup = createEvaluationProvider();
  private readonly evaluator: EvaluationProvider = this.evaluationSetup.provider;
  private readonly ui: AppUI;
  private readonly challengePanel: ChallengePanel;
  private readonly diagnosticPanel: DiagnosticPanel;

  private game: Phaser.Game | null = null;
  private activeDoorId: DoorId | null = null;
  private activeChallengeId: string | null = null;
  private abortController: AbortController | null = null;
  private requestToken = 0;
  private evaluationAbort: AbortController | null = null;
  private evaluationToken = 0;
  private bossState: BossState | null = null;
  private bossRoundIndex = 0;
  private bossStarted = false;
  private bossReadyUnsub: (() => void) | null = null;
  private runStarted = false;

  private skillStates = createSkillStates(MOTORI_CONCEPTS);
  private diagnosticState: DiagnosticState = createDiagnosticState(DIAGNOSTIC_QUESTIONS);
  private c2Route: AdaptiveRoute | null = null;
  private pendingDiagnostic: PendingDiagnostic | null = null;
  private readonly bossResolvedRounds = new Set<string>();

  constructor() {
    this.ui = new AppUI({
      onStart: () => this.startDiagnostic(),
      onRestart: () => this.restartRun(),
    });
    this.challengePanel = new ChallengePanel({
      onRetryLoad: () => this.retryActiveChallenge(),
      onCancel: () => this.closeChallenge(),
      onAttemptEvaluated: (correct, state) => this.handleAttemptEvaluated(correct, state),
      onContinue: () => this.handleChallengeContinue(),
    });
    this.diagnosticPanel = new DiagnosticPanel({
      onSubmit: (selectedOptionId, explanation) =>
        this.submitDiagnosticAnswer(selectedOptionId, explanation),
      onClarification: (explanation) => this.submitDiagnosticClarification(explanation),
      onContinue: () => this.continueDiagnostic(),
      onBeginDungeon: () => this.startRun(),
    });

    const notes = [this.setup.note, this.evaluationSetup.note].filter(
      (note): note is string => Boolean(note),
    );
    this.ui.setCourse(
      COURSE,
      `${this.setup.provider.name} · ${this.evaluationSetup.provider.name}`,
      notes.join(' '),
    );
    this.ui.setSkills(this.skillStates, MOTORI_CONCEPTS);
    this.ui.showStart();
    this.bindGameEvents();
  }

  private bindGameEvents(): void {
    gameEvents.on('door:interact', ({ doorId }) => this.openDoorChallenge(doorId));
    gameEvents.on('boss:enter', () => this.startBossEncounter());
  }

  // -------------------------------------------------------------------------
  // Diagnostic
  // -------------------------------------------------------------------------

  private startDiagnostic(): void {
    if (this.diagnosticPanel.isOpen()) {
      return;
    }

    this.cancelEvaluation();
    this.cancelActiveRequest();
    this.session.reset();
    this.runStarted = false;
    this.diagnosticState = createDiagnosticState(DIAGNOSTIC_QUESTIONS);
    this.skillStates = createSkillStates(MOTORI_CONCEPTS);
    this.c2Route = null;
    this.pendingDiagnostic = null;

    this.ui.setSkills(this.skillStates, MOTORI_CONCEPTS);
    this.ui.beginDiagnostic();
    this.showCurrentDiagnosticQuestion();
  }

  private showCurrentDiagnosticQuestion(): void {
    const question = currentDiagnosticQuestion(this.diagnosticState, DIAGNOSTIC_QUESTIONS);
    if (!question) {
      this.showDiagnosticSummary();
      return;
    }
    this.diagnosticPanel.open(
      question,
      this.diagnosticState.index,
      DIAGNOSTIC_QUESTIONS.length,
      this.conceptFor(question.conceptId),
      this.skillStates[question.conceptId],
    );
  }

  private submitDiagnosticAnswer(
    selectedOptionId: string,
    explanation: string,
  ): void {
    const question = currentDiagnosticQuestion(this.diagnosticState, DIAGNOSTIC_QUESTIONS);
    if (!question) {
      return;
    }
    this.pendingDiagnostic = { question, selectedOptionId, explanation };
    void this.runDiagnosticEvaluation(question, selectedOptionId, explanation, false);
  }

  private submitDiagnosticClarification(explanation: string): void {
    const pending = this.pendingDiagnostic;
    if (!pending) {
      return;
    }
    const combined = `${pending.explanation}\n\nClarification: ${explanation}`;
    void this.runDiagnosticEvaluation(
      pending.question,
      pending.selectedOptionId,
      combined,
      true,
    );
  }

  private async runDiagnosticEvaluation(
    question: DiagnosticQuestion,
    selectedOptionId: string,
    explanation: string,
    clarificationTried: boolean,
  ): Promise<void> {
    const rubric = getRubric(question.rubricId);
    if (!rubric) {
      this.diagnosticPanel.showError(`Missing rubric ${question.rubricId}.`);
      return;
    }

    const request: EvaluationRequest = {
      questionId: question.id,
      conceptId: question.conceptId,
      prompt: question.prompt,
      options: question.options,
      correctOptionId: question.correctOptionId,
      selectedOptionId,
      explanation,
      rubric,
    };

    this.abortEvaluation();
    const controller = new AbortController();
    this.evaluationAbort = controller;
    const token = ++this.evaluationToken;

    try {
      const evaluation = await this.evaluator.evaluate(request, {
        signal: controller.signal,
      });
      if (token !== this.evaluationToken) {
        return;
      }
      this.evaluationAbort = null;
      this.handleDiagnosticEvaluation(
        question,
        selectedOptionId,
        explanation,
        evaluation,
        clarificationTried,
        rubric,
      );
    } catch (error) {
      if (token !== this.evaluationToken || isEvaluationAbortError(error)) {
        return;
      }
      this.evaluationAbort = null;
      this.diagnosticPanel.showError(this.describeEvaluationError(error));
    }
  }

  private handleDiagnosticEvaluation(
    question: DiagnosticQuestion,
    selectedOptionId: string,
    explanation: string,
    evaluation: EvaluationResult,
    clarificationTried: boolean,
    rubric: NonNullable<ReturnType<typeof getRubric>>,
  ): void {
    const uncertain =
      evaluation.verdict === 'uncertain' || evaluation.confidence < 0.55;

    if (uncertain && !clarificationTried && selectedOptionId === question.correctOptionId) {
      this.pendingDiagnostic = { question, selectedOptionId, explanation };
      this.diagnosticPanel.showClarification(
        evaluation.clarificationQuestion ?? question.explanationPrompt,
        evaluatorLabel(evaluation.evaluator),
      );
      return;
    }

    const correct = selectedOptionId === question.correctOptionId;
    const answer: DiagnosticAnswer = {
      questionId: question.id,
      conceptId: question.conceptId,
      selectedOptionId,
      explanation,
      correct,
      evaluation,
    };

    this.diagnosticState = recordDiagnosticAnswer(
      this.diagnosticState,
      DIAGNOSTIC_QUESTIONS,
      answer,
    );
    this.pendingDiagnostic = null;

    const concept = this.conceptFor(question.conceptId);
    const skill = applySkillEvidence(this.skillStates[question.conceptId], {
      source: 'diagnostic',
      label: `${question.conceptId} · ${concept.shortTitle}`,
      answerCorrect: correct,
      reasoning: evaluation.reasoning,
      confidence: evaluation.confidence,
      attempts: 1,
    });
    this.skillStates = {
      ...this.skillStates,
      [question.conceptId]: skill,
    };
    this.ui.setSkills(this.skillStates, MOTORI_CONCEPTS);

    let route: AdaptiveRoute | null = null;
    if (question.conceptId === 'C2') {
      route = decideRoute({
        conceptId: 'C2',
        answerCorrect: correct,
        evaluation: {
          verdict: evaluation.verdict,
          reasoning: evaluation.reasoning,
          confidence: evaluation.confidence,
          clarificationQuestion: evaluation.clarificationQuestion,
        },
        bank: ADAPTIVE_BANKS,
        allowClarification: false,
      });
      this.c2Route = route;
    }

    const view: DiagnosticFeedbackView = {
      question,
      rubric,
      correct,
      evaluation,
      concept,
      skill,
      route,
      isLast: this.diagnosticState.complete,
      clarificationTried,
    };
    this.diagnosticPanel.showFeedback(view);
  }

  private continueDiagnostic(): void {
    if (this.diagnosticState.complete) {
      this.showDiagnosticSummary();
      return;
    }
    this.showCurrentDiagnosticQuestion();
  }

  private showDiagnosticSummary(): void {
    const answers: DiagnosticSummaryView['answers'] = [];
    for (const answer of this.diagnosticState.answers) {
      const question = DIAGNOSTIC_QUESTIONS.find(
        (entry) => entry.id === answer.questionId,
      );
      if (!question) {
        continue;
      }
      answers.push({
        question,
        answer,
        concept: this.conceptFor(answer.conceptId),
        skill: this.skillStates[answer.conceptId],
      });
    }

    this.diagnosticPanel.showSummary({
      answers,
      skills: this.skillStates,
      concepts: MOTORI_CONCEPTS,
      route: this.c2Route,
    });
  }

  // -------------------------------------------------------------------------
  // Dungeon and doors
  // -------------------------------------------------------------------------

  private startRun(): void {
    if (this.runStarted) {
      return;
    }
    this.runStarted = true;
    this.session.reset();
    this.diagnosticPanel.close();
    this.ui.beginRun();
    this.ui.setProgress([], DOORS.length);
    this.ui.setSkills(this.skillStates, MOTORI_CONCEPTS);
    this.createGame();
    this.ui.showToast('Clear all three doors, then face the Registrar.', 3_600);
  }

  private createGame(): void {
    if (this.game) {
      return;
    }
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: 'game-root',
      width: 960,
      height: 600,
      backgroundColor: '#05070f',
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [DungeonScene, BossScene],
    };
    this.game = new Phaser.Game(config);
  }

  private openDoorChallenge(doorId: DoorId): void {
    if (this.session.isDoorComplete(doorId)) {
      return;
    }
    const door = DOOR_BY_ID[doorId];
    const challengeId = this.resolveDoorChallengeId(door);
    this.activeDoorId = doorId;
    this.activeChallengeId = challengeId;
    this.loadDoorChallenge(door, challengeId);
  }

  private resolveDoorChallengeId(door: DoorDefinition): string {
    if (!door.adaptive) {
      return door.challengeId;
    }
    const routed = this.c2Route ? routeChallengeId(this.c2Route) : null;
    return routed ?? door.challengeId;
  }

  private loadDoorChallenge(door: DoorDefinition, challengeId: string): void {
    this.abortActiveRequest();
    const controller = new AbortController();
    this.abortController = controller;
    const token = ++this.requestToken;
    this.activeChallengeId = challengeId;

    gameEvents.emit('gameplay:pause', { paused: true });
    this.challengePanel.openLoading(
      door.label,
      `${door.conceptId} · ${this.conceptFor(door.conceptId).shortTitle}`,
      'door',
    );

    this.provider
      .getChallenge(challengeId, { signal: controller.signal })
      .then((challenge) => {
        if (token !== this.requestToken) {
          return;
        }
        const learning = getLearningChallenge(challengeId);
        this.challengePanel.showChallenge(
          challenge,
          learning,
          this.conceptFor(learning?.conceptId ?? door.conceptId),
        );
      })
      .catch((error: unknown) => {
        if (token !== this.requestToken || isChallengeAbortError(error)) {
          return;
        }
        this.challengePanel.showError(describeProviderError(error));
      });
  }

  private retryActiveChallenge(): void {
    if (this.challengePanel.currentMode === 'boss') {
      this.loadBossRound(this.bossRoundIndex);
      return;
    }
    if (this.activeDoorId) {
      const door = DOOR_BY_ID[this.activeDoorId];
      this.loadDoorChallenge(
        door,
        this.activeChallengeId ?? this.resolveDoorChallengeId(door),
      );
    }
  }

  private closeChallenge(): void {
    if (this.challengePanel.currentMode === 'boss') {
      return;
    }
    this.cancelActiveRequest();
    this.challengePanel.close();
    this.activeDoorId = null;
    this.activeChallengeId = null;
    gameEvents.emit('gameplay:pause', { paused: false });
  }

  private handleChallengeContinue(): void {
    if (this.challengePanel.currentMode === 'boss') {
      this.continueBoss();
      return;
    }

    const doorId = this.activeDoorId;
    const state = this.challengePanel.attemptState;
    const challenge = state.challenge;
    if (!doorId || !challenge || state.result !== 'correct') {
      return;
    }

    this.session.completeDoor({
      doorId,
      challengeTitle: challenge.title,
      attempts: state.attempts,
      xp: challenge.xp,
    });

    const learning = getLearningChallenge(challenge.id);
    const conceptId = learning?.conceptId ?? DOOR_BY_ID[doorId].conceptId;
    const isAdaptive =
      learning?.kind === 'advanced' ||
      learning?.kind === 'counterexample' ||
      learning?.kind === 'remedial';
    this.applyEvidence(conceptId, {
      source: isAdaptive ? 'adaptive' : 'concept-check',
      label: challenge.title,
      answerCorrect: true,
      reasoning: 'not-assessed',
      confidence: 0.72,
      attempts: state.attempts,
    });

    this.cancelActiveRequest();
    this.challengePanel.close();
    this.activeDoorId = null;
    this.activeChallengeId = null;
    gameEvents.emit('gameplay:pause', { paused: false });
    gameEvents.emit('door:solved', { doorId });

    const completedIds = DOOR_IDS.filter((id) => this.session.isDoorComplete(id));
    this.ui.setProgress(completedIds, DOORS.length);

    if (this.session.allDoorsComplete) {
      this.ui.showToast('All three doors are cleared. The boss gate is open.', 4_200);
    } else {
      this.ui.showToast(`${DOOR_BY_ID[doorId].label} cleared.`);
    }
  }

  // -------------------------------------------------------------------------
  // Boss
  // -------------------------------------------------------------------------

  private handleAttemptEvaluated(
    correct: boolean,
    state: ChallengeState,
  ): void {
    if (this.challengePanel.currentMode !== 'boss' || !this.bossState) {
      return;
    }
    const round = BOSS_ROUNDS[this.bossRoundIndex];
    if (!round || this.bossResolvedRounds.has(round.id)) {
      return;
    }
    this.bossResolvedRounds.add(round.id);

    this.bossState = resolveBossRound(this.bossState, correct);
    this.applyEvidence(round.conceptId, {
      source: 'boss',
      label: round.title,
      answerCorrect: correct,
      reasoning: 'not-assessed',
      confidence: 0.75,
      attempts: state.attempts,
    });
    this.ui.updateBossHud(this.bossState);
    gameEvents.emit('boss:round-resolved', {
      correct,
      state: this.bossState,
    });
  }

  private startBossEncounter(): void {
    if (this.bossStarted || !this.game || !this.session.allDoorsComplete) {
      return;
    }
    this.bossStarted = true;
    this.bossState = createBossState();
    this.bossRoundIndex = 0;
    this.bossResolvedRounds.clear();
    this.cancelActiveRequest();
    this.ui.hideToast();

    this.bossReadyUnsub?.();
    this.bossReadyUnsub = gameEvents.on('boss:ready', () => {
      this.bossReadyUnsub?.();
      this.bossReadyUnsub = null;
      if (!this.bossState) {
        return;
      }
      this.ui.showBossHud(this.bossState);
      this.loadBossRound(0);
    });

    this.game.scene.stop('DungeonScene');
    this.game.scene.start('BossScene');
  }

  private loadBossRound(index: number): void {
    const round = BOSS_ROUNDS[index];
    if (!round || !this.bossState) {
      return;
    }

    this.abortActiveRequest();
    const controller = new AbortController();
    this.abortController = controller;
    const token = ++this.requestToken;
    this.bossRoundIndex = index;

    this.challengePanel.openLoading(
      `${BOSS.name} · Phase ${round.phase} of ${BOSS_ROUNDS.length}`,
      round.title,
      'boss',
    );

    this.provider
      .getChallenge(round.challengeId, { signal: controller.signal })
      .then((challenge) => {
        if (token !== this.requestToken) {
          return;
        }
        const learning = getLearningChallenge(round.challengeId);
        this.challengePanel.showChallenge(
          challenge,
          learning,
          this.conceptFor(round.conceptId),
        );
      })
      .catch((error: unknown) => {
        if (token !== this.requestToken || isChallengeAbortError(error)) {
          return;
        }
        this.challengePanel.showError(describeProviderError(error));
      });
  }

  private continueBoss(): void {
    if (!this.bossState) {
      return;
    }
    this.challengePanel.close();
    this.cancelActiveRequest();

    if (this.bossState.finished) {
      this.finishRun();
      return;
    }

    this.bossRoundIndex += 1;
    this.loadBossRound(this.bossRoundIndex);
  }

  private finishRun(): void {
    if (!this.bossState) {
      return;
    }

    this.session.setBossState(this.bossState);
    this.ui.hideBossHud();
    this.challengePanel.close();
    this.cancelActiveRequest();

    const challenges: ResultChallengeView[] = DOORS.map((door) => {
      const completion = this.session.completions.find(
        (entry) => entry.doorId === door.id,
      );
      return {
        label: door.label,
        title: completion?.challengeTitle ?? 'Not cleared',
        completed: completion !== undefined,
        attempts: completion?.attempts ?? 0,
        xp: completion?.xp ?? 0,
      };
    });

    this.ui.showResult({
      victory: this.bossState.victory,
      bossState: this.bossState,
      challenges,
      skills: this.skillStates,
      concepts: MOTORI_CONCEPTS,
    });
  }

  // -------------------------------------------------------------------------
  // Shared helpers
  // -------------------------------------------------------------------------

  private applyEvidence(conceptId: ConceptId, input: SkillEvidenceInput): void {
    this.skillStates = {
      ...this.skillStates,
      [conceptId]: applySkillEvidence(this.skillStates[conceptId], input),
    };
    this.ui.setSkills(this.skillStates, MOTORI_CONCEPTS);
  }

  private conceptFor(conceptId: ConceptId): Concept {
    const concept = MOTORI_CONCEPTS.find((entry) => entry.id === conceptId);
    if (!concept) {
      throw new Error(`Unknown concept ${conceptId}.`);
    }
    return concept;
  }

  private describeEvaluationError(error: unknown): string {
    if (error instanceof EvaluationProviderError) {
      return error.message;
    }
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return 'The evaluator could not score this answer. Try again.';
  }

  private restartRun(): void {
    this.cancelActiveRequest();
    this.cancelEvaluation();
    this.challengePanel.close();
    this.diagnosticPanel.close();
    this.bossReadyUnsub?.();
    this.bossReadyUnsub = null;
    this.ui.hideBossHud();
    this.ui.hideToast();

    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }

    this.session.reset();
    this.activeDoorId = null;
    this.activeChallengeId = null;
    this.bossState = null;
    this.bossRoundIndex = 0;
    this.bossStarted = false;
    this.bossResolvedRounds.clear();
    this.runStarted = false;
    this.diagnosticState = createDiagnosticState(DIAGNOSTIC_QUESTIONS);
    this.skillStates = createSkillStates(MOTORI_CONCEPTS);
    this.c2Route = null;
    this.pendingDiagnostic = null;
    this.ui.setSkills(this.skillStates, MOTORI_CONCEPTS);
    this.ui.setProgress([], DOORS.length);
    this.ui.showStart();
  }

  private abortActiveRequest(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private cancelActiveRequest(): void {
    this.requestToken += 1;
    this.abortActiveRequest();
  }

  private abortEvaluation(): void {
    this.evaluationAbort?.abort();
    this.evaluationAbort = null;
  }

  private cancelEvaluation(): void {
    this.evaluationToken += 1;
    this.abortEvaluation();
  }
}

const app = new BossFightApp();
if (import.meta.env.DEV) {
  window.__BOSSFIGHT_DEV__ = app;
}

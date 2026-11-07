import type { Challenge, SequenceChallenge } from '../domain/challenge';
import type { Concept, LearningChallenge } from '../domain/learning';
import {
  completeChallenge,
  correctAnswerText,
  initialChallengeState,
  isAnswerReady,
  loadFailed,
  loadSucceeded,
  resetSequence,
  retryAnswer,
  selectOption,
  startLoading,
  submitAnswer,
  toggleSequenceItem,
  type ChallengeState,
} from '../domain/challengeState';
import { renderLearningContext as renderLearningContextView, renderSourceBlock } from './learningRender';
import { mustGet } from './dom';

export type ChallengeMode = 'door' | 'boss';

export interface ChallengePanelCallbacks {
  onRetryLoad: () => void;
  onCancel: () => void;
  onAttemptEvaluated: (correct: boolean, state: ChallengeState) => void;
  onContinue: () => void;
}

export class ChallengePanel {
  private readonly screen = mustGet<HTMLElement>('challenge-screen');
  private readonly panel = mustGet<HTMLElement>('challenge-panel');
  private readonly eyebrow = mustGet<HTMLElement>('challenge-eyebrow');
  private readonly title = mustGet<HTMLElement>('challenge-title');
  private readonly closeButton = mustGet<HTMLButtonElement>('challenge-close');

  private readonly loadingBlock = mustGet<HTMLElement>('challenge-loading');
  private readonly cancelLoadingButton =
    mustGet<HTMLButtonElement>('challenge-cancel-loading');

  private readonly errorBlock = mustGet<HTMLElement>('challenge-error');
  private readonly errorMessage = mustGet<HTMLElement>('challenge-error-message');
  private readonly retryButton = mustGet<HTMLButtonElement>('challenge-retry');
  private readonly backErrorButton = mustGet<HTMLButtonElement>('challenge-back-error');

  private readonly questionBlock = mustGet<HTMLElement>('challenge-question');
  private readonly learningBlock = mustGet<HTMLElement>('challenge-learning');
  private readonly prompt = mustGet<HTMLElement>('challenge-prompt');
  private readonly hint = mustGet<HTMLElement>('challenge-hint');
  private readonly options = mustGet<HTMLElement>('challenge-options');
  private readonly sequence = mustGet<HTMLElement>('challenge-sequence');
  private readonly sequenceSelected = mustGet<HTMLElement>('sequence-selected');
  private readonly sequencePool = mustGet<HTMLElement>('sequence-pool');
  private readonly sequenceReset = mustGet<HTMLButtonElement>('sequence-reset');
  private readonly attempts = mustGet<HTMLElement>('challenge-attempts');
  private readonly submitButton = mustGet<HTMLButtonElement>('challenge-submit');

  private readonly feedbackBlock = mustGet<HTMLElement>('challenge-feedback');
  private readonly verdict = mustGet<HTMLElement>('feedback-verdict');
  private readonly explanation = mustGet<HTMLElement>('feedback-explanation');
  private readonly correctAnswer = mustGet<HTMLElement>('feedback-correct');
  private readonly feedbackSource = mustGet<HTMLElement>('feedback-source');
  private readonly feedbackActions = mustGet<HTMLElement>('feedback-actions');

  private mode: ChallengeMode = 'door';
  private state: ChallengeState = initialChallengeState();
  private learning: LearningChallenge | null = null;
  private concept: Concept | null = null;

  constructor(private readonly callbacks: ChallengePanelCallbacks) {
    this.closeButton.addEventListener('click', () => this.callbacks.onCancel());
    this.cancelLoadingButton.addEventListener('click', () => this.callbacks.onCancel());
    this.backErrorButton.addEventListener('click', () => this.callbacks.onCancel());
    this.retryButton.addEventListener('click', () => this.callbacks.onRetryLoad());
    this.submitButton.addEventListener('click', () => this.submit());
    this.sequenceReset.addEventListener('click', () => this.handleSequenceReset());

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen() && this.mode === 'door') {
        event.preventDefault();
        this.callbacks.onCancel();
      }
    });
  }

  get currentMode(): ChallengeMode {
    return this.mode;
  }

  get attemptState(): ChallengeState {
    return this.state;
  }

  isOpen(): boolean {
    return !this.screen.classList.contains('is-hidden');
  }

  openLoading(eyebrow: string, title: string, mode: ChallengeMode): void {
    this.mode = mode;
    this.state = startLoading(initialChallengeState());
    this.learning = null;
    this.concept = null;
    this.renderLearningContext();
    this.feedbackSource.replaceChildren();
    this.eyebrow.textContent = eyebrow;
    this.title.textContent = title;
    this.errorMessage.textContent = '';
    this.panel.dataset.mode = mode;
    this.syncChrome();
    this.screen.classList.remove('is-hidden');
    this.panel.scrollTop = 0;
    this.render();
    this.focusFirst();
  }

  showChallenge(
    challenge: Challenge,
    learning?: LearningChallenge,
    concept?: Concept,
  ): void {
    this.state = loadSucceeded(this.state, challenge);
    this.learning = learning ?? null;
    this.concept = concept ?? null;
    this.renderLearningContext();
    this.title.textContent = challenge.title;
    if (challenge.hint) {
      this.hint.textContent = `Hint: ${challenge.hint}`;
      this.hint.classList.remove('is-hidden');
    } else {
      this.hint.textContent = '';
      this.hint.classList.add('is-hidden');
    }
    this.render();
    this.focusFirst();
  }

  showError(message: string): void {
    this.state = loadFailed(this.state, message);
    this.errorMessage.textContent = message;
    this.render();
    this.focusFirst();
  }

  close(): void {
    this.screen.classList.add('is-hidden');
    this.state = initialChallengeState();
    this.learning = null;
    this.concept = null;
    this.renderLearningContext();
    this.options.replaceChildren();
    this.sequenceSelected.replaceChildren();
    this.sequencePool.replaceChildren();
    this.feedbackSource.replaceChildren();
    this.feedbackActions.replaceChildren();
  }

  private syncChrome(): void {
    const isBoss = this.mode === 'boss';
    this.closeButton.classList.toggle('is-hidden', isBoss);
    this.cancelLoadingButton.classList.toggle('is-hidden', isBoss);
    this.backErrorButton.classList.toggle('is-hidden', isBoss);
  }

  private renderLearningContext(): void {
    if (!this.learning || !this.concept) {
      this.learningBlock.replaceChildren();
      this.learningBlock.classList.add('is-hidden');
      return;
    }
    this.learningBlock.classList.remove('is-hidden');
    renderLearningContextView(this.learningBlock, this.learning, this.concept);
  }

  private render(): void {
    this.loadingBlock.classList.toggle('is-hidden', this.state.phase !== 'loading');
    this.errorBlock.classList.toggle('is-hidden', this.state.phase !== 'error');
    this.questionBlock.classList.toggle('is-hidden', this.state.phase !== 'ready');
    this.feedbackBlock.classList.toggle('is-hidden', this.state.phase !== 'feedback');

    if (this.state.phase === 'error') {
      this.errorMessage.textContent = this.state.error ?? 'Unknown archive error.';
    }
    if (this.state.phase === 'ready') {
      this.renderQuestion();
    }
    if (this.state.phase === 'feedback') {
      this.renderFeedback();
    }
  }

  private renderQuestion(): void {
    const challenge = this.state.challenge;
    if (!challenge) {
      return;
    }

    this.prompt.textContent = challenge.prompt;
    this.renderLearningContext();
    this.options.replaceChildren();
    this.sequenceSelected.replaceChildren();
    this.sequencePool.replaceChildren();

    const attemptLabel =
      this.state.attempts === 0 ? 'First attempt' : `Attempt ${this.state.attempts + 1}`;
    this.attempts.textContent = `${attemptLabel} · worth ${challenge.xp} XP`;

    const isSequence = challenge.type === 'sequence';
    this.sequence.classList.toggle('is-hidden', !isSequence);
    this.options.classList.toggle('is-hidden', isSequence);

    if (isSequence) {
      this.renderSequence(challenge);
    } else {
      this.renderOptions(challenge);
    }
    this.updateSubmitState();
  }

  private renderOptions(challenge: Challenge): void {
    if (challenge.type === 'sequence') {
      return;
    }
    const options =
      challenge.type === 'multiple-choice'
        ? challenge.options
        : [
            { id: 'true', label: 'True' },
            { id: 'false', label: 'False' },
          ];

    options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'option';
      button.dataset.optionId = option.id;
      const selected = this.state.selectedOptionId === option.id;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));

      const key = document.createElement('span');
      key.className = 'option-key';
      key.textContent =
        challenge.type === 'true-false'
          ? option.id === 'true'
            ? 'T'
            : 'F'
          : String.fromCharCode(65 + index);
      const label = document.createElement('span');
      label.className = 'option-label';
      label.textContent = option.label;
      button.append(key, label);

      button.addEventListener('click', () => {
        this.state = selectOption(this.state, option.id);
        for (const candidate of this.options.querySelectorAll<HTMLButtonElement>('.option')) {
          const isSelected = candidate.dataset.optionId === this.state.selectedOptionId;
          candidate.classList.toggle('is-selected', isSelected);
          candidate.setAttribute('aria-pressed', String(isSelected));
        }
        this.updateSubmitState();
      });

      this.options.append(button);
    });
  }

  private renderSequence(challenge: SequenceChallenge): void {
    this.sequenceSelected.replaceChildren();
    this.sequencePool.replaceChildren();

    this.state.sequenceSelection.forEach((itemId, index) => {
      const item = challenge.items.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }
      const row = document.createElement('li');
      const number = document.createElement('span');
      number.className = 'seq-num';
      number.textContent = String(index + 1);
      const label = document.createElement('span');
      label.textContent = item.label;
      row.append(number, label);
      this.sequenceSelected.append(row);
    });

    for (const item of challenge.items) {
      if (this.state.sequenceSelection.includes(item.id)) {
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'seq-item';
      button.textContent = item.label;
      button.addEventListener('click', () => {
        this.state = toggleSequenceItem(this.state, item.id);
        this.renderQuestion();
        this.sequenceReset.focus();
      });
      this.sequencePool.append(button);
    }

    this.sequenceReset.disabled = this.state.sequenceSelection.length === 0;
  }

  private handleSequenceReset(): void {
    this.state = resetSequence(this.state);
    this.renderQuestion();
    this.sequencePool.querySelector<HTMLButtonElement>('button')?.focus();
  }

  private updateSubmitState(): void {
    this.submitButton.disabled = !isAnswerReady(this.state);
  }

  private submit(): void {
    const next = submitAnswer(this.state);
    if (next === this.state) {
      return;
    }
    this.state = next;
    this.render();
    this.callbacks.onAttemptEvaluated(this.state.result === 'correct', this.state);
  }

  private renderFeedback(): void {
    const challenge = this.state.challenge;
    if (!challenge) {
      return;
    }

    const correct = this.state.result === 'correct';
    this.verdict.textContent = correct ? 'Correct.' : 'Not quite.';
    this.verdict.classList.toggle('is-correct', correct);
    this.verdict.classList.toggle('is-incorrect', !correct);
    this.explanation.textContent = challenge.explanation;
    this.correctAnswer.textContent = `Correct answer:\n${correctAnswerText(this.state)}`;
    renderSourceBlock(
      this.feedbackSource,
      this.learning?.sourceRefs ?? [],
      this.learning?.answerSourceRefs ?? [],
    );
    this.feedbackActions.replaceChildren();

    if (this.mode === 'boss') {
      this.feedbackActions.append(
        this.makeButton('Continue', 'btn btn-primary', () => this.callbacks.onContinue()),
      );
    } else if (correct) {
      this.feedbackActions.append(
        this.makeButton('Claim reward & return', 'btn btn-primary', () => {
          this.state = completeChallenge(this.state);
          this.callbacks.onContinue();
        }),
      );
    } else {
      this.feedbackActions.append(
        this.makeButton('Try again', 'btn btn-primary', () => {
          this.state = retryAnswer(this.state);
          this.render();
          this.focusFirst();
        }),
        this.makeButton('Leave door', 'btn btn-ghost', () => this.callbacks.onCancel()),
      );
    }

    this.focusFirst();
  }

  private makeButton(
    label: string,
    className: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private focusFirst(): void {
    requestAnimationFrame(() => {
      const target = this.screen.querySelector<HTMLElement>(
        '.state-block:not(.is-hidden) button:not(:disabled)',
      );
      target?.focus();
    });
  }
}

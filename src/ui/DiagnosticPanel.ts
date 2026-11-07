import type {
  Concept,
  ConceptId,
  DiagnosticQuestion,
  EvaluationRubric,
  StudentSkillState,
} from '../domain/learning';
import type { DiagnosticAnswer } from '../domain/diagnostic';
import type { AdaptiveRoute } from '../domain/gameDirector';
import type { EvaluationResult } from '../evaluation/types';
import { evaluatorLabel } from '../evaluation/types';
import { formatMastery } from '../domain/skillState';
import {
  renderCriteriaList,
  renderRouteNote,
  renderSkillList,
  renderSkillReadout,
  renderSourceBlock,
} from './learningRender';
import { mustGet } from './dom';

export interface DiagnosticFeedbackView {
  question: DiagnosticQuestion;
  rubric: EvaluationRubric;
  correct: boolean;
  evaluation: EvaluationResult;
  concept: Concept;
  skill: StudentSkillState;
  route: AdaptiveRoute | null;
  isLast: boolean;
  clarificationTried: boolean;
}

export interface DiagnosticSummaryView {
  answers: Array<{
    question: DiagnosticQuestion;
    answer: DiagnosticAnswer;
    concept: Concept;
    skill: StudentSkillState;
  }>;
  skills: Record<ConceptId, StudentSkillState>;
  concepts: readonly Concept[];
  route: AdaptiveRoute | null;
}

export interface DiagnosticPanelCallbacks {
  onSubmit: (selectedOptionId: string, explanation: string) => void;
  onClarification: (explanation: string) => void;
  onContinue: () => void;
  onBeginDungeon: () => void;
}

type DiagnosticPhase =
  | 'answering'
  | 'evaluating'
  | 'feedback'
  | 'clarification'
  | 'summary';

export class DiagnosticPanel {
  private readonly screen = mustGet<HTMLElement>('diagnostic-screen');
  private readonly panel = mustGet<HTMLElement>('diagnostic-panel');
  private readonly progress = mustGet<HTMLElement>('diagnostic-progress');
  private readonly conceptTitle = mustGet<HTMLElement>('diagnostic-concept');
  private readonly badge = mustGet<HTMLElement>('diagnostic-badge');

  private readonly questionBlock = mustGet<HTMLElement>('diagnostic-question-block');
  private readonly prompt = mustGet<HTMLElement>('diagnostic-prompt');
  private readonly options = mustGet<HTMLElement>('diagnostic-options');
  private readonly explanation = mustGet<HTMLTextAreaElement>('diagnostic-explanation');
  private readonly hint = mustGet<HTMLElement>('diagnostic-explanation-hint');
  private readonly status = mustGet<HTMLElement>('diagnostic-status');
  private readonly submitButton = mustGet<HTMLButtonElement>('diagnostic-submit');

  private readonly clarificationBlock = mustGet<HTMLElement>('diagnostic-clarification');
  private readonly clarificationPrompt = mustGet<HTMLElement>(
    'diagnostic-clarification-prompt',
  );
  private readonly clarificationInput = mustGet<HTMLTextAreaElement>(
    'diagnostic-clarification-input',
  );
  private readonly clarificationStatus = mustGet<HTMLElement>(
    'diagnostic-clarification-status',
  );
  private readonly clarificationSubmit = mustGet<HTMLButtonElement>(
    'diagnostic-clarification-submit',
  );

  private readonly feedbackBlock = mustGet<HTMLElement>('diagnostic-feedback');
  private readonly verdict = mustGet<HTMLElement>('diagnostic-verdict');
  private readonly evaluatorLine = mustGet<HTMLElement>('diagnostic-evaluator');
  private readonly feedbackText = mustGet<HTMLElement>('diagnostic-feedback-text');
  private readonly criteria = mustGet<HTMLElement>('diagnostic-criteria');
  private readonly source = mustGet<HTMLElement>('diagnostic-source');
  private readonly skillReadout = mustGet<HTMLElement>('diagnostic-skill');
  private readonly routeNote = mustGet<HTMLElement>('diagnostic-route');
  private readonly actions = mustGet<HTMLElement>('diagnostic-actions');

  private readonly summaryBlock = mustGet<HTMLElement>('diagnostic-summary');
  private readonly summaryList = mustGet<HTMLElement>('diagnostic-summary-list');
  private readonly summaryRoute = mustGet<HTMLElement>('diagnostic-summary-route');
  private readonly summarySkills = mustGet<HTMLElement>('diagnostic-summary-skills');
  private readonly beginButton = mustGet<HTMLButtonElement>('diagnostic-begin');

  private question: DiagnosticQuestion | null = null;
  private selectedOptionId: string | null = null;
  private phase: DiagnosticPhase = 'answering';
  private clarificationMode = false;

  constructor(private readonly callbacks: DiagnosticPanelCallbacks) {
    this.submitButton.addEventListener('click', () => this.submitAnswer());
    this.clarificationSubmit.addEventListener('click', () => this.submitClarification());
    this.explanation.addEventListener('input', () => this.updateSubmitState());
    this.clarificationInput.addEventListener('input', () => this.updateClarificationState());
    this.beginButton.addEventListener('click', () => this.callbacks.onBeginDungeon());
  }

  isOpen(): boolean {
    return !this.screen.classList.contains('is-hidden');
  }

  open(
    question: DiagnosticQuestion,
    index: number,
    total: number,
    concept: Concept,
    skill: StudentSkillState,
  ): void {
    this.question = question;
    this.selectedOptionId = null;
    this.phase = 'answering';
    this.clarificationMode = false;

    this.progress.textContent = `Diagnostic · ${index + 1} / ${total}`;
    this.conceptTitle.textContent = `${concept.id} · ${concept.title}`;
    this.badge.textContent =
      skill.evidenceCount === 0
        ? 'Provisional · not yet scored'
        : `Provisional skill: ${formatMastery(skill)}`;

    this.prompt.textContent = question.prompt;
    this.hint.textContent = question.explanationHint ?? question.explanationPrompt;
    this.explanation.value = '';
    this.clarificationInput.value = '';
    this.hideStatus(this.status);
    this.hideStatus(this.clarificationStatus);

    this.showBlock(this.questionBlock);
    this.hideBlock(this.clarificationBlock);
    this.hideBlock(this.feedbackBlock);
    this.hideBlock(this.summaryBlock);

    this.renderOptions(question);
    this.updateSubmitState();

    this.screen.classList.remove('is-hidden');
    this.panel.scrollTop = 0;
    this.focusFirst();
  }

  showError(message: string): void {
    this.phase = this.clarificationMode ? 'clarification' : 'answering';
    if (this.clarificationMode) {
      this.showStatus(this.clarificationStatus, message, true);
      this.clarificationSubmit.disabled = false;
      this.clarificationInput.focus();
      return;
    }
    this.showStatus(this.status, message, true);
    this.updateSubmitState();
    this.options.querySelector<HTMLButtonElement>('button')?.focus();
  }

  showClarification(prompt: string, evaluator: string): void {
    this.phase = 'clarification';
    this.clarificationMode = true;

    this.hideBlock(this.questionBlock);
    this.hideBlock(this.feedbackBlock);
    this.hideBlock(this.summaryBlock);
    this.showBlock(this.clarificationBlock);

    this.clarificationPrompt.textContent = `${prompt} (${evaluator})`;
    this.clarificationInput.value = '';
    this.hideStatus(this.clarificationStatus);
    this.clarificationSubmit.disabled = false;

    this.screen.classList.remove('is-hidden');
    this.panel.scrollTop = 0;
    this.clarificationInput.focus();
  }

  showFeedback(view: DiagnosticFeedbackView): void {
    this.phase = 'feedback';
    this.hideBlock(this.questionBlock);
    this.hideBlock(this.clarificationBlock);
    this.hideBlock(this.summaryBlock);
    this.showBlock(this.feedbackBlock);

    this.verdict.textContent = view.correct ? 'Answer correct.' : 'Answer incorrect.';
    this.verdict.classList.toggle('is-correct', view.correct);
    this.verdict.classList.toggle('is-incorrect', !view.correct);

    const parts = [
      `Evaluator: ${evaluatorLabel(view.evaluation.evaluator)}`,
      `reasoning: ${view.evaluation.reasoning}`,
      `confidence: ${Math.round(view.evaluation.confidence * 100)}%`,
    ];
    if (view.clarificationTried) {
      parts.push('clarification reviewed');
    }
    if (view.evaluation.fallbackReason) {
      parts.push(`fallback reason: ${view.evaluation.fallbackReason}`);
    }
    this.evaluatorLine.textContent = parts.join(' · ');

    this.feedbackText.textContent = view.evaluation.feedback;
    renderCriteriaList(
      this.criteria,
      view.rubric,
      view.evaluation.matchedCriteria,
      view.evaluation.missingCriteria,
    );
    renderSourceBlock(this.source, view.question.sourceRefs, view.question.answerSourceRefs);
    renderSkillReadout(this.skillReadout, view.skill, view.concept);

    if (view.route) {
      renderRouteNote(this.routeNote, view.route);
    } else {
      this.routeNote.classList.add('is-hidden');
    }

    this.actions.replaceChildren();
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-primary';
    next.textContent = view.isLast ? 'See diagnostic summary' : 'Next question';
    next.addEventListener('click', () => this.callbacks.onContinue());
    this.actions.append(next);

    this.screen.classList.remove('is-hidden');
    this.panel.scrollTop = 0;
    this.focusFirst();
  }

  showSummary(view: DiagnosticSummaryView): void {
    this.phase = 'summary';
    this.hideBlock(this.questionBlock);
    this.hideBlock(this.clarificationBlock);
    this.hideBlock(this.feedbackBlock);
    this.showBlock(this.summaryBlock);

    this.summaryList.replaceChildren();
    for (const entry of view.answers) {
      const item = document.createElement('li');
      item.className = 'summary-item';

      const head = document.createElement('div');
      head.className = 'summary-head';
      const title = document.createElement('strong');
      title.textContent = `${entry.concept.id} · ${entry.concept.shortTitle}`;
      const mastery = document.createElement('span');
      mastery.className = 'summary-mastery';
      mastery.textContent = formatMastery(entry.skill);
      head.append(title, mastery);

      const meta = document.createElement('span');
      meta.className = 'summary-meta';
      meta.textContent = `${entry.answer.correct ? 'Answer correct' : 'Answer incorrect'} · ${
        entry.answer.evaluation.reasoning
      } reasoning · ${evaluatorLabel(entry.answer.evaluation.evaluator)}`;

      item.append(head, meta);
      this.summaryList.append(item);
    }

    renderRouteNote(this.summaryRoute, view.route);
    renderSkillList(this.summarySkills, view.skills, view.concepts, { compact: false });

    this.screen.classList.remove('is-hidden');
    this.panel.scrollTop = 0;
    this.beginButton.focus();
  }

  close(): void {
    this.screen.classList.add('is-hidden');
    this.question = null;
    this.selectedOptionId = null;
    this.phase = 'answering';
    this.clarificationMode = false;
    this.options.replaceChildren();
    this.actions.replaceChildren();
    this.summaryList.replaceChildren();
  }

  private renderOptions(question: DiagnosticQuestion): void {
    this.options.replaceChildren();
    question.options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'option';
      button.dataset.optionId = option.id;
      button.setAttribute('aria-pressed', 'false');

      const key = document.createElement('span');
      key.className = 'option-key';
      key.textContent = String.fromCharCode(65 + index);
      const label = document.createElement('span');
      label.className = 'option-label';
      label.textContent = option.label;
      button.append(key, label);

      button.addEventListener('click', () => {
        if (this.phase !== 'answering') {
          return;
        }
        this.selectedOptionId = option.id;
        for (const candidate of this.options.querySelectorAll<HTMLButtonElement>('.option')) {
          const selected = candidate.dataset.optionId === option.id;
          candidate.classList.toggle('is-selected', selected);
          candidate.setAttribute('aria-pressed', String(selected));
        }
        this.updateSubmitState();
      });

      this.options.append(button);
    });
  }

  private submitAnswer(): void {
    if (
      this.phase !== 'answering' ||
      !this.question ||
      !this.selectedOptionId ||
      this.explanation.value.trim().length === 0
    ) {
      return;
    }
    this.clarificationMode = false;
    this.phase = 'evaluating';
    this.showStatus(
      this.status,
      'Evaluating your reasoning against the provisional rubric…',
      false,
    );
    this.submitButton.disabled = true;
    this.callbacks.onSubmit(this.selectedOptionId, this.explanation.value.trim());
  }

  private submitClarification(): void {
    if (
      this.phase !== 'clarification' ||
      this.clarificationInput.value.trim().length === 0
    ) {
      return;
    }
    this.phase = 'evaluating';
    this.showStatus(
      this.clarificationStatus,
      'Re-evaluating with your clarification…',
      false,
    );
    this.clarificationSubmit.disabled = true;
    this.callbacks.onClarification(this.clarificationInput.value.trim());
  }

  private updateSubmitState(): void {
    this.submitButton.disabled =
      this.phase === 'evaluating' ||
      !this.selectedOptionId ||
      this.explanation.value.trim().length === 0;
  }

  private updateClarificationState(): void {
    this.clarificationSubmit.disabled =
      this.phase === 'evaluating' || this.clarificationInput.value.trim().length === 0;
  }

  private showStatus(element: HTMLElement, message: string, isError: boolean): void {
    element.textContent = message;
    element.classList.remove('is-hidden');
    element.classList.toggle('is-error', isError);
  }

  private hideStatus(element: HTMLElement): void {
    element.textContent = '';
    element.classList.add('is-hidden');
    element.classList.remove('is-error');
  }

  private showBlock(element: HTMLElement): void {
    element.classList.remove('is-hidden');
  }

  private hideBlock(element: HTMLElement): void {
    element.classList.add('is-hidden');
  }

  private focusFirst(): void {
    requestAnimationFrame(() => {
      const target = this.screen.querySelector<HTMLElement>(
        '.state-block:not(.is-hidden) button:not(:disabled), .state-block:not(.is-hidden) textarea',
      );
      target?.focus();
    });
  }
}

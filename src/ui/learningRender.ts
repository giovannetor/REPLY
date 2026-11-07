import { renderMath } from './math';
import type {
  Concept,
  ConceptId,
  EvaluationRubric,
  LearningChallenge,
  StudentSkillState,
} from '../domain/learning';
import type { AdaptiveRoute } from '../domain/gameDirector';
import { routeLabel } from '../domain/gameDirector';
import { describeSourceStatus } from '../domain/sources';
import { formatMastery, skillStatusLabel } from '../domain/skillState';

const KIND_LABEL: Record<LearningChallenge['kind'], string> = {
  diagnostic: 'Diagnostic',
  remedial: 'Remedial',
  advanced: 'Advanced',
  counterexample: 'Counterexample',
  'concept-check': 'Concept check',
  boss: 'Boss phase',
};

export interface SkillListOptions {
  compact?: boolean;
}

function makeBar(mastery: number): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'skill-bar';
  bar.setAttribute('role', 'presentation');
  const fill = document.createElement('span');
  fill.style.width = `${Math.round(Math.min(1, Math.max(0, mastery)) * 100)}%`;
  bar.append(fill);
  return bar;
}

export function renderSkillList(
  container: HTMLElement,
  states: Record<ConceptId, StudentSkillState>,
  concepts: readonly Concept[],
  options: SkillListOptions = {},
): void {
  container.replaceChildren();

  for (const concept of concepts) {
    const state = states[concept.id];
    const item = document.createElement('li');
    item.className = 'skill-item';
    item.dataset.status = state.status;
    item.dataset.assessed = String(concept.assessedInThisSlice);

    const head = document.createElement('div');
    head.className = 'skill-head';
    const name = document.createElement('strong');
    renderMath(name, `${concept.id} · ${concept.shortTitle}`);
    const value = document.createElement('span');
    value.className = 'skill-value';
    renderMath(value, concept.assessedInThisSlice ? formatMastery(state) : '—');
    head.append(name, value);

    item.append(head);
    if (concept.assessedInThisSlice) {
      item.append(makeBar(state.mastery));
      const meta = document.createElement('span');
      meta.className = 'skill-meta';
      renderMath(
        meta,
        `${skillStatusLabel(state)} · ${state.evidenceCount} evidence`,
      );
      item.append(meta);
    } else {
      const meta = document.createElement('span');
      meta.className = 'skill-meta';
      renderMath(meta, 'Not assessed in this slice');
      item.append(meta);
    }

    if (!options.compact) {
      const summary = document.createElement('p');
      summary.className = 'skill-summary';
      renderMath(summary, concept.focus);
      item.append(summary);
    }

    container.append(item);
  }
}

export function renderSkillReadout(
  container: HTMLElement,
  state: StudentSkillState,
  concept: Concept,
): void {
  container.replaceChildren();
  container.dataset.status = state.status;

  const head = document.createElement('div');
  head.className = 'skill-head';
  const title = document.createElement('strong');
  renderMath(title, `${concept.id} · ${concept.shortTitle}`);
  const value = document.createElement('span');
  value.className = 'skill-value';
  renderMath(value, concept.assessedInThisSlice ? formatMastery(state) : '—');
  head.append(title, value);
  container.append(head);

  if (concept.assessedInThisSlice) {
    container.append(makeBar(state.mastery));
    const meta = document.createElement('span');
    meta.className = 'skill-meta';
    renderMath(
      meta,
      `${skillStatusLabel(state)} · ${state.evidenceCount} evidence · ${state.correctCount} correct`,
    );
    container.append(meta);
  } else {
    const meta = document.createElement('span');
    meta.className = 'skill-meta';
    renderMath(meta, 'Not assessed in this slice');
    container.append(meta);
  }

  const note = document.createElement('p');
  note.className = 'skill-note';
  note.textContent =
    'Provisional estimate from authored prototype evidence. It is not a verified grade.';
  container.append(note);
}

export function renderCriteriaList(
  container: HTMLElement,
  rubric: EvaluationRubric,
  matchedIds: readonly string[],
  missingIds: readonly string[],
): void {
  container.replaceChildren();

  const heading = document.createElement('p');
  heading.className = 'criteria-heading';
  renderMath(heading, 'Provisional rubric signals');
  container.append(heading);

  const list = document.createElement('ul');
  list.className = 'criteria-items';
  for (const criterion of rubric.criteria) {
    const matched = matchedIds.includes(criterion.id);
    const item = document.createElement('li');
    item.className = `criterion ${matched ? 'is-matched' : 'is-missing'}`;

    const mark = document.createElement('span');
    mark.className = 'criterion-mark';
    renderMath(mark, matched ? '✓' : '·');
    mark.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('span');
    copy.className = 'criterion-copy';
    const label = document.createElement('strong');
    renderMath(
      label,
      `${criterion.label} · ${Math.round(criterion.weight * 100)}%`,
    );
    const description = document.createElement('span');
    renderMath(description, criterion.description);
    copy.append(label, description);

    item.append(mark, copy);
    list.append(item);
  }
  container.append(list);

  if (rubric.scoringGuide) {
    for (const level of ['2', '1', '0'] as const) {
      const guide = document.createElement('p');
      guide.className = 'criteria-note';
      renderMath(
        guide,
        `Pack rubric ${level}/2: ${rubric.scoringGuide[level]}`,
      );
      container.append(guide);
    }
  }
  if (rubric.misconception) {
    const misconception = document.createElement('p');
    misconception.className = 'criteria-note';
    renderMath(
      misconception,
      `Misconception to check: ${rubric.misconception}`,
    );
    container.append(misconception);
  }

  if (missingIds.length > 0) {
    const missing = document.createElement('p');
    missing.className = 'criteria-note';
    renderMath(missing, `Missing signals: ${missingIds.join(', ')}.`);
    container.append(missing);
  }

  if (rubric.provisional) {
    const note = document.createElement('p');
    note.className = 'criteria-note';
    renderMath(
      note,
      'Authored rubric · not verified against course materials.',
    );
    container.append(note);
  }
}

function appendSourceRow(
  container: HTMLElement,
  refs: LearningChallenge['sourceRefs'],
  context: 'topic' | 'answer',
): void {
  const status = describeSourceStatus(refs, context);
  const row = document.createElement('div');
  row.className = 'source-row';
  row.dataset.tone = status.tone;

  const head = document.createElement('div');
  head.className = 'source-head';
  const badge = document.createElement('span');
  badge.className = 'source-badge';
  renderMath(badge, status.label);
  const detail = document.createElement('span');
  detail.className = 'source-detail';
  renderMath(detail, status.detail);
  head.append(badge, detail);
  row.append(head);

  for (const ref of refs) {
    const refNode = document.createElement('div');
    refNode.className = 'source-ref';
    const title = document.createElement('strong');
    renderMath(title, ref.title);
    const meta = document.createElement('span');
    renderMath(
      meta,
      `${ref.kind.replace('-', ' ')} · ${ref.locator} · ${
        ref.verified ? 'document listed' : 'unverified'
      }`,
    );
    refNode.append(title, meta);
    if (ref.note) {
      const note = document.createElement('p');
      note.className = 'source-note';
      renderMath(note, ref.note);
      refNode.append(note);
    }
    row.append(refNode);
  }

  container.append(row);
}

export function renderSourceBlock(
  container: HTMLElement,
  topicRefs: LearningChallenge['sourceRefs'],
  answerRefs: LearningChallenge['answerSourceRefs'],
): void {
  container.replaceChildren();
  const heading = document.createElement('p');
  heading.className = 'source-heading';
  renderMath(heading, 'Sources & verification');
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Sources & verification';
  details.append(summary);
  appendSourceRow(details, topicRefs, 'topic');
  appendSourceRow(details, answerRefs, 'answer');
  container.append(details);
}

export function renderLearningContext(
  container: HTMLElement,
  learning: LearningChallenge,
  concept: Concept,
): void {
  container.replaceChildren();

  const title = document.createElement('p');
  title.className = 'learning-context-title';
  renderMath(
    title,
    `${concept.id} · ${concept.title} · ${KIND_LABEL[learning.kind]}`,
  );

  const objective = document.createElement('p');
  objective.className = 'learning-objective';
  renderMath(objective, `Objective: ${learning.learningObjective}`);

  const topic = describeSourceStatus(learning.sourceRefs, 'topic');
  const answer = describeSourceStatus(learning.answerSourceRefs, 'answer');

  const chips = document.createElement('div');
  chips.className = 'source-chips';
  const topicChip = document.createElement('span');
  topicChip.className = 'source-chip';
  topicChip.dataset.tone = topic.tone;
  renderMath(topicChip, `Topic source: ${topic.label}`);
  const answerChip = document.createElement('span');
  answerChip.className = 'source-chip';
  answerChip.dataset.tone = answer.tone;
  renderMath(answerChip, `Answer source: ${answer.label}`);
  chips.append(topicChip, answerChip);

  container.append(title, objective, chips);
}

export function renderRouteNote(
  container: HTMLElement,
  route: AdaptiveRoute | null,
): void {
  container.replaceChildren();
  container.classList.remove('is-hidden');

  const title = document.createElement('strong');
  const reason = document.createElement('span');

  if (!route) {
    renderMath(title, 'C2 adaptive path');
    renderMath(reason, 'No adaptive route selected yet.');
    container.append(title, reason);
    return;
  }

  renderMath(title, `C2 adaptive path · ${routeLabel(route)}`);
  renderMath(reason, route.reason);
  container.append(title, reason);

  if (route.kind === 'clarification') {
    const prompt = document.createElement('span');
    renderMath(prompt, `Clarification prompt: ${route.prompt}`);
    container.append(prompt);
  }
}

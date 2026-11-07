import { BossPanel } from './BossPanel';
import {
  BOSS_MAX_HP,
  PLAYER_MAX_HP,
  currentRoundNumber,
  type BossState,
} from '../domain/boss';
import type { DoorId } from '../domain/challenge';
import type { Concept, ConceptId, StudentSkillState } from '../domain/learning';
import { renderSkillList } from './learningRender';
import { mustGet, mustGetAll } from './dom';

export interface CourseView {
  readonly name: string;
  readonly code: string;
  readonly institution: string;
  readonly lede: string;
}

export interface ResultChallengeView {
  label: string;
  title: string;
  completed: boolean;
  attempts: number;
  xp: number;
}

export interface RunSummary {
  victory: boolean;
  bossState: BossState;
  challenges: ResultChallengeView[];
  skills: Record<ConceptId, StudentSkillState>;
  concepts: readonly Concept[];
}

export interface AppUICallbacks {
  onStart: () => void;
  onRestart: () => void;
}

export class AppUI {
  private readonly bossPanel = new BossPanel();
  private readonly startScreen = mustGet<HTMLElement>('start-screen');
  private readonly diagnosticScreen = mustGet<HTMLElement>('diagnostic-screen');
  private readonly startCourse = mustGet<HTMLElement>('start-course');
  private readonly startCourseCode = mustGet<HTMLElement>('start-course-code');
  private readonly startInstitution = mustGet<HTMLElement>('start-institution');
  private readonly startLede = mustGet<HTMLElement>('start-lede');
  private readonly providerName = mustGet<HTMLElement>('provider-name');
  private readonly providerNote = mustGet<HTMLElement>('provider-note');
  private readonly startButton = mustGet<HTMLButtonElement>('start-btn');

  private readonly hud = mustGet<HTMLElement>('hud');
  private readonly hudCourse = mustGet<HTMLElement>('hud-course');
  private readonly hudCourseCode = mustGet<HTMLElement>('hud-course-code');
  private readonly hudDoors = mustGet<HTMLElement>('hud-doors');
  private readonly pips = mustGetAll<HTMLElement>('.pip');

  private readonly bossHud = mustGet<HTMLElement>('boss-hud');
  private readonly bossRound = mustGet<HTMLElement>('boss-round');
  private readonly bossHpFill = mustGet<HTMLElement>('boss-hp-fill');
  private readonly bossHpText = mustGet<HTMLElement>('boss-hp-text');
  private readonly playerHpText = mustGet<HTMLElement>('player-hp-text');

  private readonly toast = mustGet<HTMLElement>('toast');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly skillsPanel = mustGet<HTMLElement>('skills-panel');
  private readonly skillsList = mustGet<HTMLElement>('skills-list');
  private readonly resultSkills = mustGet<HTMLElement>('result-skills');

  private readonly resultScreen = mustGet<HTMLElement>('result-screen');
  private readonly resultEyebrow = mustGet<HTMLElement>('result-eyebrow');
  private readonly resultTitle = mustGet<HTMLElement>('result-title');
  private readonly resultSubtitle = mustGet<HTMLElement>('result-subtitle');
  private readonly resultChallenges = mustGet<HTMLElement>('result-challenges');
  private readonly resultStats = mustGet<HTMLElement>('result-stats');
  private readonly restartButton = mustGet<HTMLButtonElement>('restart-btn');

  constructor(private readonly callbacks: AppUICallbacks) {
    this.startButton.addEventListener('click', () => this.callbacks.onStart());
    this.restartButton.addEventListener('click', () => this.callbacks.onRestart());
  }

  setCourse(course: CourseView, providerName: string, note?: string): void {
    this.startCourse.textContent = course.name;
    this.startCourseCode.textContent = course.code;
    this.startInstitution.textContent = course.institution;
    this.startLede.textContent = course.lede;
    this.hudCourse.textContent = course.name;
    this.hudCourseCode.textContent = course.code;
    this.providerName.textContent = providerName;

    if (note) {
      this.providerNote.textContent = note;
      this.providerNote.classList.remove('is-hidden');
    } else {
      this.providerNote.textContent = '';
      this.providerNote.classList.add('is-hidden');
    }
  }

  showStart(): void {
    this.startScreen.classList.remove('is-hidden');
    this.diagnosticScreen.classList.add('is-hidden');
    this.resultScreen.classList.add('is-hidden');
    this.hud.classList.add('is-hidden');
    this.bossHud.classList.add('is-hidden');
    this.skillsPanel.classList.add('is-hidden');
    this.hideToast();
    this.startButton.focus();
  }

  beginDiagnostic(): void {
    this.startScreen.classList.add('is-hidden');
    this.resultScreen.classList.add('is-hidden');
    this.hud.classList.add('is-hidden');
    this.bossHud.classList.add('is-hidden');
    this.skillsPanel.classList.add('is-hidden');
    this.hideToast();
  }

  beginRun(): void {
    this.startScreen.classList.add('is-hidden');
    this.diagnosticScreen.classList.add('is-hidden');
    this.resultScreen.classList.add('is-hidden');
    this.hud.classList.remove('is-hidden');
    this.bossHud.classList.add('is-hidden');
    this.skillsPanel.classList.remove('is-hidden');
  }

  setSkills(
    states: Record<ConceptId, StudentSkillState>,
    concepts: readonly Concept[],
  ): void {
    renderSkillList(this.skillsList, states, concepts, { compact: true });
  }

  setProgress(completedDoorIds: readonly DoorId[], total: number): void {
    this.hudDoors.textContent = `Doors cleared ${completedDoorIds.length} / ${total}`;
    for (const pip of this.pips) {
      const doorId = pip.dataset.door as DoorId | undefined;
      pip.classList.toggle(
        'is-complete',
        doorId !== undefined && completedDoorIds.includes(doorId),
      );
    }
  }

  showBossHud(state: BossState): void {
    this.bossHud.classList.remove('is-hidden');
    this.updateBossHud(state);
  }

  updateBossHud(state: BossState): void {
    this.bossPanel.update(state);
    this.bossRound.textContent = `Round ${currentRoundNumber(state)} / ${state.totalRounds}`;
    this.bossHpFill.style.width = `${Math.max(0, (state.bossHp / BOSS_MAX_HP) * 100)}%`;
    this.bossHpText.textContent = `${state.bossHp} / ${BOSS_MAX_HP}`;
    this.playerHpText.textContent = `${state.playerHp} / ${PLAYER_MAX_HP}`;
  }

  hideBossHud(): void {
    this.bossHud.classList.add('is-hidden');
  }

  showToast(message: string, durationMs = 2_600): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toast.textContent = message;
    this.toast.classList.remove('is-hidden');
    this.toastTimer = setTimeout(() => {
      this.toast.classList.add('is-hidden');
      this.toastTimer = null;
    }, durationMs);
  }

  hideToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.toast.classList.add('is-hidden');
  }

  showResult(summary: RunSummary): void {
    this.hud.classList.add('is-hidden');
    this.bossHud.classList.add('is-hidden');
    this.diagnosticScreen.classList.add('is-hidden');
    this.skillsPanel.classList.add('is-hidden');
    this.hideToast();

    this.resultScreen.classList.remove('is-hidden');
    this.resultEyebrow.textContent = summary.victory ? 'Final exam cleared' : 'Run ended';
    this.resultTitle.textContent = summary.victory ? 'Victory' : 'Defeat';
    this.resultTitle.classList.toggle('is-victory', summary.victory);
    this.resultTitle.classList.toggle('is-defeat', !summary.victory);

    const cleared = summary.challenges.filter((challenge) => challenge.completed).length;
    const outcome = summary.victory
      ? `The Registrar yields. You cleared ${cleared} of ${summary.challenges.length} doors and broke the archive's hold on the final exam.`
      : `The archive stays sealed. You cleared ${cleared} of ${summary.challenges.length} doors and answered ${summary.bossState.correctAnswers} of ${summary.bossState.totalRounds} boss questions correctly.`;
    this.resultSubtitle.textContent = `${outcome} Skill estimates are provisional and unverified.`;

    this.resultChallenges.replaceChildren();
    for (const challenge of summary.challenges) {
      this.resultChallenges.append(this.buildResultItem(challenge));
    }

    renderSkillList(this.resultSkills, summary.skills, summary.concepts, {
      compact: false,
    });

    const assessedConcepts = summary.concepts.filter(
      (concept) => concept.assessedInThisSlice,
    ).length;
    this.resultStats.replaceChildren(
      this.buildStat('Doors cleared', `${cleared} / ${summary.challenges.length}`),
      this.buildStat(
        'Boss rounds',
        `${summary.bossState.correctAnswers} / ${summary.bossState.totalRounds}`,
      ),
      this.buildStat('Boss HP left', `${summary.bossState.bossHp} / ${BOSS_MAX_HP}`),
      this.buildStat(
        'Skills assessed',
        `${assessedConcepts} / ${summary.concepts.length}`,
      ),
    );

    this.restartButton.focus();
  }

  private buildResultItem(challenge: ResultChallengeView): HTMLLIElement {
    const item = document.createElement('li');
    item.className = `result-item ${challenge.completed ? 'is-complete' : 'is-locked'}`;

    const check = document.createElement('span');
    check.className = 'result-check';
    check.textContent = challenge.completed ? '✓' : '·';
    check.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');
    copy.className = 'result-copy';
    const title = document.createElement('strong');
    title.textContent = challenge.completed
      ? challenge.title
      : `${challenge.label} · not cleared`;
    const meta = document.createElement('span');
    meta.textContent = challenge.completed
      ? `${challenge.label} · ${challenge.attempts} attempt${challenge.attempts === 1 ? '' : 's'}`
      : challenge.label;
    copy.append(title, meta);

    const xp = document.createElement('span');
    xp.className = 'result-xp';
    xp.textContent = challenge.completed ? `${challenge.xp} XP` : '—';

    item.append(check, copy, xp);
    return item;
  }

  private buildStat(label: string, value: string): HTMLDivElement {
    const stat = document.createElement('div');
    stat.className = 'stat';
    const labelNode = document.createElement('span');
    labelNode.textContent = label;
    const valueNode = document.createElement('strong');
    valueNode.textContent = value;
    stat.append(labelNode, valueNode);
    return stat;
  }
}

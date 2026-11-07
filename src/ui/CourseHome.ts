import {
  listCourses,
  saveCourse,
  validateCourseDraft,
  type LibraryCourse,
} from './courseLibrary';
import { mustGet } from './dom';

export class CourseHome {
  private readonly screen = mustGet<HTMLElement>('home-screen');
  private readonly grid = mustGet<HTMLElement>('course-grid');
  private readonly dialog = mustGet<HTMLDialogElement>('course-dialog');
  private readonly form = mustGet<HTMLFormElement>('course-form');
  private readonly files = mustGet<HTMLInputElement>('course-materials');
  private readonly status = mustGet<HTMLElement>('course-save-status');
  private readonly notice = mustGet<HTMLElement>('library-notice');
  private readonly save = mustGet<HTMLButtonElement>('course-save');
  private saving = false;

  constructor(onPlay: () => void) {
    mustGet('play-seeded').addEventListener('click', () => {
      this.screen.classList.add('is-hidden');
      onPlay();
    });
    mustGet('create-course').addEventListener('click', () => this.openForm());
    mustGet('course-cancel').addEventListener('click', () =>
      this.dialog.close(),
    );
    this.dialog.addEventListener('cancel', (event) => {
      if (this.saving) event.preventDefault();
    });
    this.files.addEventListener('change', () => {
      const files = Array.from(this.files.files ?? []);
      mustGet('material-selection').textContent = files.length
        ? files
            .map((file) => `${file.name} (${Math.ceil(file.size / 1024)} KB)`)
            .join(' · ')
        : 'No materials selected. You can save a draft without files.';
    });
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.create();
    });
    mustGet('course-home-back').addEventListener('click', () => this.show());
  }

  show(): void {
    mustGet('start-screen').classList.add('is-hidden');
    mustGet('result-screen').classList.add('is-hidden');
    this.screen.classList.remove('is-hidden');
    void this.refresh();
    this.screen.scrollTop = 0;
    const heading = mustGet('home-title');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }

  private openForm(): void {
    this.form.reset();
    this.status.textContent = '';
    mustGet('material-selection').textContent =
      'No materials selected. You can save a draft without files.';
    this.dialog.showModal();
    this.dialog.scrollTop = 0;
    mustGet('course-title').focus();
  }

  private async refresh(): Promise<void> {
    this.grid
      .querySelectorAll('.draft-course')
      .forEach((node) => node.remove());
    try {
      const courses = await listCourses();
      for (const course of courses.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ))
        this.grid.append(this.card(course));
      mustGet('library-count').textContent =
        `${courses.length + 1} course${courses.length ? 's' : ''} in your hangar`;
    } catch {
      this.notice.textContent =
        'Local library unavailable. The seeded demo is still playable; new courses cannot be saved in this browser.';
    }
  }

  private card(course: LibraryCourse): HTMLElement {
    const card = document.createElement('article');
    card.className = 'course-card draft-course';
    const art = document.createElement('div');
    art.className = 'course-art draft-art';
    art.textContent = '＋';
    art.setAttribute('aria-hidden', 'true');
    const body = document.createElement('div');
    body.className = 'course-card-body';
    const badge = document.createElement('span');
    badge.className = 'badge badge-warn';
    badge.textContent = course.materials.length
      ? 'Materials uploaded'
      : 'Draft';
    const title = document.createElement('h3');
    title.textContent = course.title;
    const institution = document.createElement('p');
    institution.className = 'course-institution';
    institution.textContent = course.institution || 'Independent learning';
    const description = document.createElement('p');
    description.className = 'course-description';
    description.textContent = course.description;
    const detail = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `${course.materials.length} material${course.materials.length === 1 ? '' : 's'} · stored on this device`;
    const list = document.createElement('ul');
    course.materials.forEach((material) => {
      const item = document.createElement('li');
      item.textContent = `${material.name} · ${Math.ceil(material.size / 1024)} KB`;
      list.append(item);
    });
    detail.append(summary, list);
    const note = document.createElement('p');
    note.className = 'course-pending';
    note.textContent =
      'Content generation coming next. Playable only for seeded demo courses.';
    body.append(badge, title, institution, description, detail, note);
    card.append(art, body);
    return card;
  }

  private async create(): Promise<void> {
    if (this.saving) return;
    const draft = {
      title: mustGet<HTMLInputElement>('course-title').value,
      description: mustGet<HTMLTextAreaElement>('course-description').value,
      institution: mustGet<HTMLInputElement>('course-institution').value,
      files: Array.from(this.files.files ?? []),
    };
    const error = validateCourseDraft(draft);
    if (error) {
      this.status.textContent = error;
      return;
    }
    this.saving = true;
    this.save.disabled = true;
    mustGet<HTMLButtonElement>('course-cancel').disabled = true;
    this.status.textContent = 'Saving course and materials on this device…';
    try {
      await saveCourse(draft);
      this.dialog.close();
      this.notice.textContent = draft.files.length
        ? 'Course saved. Materials are stored locally; content generation is not available yet.'
        : 'Draft saved on this device. It is not playable yet.';
      await this.refresh();
      mustGet('create-course').focus();
    } catch (error) {
      this.status.textContent =
        error instanceof Error ? error.message : 'Unable to save this course.';
    } finally {
      this.saving = false;
      this.save.disabled = false;
      mustGet<HTMLButtonElement>('course-cancel').disabled = false;
    }
  }
}

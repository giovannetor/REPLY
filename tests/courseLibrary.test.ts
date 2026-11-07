import { describe, expect, test } from 'vitest';
import { validateCourseDraft, type CourseDraft } from '../src/ui/courseLibrary';
const draft = (files: File[] = []): CourseDraft => ({
  title: 'Orbital Mechanics',
  description: 'Study transfer orbits.',
  institution: '',
  files,
});
const file = (name: string, size = 1) =>
  ({ name, size, type: 'application/pdf' }) as File;
describe('local course material boundaries', () => {
  test('accepts drafts without materials and supported course documents', () => {
    expect(validateCourseDraft(draft())).toBeNull();
    expect(
      validateCourseDraft(draft([file('lecture.PDF'), file('notes.md')])),
    ).toBeNull();
  });
  test('rejects executables, oversized uploads and too many files before storage', () => {
    expect(validateCourseDraft(draft([file('run.exe')]))).toContain('PDF');
    expect(
      validateCourseDraft(draft([file('lecture.pdf', 21 * 1024 * 1024)])),
    ).toContain('20 MB');
    expect(
      validateCourseDraft(
        draft(Array.from({ length: 11 }, () => file('notes.pdf'))),
      ),
    ).toContain('10');
  });
  test('rejects blank required fields', () => {
    expect(validateCourseDraft({ ...draft(), title: '   ' })).toContain(
      'title',
    );
    expect(validateCourseDraft({ ...draft(), description: '   ' })).toContain(
      'description',
    );
  });
});

import 'fake-indexeddb/auto';
import { listCourses, saveCourse } from '../src/ui/courseLibrary';

test('persists course metadata and real material bytes in the same IndexedDB record', async () => {
  const material = new File(['orbital notes'], 'notes.txt', {
    type: 'text/plain',
  });
  const saved = await saveCourse(draft([material]));
  expect(
    (await listCourses()).find((course) => course.id === saved.id)?.materials,
  ).toEqual([{ name: 'notes.txt', size: 13, type: 'text/plain' }]);
  const record = await new Promise<{ files: Blob[] }>((resolve, reject) => {
    const open = indexedDB.open('poliquest-library', 1);
    open.onsuccess = () => {
      const db = open.result;
      const get = db
        .transaction('courses')
        .objectStore('courses')
        .get(saved.id);
      get.onsuccess = () => {
        db.close();
        resolve(get.result);
      };
      get.onerror = () => {
        db.close();
        reject(get.error);
      };
    };
    open.onerror = () => reject(open.error);
  });
  expect(await record.files[0].text()).toBe('orbital notes');
});

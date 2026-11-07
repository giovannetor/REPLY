export interface CourseMaterial {
  name: string;
  size: number;
  type: string;
}
export interface LibraryCourse {
  id: string;
  title: string;
  description: string;
  institution: string;
  createdAt: string;
  materials: CourseMaterial[];
}
export interface CourseDraft {
  title: string;
  description: string;
  institution: string;
  files: File[];
}
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const TYPES = /\.(pdf|txt|md|ppt|pptx|doc|docx)$/i;

export function validateCourseDraft(draft: CourseDraft): string | null {
  if (!draft.title.trim() || draft.title.trim().length > 100)
    return 'Enter a course title (up to 100 characters).';
  if (!draft.description.trim() || draft.description.trim().length > 500)
    return 'Enter a short description (up to 500 characters).';
  if (draft.institution.trim().length > 160)
    return 'Institution / professor must be at most 160 characters.';
  if (draft.files.length > 10) return 'Choose at most 10 materials per course.';
  if (draft.files.some((file) => !TYPES.test(file.name)))
    return 'Use PDF, TXT, MD, PPT, PPTX, DOC or DOCX files.';
  if (draft.files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES)
    return 'Materials must total 20 MB or less.';
  return null;
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('poliquest-library', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('courses', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Local storage is unavailable.'));
    request.onblocked = () =>
      reject(new Error('Close other Poliquest tabs and try again.'));
  });
}

export async function listCourses(): Promise<LibraryCourse[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction('courses', 'readonly')
        .objectStore('courses')
        .getAll();
      request.onsuccess = () =>
        resolve(
          request.result.map(
            ({ files: _files, ...course }) => course as LibraryCourse,
          ),
        );
      request.onerror = () =>
        reject(new Error('Could not read your local courses.'));
    });
  } finally {
    db.close();
  }
}

/** Store real files locally, atomically with metadata. No upload or content generation is implied. */
export async function saveCourse(draft: CourseDraft): Promise<LibraryCourse> {
  const error = validateCourseDraft(draft);
  if (error) throw new Error(error);
  const course: LibraryCourse = {
    id: crypto.randomUUID(),
    title: draft.title.trim(),
    description: draft.description.trim(),
    institution: draft.institution.trim(),
    createdAt: new Date().toISOString(),
    materials: draft.files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    })),
  };
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('courses', 'readwrite');
      tx.objectStore('courses').add({ ...course, files: draft.files });
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          new Error(
            'Could not save locally. Browser storage may be full. Your course was not saved.',
          ),
        );
      tx.onabort = () =>
        reject(new Error('Local save interrupted. Your course was not saved.'));
    });
  } finally {
    db.close();
  }
  return course;
}

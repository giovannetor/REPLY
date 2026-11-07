import type { SourceReference } from './learning';

export type SourceTone = 'verified' | 'unverified' | 'missing';

export interface SourceStatus {
  isMissing: boolean;
  tone: SourceTone;
  label: string;
  detail: string;
}

/**
 * Describes whether a content item has a source and whether that source is
 * verified. An empty answer-source list is deliberately reported as missing:
 * the framework summary does not verify authored answers or rubrics.
 */
export function describeSourceStatus(
  refs: readonly SourceReference[],
  context: 'topic' | 'answer' = 'topic',
): SourceStatus {
  if (refs.length === 0) {
    return {
      isMissing: true,
      tone: 'missing',
      label: context === 'answer' ? 'No answer source' : 'No source reference',
      detail:
        context === 'answer'
          ? 'The answer and rubric are authored prototype content. They are not verified against course materials.'
          : 'This item has no source reference. Treat it as authored prototype content.',
    };
  }

  const verifiedCount = refs.filter((ref) => ref.verified).length;
  if (verifiedCount === 0) {
    return {
      isMissing: false,
      tone: 'unverified',
      label: context === 'answer' ? 'Unverified answer source' : 'Unverified topic source',
      detail: 'The listed source is not marked as verified.',
    };
  }

  return {
    isMissing: false,
    tone: 'verified',
    label: context === 'answer' ? 'Answer source' : 'Topic source',
    detail:
      verifiedCount === refs.length
        ? 'A source document is listed. Check its note: it may support the topic only.'
        : 'Some listed sources are unverified.',
  };
}

export function sourceBadgeLabel(ref: SourceReference): string {
  return ref.verified ? 'Verified document' : 'Unverified';
}

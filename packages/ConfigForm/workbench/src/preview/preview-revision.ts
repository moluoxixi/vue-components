/**
 * Small latest-only gate shared by preview projections. A renderer may finish
 * asynchronously (compiler, iframe bootstrap, or runtime mount); only the
 * result belonging to the most recently requested revision can publish an
 * artifact.
 */
export interface PreviewRevisionGate {
  request: (revision: string) => void
  isCurrent: (revision: string) => boolean
  invalidate: () => void
}

export function createPreviewRevisionGate(): PreviewRevisionGate {
  let current = ''
  return {
    request(revision) {
      current = revision
    },
    isCurrent(revision) {
      return revision !== '' && revision === current
    },
    invalidate() {
      current = ''
    },
  }
}

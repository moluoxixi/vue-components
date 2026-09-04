export function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value))
    return fallback

  return Math.max(1, Math.trunc(value))
}

export function validateEmbeddingBatch(
  embeddings: readonly number[][],
  expectedCount: number,
): number {
  if (embeddings.length !== expectedCount) {
    throw new Error(
      `embedding count mismatch: got ${embeddings.length}, expected ${expectedCount}`,
    )
  }
  if (expectedCount === 0)
    throw new Error('cannot build a vector index without documents')

  const dimension = embeddings[0]?.length ?? 0
  if (dimension <= 0)
    throw new Error('embedding vector must contain at least one dimension')

  embeddings.forEach((vector, index) => {
    validateEmbeddingVector(vector, dimension, `embedding ${index}`)
  })
  return dimension
}

export function validateEmbeddingVector(
  vector: readonly number[],
  dimension: number,
  label = 'embedding',
): void {
  if (!Number.isInteger(dimension) || dimension <= 0)
    throw new Error(`invalid embedding dimension: ${dimension}`)
  if (vector.length !== dimension) {
    throw new Error(
      `${label} dim mismatch: got ${vector.length}, expected ${dimension}`,
    )
  }
  if (vector.some(value => !Number.isFinite(value)))
    throw new Error(`${label} contains a non-finite value`)
}

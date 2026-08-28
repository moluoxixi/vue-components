import type { Orama } from '@orama/orama'
import type { EmbeddingModel } from 'ai'
import type { EmbeddingIdentitySeed, IndexMeta } from './index-state'
import type { ComponentContract } from './types'
import { create, insertMultiple, save } from '@orama/orama'
import { embedMany } from 'ai'
import { validateEmbeddingBatch } from './embedding-validation'
import { renderExample, renderSearchableDoc } from './generator'

export type { EmbeddingIdentity, EmbeddingIdentitySeed, IndexMeta } from './index-state'

export function createIndexSchema(dimension: number) {
  if (!Number.isInteger(dimension) || dimension <= 0)
    throw new Error(`invalid embedding dimension: ${dimension}`)

  return {
    component: 'string',
    packageName: 'string',
    docPath: 'string',
    source: 'string',
    knowledgeKey: 'string',
    body: 'string',
    embedding: `vector[${dimension}]` as `vector[${number}]`,
  } as const
}

export type IndexSchema = ReturnType<typeof createIndexSchema>

export interface IndexDoc {
  component: string
  packageName: string
  docPath: string
  source: 'internal' | 'external'
  knowledgeKey: string
  body: string
  example: string
  exampleJs: string
  embedding: number[]
}

export interface BuildResult {
  snapshot: unknown
  meta: IndexMeta
}

/** Builds a persistable Orama index with the SDK model's actual vector dimension. */
export async function buildIndex(
  contracts: ComponentContract[],
  model: EmbeddingModel,
  sourceHash: string,
  identity: EmbeddingIdentitySeed,
  abortSignal?: AbortSignal,
): Promise<BuildResult> {
  const docs = contracts.map((contract) => {
    const exampleCode = renderExample(contract)
    return {
      component: contract.name,
      packageName: contract.packageName,
      docPath: contract.sourceFile,
      source: contract.knowledgeSource ?? 'internal',
      knowledgeKey: contract.knowledgeKey ?? `${contract.knowledgeSource ?? 'internal'}:${encodeURIComponent(contract.packageName)}:${encodeURIComponent(contract.name)}`,
      body: renderSearchableDoc(contract),
      example: exampleCode.ts,
      exampleJs: exampleCode.js,
    }
  })

  const { embeddings } = await embedMany({
    model,
    values: docs.map(doc => doc.body),
    abortSignal,
  })
  const dimension = validateEmbeddingBatch(embeddings, docs.length)
  const schema = createIndexSchema(dimension)
  const db = create({ schema })
  const indexDocs: IndexDoc[] = docs.map((doc, index) => ({
    ...doc,
    embedding: embeddings[index],
  }))
  await insertMultiple(db as Orama<typeof schema>, indexDocs)

  return {
    snapshot: save(db as Orama<typeof schema>),
    meta: {
      builtAt: new Date().toISOString(),
      componentCount: contracts.length,
      sourceHash,
      embeddingIdentity: { ...identity, dimension },
    },
  }
}

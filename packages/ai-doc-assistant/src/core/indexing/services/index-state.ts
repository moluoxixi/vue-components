import type { EmbeddingProviderId } from '@moluoxixi/ai-provider/shared'
import type { ComponentContract } from '../../types'
import { createHash } from 'node:crypto'

export interface EmbeddingIdentity {
  provider: EmbeddingProviderId
  model: string
  endpointFingerprint: string
  dimension: number
}

export type EmbeddingIdentitySeed = Omit<EmbeddingIdentity, 'dimension'>

/** Stable hash of the extracted contracts used to detect persisted source drift. */
export function sourceHashOf(contracts: readonly ComponentContract[]): string {
  const stableContracts = [...contracts]
    .sort((left, right) => (left.knowledgeKey ?? left.name).localeCompare(right.knowledgeKey ?? right.name))
  return createHash('sha256').update(JSON.stringify(stableContracts)).digest('hex')
}

/** 索引元信息；content 模式不携带 embeddingIdentity。 */
export interface IndexMeta {
  /** 抽取完成时间（ISO 字符串）。 */
  builtAt: string
  /** 已抽取的组件数量。 */
  componentCount: number
  /** 组件源文件集合的哈希，用于判断契约是否陈旧（stale）。 */
  sourceHash: string
  /** vector 索引使用的远程 Provider/model/endpoint 与实际维度。 */
  embeddingIdentity?: EmbeddingIdentity
}

/** 索引生命周期状态机：idle → building → ready；身份漂移为 stale，失败为 error。 */
export type IndexStatus = 'idle' | 'building' | 'ready' | 'stale' | 'error'

/** 对外暴露的索引状态快照，供 GET /index/status 返回。 */
export interface IndexStatusSnapshot {
  status: IndexStatus
  /** 已构建索引的元信息；ready/stale 时可用。 */
  meta: IndexMeta | null
  /** error 状态下的失败原因；其余状态为 null。 */
  error: string | null
  /** building 状态的起始时间戳（ms）；非构建中为 null。 */
  startedAt: number | null
}

/**
 * 索引状态管理器：维护状态机 + 单飞锁。
 *
 * 单飞（single-flight）：并发的构建请求复用同一个 in-flight Promise，
 * 避免重复抽取/索引构建与写状态竞争。
 */
export class IndexStateManager {
  private status: IndexStatus = 'idle'
  private meta: IndexMeta | null = null
  private error: string | null = null
  private startedAt: number | null = null
  /** 当前进行中的构建任务；null 表示无构建在跑。 */
  private inflight: Promise<IndexMeta> | null = null

  /** 从持久化 meta 恢复；embedding 身份漂移时保留 meta 但拒绝查询。 */
  hydrate(meta: IndexMeta | null, expectedEmbedding?: EmbeddingIdentitySeed): void {
    if (meta) {
      this.meta = meta
      this.status = expectedEmbedding && !matchesEmbeddingIdentity(meta.embeddingIdentity, expectedEmbedding)
        ? 'stale'
        : 'ready'
    }
  }

  markStale(): void {
    if (this.meta)
      this.status = 'stale'
  }

  snapshot(): IndexStatusSnapshot {
    return {
      status: this.status,
      meta: this.status === 'ready' || this.status === 'stale' ? this.meta : null,
      error: this.status === 'error' ? this.error : null,
      startedAt: this.status === 'building' ? this.startedAt : null,
    }
  }

  isReady(): boolean {
    return this.status === 'ready'
  }

  /**
   * 经状态机执行一次构建。并发调用复用 in-flight Promise（单飞）。
   * @param build 实际构建函数，成功须返回新的 IndexMeta。
   */
  async runBuild(build: () => Promise<IndexMeta>): Promise<IndexMeta> {
    if (this.inflight) {
      // 已有构建在跑，复用同一 Promise，不重复触发
      return this.inflight
    }

    this.status = 'building'
    this.error = null
    this.startedAt = Date.now()

    this.inflight = build()
      .then((meta) => {
        this.status = 'ready'
        this.meta = meta
        this.error = null
        return meta
      })
      .catch((err: unknown) => {
        // 失败显式落 error 状态并抛出，绝不伪装成功或静默降级
        this.status = 'error'
        this.error = err instanceof Error ? err.message : String(err)
        throw err
      })
      .finally(() => {
        this.inflight = null
        this.startedAt = null
      })

    return this.inflight
  }
}

export function matchesEmbeddingIdentity(
  actual: EmbeddingIdentity | undefined,
  expected: EmbeddingIdentitySeed,
): boolean {
  return actual?.provider === expected.provider
    && actual.model === expected.model
    && actual.endpointFingerprint === expected.endpointFingerprint
}

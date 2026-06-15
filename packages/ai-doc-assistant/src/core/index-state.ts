/**
 * 索引元信息：契约抽取完成后的快照。
 * 注：默认 content 策略采用结构化关键词 topK，无向量索引，故无 embeddingDim。
 */
export interface IndexMeta {
  /** 抽取完成时间（ISO 字符串）。 */
  builtAt: string
  /** 已抽取的组件数量。 */
  componentCount: number
  /** 组件源文件集合的哈希，用于判断契约是否陈旧（stale）。 */
  sourceHash: string
}

/** 索引生命周期状态机：idle → building → ready，失败落 error。 */
export type IndexStatus = 'idle' | 'building' | 'ready' | 'error'

/** 对外暴露的索引状态快照，供 GET /index/status 返回。 */
export interface IndexStatusSnapshot {
  status: IndexStatus
  /** 已就绪索引的元信息；building/idle/error 时为 null。 */
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

  /** 初始化：从已持久化的 meta 恢复 ready 状态（进程启动时调用）。 */
  hydrate(meta: IndexMeta | null): void {
    if (meta) {
      this.status = 'ready'
      this.meta = meta
    }
  }

  snapshot(): IndexStatusSnapshot {
    return {
      status: this.status,
      meta: this.status === 'ready' ? this.meta : null,
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

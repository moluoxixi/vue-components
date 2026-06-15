import type { BuildResult, IndexMeta } from './indexer'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** 持久化目录下的固定文件名。 */
const SNAPSHOT_FILE = 'index.json'
const META_FILE = 'index.meta.json'

/** 已加载的索引数据。 */
export interface LoadedIndex {
  snapshot: unknown
  meta: IndexMeta
}

/**
 * 原子写入索引快照与元信息：先写 .tmp 再 rename 替换，避免半成品被 retriever 读到。
 * @param dir 持久化目录（随包分发的本地目录）。
 */
export async function persistIndex(dir: string, result: BuildResult): Promise<void> {
  await mkdir(dir, { recursive: true })
  const snapshotPath = join(dir, SNAPSHOT_FILE)
  const metaPath = join(dir, META_FILE)

  const snapshotTmp = `${snapshotPath}.tmp`
  const metaTmp = `${metaPath}.tmp`

  await writeFile(snapshotTmp, JSON.stringify(result.snapshot), 'utf8')
  await writeFile(metaTmp, JSON.stringify(result.meta, null, 2), 'utf8')

  // 两个文件都写完临时态后再分别 rename，缩小不一致窗口
  await rename(snapshotTmp, snapshotPath)
  await rename(metaTmp, metaPath)
}

/**
 * 加载持久化索引。文件缺失时抛出明确错误（由调用方映射为 INDEX_NOT_READY），不返回空索引伪装就绪。
 */
export async function loadIndex(dir: string): Promise<LoadedIndex> {
  const snapshotPath = join(dir, SNAPSHOT_FILE)
  const metaPath = join(dir, META_FILE)

  let snapshotRaw: string
  let metaRaw: string
  try {
    snapshotRaw = await readFile(snapshotPath, 'utf8')
    metaRaw = await readFile(metaPath, 'utf8')
  }
  catch (err) {
    throw new Error(`index not found in ${dir}: ${(err as Error).message}`, { cause: err })
  }

  return {
    snapshot: JSON.parse(snapshotRaw),
    meta: JSON.parse(metaRaw) as IndexMeta,
  }
}

/** 读取元信息（仅 meta，用于 status 查询，避免加载大快照）。返回 null 表示未构建。 */
export async function readMeta(dir: string): Promise<IndexMeta | null> {
  try {
    const raw = await readFile(join(dir, META_FILE), 'utf8')
    return JSON.parse(raw) as IndexMeta
  }
  catch {
    return null
  }
}

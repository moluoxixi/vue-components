import type { FeatureExtractionPipeline } from '@huggingface/transformers'
/**
 * 本地 embedding 模块：用 @huggingface/transformers 在本地运行 bge-small-zh-v1.5，
 * 把文本批量转成归一化向量。零外部 API、离线可用——发布后用户无需配置任何 embedding key。
 *
 * 架构（ADR-0007 可选增强）：组件库面向未来可能增长到需要语义召回的规模时，
 * 才启用「向量库 + 本地 embedding」。chat 仍走用户配置的第三方 key（A社/GPT），
 * embedding 完全本地化，二者解耦。模型首次使用时从 HuggingFace 下载并缓存到本地。
 *
 * 实测（win32 x64, node 22）：模型加载约 10s（首次含下载），单句编码约 40ms，
 * 输出维度 512，已 L2 归一化（可直接做余弦/点积相似度）。
 */
import { pipeline } from '@huggingface/transformers'

/** bge-small-zh-v1.5 输出向量维度。 */
export const EMBEDDING_DIM = 512

/** 本地 embedding 模型 id（HuggingFace 仓库，Xenova 提供 ONNX 量化版）。 */
export const EMBEDDING_MODEL_ID = 'Xenova/bge-small-zh-v1.5'

/** 批量 embedding 函数签名：文本数组 → 等长向量数组。 */
export type EmbedFn = (texts: string[]) => Promise<number[][]>

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null

/**
 * 懒加载并单例化 feature-extraction pipeline。
 * 首次调用触发模型下载/加载（耗时），后续复用同一实例。
 */
async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('feature-extraction', EMBEDDING_MODEL_ID) as Promise<FeatureExtractionPipeline>
  }
  return pipelinePromise
}

/**
 * 把文本批量编码为归一化向量。
 * @param texts 待编码文本数组（空数组直接返回空，不触发模型加载）。
 * @returns 与输入等长的向量数组，每个向量维度为 EMBEDDING_DIM。
 *
 * 失败语义：模型加载或推理异常直接抛出（不返回空/零向量伪装成功），
 * 由上层映射为构建失败，避免错位/空向量污染索引。
 */
export const embedTexts: EmbedFn = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0)
    return []

  const extractor = await getPipeline()
  // mean pooling + L2 normalize：bge 推荐配置，输出可直接做余弦相似度
  const output = await extractor(texts, { pooling: 'mean', normalize: true })
  const vectors = output.tolist() as number[][]

  // 维度自检：模型异常导致维度不符时显式抛错，不静默放行
  for (const vec of vectors) {
    if (vec.length !== EMBEDDING_DIM) {
      throw new Error(
        `local embedding dim mismatch: got ${vec.length}, expected ${EMBEDDING_DIM}`,
      )
    }
  }
  return vectors
}

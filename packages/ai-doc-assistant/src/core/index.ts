/** core 职责目录门面：统一暴露可被 UI/server 复用的核心能力，避免跨职责 deep import。 */
export { renderExample, renderExampleSkeleton, renderSearchableDoc } from './generator'
export type { ComponentContract, EmitDef, ModelDef, PropDef, SlotDef } from './types'
export { splitAnswerSegments } from './vue-block-extractor'

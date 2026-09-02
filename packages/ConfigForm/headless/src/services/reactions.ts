import type {
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type {
  ConfigFormNode,
  ConfigFormValues,
} from '../types'
import {
  applyConfigFormReactionList,
} from '@moluoxixi/config-form-core'
import { collectAllConfigFormNodes } from '../utils'

/** 从 Headless 节点树收集 reactions，再交给 Core 的纯 reducer 执行。 */
export function applyConfigFormReactions<TValues extends ConfigFormValues>(
  nodes: ConfigFormNode<TValues, unknown, unknown, unknown>[],
  inputValues: TValues,
): ConfigFormReactionProjection<TValues> {
  const reactions = collectAllConfigFormNodes(nodes).flatMap(node => node.reactions ?? [])
  return applyConfigFormReactionList(reactions, inputValues)
}

import type { FormDevtoolsNode, FormNodeRenderMetric, FormNodeSyncMetric } from '../types'
import type { DevtoolsStore, StoredNode } from './types'
import { ConfigFormDevtoolsPluginError } from '../types'

/**
 * 校验同一 devtools node id 的稳定身份字段。
 *
 * id 复用但字段、组件、父级或源码来源变化时直接抛错，避免调试面板展示错位节点。
 */
function assertCompatibleNode(existing: FormDevtoolsNode | undefined, next: FormDevtoolsNode) {
  if (!existing)
    return

  const keys: Array<keyof FormDevtoolsNode> = ['formId', 'kind', 'field', 'component', 'parentId']
  for (const key of keys) {
    if (existing[key] !== undefined && next[key] !== undefined && existing[key] !== next[key]) {
      throw new ConfigFormDevtoolsPluginError(
        `Conflicting devtools node id: ${next.id} changed ${key} from ${String(existing[key])} to ${String(next[key])}`,
        {
          key,
          next: next[key],
          existing: existing[key],
          nodeId: next.id,
        },
      )
    }
  }

  if (existing.source && next.source && existing.source.id !== next.source.id) {
    throw new ConfigFormDevtoolsPluginError(
      `Conflicting devtools node id: ${next.id} changed source from ${existing.source.id} to ${next.source.id}`,
      {
        existingSourceId: existing.source.id,
        nextSourceId: next.source.id,
        nodeId: next.id,
      },
    )
  }
}

/**
 * 创建 devtools 客户端内存 store。
 *
 * store 负责节点注册、性能指标累积和渲染通知，不直接访问页面 DOM。
 */
export function createStore(render: () => void): DevtoolsStore {
  const nodes = new Map<string, StoredNode>()
  const formRegistrationOrders = new Map<string, number>()
  const pendingRenderMetrics = new Map<string, FormNodeRenderMetric[]>()
  const pendingSyncMetrics = new Map<string, FormNodeSyncMetric[]>()
  let orderSeed = 0
  let formRegistrationOrderSeed = 0

  /**
   * 解析表单注册顺序。
   *
   * 同一个 formId 在生命周期内保持首次注册顺序，用于多表单导航稳定排序。
   */
  function resolveFormRegistrationOrder(formId: string): number {
    const existing = formRegistrationOrders.get(formId)
    if (existing !== undefined)
      return existing

    const next = ++formRegistrationOrderSeed
    formRegistrationOrders.set(formId, next)
    return next
  }

  /**
   * 清理没有任何节点引用的表单注册顺序。
   *
   * 仅在表单所有节点都注销后删除，避免部分字段更新时导航顺序抖动。
   */
  function dropUnusedFormRegistrationOrder(formId: string) {
    for (const node of nodes.values()) {
      if (node.formId === formId)
        return
    }
    formRegistrationOrders.delete(formId)
  }

  /**
   * 将一次渲染耗时样本写入节点统计。
   *
   * 统计为增量平均值，不保留全量历史样本。
   */
  function applyRenderMetric(node: StoredNode, metric: FormNodeRenderMetric) {
    const total = (node.avgRenderMs ?? 0) * node.renderSamples + metric.duration
    node.renderSamples += 1
    node.lastRenderMs = metric.duration
    node.lastRenderPhase = metric.phase
    node.maxRenderMs = Math.max(node.maxRenderMs ?? metric.duration, metric.duration)
    node.avgRenderMs = total / node.renderSamples
  }

  /**
   * 将一次 DOM 同步耗时样本写入节点统计。
   *
   * 统计只描述 adapter 到 bridge 的同步成本，不代表组件业务渲染耗时。
   */
  function applySyncMetric(node: StoredNode, metric: FormNodeSyncMetric) {
    const total = (node.avgSyncMs ?? 0) * node.syncSamples + metric.duration
    node.syncSamples += 1
    node.lastSyncMs = metric.duration
    node.maxSyncMs = Math.max(node.maxSyncMs ?? metric.duration, metric.duration)
    node.avgSyncMs = total / node.syncSamples
  }

  /**
   * 暂存先于节点注册到达的性能样本。
   *
   * 样本按 node id 分组，节点注册后由 flushPendingMetrics 一次性补写。
   */
  function pushPendingMetric<TMetric>(pending: Map<string, TMetric[]>, metric: TMetric & { id: string }) {
    const existing = pending.get(metric.id)
    if (existing) {
      existing.push(metric)
      return
    }

    pending.set(metric.id, [metric])
  }

  /**
   * 将暂存性能样本刷新到已注册节点。
   *
   * 刷新完成后删除暂存项，避免同一批样本重复计入平均值。
   */
  function flushPendingMetrics(node: StoredNode) {
    // render/sync 指标可能早于节点注册到达，注册时必须补记，避免刷新时丢样本。
    const renderMetrics = pendingRenderMetrics.get(node.id)
    if (renderMetrics) {
      for (const metric of renderMetrics)
        applyRenderMetric(node, metric)
      pendingRenderMetrics.delete(node.id)
    }

    const syncMetrics = pendingSyncMetrics.get(node.id)
    if (syncMetrics) {
      for (const metric of syncMetrics)
        applySyncMetric(node, metric)
      pendingSyncMetrics.delete(node.id)
    }
  }

  /**
   * 注册或更新节点快照。
   *
   * 会保留已有统计信息和注册顺序；身份字段冲突时抛错暴露 adapter id 问题。
   */
  function upsertNode(node: FormDevtoolsNode, element: HTMLElement | null) {
    const existing = nodes.get(node.id)
    assertCompatibleNode(existing, node)
    const stored: StoredNode = {
      ...existing,
      ...node,
      element,
      order: node.order ?? existing?.order ?? ++orderSeed,
      registrationOrder: existing?.registrationOrder ?? resolveFormRegistrationOrder(node.formId),
      renderSamples: existing?.renderSamples ?? 0,
      syncSamples: existing?.syncSamples ?? 0,
    }
    nodes.set(node.id, stored)
    flushPendingMetrics(stored)
    render()
  }

  return {
    nodes,
    /**
     * 记录字段节点的 Vue 渲染耗时。
     *
     * 节点未注册时先暂存，后续注册会补齐样本。
     */
    recordRender(metric: FormNodeRenderMetric) {
      const node = nodes.get(metric.id)
      if (!node) {
        pushPendingMetric(pendingRenderMetrics, metric)
        return
      }

      applyRenderMetric(node, metric)
      render()
    },
    /**
     * 记录字段节点同步到 bridge 的耗时。
     *
     * 节点未注册时先暂存，避免 mount 阶段事件顺序导致样本丢失。
     */
    recordSync(metric: FormNodeSyncMetric) {
      const node = nodes.get(metric.id)
      if (!node) {
        pushPendingMetric(pendingSyncMetrics, metric)
        return
      }

      applySyncMetric(node, metric)
      render()
    },
    /** 注册新节点或刷新同 id 节点快照。 */
    registerField(node: FormDevtoolsNode, element: HTMLElement | null) {
      upsertNode(node, element)
    },
    /**
     * 注销节点并清理关联暂存指标。
     *
     * 如果该节点是表单最后一个节点，会释放对应表单注册顺序。
     */
    unregisterField(id: string) {
      const existing = nodes.get(id)
      nodes.delete(id)
      pendingRenderMetrics.delete(id)
      pendingSyncMetrics.delete(id)
      if (existing)
        dropUnusedFormRegistrationOrder(existing.formId)
      render()
    },
    /** 更新已存在节点；行为与 registerField 保持一致以支持完整快照同步。 */
    updateField(node: FormDevtoolsNode, element: HTMLElement | null) {
      upsertNode(node, element)
    },
  }
}

// @vitest-environment happy-dom
import type { DevtoolsStore, StoredNode } from '../src/client/types'
import { describe, expect, it } from 'vitest'
import { comparePickNodes, resolvePickedNode } from '../src/client/tree'

/**
 * 创建树工具测试用节点。
 *
 * 默认值覆盖最小 StoredNode 结构，调用方只传入要参与排序的字段。
 */
function createNode(overrides: Partial<StoredNode> & Pick<StoredNode, 'id'>): StoredNode {
  const { id, ...rest } = overrides

  return {
    element: null,
    field: id,
    formId: 'form-1',
    id,
    kind: 'field',
    order: 1,
    registrationOrder: 1,
    renderSamples: 0,
    syncSamples: 0,
    ...rest,
  }
}

/**
 * 创建只包含节点集合的 store mock。
 *
 * 操作方法为空实现，因为本文件只验证 tree helper 的读取逻辑。
 */
function createStore(nodes: StoredNode[]): DevtoolsStore {
  return {
    nodes: new Map(nodes.map(node => [node.id, node])),
    recordRender: () => {},
    recordSync: () => {},
    registerField: () => {},
    unregisterField: () => {},
    updateField: () => {},
  }
}

/**
 * 覆盖元素 rect 以稳定可见面积断言。
 *
 * 只设置当前测试需要的宽高和边界字段。
 */
function setRect(element: HTMLElement, width: number, height: number) {
  element.getBoundingClientRect = () => ({
    bottom: height,
    height,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

describe('client tree helpers', () => {
  it('orders picked nodes by visible area, tree depth, and declaration order', () => {
    const smallElement = document.createElement('div')
    const largeElement = document.createElement('div')
    setRect(smallElement, 20, 20)
    setRect(largeElement, 100, 100)
    document.body.append(smallElement, largeElement)

    const smallNode = createNode({ element: smallElement, id: 'small', order: 2 })
    const largeNode = createNode({ element: largeElement, id: 'large', order: 1 })
    const parentNode = createNode({ id: 'parent', order: 1 })
    const childNode = createNode({ id: 'child', order: 2, parentId: 'parent' })
    const laterNode = createNode({ id: 'later', order: 3 })
    const earlierNode = createNode({ id: 'earlier', order: 1 })
    const store = createStore([smallNode, largeNode, parentNode, childNode, laterNode, earlierNode])

    expect(comparePickNodes(store, smallNode, largeNode)).toBeLessThan(0)
    expect(comparePickNodes(store, parentNode, childNode)).toBeGreaterThan(0)
    expect(comparePickNodes(store, laterNode, earlierNode)).toBeGreaterThan(0)
  })

  it('resolves the enabled node that contains the picked target', () => {
    const element = document.createElement('div')
    const target = document.createElement('button')
    setRect(element, 80, 40)
    element.append(target)
    document.body.append(element)

    const node = createNode({ element, id: 'field-name' })
    expect(resolvePickedNode(createStore([node]), target)).toBe(node)
  })
})

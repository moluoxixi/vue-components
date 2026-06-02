import type {
  DevtoolsRenderState,
  HighlightElement,
  RenderDevtools,
  SetDevtoolsMessage,
  StoredNode,
} from '../types'
import { scrollSelectedNodeIntoView } from '../render'
import { openNodeSource } from '../sourceOpen'

/**
 * 激活并定位一个源码节点。
 *
 * 该函数会更新面板选择态、执行高亮、滚动到树节点，并请求编辑器打开源码。
 */
export function activateSourceNode(
  node: StoredNode,
  getNodeLookupRoot: () => HTMLElement,
  state: DevtoolsRenderState,
  render: RenderDevtools,
  highlight: HighlightElement,
  setMessage: SetDevtoolsMessage,
) {
  state.activeFormId = node.formId
  state.activeFormSelectedByUser = true
  state.selectedNodeId = node.id
  render()
  const nodeLookupRoot = getNodeLookupRoot()
  highlight(node.element)
  scrollSelectedNodeIntoView(nodeLookupRoot, node.id)
  void openNodeSource(node, setMessage)
}

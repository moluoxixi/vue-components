import type { NodeId, PageId, PageNode } from '../../../types'
import { pageNodeSchema } from '../../../schemas'
import { invalid } from '../errors'

type SchemaParseResult<T>
  = | { success: true, data: T }
    | { success: false, error: { issues: Array<{ message: string }> } }

export function requireParsedValue<T>(
  result: SchemaParseResult<T>,
  code: string,
  message: string,
  pageId?: PageId,
  nodeId?: NodeId,
): T {
  if (result.success)
    return result.data
  const detail = result.error.issues[0]?.message
  invalid(code, detail ? `${message} ${detail}` : message, pageId, nodeId)
}

export function parseNodeCandidate(candidate: unknown, pageId: PageId, nodeId: NodeId): PageNode {
  return requireParsedValue(
    pageNodeSchema.safeParse(candidate),
    'PROJECT_NODE_INVALID',
    'Node configuration is invalid.',
    pageId,
    nodeId,
  )
}

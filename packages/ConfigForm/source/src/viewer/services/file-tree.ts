import type { SourceFile } from '../../generator'
import type {
  SourceTreeDirectoryNode,
  SourceTreeNode,
  VisibleSourceTreeNode,
} from '../types'

function compareText(left: string, right: string): number {
  if (left === right)
    return 0
  return left < right ? -1 : 1
}

function compareNodes(left: SourceTreeNode, right: SourceTreeNode): number {
  if (left.kind !== right.kind)
    return left.kind === 'directory' ? -1 : 1
  return compareText(left.name, right.name)
}

function sortTree(nodes: SourceTreeNode[]): void {
  nodes.sort(compareNodes)
  nodes.forEach((node) => {
    if (node.kind === 'directory')
      sortTree(node.children)
  })
}

export function buildSourceFileTree(files: readonly SourceFile[]): SourceTreeNode[] {
  const roots: SourceTreeNode[] = []
  const directories = new Map<string, SourceTreeDirectoryNode>()

  for (const file of [...files].sort((left, right) => compareText(left.path, right.path))) {
    const segments = file.path.split('/')
    let children = roots
    let directoryPath = ''

    segments.slice(0, -1).forEach((segment) => {
      directoryPath = directoryPath ? `${directoryPath}/${segment}` : segment
      let directory = directories.get(directoryPath)
      if (!directory) {
        directory = {
          children: [],
          id: `directory:${directoryPath}`,
          kind: 'directory',
          name: segment,
          path: directoryPath,
        }
        directories.set(directoryPath, directory)
        children.push(directory)
      }
      children = directory.children
    })

    children.push({
      file,
      id: `file:${file.path}`,
      kind: 'file',
      name: segments.at(-1) ?? file.path,
      path: file.path,
    })
  }

  sortTree(roots)
  return roots
}

export function collectSourceDirectoryIds(nodes: readonly SourceTreeNode[]): string[] {
  const ids: string[] = []
  const visit = (entries: readonly SourceTreeNode[]): void => {
    entries.forEach((node) => {
      if (node.kind !== 'directory')
        return
      ids.push(node.id)
      visit(node.children)
    })
  }
  visit(nodes)
  return ids
}

export function directoryIdsForPath(path: string): string[] {
  const segments = path.split('/').slice(0, -1)
  return segments.map((_, index) => `directory:${segments.slice(0, index + 1).join('/')}`)
}

export function flattenVisibleSourceTree(
  nodes: readonly SourceTreeNode[],
  expandedIds: ReadonlySet<string>,
): VisibleSourceTreeNode[] {
  const visible: VisibleSourceTreeNode[] = []
  const visit = (
    entries: readonly SourceTreeNode[],
    depth: number,
    parentId?: string,
  ): void => {
    entries.forEach((node) => {
      visible.push({ depth, node, parentId })
      if (node.kind === 'directory' && expandedIds.has(node.id))
        visit(node.children, depth + 1, node.id)
    })
  }
  visit(nodes, 1)
  return visible
}

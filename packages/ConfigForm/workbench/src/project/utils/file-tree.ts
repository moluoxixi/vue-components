import type {
  ProjectFileIconKind,
  ProjectPath,
  ProjectTreeDirectory,
  ProjectTreeNode,
  VisibleProjectTreeNode,
  WorkspaceFile,
} from '../types'
import { assertUniqueProjectPaths } from './path'

const nodeCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

function compareTreeNodes(left: ProjectTreeNode, right: ProjectTreeNode): number {
  if (left.kind !== right.kind)
    return left.kind === 'directory' ? -1 : 1
  return nodeCollator.compare(left.name, right.name) || left.name.localeCompare(right.name, 'en')
}

function sortTree(nodes: ProjectTreeNode[]): ProjectTreeNode[] {
  nodes.sort(compareTreeNodes)
  nodes.forEach((node) => {
    if (node.kind === 'directory')
      sortTree(node.children)
  })
  return nodes
}

export function buildProjectFileTree(
  files: Readonly<Record<ProjectPath, Readonly<WorkspaceFile>>>,
): ProjectTreeNode[] {
  const sourcePaths = Object.keys(files)
  const paths = assertUniqueProjectPaths(sourcePaths)
  const roots: ProjectTreeNode[] = []
  const directories = new Map<string, ProjectTreeDirectory>()
  const filePaths = new Set<string>()

  paths.forEach((path, sourceIndex) => {
    const segments = path.split('/')
    let children = roots
    let parentPath = ''
    segments.forEach((name, index) => {
      const nodePath = parentPath ? `${parentPath}/${name}` : name
      const isFile = index === segments.length - 1
      if (isFile) {
        if (directories.has(nodePath))
          throw new Error(`[config-form-workbench] export path "${path}" conflicts with a directory`)
        filePaths.add(nodePath)
        children.push({
          file: files[sourcePaths[sourceIndex]! as ProjectPath]!,
          id: `file:${path}`,
          kind: 'file',
          name,
          path,
        })
        return
      }

      if (filePaths.has(nodePath))
        throw new Error(`[config-form-workbench] export directory "${nodePath}" conflicts with a file`)
      let directory = directories.get(nodePath)
      if (!directory) {
        directory = {
          children: [],
          id: `directory:${nodePath}`,
          kind: 'directory',
          name,
          path: nodePath,
        }
        directories.set(nodePath, directory)
        children.push(directory)
      }
      children = directory.children
      parentPath = nodePath
    })
  })

  return sortTree(roots)
}

export function collectProjectTreeDirectoryIds(nodes: readonly ProjectTreeNode[]): string[] {
  return nodes.flatMap(node => node.kind === 'directory'
    ? [node.id, ...collectProjectTreeDirectoryIds(node.children)]
    : [])
}

export function flattenVisibleProjectTree(
  nodes: readonly ProjectTreeNode[],
  expandedIds: ReadonlySet<string>,
  level = 1,
  parentId?: string,
): VisibleProjectTreeNode[] {
  return nodes.flatMap((node): VisibleProjectTreeNode[] => [
    { level, node, ...(parentId ? { parentId } : {}) },
    ...(node.kind === 'directory' && expandedIds.has(node.id)
      ? flattenVisibleProjectTree(node.children, expandedIds, level + 1, node.id)
      : []),
  ])
}

export function projectFileIconKind(path: ProjectPath, file: Readonly<WorkspaceFile>): ProjectFileIconKind {
  if (file.kind === 'binary')
    return 'binary'
  if (path.endsWith('.json'))
    return 'json'
  if (/\.(?:css|html|js|jsx|mjs|scss|ts|tsx|vue)$/i.test(path))
    return 'code'
  return 'text'
}

import type { DeepReadonly, ProjectSurface, SlotItem } from '@moluoxixi/config-form-model'

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&apos;',
  })[character] ?? character)
}

function orderedNodeIds(surface: DeepReadonly<ProjectSurface>): string[] {
  const ids: string[] = []
  const visited = new Set<string>()
  const visit = (items: readonly DeepReadonly<SlotItem>[]): void => {
    for (const item of items) {
      if (visited.has(item.nodeId))
        continue
      visited.add(item.nodeId)
      ids.push(item.nodeId)
      const node = surface.graph.nodesById[item.nodeId]
      if (node?.kind === 'layout') {
        for (const children of Object.values(node.slots))
          visit(children)
      }
    }
  }
  visit(surface.graph.root)
  for (const id of Object.keys(surface.graph.nodesById)) {
    if (!visited.has(id))
      ids.push(id)
  }
  return ids
}

function nodeLabel(surface: DeepReadonly<ProjectSurface>, nodeId: string): string {
  const node = surface.graph.nodesById[nodeId]
  if (!node)
    return 'Component'
  if (node.kind === 'field')
    return node.label?.trim() || node.field
  return node.component
}

/** Build a deterministic thumbnail without adding a rendering dependency to page management. */
export function createPagePreviewDataUrl(surface: DeepReadonly<ProjectSurface>): string {
  const ids = orderedNodeIds(surface)
  const labels = ids.slice(0, 5).map(id => nodeLabel(surface, id))
  const rows = labels.map((label, index) => {
    const y = 165 + index * 38
    const width = 210 - (index % 3) * 28
    return `<rect x="64" y="${y}" width="${width}" height="8" rx="4" fill="#d7dee9"/><rect x="64" y="${y - 16}" width="${Math.min(138, 74 + label.length * 4)}" height="7" rx="3.5" fill="#72809a"/><rect x="${330 + (index % 2) * 32}" y="${y - 10}" width="${Math.max(112, 212 - (index % 3) * 22)}" height="28" rx="7" fill="#f7f9fc" stroke="#dce3ed"/>`
  }).join('')
  const empty = labels.length === 0
    ? '<rect x="64" y="172" width="532" height="86" rx="14" fill="#f7f9fc" stroke="#dce3ed" stroke-dasharray="6 6"/><text x="330" y="220" text-anchor="middle" fill="#72809a" font-family="Inter,Arial,sans-serif" font-size="16">Empty page</text>'
    : rows
  const accent = surface.kind === 'dialog' ? '#b7791f' : surface.kind === 'drawer' ? '#0f766e' : '#3559b7'
  const subtitle = surface.kind === 'page' ? surface.route : surface.presentation.title
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="400" viewBox="0 0 720 400"><rect width="720" height="400" rx="22" fill="#eef2f7"/><rect x="24" y="24" width="672" height="352" rx="16" fill="#ffffff" stroke="#d7dee9"/><rect x="24" y="24" width="672" height="58" rx="16" fill="${accent}"/><circle cx="55" cy="53" r="7" fill="#ffffff" fill-opacity=".76"/><circle cx="78" cy="53" r="7" fill="#ffffff" fill-opacity=".44"/><circle cx="101" cy="53" r="7" fill="#ffffff" fill-opacity=".22"/><text x="132" y="59" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="700">${escapeXml(surface.name)}</text><text x="64" y="118" fill="#182338" font-family="Inter,Arial,sans-serif" font-size="12" font-weight="700">${escapeXml(subtitle)}</text><text x="64" y="140" fill="#72809a" font-family="Inter,Arial,sans-serif" font-size="11">${ids.length} component${ids.length === 1 ? '' : 's'} · ${surface.interactions.length} interaction${surface.interactions.length === 1 ? '' : 's'}</text>${empty}<rect x="64" y="336" width="94" height="10" rx="5" fill="${accent}" fill-opacity=".18"/><rect x="172" y="336" width="148" height="10" rx="5" fill="#e7ecf3"/></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

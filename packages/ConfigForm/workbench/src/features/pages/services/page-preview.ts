import type { DeepReadonly, ProjectSurface, SlotItem, SurfaceNode } from '@moluoxixi/config-form-model'

const previewFont = 'Segoe UI,Microsoft YaHei,Arial,sans-serif'
const previewAccent = '#409eff'

interface PreviewFrame {
  x: number
  y: number
  width: number
  height: number
}

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

function previewText(value: string, x: number, y: number, width: number, size = 14, color = '#344054', weight = 400): string {
  let clipped = ''
  let used = 0
  for (const character of value) {
    used += size * (character.codePointAt(0)! > 0x7F ? 1 : 0.56)
    if (used > width - size) {
      clipped += '\u2026'
      break
    }
    clipped += character
  }
  return `<text x="${x}" y="${y}" fill="${color}" font-family="${previewFont}" font-size="${size}" font-weight="${weight}"><title>${escapeXml(value)}</title>${escapeXml(clipped)}</text>`
}

function previewFrame(surface: DeepReadonly<ProjectSurface>): PreviewFrame {
  if (surface.kind === 'dialog')
    return { x: 100, y: 28, width: 520, height: 344 }
  if (surface.kind === 'drawer') {
    const placement = surface.presentation.placement
    if (placement === 'top' || placement === 'bottom')
      return { x: 24, y: placement === 'top' ? 0 : 104, width: 672, height: 296 }
    return { x: placement === 'left' ? 0 : 224, y: 0, width: 496, height: 400 }
  }
  return { x: 24, y: 24, width: 672, height: 352 }
}

function fieldValue(node: DeepReadonly<SurfaceNode>): string {
  if (node.kind !== 'field')
    return String(node.props.text ?? node.props.title ?? '')
  const value = node.defaultValue
  const options = node.props.options
  if (Array.isArray(options)) {
    const selected = options.find(option => option && typeof option === 'object' && !Array.isArray(option) && option.value === value)
    if (selected && typeof selected === 'object' && !Array.isArray(selected))
      return String(selected.label ?? value ?? '')
  }
  if (typeof value === 'string' || typeof value === 'number')
    return String(value)
  return ''
}

function previewControl(node: DeepReadonly<SurfaceNode>, x: number, y: number, width: number): string {
  const kind = node.component.split('.').at(-1)
  const value = fieldValue(node)
  if (kind === 'switch') {
    const checked = node.kind === 'field' && node.defaultValue === true
    return `<rect x="${x}" y="${y + 3}" width="38" height="22" rx="11" fill="${checked ? previewAccent : '#c7cdd6'}"/><circle cx="${x + (checked ? 27 : 11)}" cy="${y + 14}" r="8" fill="#fff"/>`
  }
  if (kind === 'slider') {
    const minimum = typeof node.props.min === 'number' ? node.props.min : 0
    const maximum = typeof node.props.max === 'number' ? node.props.max : 100
    const numeric = node.kind === 'field' && typeof node.defaultValue === 'number' ? node.defaultValue : minimum
    const ratio = maximum > minimum ? Math.min(1, Math.max(0, (numeric - minimum) / (maximum - minimum))) : 0
    return `<rect x="${x}" y="${y + 12}" width="${width}" height="4" rx="2" fill="#e5e9ef"/><rect x="${x}" y="${y + 12}" width="${width * ratio}" height="4" rx="2" fill="${previewAccent}"/><circle cx="${x + width * ratio}" cy="${y + 14}" r="7" fill="#fff" stroke="${previewAccent}" stroke-width="2"/>`
  }
  if (kind === 'rate') {
    const rating = node.kind === 'field' && typeof node.defaultValue === 'number' ? node.defaultValue : 0
    return Array.from({ length: Math.min(5, Math.floor(width / 24)) }, (_, index) => `<path transform="translate(${x + index * 24},${y + 4})" d="m10 0 3 6.2 6.8 1-4.9 4.8 1.1 6.8L10 15.6 3.9 18.8 5 12 0.1 7.2l6.8-1Z" fill="${index < rating ? '#e6b04a' : '#e3e7ed'}"/>`).join('')
  }
  if (kind === 'checkbox' || kind === 'radio') {
    const circle = kind === 'radio'
    const options = Array.isArray(node.props.options) ? node.props.options.slice(0, 2) : []
    return (options.length ? options : [null]).map((option, index, items) => {
      const entry = option && typeof option === 'object' && !Array.isArray(option) ? option : undefined
      const defaultValue = node.kind === 'field' ? node.defaultValue : undefined
      const checked = entry ? Array.isArray(defaultValue) ? defaultValue.includes(entry.value ?? null) : defaultValue === entry.value : defaultValue === true
      const left = x + index * width / items.length
      const label = String(entry?.label ?? '')
      const mark = circle
        ? `<circle cx="${left + 8}" cy="${y + 14}" r="3" fill="#fff"/>`
        : `<path d="m${left + 4} ${y + 14} 3 3 5-6" fill="none" stroke="#fff" stroke-width="1.5"/>`
      return `<rect x="${left}" y="${y + 6}" width="16" height="16" rx="${circle ? 8 : 3}" fill="${checked ? previewAccent : '#fff'}" stroke="${checked ? previewAccent : '#c7cdd6'}"/>${checked ? mark : ''}${previewText(label, left + 24, y + 19, width / items.length - 24, 13)}`
    }).join('')
  }
  const placeholder = typeof node.props.placeholder === 'string' ? node.props.placeholder : ''
  const display = kind === 'password' && value ? '\u2022\u2022\u2022\u2022\u2022\u2022' : value || placeholder
  const isSelect = kind === 'select' || kind === 'auto-complete' || kind === 'date' || kind === 'time'
  return `<rect x="${x}" y="${y}" width="${width}" height="30" rx="4" fill="#fff" stroke="#d9dfe8"/>${previewText(display, x + 10, y + 20, width - (isSelect ? 32 : 20), 13, value ? '#344054' : '#8b95a5')}${isSelect ? `<path d="M${x + width - 19} ${y + 12}l4 4 4-4" fill="none" stroke="#8b95a5" stroke-width="1.5"/>` : ''}`
}

function previewNodes(surface: DeepReadonly<ProjectSurface>, frame: PreviewFrame): string {
  const ids = orderedNodeIds(surface)
  const contentX = frame.x + 28
  const contentY = frame.y + 94
  const contentWidth = frame.width - 56
  const bottom = frame.y + frame.height - 26
  const columns = surface.graph.form.columns ?? 24
  const fieldSpan = surface.graph.form.fieldSpan ?? columns
  const placements = new Map(surface.graph.root.map(item => [item.nodeId, typeof item.placement.span === 'number' ? item.placement.span : fieldSpan]))
  let y = contentY
  let column = 0
  const rows: string[] = []
  for (const id of ids) {
    const node = surface.graph.nodesById[id]
    if (!node)
      continue
    const halfWidth = node.kind === 'field' && (placements.get(id) ?? columns) <= columns / 2
    if (!halfWidth && column) {
      y += 52
      column = 0
    }
    if (y + 32 > bottom)
      break
    const x = contentX + (column ? contentWidth / 2 + 10 : 0)
    const width = halfWidth ? contentWidth / 2 - 10 : contentWidth
    if (node.kind === 'field') {
      const labelWidth = Math.min(90, width * 0.32)
      const label = node.label?.trim() || node.field
      rows.push(previewText(label, x, y + 20, labelWidth, 14))
      if (node.required)
        rows.push(previewText('*', x - 9, y + 20, 16, 14, '#e85d64'))
      rows.push(previewControl(node, x + labelWidth, y, width - labelWidth))
    }
    else if (node.component.endsWith('.button')) {
      const text = fieldValue(node) || 'Button'
      const buttonWidth = Math.min(width, Math.max(88, text.length * 8 + 28))
      rows.push(`<rect x="${x}" y="${y}" width="${buttonWidth}" height="30" rx="4" fill="${previewAccent}"/>${previewText(text, x + 14, y + 20, buttonWidth - 20, 13, '#fff')}`)
    }
    else {
      const text = fieldValue(node)
      if (!text)
        continue
      rows.push(previewText(text, x, y + 20, width, 16, '#344054', node.kind === 'layout' ? 600 : 400))
    }
    if (halfWidth && column === 0) {
      column = 1
    }
    else {
      y += 52
      column = 0
    }
  }
  return rows.join('')
}

/** Build a deterministic thumbnail without adding a rendering dependency to page management. */
export function createPagePreviewDataUrl(surface: DeepReadonly<ProjectSurface>): string {
  const frame = previewFrame(surface)
  const title = surface.kind === 'page' ? surface.name : surface.presentation.title || surface.name
  const subtitle = surface.kind === 'page' ? surface.route : surface.name
  const backdrop = surface.kind === 'page' ? '#f0f3f7' : '#dce2e9'
  const close = surface.kind === 'page' ? '' : `<path d="M${frame.x + frame.width - 35} ${frame.y + 27}l10 10m0-10l-10 10" fill="none" stroke="#8993a3" stroke-width="1.5"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="400" viewBox="0 0 720 400"><title>${escapeXml(title)}</title><rect width="720" height="400" fill="${backdrop}"/><rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="${surface.kind === 'drawer' ? 0 : 6}" fill="#fff" stroke="#dde3eb"/>${previewText(title, frame.x + 28, frame.y + 37, frame.width - 100, 21, '#182230', 600)}${previewText(subtitle, frame.x + 28, frame.y + 60, frame.width - 70, 12, '#8490a1')}<path d="M${frame.x} ${frame.y + 76}h${frame.width}" stroke="#e9edf2"/>${close}${previewNodes(surface, frame)}</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

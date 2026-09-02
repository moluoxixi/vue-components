const STRIPPED_ATTRIBUTES = new Set([
  'autofocus',
  'for',
  'form',
  'href',
  'id',
  'name',
  'srcdoc',
  'tabindex',
])

function sanitizeElement(element: Element): void {
  for (const attribute of [...element.attributes]) {
    if (
      STRIPPED_ATTRIBUTES.has(attribute.name)
      || attribute.name.startsWith('data-config-')
      || attribute.name.startsWith('data-designer-')
      || attribute.name.startsWith('on')
    ) {
      element.removeAttribute(attribute.name)
    }
  }
  if (element.matches('a, button, input, select, textarea, [contenteditable]')) {
    element.setAttribute('tabindex', '-1')
    element.removeAttribute('contenteditable')
  }
}

function replaceMedia(source: Element, clone: Element): void {
  if (!(clone instanceof HTMLElement))
    return
  if (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement || source instanceof HTMLVideoElement) {
    const rect = source.getBoundingClientRect()
    const canvas = document.createElement('canvas')
    canvas.className = clone.className
    canvas.style.cssText = clone.style.cssText
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    canvas.width = Math.max(1, Math.round(rect.width))
    canvas.height = Math.max(1, Math.round(rect.height))
    try {
      canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)
    }
    catch {
      canvas.style.background = getComputedStyle(source).background
    }
    clone.replaceWith(canvas)
  }
  else if (source.matches('audio, iframe')) {
    const placeholder = document.createElement('div')
    placeholder.className = clone.className
    placeholder.style.cssText = clone.style.cssText
    const rect = source.getBoundingClientRect()
    placeholder.style.width = `${rect.width}px`
    placeholder.style.height = `${rect.height}px`
    placeholder.style.background = getComputedStyle(source).background
    clone.replaceWith(placeholder)
  }
}

export function createDesignerDragVisualClone(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  const sourceElements = [source, ...source.querySelectorAll('*')]
  const cloneElements = [clone, ...clone.querySelectorAll('*')]
  sourceElements.forEach((sourceElement, index) => {
    const cloneElement = cloneElements[index]
    if (!cloneElement)
      return
    sanitizeElement(cloneElement)
    replaceMedia(sourceElement, cloneElement)
  })
  clone.style.width = '100%'
  clone.style.height = '100%'
  clone.style.margin = '0'
  clone.style.pointerEvents = 'none'
  return clone
}

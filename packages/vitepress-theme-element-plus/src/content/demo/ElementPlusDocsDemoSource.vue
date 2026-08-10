<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { computeFoldRegions } from './code-fold'

const props = defineProps<{
  foldCodeRegion: string
  foldedLine: string
  foldedLines: string
  source: string
  unfoldCodeRegion: string
}>()

const sourceRef = ref<HTMLElement>()

const chevronSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'

function setupFolding(): void {
  const container = sourceRef.value
  const code = container?.querySelector('pre > code')
  if (!container || !code)
    return

  container.classList.remove('has-fold')
  const lineElements: HTMLElement[] = []
  for (const node of Array.from(code.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (/^\s*$/.test(node.textContent ?? ''))
        node.remove()
    }
    else if (node instanceof HTMLElement && node.classList.contains('line')) {
      node.classList.add('code-line')
      lineElements.push(node)
    }
  }

  const regions = computeFoldRegions(lineElements.map(element => element.textContent ?? ''))
  if (regions.length === 0)
    return

  container.classList.add('has-fold')
  const foldDepths = new Map<HTMLElement, number>()
  const setCovered = (elements: HTMLElement[], folded: boolean): void => {
    for (const element of elements) {
      const depth = (foldDepths.get(element) ?? 0) + (folded ? 1 : -1)
      foldDepths.set(element, depth)
      element.style.display = depth > 0 ? 'none' : ''
    }
  }

  for (const { start, end } of regions) {
    const startElement = lineElements[start]
    if (!startElement)
      continue
    const hiddenElements = lineElements.slice(start + 1, end + 1)

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'code-fold-btn'
    button.setAttribute('aria-expanded', 'true')
    button.setAttribute('aria-label', props.foldCodeRegion)
    button.innerHTML = chevronSvg
    startElement.appendChild(button)

    const toggle = (): void => {
      const folded = startElement.classList.toggle('folded')
      button.setAttribute('aria-expanded', String(!folded))
      button.setAttribute('aria-label', folded ? props.unfoldCodeRegion : props.foldCodeRegion)
      setCovered(hiddenElements, folded)
      if (folded) {
        const count = hiddenElements.length
        const placeholder = document.createElement('button')
        placeholder.type = 'button'
        placeholder.className = 'code-fold-placeholder'
        placeholder.textContent = '\u22ef'
        placeholder.title = (count === 1 ? props.foldedLine : props.foldedLines)
          .replace('{lines}', String(count))
        placeholder.addEventListener('click', toggle)
        startElement.appendChild(placeholder)
      }
      else {
        startElement.querySelector('.code-fold-placeholder')?.remove()
      }
    }
    button.addEventListener('click', toggle)
  }
}

onMounted(setupFolding)
watch(() => props.source, async () => {
  await nextTick()
  setupFolding()
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div ref="sourceRef" class="demo-source-code" v-html="source" />
</template>

<style scoped>
:deep(div[class*='language-']) {
  margin: 0;
  border-radius: 0;
}

:deep(.shiki) {
  padding: 18px 28px;
}

:deep(.code-line) {
  position: relative;
  display: block;
}

:deep(.code-line:empty) {
  min-height: 1lh;
}

.has-fold :deep(.code-fold-btn) {
  position: absolute;
  top: 50%;
  left: -20px;
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-color-lighter);
  cursor: pointer;
  opacity: 0;
  transform: translateY(-50%);
  transition: color 0.15s, opacity 0.15s;
}

.has-fold:hover :deep(.code-fold-btn),
.has-fold :deep(.folded .code-fold-btn),
.has-fold :deep(.code-fold-btn:focus-visible) {
  opacity: 1;
}

.has-fold :deep(.code-fold-btn:hover),
.has-fold :deep(.code-fold-btn:focus-visible) {
  color: var(--brand-color);
  outline: none;
}

.has-fold :deep(.code-fold-btn:focus-visible) {
  border-radius: 2px;
  box-shadow: 0 0 0 1px var(--brand-color);
}

.has-fold :deep(.code-fold-btn svg) {
  transition: transform 0.15s;
}

.has-fold :deep(.folded .code-fold-btn svg) {
  transform: rotate(-90deg);
}

.has-fold :deep(.code-fold-placeholder) {
  display: inline-flex;
  min-width: 24px;
  height: 18px;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  padding: 0 6px;
  border: 0;
  border-radius: 4px;
  background: var(--mx-fill-dark, var(--el-fill-color));
  color: var(--text-color-light);
  cursor: pointer;
  font: inherit;
}

.has-fold :deep(.code-fold-placeholder:hover),
.has-fold :deep(.code-fold-placeholder:focus-visible) {
  background: var(--mx-hover, var(--el-fill-color-dark));
  color: var(--brand-color);
  outline: none;
}
</style>

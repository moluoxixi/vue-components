import type { PageData } from 'vitepress'
import type { TocLinkItem } from '../types'
import { useData } from 'vitepress'
import { nextTick, onMounted, ref, watch } from 'vue'

type Headers = PageData['headers']

interface DocumentHeaderStackItem {
  ignored?: true
  item?: TocLinkItem
  level: number
}

const ignoredHeaderContentRE = /\b(?:VPBadge|header-anchor|footnote-ref|ignore-header)\b/

export function useToc() {
  const { page } = useData()
  const headers = ref(resolveHeaders(page.value.headers))

  const syncDocumentHeaders = () => {
    const container = document.querySelector('.doc-content')
    headers.value = container
      ? resolveDocumentHeaders(container)
      : resolveHeaders(page.value.headers)
  }

  onMounted(() => {
    void nextTick(syncDocumentHeaders)
  })

  watch(
    () => page.value.relativePath,
    () => {
      headers.value = resolveHeaders(page.value.headers)
      void nextTick(syncDocumentHeaders)
    },
    { flush: 'post' },
  )

  return headers
}

export function resolveHeaders(headers: PageData['headers']) {
  return mapHeaders(headers)
}

export function mapHeaders(headers: Headers): TocLinkItem[] {
  return headers.map(header => ({
    text: header.title,
    link: `#${header.slug}`,
    children: header.children?.length ? mapHeaders(header.children) : undefined,
  }))
}

export function resolveDocumentHeaders(container: ParentNode): TocLinkItem[] {
  const headings = Array.from(
    container.querySelectorAll<HTMLHeadingElement>('h2, h3, h4, h5, h6'),
  ).filter(heading => heading.id && heading.hasChildNodes())

  const result: TocLinkItem[] = []
  const stack: DocumentHeaderStackItem[] = []

  for (const heading of headings) {
    const level = Number(heading.tagName.slice(1))

    while (stack.at(-1)?.level >= level)
      stack.pop()

    const parent = stack.at(-1)
    if (heading.classList.contains('ignore-header') || parent?.ignored) {
      stack.push({ level, ignored: true })
      continue
    }

    const item: TocLinkItem = {
      link: `#${heading.id}`,
      text: serializeHeader(heading),
    }

    if (parent?.item)
      (parent.item.children ??= []).push(item)
    else
      result.push(item)

    stack.push({ item, level })
  }

  return result
}

function serializeHeader(heading: HTMLHeadingElement): string {
  let title = ''

  const appendText = (node: Node) => {
    if (node.nodeType === 1 && ignoredHeaderContentRE.test(String((node as Element).className)))
      return

    if (node.nodeType === 3) {
      title += node.textContent ?? ''
      return
    }

    node.childNodes.forEach(appendText)
  }

  heading.childNodes.forEach(appendText)
  return title.trim()
}

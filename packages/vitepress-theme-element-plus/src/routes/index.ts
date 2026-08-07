import type { DocsComponent, DocsLocale } from '../types'

export function createComponentPaths(
  components: DocsComponent[],
  locale: DocsLocale = 'en-US',
  pathPrefix = `/${locale}`,
): Record<string, string> {
  const prefix = pathPrefix === '/' ? '' : pathPrefix.replace(/\/$/, '')
  return Object.fromEntries(components.map((component) => {
    const slug = component.slug ?? component.name.toLowerCase()
    return [slug, `${prefix}/components/${slug}`]
  }))
}

export function renderComponentPage(component: DocsComponent, locale: DocsLocale, body: string): string {
  return `---\ntitle: ${component.title ?? component.name}\ncomponent: ${component.name}\nlocale: ${locale}\n---\n\n${body}`
}

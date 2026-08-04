import type { DocsLocale } from '../.vitepress/docs-site.ts'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDocsMessages } from '../.vitepress/docs-i18n.ts'
import {
  componentSourcePath,
  defaultDocsLocale,
  getDocsLocaleConfig,
} from '../.vitepress/docs-site.ts'

export interface ComponentRoute {
  name: string
  slug: string
  description: string
}

export interface ComponentRoutePath {
  params: {
    slug: string
  }
  content: string
}

export interface SourceDocLayout {
  contentStartLine: number
  introductionEndLine: number
  lastContentLine: number
}

export interface CreateComponentRoutePathsOptions {
  root: string
  components: ComponentRoute[]
  locale?: ComponentRouteLocaleOptions
}

export interface ComponentRouteLocaleOptions {
  sourceDocFile: string
  sourceDocIncludePrefix: string
  headings: {
    api: string
    contributors: string
  }
}

export interface CreateComponentRoutePathsResult {
  paths: ComponentRoutePath[]
  apiOnly: string[]
}

const COMPONENT_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/
const COMPONENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const API_DOCS_TAG_PATTERN = /<\s*(?:ApiDocs|api-docs)\b/

export function createComponentRouteLocaleOptions(locale: DocsLocale): ComponentRouteLocaleOptions {
  const configured = getDocsLocaleConfig(locale)
  const messages = getDocsMessages(locale)
  return {
    sourceDocFile: configured.sourceDoc,
    sourceDocIncludePrefix: configured.sourceDocIncludePrefix,
    headings: {
      api: messages.route.api,
      contributors: messages.route.contributors,
    },
  }
}

const DEFAULT_LOCALE_OPTIONS = createComponentRouteLocaleOptions(defaultDocsLocale)

function sourceDocInclude(
  component: ComponentRoute,
  startLine: number,
  endLine: number,
  locale: ComponentRouteLocaleOptions,
): string {
  return `<!--@include: ${locale.sourceDocIncludePrefix}${componentSourcePath(component.name)}/${locale.sourceDocFile}{${startLine},${endLine}}-->`
}

function analyzeSourceDoc(content: string, component: ComponentRoute): SourceDocLayout {
  const lines = content.split(/\r?\n/)
  let contentStartIndex = 0

  if (lines[0]?.trim() === '---') {
    const frontmatterEndIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
    if (frontmatterEndIndex < 0)
      throw new Error(`component source documentation has unclosed frontmatter: ${component.name}`)
    contentStartIndex = frontmatterEndIndex + 1
  }

  const headingIndex = lines.findIndex((line, index) => index >= contentStartIndex && /^#\s+\S/.test(line.trim()))
  if (headingIndex < 0)
    throw new Error(`component source documentation must declare a level-one heading: ${component.name}`)

  let paragraphStartIndex = headingIndex + 1
  while (paragraphStartIndex < lines.length && !lines[paragraphStartIndex]?.trim())
    paragraphStartIndex += 1

  let introductionEndIndex = headingIndex
  if (paragraphStartIndex < lines.length && !/^#{1,6}\s+/.test(lines[paragraphStartIndex]?.trim() ?? '')) {
    introductionEndIndex = paragraphStartIndex
    while (introductionEndIndex + 1 < lines.length && lines[introductionEndIndex + 1]?.trim())
      introductionEndIndex += 1
  }

  let lastContentIndex = lines.length - 1
  while (lastContentIndex > introductionEndIndex && !lines[lastContentIndex]?.trim())
    lastContentIndex -= 1

  return {
    contentStartLine: contentStartIndex + 1,
    introductionEndLine: introductionEndIndex + 1,
    lastContentLine: lastContentIndex + 1,
  }
}

function assertSafeComponent(component: ComponentRoute): void {
  if (!COMPONENT_NAME_PATTERN.test(component.name))
    throw new Error(`invalid documentation component name: ${component.name}`)
  if (!COMPONENT_SLUG_PATTERN.test(component.slug))
    throw new Error(`invalid documentation component slug: ${component.slug}`)
  if (component.slug === 'index')
    throw new Error('documentation component slug is reserved: index')
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value))
      duplicates.add(value)
    seen.add(value)
  }
  return Array.from(duplicates).sort()
}

export function renderComponentRoute(
  component: ComponentRoute,
  sourceDoc?: SourceDocLayout,
  locale: ComponentRouteLocaleOptions = DEFAULT_LOCALE_OPTIONS,
): string {
  assertSafeComponent(component)

  const content: string[] = []
  if (sourceDoc) {
    content.push(sourceDocInclude(
      component,
      sourceDoc.contentStartLine,
      sourceDoc.introductionEndLine,
      locale,
    ))
  }
  else {
    content.push(`# ${component.name}\n\n${component.description}`)
  }

  content.push(`<ComponentDocMeta name="${component.name}" slug="${component.slug}" :has-source-doc="${Boolean(sourceDoc)}" />`)

  if (sourceDoc && sourceDoc.introductionEndLine < sourceDoc.lastContentLine) {
    content.push(sourceDocInclude(
      component,
      sourceDoc.introductionEndLine + 1,
      sourceDoc.lastContentLine,
      locale,
    ))
  }

  content.push(`## ${locale.headings.api}\n\n<ApiDocs name="${component.name}" />`)
  content.push(`## ${locale.headings.contributors}\n\n<DocContributors name="${component.name}" />`)

  return `${content.join('\n\n')}\n`
}

export function createComponentRoutePaths(
  options: CreateComponentRoutePathsOptions,
): CreateComponentRoutePathsResult {
  const { root, components } = options
  const locale = options.locale ?? DEFAULT_LOCALE_OPTIONS
  components.forEach(assertSafeComponent)

  const duplicateNames = duplicateValues(components.map(component => component.name))
  if (duplicateNames.length > 0)
    throw new Error(`duplicate documentation component names: ${duplicateNames.join(', ')}`)

  const duplicateSlugs = duplicateValues(components.map(component => component.slug))
  if (duplicateSlugs.length > 0)
    throw new Error(`duplicate documentation component slugs: ${duplicateSlugs.join(', ')}`)

  const apiOnly: string[] = []
  const paths = components.map((component) => {
    const sourceDocPath = resolve(root, componentSourcePath(component.name), locale.sourceDocFile)
    const hasSourceDoc = existsSync(sourceDocPath)
    const sourceDocContent = hasSourceDoc ? readFileSync(sourceDocPath, 'utf8') : undefined
    if (sourceDocContent && API_DOCS_TAG_PATTERN.test(sourceDocContent))
      throw new Error(`component source documentation must not declare ApiDocs: ${component.name}`)
    if (!hasSourceDoc)
      apiOnly.push(component.name)

    return {
      params: { slug: component.slug },
      content: renderComponentRoute(
        component,
        sourceDocContent ? analyzeSourceDoc(sourceDocContent, component) : undefined,
        locale,
      ),
    }
  })

  return {
    paths,
    apiOnly: apiOnly.sort(),
  }
}

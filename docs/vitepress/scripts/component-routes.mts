import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

export interface CreateComponentRoutePathsOptions {
  root: string
  components: ComponentRoute[]
}

export interface CreateComponentRoutePathsResult {
  paths: ComponentRoutePath[]
  apiOnly: string[]
}

const COMPONENT_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/
const COMPONENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const API_DOCS_TAG_PATTERN = /<\s*(?:ApiDocs|api-docs)\b/

function sourceDocInclude(component: ComponentRoute): string {
  return `<!--@include: ../../../packages/components/src/${component.name}/docs/index.md-->`
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

export function renderComponentRoute(component: ComponentRoute, hasSourceDoc: boolean): string {
  assertSafeComponent(component)

  const introduction = hasSourceDoc
    ? sourceDocInclude(component)
    : `# ${component.name}\n\n${component.description}`

  return `${introduction}\n\n## API\n\n<ApiDocs name="${component.name}" />\n`
}

export function createComponentRoutePaths(
  options: CreateComponentRoutePathsOptions,
): CreateComponentRoutePathsResult {
  const { root, components } = options
  components.forEach(assertSafeComponent)

  const duplicateNames = duplicateValues(components.map(component => component.name))
  if (duplicateNames.length > 0)
    throw new Error(`duplicate documentation component names: ${duplicateNames.join(', ')}`)

  const duplicateSlugs = duplicateValues(components.map(component => component.slug))
  if (duplicateSlugs.length > 0)
    throw new Error(`duplicate documentation component slugs: ${duplicateSlugs.join(', ')}`)

  const apiOnly: string[] = []
  const paths = components.map((component) => {
    const sourceDocPath = resolve(root, 'packages/components/src', component.name, 'docs/index.md')
    const hasSourceDoc = existsSync(sourceDocPath)
    if (hasSourceDoc && API_DOCS_TAG_PATTERN.test(readFileSync(sourceDocPath, 'utf8')))
      throw new Error(`component source documentation must not declare ApiDocs: ${component.name}`)
    if (!hasSourceDoc)
      apiOnly.push(component.name)

    return {
      params: { slug: component.slug },
      content: renderComponentRoute(component, hasSourceDoc),
    }
  })

  return {
    paths,
    apiOnly: apiOnly.sort(),
  }
}

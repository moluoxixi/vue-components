import type { SourceTextFile } from '@moluoxixi/config-form-source/generator'
import { parse as parseModule } from '@babel/parser'
import { parse as parseVue } from 'vue/compiler-sfc'

interface SyntaxNode {
  type: string
  start?: number | null
  end?: number | null
  [key: string]: unknown
}

interface SourceEdit {
  start: number
  end: number
  text: string
}

function isNode(value: unknown): value is SyntaxNode {
  return typeof value === 'object' && value !== null && 'type' in value
}

function visitNodes(node: unknown, visit: (node: SyntaxNode) => void): void {
  if (!isNode(node))
    return
  visit(node)
  Object.values(node).forEach((value) => {
    if (Array.isArray(value))
      value.filter(isNode).forEach(child => visitNodes(child, visit))
    else if (isNode(value))
      visitNodes(value, visit)
  })
}

function applyEdits(content: string, edits: readonly SourceEdit[]): string {
  return [...edits]
    .sort((left, right) => right.start - left.start)
    .reduce((source, edit) => source.slice(0, edit.start) + edit.text + source.slice(edit.end), content)
}

function normalizePath(path: string): string {
  const segments: string[] = []
  path.split('/').forEach((segment) => {
    if (segment === '..')
      segments.pop()
    else if (segment && segment !== '.')
      segments.push(segment)
  })
  return segments.join('/')
}

function relativePath(from: string, to: string): string {
  const source = from.split('/').slice(0, -1)
  const target = to.split('/')
  while (source.length && target.length && source[0] === target[0]) {
    source.shift()
    target.shift()
  }
  const relative = [...source.map(() => '..'), ...target].join('/')
  return relative.startsWith('.') ? relative : `./${relative}`
}

function rewriteSpecifier(
  specifier: string,
  path: string,
  paths: ReadonlyMap<string, string>,
  assetUrl = false,
): string {
  if (!specifier.startsWith('./') && !specifier.startsWith('../') && !specifier.startsWith('@/'))
    return specifier
  const suffixIndex = specifier.search(/[?#]/u)
  const suffix = suffixIndex === -1 ? '' : specifier.slice(suffixIndex)
  const modulePath = suffixIndex === -1 ? specifier : specifier.slice(0, suffixIndex)
  const resolved = modulePath.startsWith('@/')
    ? `src/${modulePath.slice(2)}`
    : normalizePath(`${path.slice(0, path.lastIndexOf('/'))}/${modulePath}`)
  const candidates = assetUrl
    ? [resolved]
    : [resolved, ...['.ts', '.tsx', '.js', '.jsx', '.vue', '/index.ts', '/index.js'].map(extension => resolved + extension)]
  const target = candidates.map(candidate => paths.get(candidate)).find(Boolean)
  if (!target)
    return specifier
  if (assetUrl || !target.startsWith('src/'))
    return relativePath(paths.get(path) ?? path, target) + suffix
  const alias = target.slice('src/'.length)
    .replace(/\.[cm]?[jt]sx?$/u, '')
    .replace(/\/index$/u, '')
  return `@/${alias}${suffix}`
}

function importSource(node: SyntaxNode): SyntaxNode | undefined {
  let source: unknown
  if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
    source = node.source
  }
  else if (node.type === 'ImportExpression') {
    source = node.source
  }
  else if (node.type === 'TSImportType') {
    source = node.argument
  }
  return isNode(source) && source.type === 'StringLiteral' ? source : undefined
}

function assetSource(node: SyntaxNode): SyntaxNode | undefined {
  if (node.type !== 'NewExpression' || !isNode(node.callee) || node.callee.type !== 'Identifier' || node.callee.name !== 'URL')
    return undefined
  const [source, base] = Array.isArray(node.arguments) ? node.arguments : []
  if (!isNode(base) || base.type !== 'MemberExpression' || !isNode(base.object) || base.object.type !== 'MetaProperty'
    || !isNode(base.object.meta) || base.object.meta.name !== 'import'
    || !isNode(base.property) || base.property.name !== 'url') {
    return undefined
  }
  return isNode(source) && source.type === 'StringLiteral' ? source : undefined
}

function moduleEdits(
  content: string,
  path: string,
  paths: ReadonlyMap<string, string>,
  offset = 0,
): SourceEdit[] {
  const ast = parseModule(content, { sourceType: 'module', plugins: ['typescript', 'jsx'], createImportExpressions: true })
  const edits: SourceEdit[] = []
  visitNodes(ast, (node) => {
    const imported = importSource(node)
    const source = imported ?? assetSource(node)
    if (!source || typeof source.value !== 'string' || typeof source.start !== 'number' || typeof source.end !== 'number')
      return
    const rewritten = rewriteSpecifier(source.value, path, paths, !imported)
    if (rewritten === source.value)
      return
    const quote = content[source.start] === '"' ? '"' : '\''
    edits.push({
      start: offset + source.start,
      end: offset + source.end,
      text: `${quote}${rewritten.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)}${quote}`,
    })
  })
  return edits
}

function objectProperty(node: unknown, name: string): SyntaxNode | undefined {
  return isNode(node) && Array.isArray(node.properties)
    ? node.properties.filter(isNode).find(property => property.type === 'ObjectProperty' && !property.computed
      && isNode(property.key) && (property.key.name === name || property.key.value === name))
    : undefined
}

function objectValue(property: SyntaxNode | undefined): SyntaxNode | undefined {
  return property && isNode(property.value) && property.value.type === 'ObjectExpression'
    ? property.value
    : undefined
}

function viteAliasSource(content: string): string {
  const ast = parseModule(content, { sourceType: 'module', plugins: ['typescript'] })
  const exported = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration')
  const declaration = exported?.type === 'ExportDefaultDeclaration' ? exported.declaration : undefined
  const config = declaration?.type === 'CallExpression' ? declaration.arguments[0] : declaration
  if (!config || config.type !== 'ObjectExpression' || typeof config.start !== 'number')
    throw new TypeError('The generated Vite configuration must export an object configuration.')
  const existingHelper = ast.program.body.flatMap(node => node.type === 'ImportDeclaration' && node.source.value === 'node:url'
    ? node.specifiers.filter(specifier => specifier.type === 'ImportSpecifier'
      && (specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value) === 'fileURLToPath')
    : []).at(0)?.local.name
  const helper = existingHelper ?? 'fileURLToPath'
  const alias = `${helper}(new URL('./src', import.meta.url))`
  const edits: SourceEdit[] = []
  const resolveProperty = objectProperty(config, 'resolve')
  const resolve = objectValue(resolveProperty)
  const aliasProperty = resolve ? objectProperty(resolve, 'alias') : undefined
  const aliases = objectValue(aliasProperty)
  const sourceAlias = aliases ? objectProperty(aliases, '@') : undefined
  if ((resolveProperty && !resolve) || (aliasProperty && !aliases))
    throw new TypeError('The generated Vite resolve and alias options must be object configurations.')
  if (sourceAlias && isNode(sourceAlias.value) && typeof sourceAlias.value.start === 'number' && typeof sourceAlias.value.end === 'number') {
    edits.push({ start: sourceAlias.value.start, end: sourceAlias.value.end, text: alias })
  }
  else if (typeof aliases?.start === 'number') {
    edits.push({ start: aliases.start + 1, end: aliases.start + 1, text: `\n      '@': ${alias},` })
  }
  else if (typeof resolve?.start === 'number') {
    edits.push({ start: resolve.start + 1, end: resolve.start + 1, text: `\n    alias: { '@': ${alias} },` })
  }
  else {
    edits.push({ start: config.start + 1, end: config.start + 1, text: `\n  resolve: {\n    alias: { '@': ${alias} },\n  },` })
  }
  const rewritten = applyEdits(content, edits)
  return existingHelper ? rewritten : `import { fileURLToPath } from 'node:url'\n${rewritten}`
}

/** Rewrite module references only, preserving templates, comments, and data strings. */
export function rewriteStructuredSourceText(file: SourceTextFile, paths: ReadonlyMap<string, string>): string {
  const { path, content } = file
  if (path === 'tsconfig.json') {
    const config = JSON.parse(content) as {
      compilerOptions?: { paths?: Record<string, string[]>, [key: string]: unknown }
      [key: string]: unknown
    }
    config.compilerOptions = {
      ...config.compilerOptions,
      baseUrl: '.',
      paths: { ...config.compilerOptions?.paths, '@/*': ['src/*'] },
    }
    return `${JSON.stringify(config, null, 2)}\n`
  }
  if (path === 'vite.config.ts')
    return viteAliasSource(content)
  if (path.endsWith('.vue')) {
    const { descriptor, errors } = parseVue(content, { filename: path })
    if (errors.length)
      throw new TypeError(`Unable to parse generated Vue source: ${path}`)
    const edits = [descriptor.script, descriptor.scriptSetup].flatMap(block => block
      ? moduleEdits(block.content, path, paths, block.loc.start.offset)
      : [])
    return applyEdits(content, edits)
  }
  if (/\.[cm]?[jt]sx?$/u.test(path))
    return applyEdits(content, moduleEdits(content, path, paths))
  return content
}

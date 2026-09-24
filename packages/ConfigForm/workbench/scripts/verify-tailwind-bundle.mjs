import { readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const outputRoot = resolve(root, 'dist')
const basePath = normalizeBasePath(process.env.CONFIG_FORM_WORKBENCH_BASE ?? '/')
const indexCss = readEntryCss('index.html')
const runtimeHostCss = readEntryCss('runtime-host.html')

const requiredUtilities = [
  ['display utility', /\.flex\{display:flex\}/],
  ['column layout utility', /\.flex-col\{flex-direction:column\}/],
  ['minimum-height utility', /\.min-h-0\{min-height:0\}/],
  ['semantic background utility', /\.bg-wb-editor-surface\{background-color:var\(--wb-editor-surface\)\}/],
  ['semantic text utility', /\.text-wb-accent-text\{color:var\(--wb-accent-text\)\}/],
  ['semantic muted-text utility', /\.text-wb-muted\{color:var\(--wb-muted\)\}/],
  ['semantic strong-text utility', /\.text-wb-text-strong\{color:var\(--wb-text-strong\)\}/],
]

for (const [name, pattern] of requiredUtilities) {
  if (!pattern.test(indexCss))
    throw new Error(`Workbench build emitted no Tailwind ${name}.`)
}

const forbiddenPatterns = [
  ['an unexpanded Tailwind directive', /@(?:source|tailwind|theme)\b/],
  ['the Tailwind Preflight form-control reset', /::file-selector-button\s*\{[^}]*box-sizing\s*:\s*border-box/],
  ['a utility from automatic repository scanning', /\.hidden\{display:none\}/],
]

for (const [name, pattern] of forbiddenPatterns) {
  if (pattern.test(indexCss))
    throw new Error(`Workbench build unexpectedly contains ${name}.`)
}

for (const [name, pattern] of requiredUtilities.slice(3)) {
  if (pattern.test(runtimeHostCss))
    throw new Error(`Runtime Host CSS unexpectedly contains Workbench Tailwind ${name}.`)
}

function normalizeBasePath(value) {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

function outputPath(url) {
  if (!url.startsWith('/'))
    return url.replace(/^\.\//, '')
  if (!url.startsWith(basePath))
    throw new Error(`Workbench asset URL is outside configured base ${basePath}: ${url}`)
  return url.slice(basePath.length)
}

function readEntryCss(entry) {
  const html = readFileSync(resolve(outputRoot, entry), 'utf8')
  const stylesheets = [...html.matchAll(/<link\b([^>]*)>/gi)]
    .filter(([, attributes]) => /\brel=["']stylesheet["']/i.test(attributes ?? ''))
    .map(([, attributes]) => /\bhref=["']([^"']+)["']/i.exec(attributes ?? '')?.[1])
    .filter(Boolean)
    .map(outputPath)

  if (stylesheets.length === 0)
    throw new Error(`Workbench build entry ${entry} references no stylesheets.`)

  return stylesheets
    .map(file => readFileSync(resolveOutputFile(file), 'utf8'))
    .join('\n')
}

function resolveOutputFile(file) {
  const target = resolve(outputRoot, file)
  const outputRelativePath = relative(outputRoot, target)
  if (outputRelativePath === '..' || outputRelativePath.startsWith(`..${sep}`) || isAbsolute(outputRelativePath))
    throw new Error(`Workbench asset URL escapes the build output: ${file}`)
  return target
}

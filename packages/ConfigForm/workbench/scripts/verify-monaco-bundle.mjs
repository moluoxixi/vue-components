import { readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const outputRoot = resolve(root, 'dist')
const assetsRoot = resolve(outputRoot, 'assets')
const html = readFileSync(resolve(outputRoot, 'index.html'), 'utf8')
const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)]
const entryTag = scriptTags.find(([, attributes]) => /\btype=["']module["']/i.test(attributes ?? ''))
const entrySource = /\bsrc=["']([^"']+)["']/i.exec(entryTag?.[1] ?? '')?.[1]

if (!entrySource)
  throw new Error('Workbench build has no module entry script.')

const entryFile = entrySource.replace(/^\/+/, '')
const monacoMarkers = [
  'MonacoEnvironment',
  'inmemory://config-form-workbench/',
  'editor.worker',
  'ts.worker',
]

const initialJavaScript = new Set([entryFile])
for (const [, attributes] of [...html.matchAll(/<link\b([^>]*)>/gi)]) {
  if (!/\brel=["']modulepreload["']/i.test(attributes ?? ''))
    continue
  const href = /\bhref=["']([^"']+)["']/i.exec(attributes ?? '')?.[1]
  if (href?.endsWith('.js'))
    initialJavaScript.add(href.replace(/^\/+/, ''))
}

const pending = [...initialJavaScript]
while (pending.length) {
  const file = pending.pop()
  if (!file)
    continue
  const source = readFileSync(resolve(outputRoot, file), 'utf8')
  const imports = [
    ...source.matchAll(/\b(?:import|export)[^"'();]+\bfrom\s*["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\s*["']([^"']+)["']/g),
  ]
  for (const match of imports) {
    const specifier = match[1]
    if (!specifier?.endsWith('.js') || (!specifier.startsWith('.') && !specifier.startsWith('/')))
      continue
    const dependency = relative(outputRoot, resolve(outputRoot, dirname(file), specifier)).replaceAll('\\', '/')
    if (!initialJavaScript.has(dependency)) {
      initialJavaScript.add(dependency)
      pending.push(dependency)
    }
  }
}

for (const file of initialJavaScript) {
  const source = readFileSync(resolve(outputRoot, file), 'utf8')
  for (const marker of monacoMarkers) {
    if (source.includes(marker))
      throw new Error(`Workbench initial module graph contains Monaco marker ${marker} in ${file}`)
  }
}

const asyncJavaScript = readdirSync(assetsRoot)
  .filter(file => file.endsWith('.js') && !initialJavaScript.has(`assets/${file}`))
  .map(file => readFileSync(resolve(assetsRoot, file), 'utf8'))

if (!asyncJavaScript.some(source => source.includes('inmemory://config-form-workbench/')))
  throw new Error('Workbench build emitted no async WorkspaceCodeEditor chunk.')

import { readFileSync, realpathSync, statSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { compileScript, parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import { docsLocales, docsSite } from '../../docs-site'
import { supportedLocalSfcModules } from '../../theme/content'

const workspaceRoot = resolve(process.cwd(), '../..')
const componentSourceRoot = resolve(workspaceRoot, docsSite.source.componentRoot)
const componentSourceDocs = [...new Set(Object.values(docsLocales).map(locale => locale.sourceDoc))]
const vueBuiltIns = new Set(['Component', 'KeepAlive', 'Suspense', 'Teleport', 'Transition', 'TransitionGroup'])
const demoRuntimeModules = new Set<string>(supportedLocalSfcModules)

interface ImportDeclarationNode {
  type: 'ImportDeclaration'
  importKind?: 'type' | 'value'
  source: { value: string }
  specifiers: Array<{
    importKind?: 'type' | 'value'
    local: { name: string }
  }>
}

function toPascalCase(value: string): string {
  return value.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')
}

function extractVueDemos(markdown: string): string[] {
  const demos: string[] = []
  let current: string[] | null = null
  let closingFence = ''

  for (const line of markdown.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    const fence = current === null
      ? trimmedLine.match(/^(`{3,}|~{3,})/)
      : null
    const fenceInfo = fence ? trimmedLine.slice(fence[1]!.length).trim() : ''
    const opening = fence && /^vue(?:\s|$)/i.test(fenceInfo) ? fence : null
    if (opening) {
      current = []
      closingFence = opening[1] ?? ''
      continue
    }
    if (
      current !== null
      && new RegExp(`^\\s*${closingFence.charAt(0)}{${closingFence.length},}\\s*$`).test(line)
    ) {
      demos.push(current.join('\n'))
      current = null
      closingFence = ''
      continue
    }
    current?.push(line)
  }

  return demos
}

function findComponentTags(template: string): string[] {
  return [...template.matchAll(/<\/?([a-z][\w.-]*)(?=[\s/>])/gi)]
    .map((match) => {
      const tag = match[1] ?? ''
      if (!/^[A-Z]/.test(tag) && !tag.includes('-'))
        return ''
      return tag.includes('.') ? tag.split('.')[0] ?? '' : toPascalCase(tag)
    })
    .filter(tag => tag && !vueBuiltIns.has(tag))
}

interface RuntimeImports {
  bindings: Map<string, string>
  modules: Set<string>
}

function collectRuntimeImports(compiled: ReturnType<typeof compileScript>): RuntimeImports {
  const bindings = new Map<string, string>()
  const modules = new Set<string>()
  const nodes = [
    ...(compiled.scriptAst ?? []),
    ...(compiled.scriptSetupAst ?? []),
  ] as ImportDeclarationNode[]

  for (const node of nodes) {
    if (node.type !== 'ImportDeclaration' || node.importKind === 'type')
      continue
    modules.add(node.source.value)
    for (const specifier of node.specifiers) {
      if (specifier.importKind !== 'type')
        bindings.set(specifier.local.name, node.source.value)
    }
  }

  return { bindings, modules }
}

async function collectVueFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory()
      ? collectVueFiles(path)
      : Promise.resolve(entry.name.endsWith('.vue') ? [path] : [])
  }))

  return nestedFiles.flat()
}

describe('browser-compiled component demos', () => {
  it('recognizes attributed fences and rejects non-import kebab-case bindings', () => {
    const [source] = extractVueDemos(`~~~vue [demo]
<template><request-select-v2 /></template>
<script setup lang="ts">
const RequestSelectV2 = {}
</script>
~~~`)

    expect(source).toBeTruthy()
    const filename = 'attributed-kebab-case-demo.vue'
    const { descriptor, errors } = parse(source!, { filename })
    expect(errors).toEqual([])
    const imports = collectRuntimeImports(compileScript(descriptor, { id: filename }))
    const missing = findComponentTags(descriptor.template?.content ?? '')
      .filter(tag => !demoRuntimeModules.has(imports.bindings.get(tag) ?? ''))

    expect(missing).toEqual(['RequestSelectV2'])
  })

  it('rejects runtime imports outside the browser compiler module cache', () => {
    const [source] = extractVueDemos(`\`\`\`vue
<template><CopyText /></template>
<script setup lang="ts">
import { CopyText } from '@moluoxixi/components/CopyText'
</script>
\`\`\``)
    const filename = 'unsupported-module-demo.vue'
    const { descriptor } = parse(source!, { filename })
    const imports = collectRuntimeImports(compileScript(descriptor, { id: filename }))

    expect([...imports.modules].filter(module => !demoRuntimeModules.has(module)))
      .toEqual(['@moluoxixi/components/CopyText'])
  })

  it('explicitly bind every component used by a Vue demo', async () => {
    const componentDirectories = await readdir(componentSourceRoot, { withFileTypes: true })
    const failures: string[] = []

    for (const directory of componentDirectories.filter(entry => entry.isDirectory())) {
      for (const sourceDoc of componentSourceDocs) {
        const docsPath = resolve(componentSourceRoot, directory.name, sourceDoc)
        let markdown: string
        try {
          markdown = await readFile(docsPath, 'utf8')
        }
        catch {
          continue
        }

        for (const [demoIndex, source] of extractVueDemos(markdown).entries()) {
          const localeSuffix = sourceDoc.replace(/[^a-z]+/gi, '-')
          const filename = `${directory.name}-${localeSuffix}-demo-${demoIndex + 1}.vue`
          const { descriptor, errors } = parse(source, { filename })
          if (errors.length > 0) {
            failures.push(`${filename}: ${errors.map(String).join('; ')}`)
            continue
          }

          const imports = descriptor.scriptSetup || descriptor.script
            ? collectRuntimeImports(compileScript(descriptor, { id: filename }))
            : { bindings: new Map<string, string>(), modules: new Set<string>() }
          const missing = [...new Set(findComponentTags(descriptor.template?.content ?? ''))]
            .filter(tag => !demoRuntimeModules.has(imports.bindings.get(tag) ?? ''))
          const unsupportedModules = [...imports.modules]
            .filter(module => !demoRuntimeModules.has(module))

          if (missing.length > 0)
            failures.push(`${filename}: missing ${missing.join(', ')}`)
          if (unsupportedModules.length > 0)
            failures.push(`${filename}: unsupported modules ${unsupportedModules.join(', ')}`)
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([])
  })

  it('explicitly imports Element Plus components used by package SFCs', async () => {
    const failures: string[] = []

    for (const filename of await collectVueFiles(componentSourceRoot)) {
      const source = await readFile(filename, 'utf8')
      const { descriptor, errors } = parse(source, { filename })
      if (errors.length > 0) {
        failures.push(`${filename}: ${errors.map(String).join('; ')}`)
        continue
      }

      const elementTags = [...new Set(findComponentTags(descriptor.template?.content ?? ''))]
        .filter(tag => tag.startsWith('El'))
      if (elementTags.length === 0)
        continue

      const imports = descriptor.scriptSetup || descriptor.script
        ? collectRuntimeImports(compileScript(descriptor, {
            id: filename,
            fs: {
              fileExists: (file) => {
                try {
                  return statSync(file).isFile()
                }
                catch {
                  return false
                }
              },
              readFile: file => readFileSync(file, 'utf8'),
              realpath: realpathSync,
            },
          }))
        : { bindings: new Map<string, string>(), modules: new Set<string>() }
      const missing = elementTags.filter(tag => imports.bindings.get(tag) !== 'element-plus')

      if (missing.length > 0)
        failures.push(`${filename}: missing ${missing.join(', ')}`)
    }

    expect(failures, failures.join('\n')).toEqual([])
  })
})

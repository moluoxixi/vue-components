import { readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { createModuleGraph } from '../package-architecture/services/module-graph.mjs'

const root = resolve(import.meta.dirname, '../..')
function inside(file, directory) {
  const path = relative(directory, file)
  return !path.startsWith('..') && !isAbsolute(path)
}

describe('configForm dependency direction', () => {
  it.each([
    ['core', /^(?:vue|zod|@moluoxixi\/config-form(?:-|$))/],
    ['model', /^(?:vue|@moluoxixi\/config-form(?:$|-designer|-compiler|-vue-backend))/],
    ['compiler', /^(?:vue|@moluoxixi\/config-form(?:$|-designer|-vue-backend))/],
    ['designer', /^@moluoxixi\/config-form(?:$|\/|-vue-backend)/],
  ])('%s has no forbidden production or type dependency', (name, forbidden) => {
    const source = resolve(root, 'packages/ConfigForm', name, 'src')
    const graph = createModuleGraph(source)
    const hits = []
    for (const [file, module] of graph.modules) {
      if (file.includes('__tests__') || file.endsWith('.d.ts'))
        continue
      const visit = (node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
          && ts.isStringLiteralLike(node.moduleSpecifier) && forbidden.test(node.moduleSpecifier.text)) {
          hits.push(`${relative(root, file)}: ${node.moduleSpecifier.text}`)
        }
        if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
          && ts.isStringLiteralLike(node.argument.literal) && forbidden.test(node.argument.literal.text)) {
          hits.push(`${relative(root, file)}: ${node.argument.literal.text}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(module.sourceFile)
      for (const specifier of module.specifiers) {
        if (forbidden.test(specifier))
          hits.push(`${relative(root, file)}: ${specifier}`)
      }
      for (const dependency of module.dependencies) {
        if (inside(dependency, resolve(root, 'packages/ConfigForm')) && !inside(dependency, source))
          hits.push(`${relative(root, file)}: private cross-package import ${relative(root, dependency)}`)
      }
    }
    const manifest = JSON.parse(readFileSync(resolve(source, '../package.json'), 'utf8'))
    for (const key of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })) {
      if (forbidden.test(key))
        hits.push(`manifest: ${key}`)
    }
    expect(hits).toEqual([])
  })

  it('keeps Workbench lazy features independent of the app composition root', () => {
    const source = resolve(root, 'packages/ConfigForm/workbench/src')
    const graph = createModuleGraph(source)
    const app = resolve(source, 'app')
    const hits = []
    for (const [file, module] of graph.modules) {
      if (!inside(file, resolve(source, 'features')) || file.includes('__tests__'))
        continue
      for (const dependency of module.dependencies) {
        if (inside(dependency, app))
          hits.push(`${relative(root, file)} -> ${relative(root, dependency)}`)
      }
    }
    expect(hits).toEqual([])
  })
})

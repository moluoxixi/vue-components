import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, relative, resolve } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const packagesRoot = resolve(repositoryRoot, 'packages')
const docsManifest = JSON.parse(readFileSync(
  resolve(repositoryRoot, 'docs/vitepress/package.json'),
  'utf8',
))
const rootManifest = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'))
const gitignore = readFileSync(resolve(repositoryRoot, '.gitignore'), 'utf8')
const docsVitepressConfig = readFileSync(
  resolve(repositoryRoot, 'docs/vitepress/.vitepress/config.ts'),
  'utf8',
)
const declarationFinalizer = resolve(repositoryRoot, 'scripts/finalize-published-declarations.mjs')
const declarationFinalizerPackages = [
  '@moluoxixi/ai-doc-assistant',
  '@moluoxixi/ai-provider',
  '@moluoxixi/components',
  '@moluoxixi/config-form',
  '@moluoxixi/config-form-antd-vue',
  '@moluoxixi/config-form-core',
  '@moluoxixi/config-form-compiler',
  '@moluoxixi/config-form-model',
  '@moluoxixi/config-form-designer',
  '@moluoxixi/config-form-designer-antd-vue',
  '@moluoxixi/config-form-designer-element-plus',
  '@moluoxixi/config-form-devtools-vite-plugin',
  '@moluoxixi/config-form-element',
  '@moluoxixi/config-form-headless',
  '@moluoxixi/config-form-plugin-antd-vue',
  '@moluoxixi/config-form-plugin-element-plus',
  '@moluoxixi/config-form-vue-backend',
  '@moluoxixi/hooks',
  '@moluoxixi/i18n-tool',
  '@moluoxixi/rich-text-editor',
  '@moluoxixi/vitepress-theme-element-plus',
  '@moluoxixi/zod3-to-rule',
]
const componentsDeepImportExceptions = [
  ['ConfigTable/src/types/emits.ts', '../../../HeadlessTable/src/types'],
  ['ConfigTable/src/types/props.ts', '../../../HeadlessTable/src/types'],
  ['ConfigTable/src/types/table.ts', '../../../HeadlessTable/src/types'],
  ['CopyText/src/types/props.ts', '../../../HeadlessCopyText'],
  ['CopyText/src/types/slots.ts', '../../../HeadlessCopyText'],
  ['HeadlessTable/__tests__/HeadlessTable.type.test.ts', '../../../index'],
  ['PopoverTableSelect/src/types/props.ts', '../../../ConfigTable'],
  ['PopoverTableSelect/src/types/props.ts', '../../../utils'],
  ['RequestCascader/src/types/emits.ts', '../../../request/types'],
  ['RequestCascader/src/types/expose.ts', '../../../request/types'],
  ['RequestCascader/src/types/props.ts', '../../../request/types'],
  ['RequestSelectV2/src/types/emits.ts', '../../../request/types'],
  ['RequestSelectV2/src/types/expose.ts', '../../../request/types'],
  ['RequestSelectV2/src/types/props.ts', '../../../request/types'],
  ['RequestTreeSelect/src/types/emits.ts', '../../../request/types'],
  ['RequestTreeSelect/src/types/expose.ts', '../../../request/types'],
  ['RequestTreeSelect/src/types/props.ts', '../../../request/types'],
]

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? walkFiles(path) : [path]
  })
}

function getScriptSource(file) {
  const source = readFileSync(file, 'utf8')
  if (extname(file) !== '.vue')
    return source

  const { descriptor } = parse(source, { filename: file })
  return [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n')
}

function collectModuleSpecifiers(file) {
  const source = getScriptSource(file)
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const specifiers = []
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    }
    else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return specifiers
}

describe('repository path conventions', () => {
  it('builds component runtime assets before consumers that bundle them', () => {
    const workspaceBuild = docsManifest.scripts['build:workspace-packages']
    const workspaceContentBuild = docsManifest.scripts['build:workspace-content-packages']
    const componentBuild = workspaceContentBuild.indexOf('pnpm build:workspace-components')
    const aiDocBuild = workspaceContentBuild.indexOf('pnpm build:workspace-ai-doc')
    const extractBuild = docsManifest.scripts['preextract-api']
    const extractComponentBuild = extractBuild.indexOf('pnpm build:workspace-components')
    const extractAiDocBuild = extractBuild.indexOf('pnpm --filter @moluoxixi/ai-doc-assistant build')

    expect(componentBuild).toBeGreaterThanOrEqual(0)
    expect(aiDocBuild).toBeGreaterThan(componentBuild)
    expect(workspaceBuild).toContain('pnpm build:workspace-content-packages')
    expect(workspaceBuild).toContain('pnpm build:workspace-theme')
    expect(extractComponentBuild).toBeGreaterThanOrEqual(0)
    expect(extractAiDocBuild).toBeGreaterThan(extractComponentBuild)
  })

  it('waits for workspace dependencies before the documentation build', () => {
    const turboConfig = JSON.parse(readFileSync(resolve(repositoryRoot, 'turbo.json'), 'utf8'))

    expect(turboConfig.tasks['@moluoxixi/docs#build'].dependsOn).toEqual(['^build'])
    expect(turboConfig.tasks['@moluoxixi/docs#test'].dependsOn).toEqual(['^build'])
    expect(turboConfig.tasks['@moluoxixi/docs#typecheck'].dependsOn).toEqual(['^build'])
  })

  it('keeps generated documentation artifacts in one ignored lifecycle directory', () => {
    expect(gitignore).toContain('**/.generated/')
    expect(gitignore).not.toContain('/docs/vitepress/.vitepress/api/')
    expect(docsManifest.scripts.predev).toBe('pnpm build:workspace-theme')
    const workspaceThemeCli = 'node ../../packages/vitepress-theme-element-plus/dist/element-plus-docs.js'
    expect(docsManifest.scripts.dev).toBe(`${workspaceThemeCli} dev`)
    expect(docsManifest.scripts.prebuild).toBe('pnpm build:workspace-theme')
    expect(docsManifest.scripts.build).toBe(`${workspaceThemeCli} build`)
    expect(docsManifest.scripts['preprepare:docs']).toBe('pnpm build:workspace-theme')
    expect(docsManifest.scripts['prepare:docs']).toBe(`${workspaceThemeCli} prepare`)
    expect(docsManifest.scripts).not.toHaveProperty('sync-local-metadata:staged')
    expect(rootManifest.scripts['build:docs']).toBe('pnpm -C docs/vitepress build')
    expect(rootManifest.scripts['pre-commit']).not.toContain('metadata')
    expect(docsVitepressConfig).toContain(`srcDir: '.generated/content'`)
    expect(docsVitepressConfig).toContain('createElementPlusDocsContentRewrites(projectConfig)')

    for (const directory of [
      'docs/vitepress/zh/components',
      'docs/vitepress/zh/utils',
      'docs/vitepress/en/components',
      'docs/vitepress/en/utils',
    ]) {
      expect(readdirSync(resolve(repositoryRoot, directory))).toEqual(['index.md'])
    }

    for (const obsoleteRoute of [
      'docs/vitepress/components/copy-text.md',
      'docs/vitepress/utils/utils.md',
      'docs/vitepress/en/components/copy-text.md',
      'docs/vitepress/en/utils/utils.md',
    ]) {
      expect(existsSync(resolve(repositoryRoot, obsoleteRoute)), obsoleteRoute).toBe(false)
    }

    for (const oldPath of [
      'docs/vitepress/.vitepress/api',
      'docs/vitepress/.vitepress/auto-imports.d.ts',
      'docs/vitepress/.vitepress/components.d.ts',
      'docs/vitepress/.vitepress/github-metadata.json',
      'docs/vitepress/.vitepress/gitlab-metadata.json',
      'docs/vitepress/.vitepress/gitee-metadata.json',
      'docs/vitepress/.vitepress/local-metadata.json',
      'docs/vitepress/.vitepress/yunxiao-metadata.json',
    ]) {
      expect(existsSync(resolve(repositoryRoot, oldPath)), oldPath).toBe(false)
    }
  })

  it('requires an explicit declaration package manifest', () => {
    const result = spawnSync(process.execPath, [declarationFinalizer], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'Usage: pnpm -w finalize:declarations --manifest <package.json>',
    )
  })

  it('derives the declaration package from its manifest instead of cwd', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'finalize-declarations-'))
    const packageRoot = resolve(fixtureRoot, 'package')
    const callerRoot = resolve(fixtureRoot, 'caller')
    const declarationRoot = resolve(packageRoot, 'dist')
    const manifestPath = resolve(packageRoot, 'package.json')
    const entryPath = resolve(declarationRoot, 'index.d.ts')

    try {
      mkdirSync(declarationRoot, { recursive: true })
      mkdirSync(callerRoot)
      writeFileSync(manifestPath, JSON.stringify({
        name: '@fixture/declarations',
        exports: {},
      }))
      writeFileSync(resolve(declarationRoot, 'dependency.d.ts'), 'export interface Value {}\n')
      writeFileSync(entryPath, 'export type { Value } from \'./dependency\'\n')

      const result = spawnSync(
        process.execPath,
        [declarationFinalizer, '--manifest', manifestPath],
        { cwd: callerRoot, encoding: 'utf8' },
      )

      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Finalized 1 declaration specifiers')
      expect(readFileSync(entryPath, 'utf8')).toContain('from \'./dependency.js\'')
    }
    finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  })

  it('routes declaration postbuilds through the workspace-root command', () => {
    const manifests = walkFiles(packagesRoot)
      .filter(file => file.endsWith('package.json'))
      .map(file => ({ file, manifest: JSON.parse(readFileSync(file, 'utf8')) }))
    const declarationPostbuilds = manifests.filter(({ manifest }) => (
      manifest.scripts?.postbuild?.includes('finalize')
    ))

    expect(declarationPostbuilds.map(({ manifest }) => manifest.name).sort())
      .toEqual([...declarationFinalizerPackages].sort())
    for (const { manifest } of declarationPostbuilds) {
      expect(manifest.scripts.postbuild).toContain(
        'pnpm -w finalize:declarations --manifest "$npm_package_json"',
      )
      expect(manifest.scripts.postbuild).not.toContain('../scripts/')
    }
  })

  it('uses package-owned private imports for components cross-module imports', () => {
    const componentsManifest = JSON.parse(readFileSync(
      resolve(packagesRoot, 'components/package.json'),
      'utf8',
    ))
    expect(componentsManifest.imports).toEqual({
      '#components/*': {
        source: './src/*/index.ts',
        types: './dist/src/*/index.d.ts',
        default: './src/*/index.ts',
      },
    })

    const componentsSource = resolve(packagesRoot, 'components/src')
    const deepRelativeImports = walkFiles(componentsSource)
      .filter(file => ['.ts', '.tsx', '.vue'].includes(extname(file)))
      .flatMap((file) => {
        const modulePath = relative(componentsSource, file).replaceAll('\\', '/')
        return collectModuleSpecifiers(file)
          .filter(specifier => /^(?:\.\.\/){3}/.test(specifier))
          .map(specifier => [modulePath, specifier])
      })
    const uniqueDeepRelativeImports = [...new Map(
      deepRelativeImports.map(item => [JSON.stringify(item), item]),
    ).values()]

    expect(uniqueDeepRelativeImports.sort()).toEqual([...componentsDeepImportExceptions].sort())
  })

  it('aligns TypeScript with source-condition package resolution', () => {
    const themeTsconfig = JSON.parse(readFileSync(
      resolve(packagesRoot, 'vitepress-theme-element-plus/tsconfig.base.json'),
      'utf8',
    ))

    expect(themeTsconfig.compilerOptions.customConditions).toEqual(['source'])
  })
})

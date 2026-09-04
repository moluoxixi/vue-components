import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const configFormRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../../../../../', import.meta.url))
const ignoredDirectories = new Set(['coverage', 'dist', 'node_modules'])
const productTextFile = /\.(?:[cm]?[jt]sx?|css|html|json|md|scss|vue)$/
const responsibilityDirectoryNames = new Set([
  'adapters',
  'components',
  'composables',
  'constants',
  'defaults',
  'errors',
  'interactions',
  'materials',
  'protocol',
  'readonly',
  'registries',
  'schemas',
  'services',
  'state',
  'style',
  'styles',
  'types',
  'utils',
  'validation',
])
const sourceRootFileAllowlist: Readonly<Record<string, readonly string[]>> = {
  'antd': ['index.ts', 'index.vue'],
  'compiler': ['index.ts'],
  'core': [],
  'designer': ['index.ts', 'styles.scss'],
  'designer-antd-vue': ['index.ts'],
  'designer-element-plus': ['index.ts'],
  'devtools-vite-plugin': ['index.ts'],
  'element': ['index.ts', 'index.vue'],
  'headless': ['index.ts'],
  'model': ['index.ts'],
  'playground': ['App.vue', 'main.ts'],
  'plugin-antd-vue': ['index.ts'],
  'plugin-element-plus': ['index.ts'],
  'runtime': ['index.vue'],
  'vue-backend': ['index.ts'],
  'workbench': [
    'adapter-styles.d.ts',
    'App.vue',
    'components.d.ts',
    'main.ts',
    'monaco-internal.d.ts',
  ],
}
const sourceRootDirectoryEntryExceptions = new Set(['playground/src/examples'])
const generatedTypeTemplateFiles = new Set([
  'workbench/src/project/export/services/source-flow.ts',
  'workbench/src/project/export/services/source-validation.ts',
])
const allowedCurrentDependencyTokens: Readonly<Record<string, readonly string[]>> = {
  'devtools-vite-plugin/src/source-inject/schemas/ast.ts': [['decorators', 'legacy'].join('-')],
  'workbench/src/features/export/components/WorkspaceCodeEditor/services/language-features.ts': [
    ['depre', 'cated'].join(''),
    ['Depre', 'cated'].join(''),
  ],
}

function collectProductTextFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      return ignoredDirectories.has(entry.name) ? [] : collectProductTextFiles(path)
    return entry.isFile() && productTextFile.test(entry.name) ? [path] : []
  })
}

function collectProductionTextFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) || entry.name.startsWith('__')
        ? []
        : collectProductionTextFiles(path)
    }
    return entry.isFile() && /\.(?:[cm]?[jt]sx?|vue)$/.test(entry.name) ? [path] : []
  })
}

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).replaceAll('\\', '/')
}

function collectProductDirectories(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || ignoredDirectories.has(entry.name) || entry.name.startsWith('__'))
      return []
    const path = join(directory, entry.name)
    return [path, ...collectProductDirectories(path)]
  })
}

function hasLocalEntry(directory: string): boolean {
  return ['index.ts', 'index.css', 'index.scss'].some(entry => existsSync(join(directory, entry)))
}

function configFormPackageSourceRoots(): Array<{ name: string, sourceRoot: string }> {
  return readdirSync(configFormRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap((entry) => {
      const packageRoot = join(configFormRoot, entry.name)
      const sourceRoot = join(packageRoot, 'src')
      return existsSync(join(packageRoot, 'package.json')) && existsSync(sourceRoot)
        ? [{ name: entry.name, sourceRoot }]
        : []
    })
}

describe('workbench production architecture boundary', () => {
  it('keeps ProjectEditorSession as the only production editing owner', () => {
    const source = readFileSync(new URL('../services/controller.ts', import.meta.url), 'utf8')
    const forbidden = [
      ['Workspace', 'Session'].join(''),
      ['create', 'Workspace', 'Session'].join(''),
      ['openDefault', 'Workspace', 'Application', 'Repository'].join(''),
      ['apply', 'Workspace', 'Application', 'Operation'].join(''),
      ['Project', 'Store'].join(''),
      ['create', 'Project', 'Store'].join(''),
      'setCurrentPage(',
      `type: '${['update', 'page', 'model'].join('-')}'`,
    ]
    forbidden.forEach(token => expect(source).not.toContain(token))
  })

  it('does not ship removed project/session compatibility modules', () => {
    const removedModules = [
      `../../project/${['application', 'repository'].join('-')}.ts`,
      `../../project/${['applica', 'tion'].join('')}.ts`,
      `../../project/${['leg', 'acy-operation-adapter'].join('')}.ts`,
      `../../project/${['project-document', 'compatibility'].join('-')}.ts`,
      `../../project/${['storage', 'migration'].join('-')}.ts`,
      `../../session/${['workspace', 'session'].join('-')}.ts`,
      `../../workbench/${['config', 'codec'].join('-')}.ts`,
    ]

    removedModules.forEach(path => expect(existsSync(new URL(path, import.meta.url))).toBe(false))
  })

  it('does not expose removed ConfigForm contracts or forwarding paths', () => {
    const forbiddenSymbols = [
      ['Project', 'Template'].join(''),
      ['create', 'Project', 'Template', 'Registry'].join(''),
      ['BUILT_IN', 'PROJECT', 'TEMPLATES'].join('_'),
      ['create', 'Built', 'In', 'Project'].join(''),
      ['create', 'Built', 'In', 'Project', 'Page'].join(''),
      ['Template', 'Identity', 'Factory'].join(''),
      ['remap', 'Template', 'Page', 'Identity'].join(''),
      ['Runtime', 'Surface'].join(''),
      ['IMPORT', 'COMPONENT', 'MIGRATION', 'FAILED'].join('_'),
      ['IMPORT', 'FLOW', 'OWNERSHIP', 'AMBIGUOUS'].join('_'),
      ['antd', 'Config', 'Form'].join(''),
      ['schema', 'Version'].join(''),
      ['protocol', 'Version'].join(''),
      ['storage', 'Schema', 'Version'].join(''),
      ['template', 'version'].join('\\.'),
      ['Runtime', 'Editor', 'Bridge'].join(''),
      ['Runtime', 'Node', 'Metadata'].join(''),
      ['Runtime', 'Editor', 'Event', 'Context'].join(''),
      ['define', 'Config', 'Form', 'Field'].join(''),
      ['define', 'Config', 'Form', 'Fields'].join(''),
      ['config', 'Form', 'Devtools', 'Vite', 'Plugin'].join(''),
      ['create', 'Project', 'Registry', 'Lock'].join(''),
      ['create', 'Registry', 'Lock', 'For', 'Components'].join(''),
      ['select', 'Registry', 'Lock', 'Components'].join(''),
    ]
    const productionFiles = collectProductTextFiles(configFormRoot).filter((path) => {
      const normalized = relative(configFormRoot, path).replaceAll('\\', '/')
      return !normalized.includes('/__tests__/')
        && !normalized.includes('/e2e/')
        && !normalized.endsWith('.test.ts')
        && !normalized.endsWith('.md')
    }).concat(join(repositoryRoot, 'scripts', 'verify-config-form-adapter-packages.mjs'))
    const symbolHits = productionFiles.flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return forbiddenSymbols
        .filter(symbol => new RegExp(`\\b${symbol}\\b`).test(source))
        .map(symbol => `${relative(configFormRoot, path)}: ${symbol}`)
    })
    const removedPaths = [
      'antd/src/bindings.ts',
      'antd/src/components.ts',
      'antd/src/styles.scss',
      'core/src/flow/hash.ts',
      'core/src/flow/interpreter.ts',
      'core/src/flow/plan.ts',
      'core/src/flow/types.ts',
      'core/src/json.ts',
      'core/src/module-registry.ts',
      'core/src/reaction-config.ts',
      'core/src/reaction.ts',
      'core/src/types.ts',
      'element/src/components.ts',
      'element/src/styles.scss',
      'runtime/src/renderer/ConfigFormRenderer.vue',
      'runtime/src/renderer/expose.ts',
      'runtime/src/renderer/install.ts',
      'runtime/src/renderer/layout.ts',
      'runtime/src/renderer/responsive.ts',
      'runtime/src/renderer/types.ts',
      'runtime/src/renderer-entry.ts',
      'runtime/src/composables/useForm.ts',
      'workbench/src/project/export/archive.ts',
      'workbench/src/project/export/source.ts',
      'workbench/src/project/import/migrations.ts',
      'workbench/src/project/import/service.ts',
      'workbench/src/project/import/types.ts',
      'workbench/src/project/project-document-repository-indexed-db.ts',
      'workbench/src/project/project-persistence-session.ts',
      'workbench/src/project/templates.ts',
      'workbench/src/project/templates/create-template.ts',
      'workbench/src/project/templates/service.ts',
      'workbench/src/project/templates/types.ts',
    ]

    expect(symbolHits).toEqual([])
    expect(removedPaths.filter(path => existsSync(join(configFormRoot, path)))).toEqual([])
  })

  it('keeps current ConfigForm features split by responsibility with local barrels', () => {
    const packageSourceRoots = configFormPackageSourceRoots()
    const packageNames = packageSourceRoots.map(({ name }) => name).sort()
    const configuredPackageNames = Object.keys(sourceRootFileAllowlist).sort()
    const unexpectedSourceRootFiles = packageSourceRoots.flatMap(({ name, sourceRoot }) => {
      const allowed = new Set(sourceRootFileAllowlist[name] ?? [])
      return readdirSync(sourceRoot, { withFileTypes: true })
        .filter(entry => entry.isFile() && !allowed.has(entry.name))
        .map(entry => `${name}/src/${entry.name}`)
    })
    const allSourceDirectories = packageSourceRoots.flatMap(({ sourceRoot }) => collectProductDirectories(sourceRoot))
    const responsibilityDirectories = allSourceDirectories
      .filter(directory => responsibilityDirectoryNames.has(basename(directory)))
    const featureRoots = allSourceDirectories.filter((directory) => {
      if (!existsSync(join(directory, 'index.ts')) || responsibilityDirectoryNames.has(basename(directory)))
        return false
      return true
    })
    const unexpectedFeatureRootFiles = featureRoots.flatMap((directory) => {
      const root = normalizedRelative(configFormRoot, directory)
      return readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name !== 'index.ts' && entry.name !== 'index.vue')
        .map(entry => `${root}/${entry.name}`)
    })
    const missingLocalEntries = [...new Set([
      ...packageSourceRoots.flatMap(({ sourceRoot }) => readdirSync(sourceRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('__'))
        .map(entry => join(sourceRoot, entry.name))),
      ...responsibilityDirectories,
      ...featureRoots.flatMap(directory => readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('__'))
        .map(entry => join(directory, entry.name))),
    ])]
      .filter(directory => !sourceRootDirectoryEntryExceptions.has(normalizedRelative(configFormRoot, directory)))
      .filter(directory => !hasLocalEntry(directory))
      .map(directory => normalizedRelative(configFormRoot, directory))
    const sourceFiles = packageSourceRoots.flatMap(({ sourceRoot }) => collectProductTextFiles(sourceRoot))
    const misplacedContracts = sourceFiles.flatMap((path) => {
      const normalized = normalizedRelative(configFormRoot, path)
      if (!normalized.endsWith('.ts')
        || normalized.endsWith('.d.ts')
        || normalized.includes('/types/')
        || normalized.endsWith('/index.ts')
        || generatedTypeTemplateFiles.has(normalized)) {
        return []
      }
      const source = readFileSync(path, 'utf8')
      return /^export\s+(?:interface|type)\b/m.test(source) ? [normalized] : []
    })
    const executableTypeFiles = sourceFiles.flatMap((path) => {
      const normalized = normalizedRelative(configFormRoot, path)
      if (!normalized.includes('/types/') || !normalized.endsWith('.ts'))
        return []
      const source = readFileSync(path, 'utf8')
      return /^export\s+(?:class|const|function|let|var)\b/m.test(source) ? [normalized] : []
    })
    const nestedSourceDirectories = allSourceDirectories
      .filter(directory => basename(directory) === 'src')
      .map(directory => normalizedRelative(configFormRoot, directory))

    expect(packageNames).toEqual(configuredPackageNames)
    expect(unexpectedSourceRootFiles).toEqual([])
    expect(unexpectedFeatureRootFiles).toEqual([])
    expect(missingLocalEntries).toEqual([])
    expect(misplacedContracts).toEqual([])
    expect(executableTypeFiles).toEqual([])
    expect(nestedSourceDirectories).toEqual([])
  })

  it('keeps compatibility implementation out of current ConfigForm production source', () => {
    const forbiddenTerms = [
      ['leg', 'acy'].join(''),
      ['depre', 'cated'].join(''),
      ['migra', 'tion'].join(''),
      ['migra', 'tions'].join(''),
      ['compati', 'bility'].join(''),
    ]
    const productionFiles = configFormPackageSourceRoots()
      .flatMap(({ sourceRoot }) => collectProductTextFiles(sourceRoot))
      .filter((path) => {
        const normalized = normalizedRelative(configFormRoot, path)
        return !normalized.includes('/__tests__/')
          && !normalized.endsWith('.test.ts')
          && !normalized.endsWith('.md')
      })
    const hits = productionFiles.flatMap((path) => {
      const normalized = normalizedRelative(configFormRoot, path)
      const source = readFileSync(path, 'utf8')
      const allowed = allowedCurrentDependencyTokens[normalized] ?? []
      return forbiddenTerms.flatMap((term) => {
        const pattern = new RegExp(`\\b${term}\\b`, 'gi')
        const matches = source.match(pattern) ?? []
        const allowedCount = allowed.reduce((count, token) => {
          return count + (token.match(new RegExp(`\\b${term}\\b`, 'gi')) ?? []).length
        }, 0)
        return matches.length === allowedCount ? [] : [`${normalized}: ${term} (${matches.length}/${allowedCount})`]
      })
    })
    const removedRuntimeSubpath = ['@moluoxixi/config-form', 'renderer'].join('/')
    const currentPublicFiles = [...new Set([
      ...productionFiles,
      ...collectProductTextFiles(join(repositoryRoot, 'packages', 'components', 'src')),
      ...collectProductTextFiles(configFormRoot).filter((path) => {
        const normalized = normalizedRelative(configFormRoot, path)
        return normalized.endsWith('/README.md')
          || normalized === 'README.md'
          || normalized.endsWith('/package.json')
      }),
      join(repositoryRoot, 'README.md'),
      join(repositoryRoot, 'packages', 'components', 'README.md'),
      join(repositoryRoot, 'packages', 'components', 'package.json'),
    ])]
    const subpathHits = currentPublicFiles
      .filter(path => readFileSync(path, 'utf8').includes(removedRuntimeSubpath))
      .map(path => normalizedRelative(configFormRoot, path))

    expect(hits).toEqual([])
    expect(subpathHits).toEqual([])
  })

  it('keeps ConfigForm out of the components package public surface', () => {
    const componentsRoot = join(repositoryRoot, 'packages', 'components')
    const removedDirectories = [
      join(componentsRoot, 'src', ['Antd', 'Config', 'Form'].join('')),
      join(componentsRoot, 'src', ['Element', 'Config', 'Form'].join('')),
    ]
    const removedFiles = [
      join(componentsRoot, 'src', ['config', 'Form.ts'].join('')),
      join(componentsRoot, 'src', 'entries', 'antd.ts'),
      join(componentsRoot, 'src', 'entries', 'element.ts'),
    ]
    const manifest = JSON.parse(readFileSync(join(componentsRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      exports?: Record<string, unknown>
    }
    const removedExports = [
      ['./', 'Antd', 'Config', 'Form'].join(''),
      ['./', 'Element', 'Config', 'Form'].join(''),
      ['./', 'config', 'Form'].join(''),
      './antd',
      './element',
    ]
    const configFormToken = ['Config', 'Form'].join('')
    const sourceHits = [
      ...collectProductTextFiles(join(componentsRoot, 'src')),
      ...collectProductTextFiles(join(repositoryRoot, 'playgrounds', 'components-playground', 'src')),
    ]
      .filter(path => readFileSync(path, 'utf8').includes(configFormToken))
      .map(path => normalizedRelative(componentsRoot, path))

    expect(removedDirectories.filter(path => existsSync(path) && collectProductTextFiles(path).length > 0)).toEqual([])
    expect(removedFiles.filter(path => existsSync(path))).toEqual([])
    expect(removedExports.filter(path => Object.hasOwn(manifest.exports ?? {}, path))).toEqual([])
    expect(Object.keys(manifest.dependencies ?? {}).filter(name => name.startsWith('@moluoxixi/config-form'))).toEqual([])
    expect(sourceHits).toEqual([])
  })

  it('keeps legacy contracts out of every ConfigForm source, test, script, template, and public declaration', () => {
    const forbiddenTokens = [
      ['Workspace', 'Application'].join(''),
      ['LowCode', 'PageModel'].join(''),
      ['Designer', 'Document'].join(''),
      ['Workspace', 'Session'].join(''),
      ['Workspace', 'Repository'].join(''),
      ['Project', 'Store'].join(''),
      ['compile', 'Designer', 'Document'].join(''),
      ['designer', 'DocumentToConfigModel'].join(''),
      ['configModel', 'ToDesigner', 'Document'].join(''),
      ['create', 'Designer', 'RuntimeProjection'].join(''),
      ['create', 'Workspace', 'Session'].join(''),
      ['create', 'Project', 'Store'].join(''),
      ['update', 'page', 'model'].join('-'),
    ]
    const forbiddenPaths = [
      ['model', 'src', ['leg', 'acy.ts'].join('')],
      ['model', 'src', ['mig', 'rate.ts'].join('')],
      ['designer', 'src', 'compiler'],
      ['designer', 'src', 'document'],
      ['designer', 'src', 'history'],
      ['designer', 'src', 'model'],
      ['designer', 'src', 'components', ['ConfigForm', 'Designer.vue'].join('')],
      ['playground', ['designer', '.html'].join('')],
      ['playground', 'src', 'designer'],
      ['workbench', 'src', 'design'],
      ['workbench', 'src', 'project', ['application', 'repository-indexed-db.ts'].join('-')],
      ['workbench', 'src', 'project', ['application', 'repository.ts'].join('-')],
      ['workbench', 'src', 'project', ['applica', 'tion.ts'].join('')],
      ['workbench', 'src', 'project', ['legacy', 'operation-adapter.ts'].join('-')],
      ['workbench', 'src', 'project', ['project-document', 'compatibility.ts'].join('-')],
      ['workbench', 'src', 'project', ['repository', 'memory.ts'].join('-')],
      ['workbench', 'src', 'project', ['storage', 'migration.ts'].join('-')],
      ['workbench', 'src', 'project', ['up', 'grade.ts'].join('')],
      ['workbench', 'src', 'session', ['workspace', 'session.ts'].join('-')],
      ['workbench', 'src', 'workbench', ['config', 'codec.ts'].join('-')],
    ]
    const scannedRoots = [configFormRoot, join(repositoryRoot, 'scripts')]
    const hits = scannedRoots.flatMap(root => collectProductTextFiles(root)).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return forbiddenTokens
        .filter(token => source.includes(token))
        .map(token => `${relative(repositoryRoot, path)}: ${token}`)
    })

    const existingPaths = forbiddenPaths
      .map(parts => join(configFormRoot, ...parts))
      .filter(path => existsSync(path))
      .map(path => relative(configFormRoot, path))

    expect(hits).toEqual([])
    expect(existingPaths).toEqual([])
  })

  it('routes normal Design rendering through Canonical IR and the Vue backend', () => {
    const controller = readFileSync(new URL('../services/controller.ts', import.meta.url), 'utf8')
    const designSession = readFileSync(new URL('../../session/services/workbench-design.ts', import.meta.url), 'utf8')
    const exportService = readFileSync(new URL('../../session/services/workbench-export.ts', import.meta.url), 'utf8')
    expect(designSession).toContain('createCompileCoordinator')
    expect(designSession).toContain('coordinator.compilePage(pageId)')
    expect(designSession).toContain('coordinator.compileDraftPage(snapshot, pageId, changeSet)')
    expect(designSession).toContain('createProjectDraftSnapshotFromTransaction')
    expect(designSession).toContain('compileCanonicalPageRuntime')
    expect(designSession).not.toContain('compileCanonicalProject')
    expect(exportService).toContain('compileCanonicalProject')
    expect(controller).not.toContain('compileCanonicalProject')
    expect(controller).not.toContain('compileCanonicalPageRuntime')
    expect(controller).not.toContain('createCompileCoordinator')
    expect(controller).not.toContain(['configModel', 'ToDesigner', 'Document'].join(''))
    expect(controller).not.toContain(['compile', 'Designer', 'Document(document'].join(''))
  })

  it('keeps Preview inside an iframe RuntimeHost with a data-only protocol', () => {
    const drawer = readFileSync(new URL('../components/PreviewDrawer/index.vue', import.meta.url), 'utf8')
    const host = readFileSync(new URL('../../runtime-host/index.vue', import.meta.url), 'utf8')
    const hostProtocol = readFileSync(new URL('../../runtime-host/composables/use-runtime-host-protocol.ts', import.meta.url), 'utf8')
    const protocol = readFileSync(new URL('../../runtime-host/types/protocol.ts', import.meta.url), 'utf8')

    expect(drawer).toContain('PreviewRuntimeHostFrame')
    expect(drawer).not.toContain('RuntimeSurface')
    expect(drawer).not.toContain('VueRuntimeCompileSuccess')
    expect(host).not.toContain('compileCanonicalPageRuntime')
    expect(host).not.toContain('loadWorkbenchRuntimeAdapter')
    expect(hostProtocol).toContain('compileCanonicalPageRuntime')
    expect(hostProtocol).toContain('loadWorkbenchRuntimeAdapter')
    expect(protocol).toContain('compilation: PageCompilation')
    expect(protocol).not.toContain(`from '${['@moluoxixi/config-form', 'renderer'].join('/')}'`)
  })

  it('keeps property mutations on the single Designer command bridge', () => {
    const shell = readFileSync(new URL('../index.vue', import.meta.url), 'utf8')
    const designSession = readFileSync(new URL('../../session/services/workbench-design.ts', import.meta.url), 'utf8')
    expect(shell).not.toContain('@model-operation')
    expect(designSession).toContain('commandControl: { execute, preview }')
    expect(designSession).toContain('const result = session.execute(command)')
  })

  it('provides Design, Preview, Export, and UI through separate contexts', () => {
    const context = readFileSync(new URL('../composables/context.ts', import.meta.url), 'utf8')
    const shell = readFileSync(new URL('../index.vue', import.meta.url), 'utf8')
    for (const name of [
      'useWorkbenchDesignSession',
      'useWorkbenchPreviewSession',
      'useWorkbenchExportService',
      'useWorkbenchUiStore',
    ]) {
      expect(context).toContain(`export function ${name}`)
      expect(shell).toContain(`${name}()`)
    }
    expect(shell).not.toContain('compileCanonicalProject')
    expect(shell).not.toContain('compileCanonicalPageRuntime')
  })

  it('passes app services into lazy features without a reverse app import', () => {
    const shell = readFileSync(new URL('../index.vue', import.meta.url), 'utf8')
    const persistence = readFileSync(new URL('../../features/persistence/index.vue', import.meta.url), 'utf8')
    const appRoot = join(configFormRoot, 'workbench/src/app')
    const featureAppImports = collectProductionTextFiles(join(configFormRoot, 'workbench/src/features'))
      .flatMap((path) => {
        const source = readFileSync(path, 'utf8')
        const specifiers = [
          ...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g),
          ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
        ].map(match => match[1]!)
        return specifiers.flatMap((specifier) => {
          if (!specifier.startsWith('.'))
            return []
          const target = resolve(dirname(path), specifier)
          return target === appRoot || target.startsWith(`${appRoot}${sep}`)
            ? [`${normalizedRelative(configFormRoot, path)} -> ${specifier}`]
            : []
        })
      })

    expect(shell).toContain(':controller="controller"')
    expect(persistence).toContain('const controller = props.controller')
    expect(featureAppImports).toEqual([])
  })

  it('delegates Preview runtime state and lifecycle to PreviewSession', () => {
    const controller = readFileSync(new URL('../services/controller.ts', import.meta.url), 'utf8')
    const projectBinding = readFileSync(new URL('../services/controller-project-binding.ts', import.meta.url), 'utf8')
    const previewSession = readFileSync(new URL('../../session/services/preview.ts', import.meta.url), 'utf8')
    const controllerOrchestration = `${controller}\n${projectBinding}`

    expect(controller).toContain('createWorkbenchPreviewSession')
    expect(projectBinding).toContain('previewSession.accept')
    expect(controller).toContain('previewSession.dispose')
    expect(controllerOrchestration).not.toContain('createPageProjectionCoordinator')
    expect(controllerOrchestration).not.toContain('lastRuntimePreview')
    expect(controllerOrchestration).not.toContain('reconcilePreviewModel')
    expect(controllerOrchestration).not.toContain('projectionCoordinator')
    expect(controllerOrchestration).not.toContain('pageFlowEngine')
    expect(previewSession).toContain('createPageProjectionCoordinator')
    expect(previewSession).toContain('lastReadyPreview')
    expect(previewSession).toContain('handleRuntimeMounted')
    expect(previewSession).toContain('handleRuntimeState')
    expect(previewSession).toContain('const touched = shallowRef')
    expect(previewSession).toContain('const validation = shallowRef')
    expect(previewSession).toContain('const trace = shallowRef')
  })

  it('keeps transient chrome state inside the UI Store', () => {
    const controller = readFileSync(new URL('../services/controller.ts', import.meta.url), 'utf8')
    const shell = readFileSync(new URL('../index.vue', import.meta.url), 'utf8')
    const uiStore = readFileSync(new URL('../state/ui-store.ts', import.meta.url), 'utf8')
    const uiRefs = [
      'mobileStudioView',
      'studioLeftView',
      'previewOpen',
      'previewExpanded',
      'previewViewport',
      'pageManagerOpen',
      'exportPreviewMode',
      'flowWorkspaceOpen',
      'appearanceDrawerOpen',
      'themePreference',
      'paletteFamily',
      'localeId',
      'message',
    ]

    uiRefs.forEach((name) => {
      expect(controller).not.toContain(`const ${name} = ref`)
      expect(uiStore).toContain(`const ${name} = ref`)
    })
    expect(uiStore).toContain('const resolvedTheme = computed')
    expect(shell).toContain('useWorkbenchUiStore()')
    expect(uiStore).not.toContain('ProjectDocument')
    expect(uiStore).not.toContain('RuntimeHostRuntimeStatePayload')
    expect(uiStore).not.toContain('ExportSnapshot')
  })

  it('keeps template browsing in the App-level creation workspace', () => {
    const app = readFileSync(new URL('../../App.vue', import.meta.url), 'utf8')
    const shell = readFileSync(new URL('../index.vue', import.meta.url), 'utf8')
    const uiStore = readFileSync(new URL('../state/ui-store.ts', import.meta.url), 'utf8')
    const workspace = readFileSync(new URL('../components/TemplateCreationWorkspace/index.vue', import.meta.url), 'utf8')

    expect(app).toContain('TemplateCreationWorkspace')
    expect(app).toContain('ref<\'create\' | \'designer\'>')
    expect(workspace).toContain('createTemplateCatalogService')
    expect(workspace).toContain('PreviewRuntimeHostFrame')
    expect(shell).not.toContain('TemplateDialog')
    expect(shell).not.toContain('templatePickerOpen')
    expect(shell).not.toContain('builtInTemplateCatalogProvider')
    expect(uiStore).not.toContain('templatePickerOpen')
  })

  it('delegates event-flow execution to the page Flow Engine', () => {
    const previewSession = readFileSync(new URL('../../session/services/preview.ts', import.meta.url), 'utf8')
    const engine = readFileSync(new URL('../../flow/services/page-flow-engine.ts', import.meta.url), 'utf8')

    expect(previewSession).toContain('createWorkbenchPageFlowEngine')
    expect(previewSession).toContain('flowEngine.dispatch')
    expect(previewSession).not.toContain('new ConfigFormFlowInterpreter')
    expect(previewSession).not.toContain('new PreviewFlowCoordinator')
    expect(engine).toContain('new ConfigFormFlowInterpreter')
    expect(engine).toContain('new PreviewFlowCoordinator')
    expect(engine).toContain('createWorkbenchFlowActionRegistry')
  })

  it('uses Flow as the only normal Workbench editor for registered component events', () => {
    const shell = readFileSync(new URL('../index.vue', import.meta.url), 'utf8')
    const dialog = readFileSync(new URL('../../features/flow/index.vue', import.meta.url), 'utf8')

    expect(shell).not.toContain('event-editor')
    expect(shell).toContain('@configure-event="showComponentEventFlow"')
    expect(shell).not.toContain('@model-operation')
    expect(dialog).toContain(':initial-trigger="initialTrigger"')
  })
})

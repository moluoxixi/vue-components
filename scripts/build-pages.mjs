import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDir, '..')
const pagesOutput = resolve(repositoryRoot, 'dist/pages')

function normalizeBasePath(value) {
  const trimmed = value.trim()
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const normalized = withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`

  if (normalized.includes('..') || normalized.includes('\\')) {
    throw new Error(`Invalid Pages base path: ${value}`)
  }

  return normalized.replace(/\/{2,}/g, '/')
}

function appendBasePath(basePath, segment) {
  return `${basePath}${segment.replace(/^\/+|\/+$/g, '')}/`
}

function runPnpm(args, environment = {}) {
  const pnpmScript = process.env.npm_execpath
  const command = pnpmScript ? process.execPath : (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm')
  const commandArgs = pnpmScript ? [pnpmScript, ...args] : args
  const result = spawnSync(command, commandArgs, {
    cwd: repositoryRoot,
    env: { ...process.env, ...environment },
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} exited with code ${result.status}`)
  }
}

function copyOutput(source, target) {
  if (!existsSync(source)) {
    throw new Error(`Expected build output does not exist: ${relative(repositoryRoot, source)}`)
  }

  mkdirSync(target, { recursive: true })
  cpSync(source, target, { recursive: true })
}

function collectFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry)
    return statSync(path).isDirectory() ? collectFiles(path) : [path]
  })
}

function collectCssUrls(content) {
  const urls = []
  const cssUrlPattern = /\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^\s'")]+))\s*\)/gi

  for (const match of content.matchAll(cssUrlPattern)) {
    urls.push(match[1] ?? match[2] ?? match[3])
  }

  return urls
}

function collectHtmlUrls(html) {
  const urls = collectCssUrls(html)
  const urlAttributePattern = /\b(?:action|cite|data|formaction|href|poster|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"=<>`]+))/gi
  const srcsetPattern = /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"=<>`]+))/gi

  for (const match of html.matchAll(urlAttributePattern)) {
    urls.push(match[1] ?? match[2] ?? match[3])
  }

  for (const match of html.matchAll(srcsetPattern)) {
    const srcset = match[1] ?? match[2] ?? match[3]
    for (const candidate of srcset.split(',')) {
      const url = candidate.trim().split(/\s+/, 1)[0]
      if (url) {
        urls.push(url)
      }
    }
  }

  return urls
}

function verifyPagesOutput(basePath) {
  const configFormBase = appendBasePath(basePath, 'config-form-playground')
  const requiredEntries = [
    'index.html',
    '404.html',
    'playground.html',
    'en/playground.html',
    'components/copy-text.html',
    'components-playground/index.html',
    'config-form-playground/index.html',
    'config-form-playground/designer.html',
    'config-form-playground/runtime-host.html',
    'vue-playground/index.html',
    'vue-playground/runtime/moluoxixi-components.js',
    'vue-playground/runtime/moluoxixi-components.css',
  ]

  const missingEntries = requiredEntries.filter(entry => !existsSync(resolve(pagesOutput, entry)))
  if (missingEntries.length > 0) {
    throw new Error(`Pages artifact is missing: ${missingEntries.join(', ')}`)
  }

  const workbenchEntry = readFileSync(resolve(pagesOutput, 'config-form-playground/designer.html'), 'utf8')
  if (!workbenchEntry.includes('<title>ConfigForm Workbench</title>')
    || !workbenchEntry.includes(`${configFormBase}assets/`)) {
    throw new Error('ConfigForm designer entry is not the current Workbench build.')
  }

  const runtimeHostEntry = readFileSync(resolve(pagesOutput, 'config-form-playground/runtime-host.html'), 'utf8')
  if (!runtimeHostEntry.includes(`${configFormBase}assets/`)) {
    throw new Error('ConfigForm Workbench runtime host entry has an invalid Pages asset path.')
  }

  const invalidUrls = []
  const assetFiles = collectFiles(pagesOutput).filter(file => /\.(?:css|html)$/i.test(file))

  for (const assetFile of assetFiles) {
    const content = readFileSync(assetFile, 'utf8')
    const urls = assetFile.endsWith('.html') ? collectHtmlUrls(content) : collectCssUrls(content)

    for (const url of urls) {
      if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(basePath)) {
        invalidUrls.push(`${relative(pagesOutput, assetFile)} -> ${url}`)
      }
    }
  }

  if (invalidUrls.length > 0) {
    throw new Error(`Pages artifact contains URLs outside ${basePath}:\n${invalidUrls.join('\n')}`)
  }
}

const pagesBase = normalizeBasePath(process.env.PAGES_BASE_PATH ?? '/vue-components/')
const componentsPlaygroundBase = appendBasePath(pagesBase, 'components-playground')
const configFormPlaygroundBase = appendBasePath(pagesBase, 'config-form-playground')
const vuePlaygroundBase = appendBasePath(pagesBase, 'vue-playground')

runPnpm(['build'])
runPnpm(['--filter', '@moluoxixi/components-playground', 'build'], {
  COMPONENTS_PLAYGROUND_BASE: componentsPlaygroundBase,
})
runPnpm(['--filter', '@config-form/workbench', 'build'], {
  CONFIG_FORM_WORKBENCH_BASE: configFormPlaygroundBase,
})
runPnpm(['--filter', '@moluoxixi/vue-playground', 'build'], {
  VUE_PLAYGROUND_BASE: vuePlaygroundBase,
})
runPnpm(['--filter', '@moluoxixi/docs', 'build'], {
  DOCS_BASE: pagesBase,
})

rmSync(pagesOutput, { force: true, recursive: true })
copyOutput(resolve(repositoryRoot, 'docs/vitepress/.vitepress/dist'), pagesOutput)
copyOutput(
  resolve(repositoryRoot, 'playgrounds/components-playground/dist'),
  resolve(pagesOutput, 'components-playground'),
)
const configFormWorkbenchOutput = resolve(repositoryRoot, 'packages/ConfigForm/workbench/dist')
const configFormPlaygroundOutput = resolve(pagesOutput, 'config-form-playground')
copyOutput(
  configFormWorkbenchOutput,
  configFormPlaygroundOutput,
)
copyFileSync(
  resolve(configFormWorkbenchOutput, 'index.html'),
  resolve(configFormPlaygroundOutput, 'designer.html'),
)
copyFileSync(
  resolve(configFormWorkbenchOutput, 'runtime-host.html'),
  resolve(configFormPlaygroundOutput, 'runtime-host.html'),
)
copyOutput(
  resolve(repositoryRoot, 'playgrounds/vue-playground/dist'),
  resolve(pagesOutput, 'vue-playground'),
)
writeFileSync(resolve(pagesOutput, '.nojekyll'), '', 'utf8')

verifyPagesOutput(pagesBase)
console.log(`Pages artifact ready at ${relative(repositoryRoot, pagesOutput)} with base ${pagesBase}`)

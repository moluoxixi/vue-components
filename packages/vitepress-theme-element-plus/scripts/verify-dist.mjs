import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const distRoot = fileURLToPath(new URL('../dist/', import.meta.url))
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const notices = await readFile(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8')

async function collectFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory())
      files.push(...await collectFiles(path))
    else files.push(path)
  }
  return files
}

const failures = []
const files = await collectFiles(distRoot)
const jsFiles = files.filter(file => file.endsWith('.js'))
const cssFiles = files.filter(file => file.endsWith('.css'))
const js = (await Promise.all(jsFiles.map(file => readFile(file, 'utf8')))).join('\n')
const browserJsFiles = jsFiles.filter(file => !file.endsWith('/markdown.js'))
const browserArtifacts = (await Promise.all(
  [...browserJsFiles, ...cssFiles].map(file => readFile(file, 'utf8')),
)).join('\n')
const nodeModuleSpecifier = /(?:\bfrom\s*|\bimport\s*\(\s*)["']node:/

if (JSON.stringify(Object.keys(packageJson.exports)) !== JSON.stringify(['.', './markdown'])) {
  failures.push('package exports must expose the browser root and markdown entries')
}
if (!jsFiles.some(file => file.endsWith('/markdown.js'))) {
  failures.push('markdown entry is missing')
}
if (!cssFiles.some(file => file.endsWith('/vitepress-theme-element-plus.css'))) {
  failures.push('theme CSS asset is missing')
}
if (!js.includes('import("./vitepress-theme-element-plus.css")')) {
  failures.push('browser entry does not dynamically load the emitted theme CSS')
}
if (browserArtifacts.includes('__MOLUOXIXI_THEME_STYLES__')) {
  failures.push('theme CSS build marker leaked into dist')
}
if (nodeModuleSpecifier.test(browserArtifacts)) {
  failures.push('forbidden browser artifact reference: node: module import')
}
for (const forbidden of [
  '@moluoxixi/ai-doc-assistant',
  '@element-plus/',
  'packages/theme-chalk',
  'element-plus.gitee.io',
  'element-plus@outlook.com',
]) {
  if (browserArtifacts.includes(forbidden))
    failures.push(`forbidden browser artifact reference: ${forbidden}`)
}
if (!notices.includes('Copyright (c) 2020-PRESENT Element Plus')) {
  failures.push('Element Plus copyright notice is missing')
}
if ((await stat(`${packageRoot}/UPSTREAM.md`)).size === 0) {
  failures.push('UPSTREAM.md is empty')
}

if (failures.length) {
  throw new Error(`Distribution verification failed:\n- ${failures.join('\n- ')}`)
}

console.log(`Verified ${browserJsFiles.length} browser JavaScript chunks, 1 Markdown entry, and ${cssFiles.length} CSS assets.`)

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
const declarationFiles = files.filter(file => file.endsWith('.d.ts'))
const cssFiles = files.filter(file => file.endsWith('.css'))
const js = (await Promise.all(jsFiles.map(file => readFile(file, 'utf8')))).join('\n')
const browserJsFiles = jsFiles.filter(file => (
  !file.endsWith('/markdown.js')
  && !file.endsWith('/node.js')
  && !file.endsWith('/element-plus-docs.js')
  && !file.endsWith('/repository-node.js')
  && !file.includes('/node-')
))
const browserArtifacts = (await Promise.all(
  [...browserJsFiles, ...cssFiles].map(file => readFile(file, 'utf8')),
)).join('\n')
const nodeModuleSpecifier = /(?:\bfrom\s*|\bimport\s*\(\s*)["']node:/

if (JSON.stringify(Object.keys(packageJson.exports)) !== JSON.stringify([
  '.',
  './markdown',
  './node',
  './repository',
  './repository/node',
  './repl',
  './repl.css',
])) {
  failures.push('package exports must expose the browser root, markdown, Node lifecycle, repository, Node repository, and REPL entries')
}
if (!jsFiles.some(file => file.endsWith('/markdown.js'))) {
  failures.push('markdown entry is missing')
}
if (!jsFiles.some(file => file.endsWith('/node.js'))) {
  failures.push('Node lifecycle entry is missing')
}
if (!declarationFiles.some(file => file.endsWith('/node.d.ts'))) {
  failures.push('Node lifecycle declaration entry is missing')
}
if (!jsFiles.some(file => file.endsWith('/repl.js'))) {
  failures.push('REPL entry is missing')
}
if (!jsFiles.some(file => file.endsWith('/repository.js'))) {
  failures.push('browser repository entry is missing')
}
if (!jsFiles.some(file => file.endsWith('/repository-node.js'))) {
  failures.push('Node repository entry is missing')
}
const cliPath = `${distRoot}/element-plus-docs.js`
if (!jsFiles.includes(cliPath)) {
  failures.push('element-plus-docs CLI entry is missing')
}
else if (!(await readFile(cliPath, 'utf8')).startsWith('#!/usr/bin/env node')) {
  failures.push('element-plus-docs CLI entry is missing its executable shebang')
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
  'packages/theme-chalk',
  'element-plus.gitee.io',
  'element-plus@outlook.com',
]) {
  if (browserArtifacts.includes(forbidden))
    failures.push(`forbidden browser artifact reference: ${forbidden}`)
}
if (/(?:\bfrom\s*|\bimport\s*\(\s*)["']@element-plus\//.test(browserArtifacts)) {
  failures.push('forbidden browser artifact import: @element-plus/ package')
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

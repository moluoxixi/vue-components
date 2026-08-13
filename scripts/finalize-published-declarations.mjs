import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const manifestFlagIndex = process.argv.indexOf('--manifest')
const packageManifest = manifestFlagIndex === -1 ? undefined : process.argv[manifestFlagIndex + 1]
if (!packageManifest)
  throw new Error('Usage: pnpm -w finalize:declarations --manifest <package.json>')

const packageManifestPath = resolve(packageManifest)
const packageRoot = dirname(packageManifestPath)
const declarationRoot = resolve(packageRoot, 'dist')

async function collectDeclarationFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory()
      ? collectDeclarationFiles(path)
      : Promise.resolve(entry.name.endsWith('.d.ts') ? [path] : [])
  }))
  return files.flat()
}

function hasExplicitExtension(specifier) {
  const basename = specifier.split('/').at(-1)
  return Boolean(basename && basename !== '.' && basename !== '..' && basename.includes('.'))
}

function requiresPublishedExtension(specifier) {
  return !hasExplicitExtension(specifier) || specifier.endsWith('.vue')
}

function collectRelativeSpecifiers(sourceFile) {
  const specifiers = []
  const addSpecifier = (literal) => {
    if (
      literal
      && ts.isStringLiteralLike(literal)
      && literal.text.startsWith('.')
      && requiresPublishedExtension(literal.text)
    ) {
      specifiers.push({
        end: literal.getEnd() - 1,
        specifier: literal.text,
        start: literal.getStart(sourceFile) + 1,
      })
    }
  }
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addSpecifier(node.moduleSpecifier)
    }
    else if (
      ts.isImportTypeNode(node)
      && ts.isLiteralTypeNode(node.argument)
      && ts.isStringLiteralLike(node.argument.literal)
    ) {
      addSpecifier(node.argument.literal)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return specifiers
}

function resolvePublishedSpecifier(file, specifier, declarationFiles) {
  const target = resolve(dirname(file), specifier)
  if (declarationFiles.has(`${target}.d.ts`))
    return `${specifier}.js`
  if (declarationFiles.has(join(target, 'index.d.ts')))
    return `${specifier.replace(/\/$/, '')}/index.js`
  throw new Error(`Cannot resolve declaration import ${specifier} from ${relative(packageRoot, file)}`)
}

async function finalizeDeclarationSpecifiers() {
  const files = await collectDeclarationFiles(declarationRoot)
  const declarationFiles = new Set(files)
  let replacementCount = 0

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const replacements = collectRelativeSpecifiers(sourceFile)
      .map(item => ({
        ...item,
        replacement: resolvePublishedSpecifier(file, item.specifier, declarationFiles),
      }))
      .sort((left, right) => right.start - left.start)

    if (replacements.length === 0)
      continue

    let output = source
    for (const replacement of replacements)
      output = `${output.slice(0, replacement.start)}${replacement.replacement}${output.slice(replacement.end)}`
    await writeFile(file, output, 'utf8')
    replacementCount += replacements.length
  }

  return replacementCount
}

async function verifyNodeNextConsumers() {
  const packageJson = JSON.parse(await readFile(packageManifestPath, 'utf8'))
  const publicEntries = Object.entries(packageJson.exports ?? {})
    .filter(([, conditions]) => conditions && typeof conditions === 'object' && 'types' in conditions)
    .map(([subpath]) => subpath === '.' ? packageJson.name : `${packageJson.name}/${subpath.slice(2)}`)
  const consumerFile = resolve(packageRoot, '__published-types-consumer__.mts')
  const options = {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ESNext,
  }

  for (const entry of publicEntries) {
    const resolved = ts.resolveModuleName(entry, consumerFile, options, ts.sys).resolvedModule
    if (!resolved)
      throw new Error(`NodeNext cannot resolve public type entry ${entry}`)
    const declarationPath = relative(declarationRoot, resolve(resolved.resolvedFileName))
    if (declarationPath.startsWith('..') || isAbsolute(declarationPath)) {
      throw new Error(
        `NodeNext resolved ${entry} outside the published declarations: ${resolved.resolvedFileName}`,
      )
    }
  }
}

const replacementCount = await finalizeDeclarationSpecifiers()
await verifyNodeNextConsumers()
console.log(`Finalized ${replacementCount} declaration specifiers and verified NodeNext package entries.`)

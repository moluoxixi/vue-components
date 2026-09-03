import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const expectedDynamicStyles = {
  'src/adapters/styles/element-plus-inspector.ts': [
    'input',
    'input-number',
    'segmented',
    'switch',
  ],
  'src/adapters/styles/element-plus-runtime.ts': [
    'card',
    'checkbox',
    'collapse',
    'date-picker',
    'input',
    'input-number',
    'option',
    'radio',
    'segmented',
    'select',
    'switch',
    'tabs',
    'time-picker',
  ],
}
const forbidden = [
  /app\.use\(\s*ElementPlus\s*\)/,
  /import\s+ElementPlus\s+from\s+['"]element-plus['"]/,
  /element-plus\/dist\/index\.css/,
  /element-plus\/es\/components\/[a-z0-9-]+\/style\/css/,
]
const sourceFiles = []

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory())
      collect(path)
    else if (/\.(?:css|scss|ts|vue)$/.test(entry.name))
      sourceFiles.push(path)
  }
}

collect(resolve(root, 'src'))
for (const path of [resolve(root, 'vite.config.ts'), ...sourceFiles]) {
  const source = readFileSync(path, 'utf8')
  for (const pattern of forbidden) {
    if (pattern.test(source))
      throw new Error(`Forbidden full Element Plus import in ${path}`)
  }
}

const declarations = readFileSync(resolve(root, 'src/components.d.ts'), 'utf8')
const declaredComponents = [...declarations.matchAll(/^\s+(El[A-Z][A-Za-z0-9]+):/gm)]
  .map(match => match[1])
  .sort()
const usedTemplateComponents = [...new Set(sourceFiles
  .filter(path => path.endsWith('.vue'))
  .flatMap(path => [...readFileSync(path, 'utf8').matchAll(/<\/?(El[A-Z][A-Za-z0-9]+)/g)]
    .map(match => match[1])))]
  .sort()
if (JSON.stringify(declaredComponents) !== JSON.stringify(usedTemplateComponents)) {
  throw new Error([
    'Element Plus resolver declarations do not match Workbench SFC usage.',
    `Declared: ${declaredComponents.join(', ')}`,
    `Used: ${usedTemplateComponents.join(', ')}`,
  ].join('\n'))
}

for (const [relativePath, expectedComponents] of Object.entries(expectedDynamicStyles)) {
  const source = readFileSync(resolve(root, relativePath), 'utf8')
  const actualComponents = [...source.matchAll(/element-plus\/es\/components\/([a-z0-9-]+)\/style\/index/g)]
    .map(match => match[1])
    .sort()
  const expected = [...expectedComponents].sort()
  if (JSON.stringify(actualComponents) !== JSON.stringify(expected)) {
    throw new Error([
      `Dynamic Element Plus styles drifted in ${relativePath}.`,
      `Expected: ${expected.join(', ')}`,
      `Actual: ${actualComponents.join(', ')}`,
    ].join('\n'))
  }
}

const outputDirectory = resolve(root, 'dist/assets')
const output = readdirSync(outputDirectory)
if (!output.some(file => file.endsWith('.css')))
  throw new Error('Workbench build emitted no component CSS')

for (const entry of ['element-plus-inspector', 'element-plus-runtime']) {
  if (!output.some(file => file.startsWith(`${entry}-`) && file.endsWith('.css')))
    throw new Error(`Workbench build emitted no split CSS for ${entry}`)
}

const emittedCss = output
  .filter(file => file.endsWith('.css'))
  .map(file => readFileSync(resolve(outputDirectory, file), 'utf8'))
  .join('\n')
for (const unusedSelector of ['.el-calendar', '.el-carousel', '.el-color-picker', '.el-tour']) {
  if (emittedCss.includes(unusedSelector))
    throw new Error(`Workbench CSS contains unused Element Plus selector ${unusedSelector}; check for a full theme import`)
}

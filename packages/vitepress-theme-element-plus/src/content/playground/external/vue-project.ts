export interface ElementPlusDocsExternalProjectOptions {
  dependencies?: Readonly<Record<string, string>>
  description?: string
  devDependencies?: Readonly<Record<string, string>>
  packageName?: string
  styleImports?: readonly string[]
  title: string
}

export interface ElementPlusDocsExternalProjectSource {
  dependencies?: Readonly<Record<string, string>>
  source: string
  styleImports?: readonly string[]
}

export interface ElementPlusDocsExternalProject {
  description?: string
  files: Readonly<Record<string, string>>
  title: string
}

const defaultDependencies = {
  vue: '^3.5.0',
}

const defaultDevDependencies = {
  '@vitejs/plugin-vue': '^5.2.0',
  'vite': '^6.0.0',
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function createMainSource(styleImports: readonly string[]): string {
  const styles = styleImports.map(path => `import ${JSON.stringify(path)}`).join('\n')
  return `import { createApp } from 'vue'
import App from './App.vue'
${styles ? `\n${styles}\n` : ''}
createApp(App).mount('#app')
`
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export function createElementPlusDocsExternalProject(
  source: string,
  options: ElementPlusDocsExternalProjectOptions,
  projectSource: ElementPlusDocsExternalProjectSource = { source },
): ElementPlusDocsExternalProject {
  const styleImports = unique([
    ...(options.styleImports ?? []),
    ...(projectSource.styleImports ?? []),
  ])
  const dependencies: Record<string, string> = {
    ...defaultDependencies,
    ...projectSource.dependencies,
    ...options.dependencies,
  }

  const packageJson = {
    name: options.packageName ?? 'vue-component-demo',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      start: 'vite --host 0.0.0.0',
    },
    dependencies,
    devDependencies: {
      ...defaultDevDependencies,
      ...options.devDependencies,
    },
  }

  return {
    description: options.description,
    title: options.title,
    files: {
      'package.json': `${JSON.stringify(packageJson, null, 2)}\n`,
      'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
      'vite.config.ts': `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})
`,
      'src/main.ts': createMainSource(styleImports),
      'src/App.vue': projectSource.source,
    },
  }
}

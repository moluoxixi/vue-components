import type { ProjectTheme } from '@moluoxixi/config-form-model'
import type { SourceStyleTarget } from '../types'
import type {
  SourceStyleBackend,
  SourceStyleBackendOptions,
} from '../types/internal'
import { kebabCase } from './serialization'

const CSS_VITE = `import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [Vue()],
})
`

const TAILWIND_VITE = `import Vue from '@vitejs/plugin-vue'
import Tailwind from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [Vue(), Tailwind()],
})
`

const CSS_BINDING_VITE = `import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [Vue()],
  build: {
    lib: {
      entry: 'src/bindings.ts',
      formats: ['es'],
      fileName: 'bindings',
      cssFileName: 'style',
    },
  },
})
`

const TAILWIND_BINDING_VITE = `import Vue from '@vitejs/plugin-vue'
import Tailwind from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [Vue(), Tailwind()],
  build: {
    lib: {
      entry: 'src/bindings.ts',
      formats: ['es'],
      fileName: 'bindings',
      cssFileName: 'style',
    },
  },
})
`

const CSS_CLASSES = {
  surface: 'demo-surface',
  surfaceHeader: 'demo-surface__header',
  surfaceContent: 'demo-surface__content',
  field: 'demo-field',
  fieldLabel: 'demo-field__label',
  fieldRequired: 'demo-field__required',
  fieldError: 'demo-field__error',
  surfaceTitle: '',
  overlay: 'demo-overlay',
  overlayUnmasked: 'demo-overlay--unmasked',
  overlayPanel: 'demo-overlay__panel',
  overlayPanelDialog: 'demo-overlay__panel--dialog',
  overlayPanelDrawer: 'demo-overlay__panel--drawer',
  overlayPanelDrawerLeft: 'demo-overlay__panel--drawer-left',
  overlayPanelDrawerRight: 'demo-overlay__panel--drawer-right',
  overlayPanelDrawerTop: 'demo-overlay__panel--drawer-top',
  overlayPanelDrawerBottom: 'demo-overlay__panel--drawer-bottom',
  overlayHeading: 'demo-overlay__heading',
  overlayTitle: '',
  overlayClose: 'demo-overlay__close',
} as const

const TAILWIND_CLASSES = {
  surface: 'demo-surface mx-auto w-[min(960px,calc(100%_-_32px))] px-0 pb-14 pt-8 max-[640px]:w-[calc(100%_-_20px)] max-[640px]:pt-5',
  surfaceHeader: 'mb-6',
  surfaceContent: 'grid gap-[var(--demo-spacing-md,16px)]',
  field: 'grid gap-1.5',
  fieldLabel: 'text-[13px] font-semibold',
  fieldRequired: 'ml-1 text-[var(--demo-color-danger,#dc2626)]',
  fieldError: 'text-xs text-[var(--demo-color-danger,#dc2626)]',
  surfaceTitle: 'm-0 text-[28px] font-[var(--demo-font-heading-weight,700)]',
  overlay: 'fixed inset-0 m-0 hidden h-full max-h-none w-full max-w-none overflow-hidden border-0 bg-slate-950/50 p-0 text-inherit [&[open]]:grid backdrop:bg-transparent',
  overlayUnmasked: 'pointer-events-none bg-transparent',
  overlayPanel: 'pointer-events-auto min-w-0 max-h-full max-w-full overflow-auto bg-[var(--demo-color-surface-raised,#fff)] shadow-lg [&_.demo-surface]:w-full [&_.demo-surface]:p-5',
  overlayPanelDialog: 'place-self-center w-[min(var(--demo-overlay-size),calc(100%_-_32px))] rounded-[var(--demo-radius-md,8px)]',
  overlayPanelDrawer: 'absolute',
  overlayPanelDrawerLeft: 'inset-y-0 left-0 w-[min(var(--demo-overlay-size),calc(100%_-_24px))]',
  overlayPanelDrawerRight: 'inset-y-0 right-0 w-[min(var(--demo-overlay-size),calc(100%_-_24px))]',
  overlayPanelDrawerTop: 'inset-x-0 top-0 h-[min(var(--demo-overlay-size),calc(100%_-_24px))]',
  overlayPanelDrawerBottom: 'inset-x-0 bottom-0 h-[min(var(--demo-overlay-size),calc(100%_-_24px))]',
  overlayHeading: 'flex items-center justify-between gap-4 border-[var(--demo-color-border,#dfe3e8)] [border-bottom-style:var(--demo-border-style,solid)] [border-bottom-width:var(--demo-border-width,1px)] border-l-0 border-r-0 border-t-0 px-5 py-4',
  overlayTitle: 'm-0 text-lg font-[var(--demo-font-heading-weight,700)]',
  overlayClose: 'h-8 w-8 cursor-pointer border-0 bg-transparent text-2xl leading-none text-inherit',
} as const

const PROJECT_STYLES = `@import './theme.css';

* { box-sizing: border-box; }
html { color: var(--demo-color-text, #1f2937); background: var(--demo-color-canvas, #f4f6f8); font-family: var(--demo-font-family, system-ui, sans-serif); font-size: var(--demo-font-size, 16px); font-weight: var(--demo-font-body-weight, 400); line-height: var(--demo-line-height, 1.5); }
body { min-width: 320px; margin: 0; }
button, input, select, textarea { font: inherit; }
.demo-surface { width: min(960px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 56px; }
.demo-surface__header { margin-bottom: 24px; }
.demo-surface__header h1 { margin: 0; font-size: 28px; }
.demo-surface__content { display: grid; gap: var(--demo-spacing-md, 16px); }
.demo-field { display: grid; gap: 6px; }
.demo-field__label { font-size: 13px; font-weight: 600; }
.demo-field__required { margin-left: 4px; color: var(--demo-color-danger, #dc2626); }
.demo-field__error { color: var(--demo-color-danger, #dc2626); font-size: 12px; }
.demo-overlay { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; overflow: hidden; border: 0; color: inherit; background: rgb(15 23 42 / 48%); }
.demo-overlay[open] { display: grid; }
.demo-overlay::backdrop { background: transparent; }
.demo-overlay--unmasked { pointer-events: none; background: transparent; }
.demo-overlay__panel { pointer-events: auto; min-width: 0; max-width: 100%; max-height: 100%; overflow: auto; background: var(--demo-color-surface-raised, #fff); box-shadow: 0 18px 48px rgb(15 23 42 / 22%); }
.demo-overlay__panel--dialog { place-self: center; width: min(var(--demo-overlay-size), calc(100% - 32px)); border-radius: var(--demo-radius-md, 8px); }
.demo-overlay__panel--drawer { position: absolute; }
.demo-overlay__panel--drawer-left, .demo-overlay__panel--drawer-right { top: 0; bottom: 0; width: min(var(--demo-overlay-size), calc(100% - 24px)); }
.demo-overlay__panel--drawer-left { left: 0; }
.demo-overlay__panel--drawer-right { right: 0; }
.demo-overlay__panel--drawer-top, .demo-overlay__panel--drawer-bottom { right: 0; left: 0; height: min(var(--demo-overlay-size), calc(100% - 24px)); }
.demo-overlay__panel--drawer-top { top: 0; }
.demo-overlay__panel--drawer-bottom { bottom: 0; }
.demo-overlay__heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; border-bottom: 1px solid var(--demo-color-border, #dfe3e8); }
.demo-overlay__heading h2 { margin: 0; font-size: 18px; }
.demo-overlay__close { width: 32px; height: 32px; border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 24px; line-height: 1; }
.demo-overlay__panel .demo-surface { width: 100%; padding: 20px; }
@media (max-width: 640px) { .demo-surface { width: min(100% - 20px, 960px); padding-top: 20px; } }
`

const THEME_FONT_FAMILIES = {
  'system': 'system-ui, sans-serif',
  'sans-serif': 'ui-sans-serif, sans-serif',
  'serif': 'ui-serif, serif',
  'monospace': 'ui-monospace, monospace',
} as const

function themeSource(theme: ProjectTheme): string {
  const lines = [':root {']
  for (const [key, value] of Object.entries(theme.colors ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    lines.push(`  --demo-color-${kebabCase(key)}: ${value};`)
  for (const [key, value] of Object.entries(theme.spacing ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    lines.push(`  --demo-spacing-${key}: ${value}px;`)
  for (const [key, value] of Object.entries(theme.radius ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    lines.push(`  --demo-radius-${key}: ${value}px;`)
  if (theme.typography?.baseSize !== undefined)
    lines.push(`  --demo-font-size: ${theme.typography.baseSize}px;`)
  if (theme.typography?.lineHeight !== undefined)
    lines.push(`  --demo-line-height: ${theme.typography.lineHeight};`)
  if (theme.typography?.family !== undefined)
    lines.push(`  --demo-font-family: ${THEME_FONT_FAMILIES[theme.typography.family]};`)
  if (theme.typography?.bodyWeight !== undefined)
    lines.push(`  --demo-font-body-weight: ${theme.typography.bodyWeight};`)
  if (theme.typography?.headingWeight !== undefined)
    lines.push(`  --demo-font-heading-weight: ${theme.typography.headingWeight};`)
  if (theme.border?.width !== undefined)
    lines.push(`  --demo-border-width: ${theme.border.width}px;`)
  if (theme.border?.style !== undefined)
    lines.push(`  --demo-border-style: ${theme.border.style};`)
  for (const [key, shadow] of Object.entries(theme.shadows ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    lines.push(`  --demo-shadow-${key}: ${shadowValue(shadow)};`)
  lines.push('}')
  return `${lines.join('\n')}\n`
}

function shadowValue(shadow: NonNullable<ProjectTheme['shadows']>[keyof NonNullable<ProjectTheme['shadows']>]): string {
  if (!shadow)
    return ''
  return `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`
}

function tailwindThemeSource(theme: ProjectTheme): string {
  const themeLines: string[] = []
  for (const key of Object.keys(theme.colors ?? {}).sort())
    themeLines.push(`  --color-${kebabCase(key)}: var(--demo-color-${kebabCase(key)});`)
  for (const key of Object.keys(theme.spacing ?? {}).sort())
    themeLines.push(`  --spacing-${key}: var(--demo-spacing-${key});`)
  for (const key of Object.keys(theme.radius ?? {}).sort())
    themeLines.push(`  --radius-${kebabCase(key)}: var(--demo-radius-${kebabCase(key)});`)

  const typography = theme.typography
  if (typography?.family !== undefined) {
    themeLines.push('  --font-body: var(--demo-font-family);')
  }
  if (typography?.baseSize !== undefined)
    themeLines.push('  --text-base: var(--demo-font-size);')
  if (typography?.lineHeight !== undefined)
    themeLines.push('  --leading-normal: var(--demo-line-height);')
  if (typography?.bodyWeight !== undefined) {
    themeLines.push('  --font-weight-body: var(--demo-font-body-weight);')
  }
  if (typography?.headingWeight !== undefined) {
    themeLines.push('  --font-weight-heading: var(--demo-font-heading-weight);')
  }
  if (theme.border?.width !== undefined) {
    themeLines.push('  --border-width-demo: var(--demo-border-width);')
  }
  if (theme.border?.style !== undefined) {
    themeLines.push('  --border-style-demo: var(--demo-border-style);')
  }
  for (const key of Object.keys(theme.shadows ?? {}).sort()) {
    themeLines.push(`  --shadow-${key}: var(--demo-shadow-${key});`)
  }

  return `${themeSource(theme).trimEnd()}\n\n@theme inline {\n${themeLines.join('\n')}\n}\n`
}

function layoutGap(props: Readonly<Record<string, unknown>>): number {
  return typeof props.gap === 'number' && Number.isFinite(props.gap)
    ? Math.max(0, props.gap)
    : 0
}

function cssBackend(): SourceStyleBackend {
  return {
    target: 'css',
    rawStyleFile: 'src/styles.css',
    bindingStyleFile: 'src/styles.css',
    packageDevDependencies: {},
    vitePluginSource: CSS_VITE,
    bindingVitePluginSource: CSS_BINDING_VITE,
    classes: CSS_CLASSES,
    themeSource,
    stylesSource: () => PROJECT_STYLES,
    rawEntrySource({ imports, styleImports, libraryUses }) {
      return `import { createApp } from 'vue'\nimport App from './App.vue'\nimport { router } from './router'\n${imports.join('\n')}${imports.length ? '\n' : ''}${styleImports.join('\n')}${styleImports.length ? '\n' : ''}import './styles.css'\n\ncreateApp(App)${libraryUses.map(item => `.use(${item})`).join('')}.mount('#app')\n`
    },
    bindingEntrySource(styleImports) {
      return `${styleImports.join('\n')}${styleImports.length ? '\n' : ''}import './styles.css'\nexport type * from './host.ts'\n`
    },
    layoutAttributes(node, resolution) {
      if (resolution.render === 'layout-flex')
        return { style: { display: 'flex', flexDirection: node.props.direction === 'column' ? 'column' : 'row', flexWrap: node.props.wrap === false ? 'nowrap' : 'wrap', gap: `${layoutGap(node.props)}px`, alignItems: typeof node.props.align === 'string' ? node.props.align : 'stretch', justifyContent: typeof node.props.justify === 'string' ? node.props.justify : 'flex-start' } as Record<string, string> }
      if (resolution.render === 'layout-grid') {
        const columns = typeof node.props.columns === 'number' && Number.isInteger(node.props.columns) ? Math.min(12, Math.max(1, node.props.columns)) : 1
        return { style: { display: 'grid', gap: `${layoutGap(node.props)}px`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } as Record<string, string> }
      }
      return {}
    },
    bindingAttributes() {
      return { formAttrs: {}, layoutAttrs: {}, cellAttrs: {}, fieldAttrs: {} }
    },
  }
}

function tailwindBackend(): SourceStyleBackend {
  return {
    target: 'tailwind-v4',
    rawStyleFile: 'src/styles.css',
    bindingStyleFile: 'src/styles.css',
    packageDevDependencies: { '@tailwindcss/vite': '^4.1.13', 'tailwindcss': '^4.1.13' },
    vitePluginSource: TAILWIND_VITE,
    bindingVitePluginSource: TAILWIND_BINDING_VITE,
    classes: TAILWIND_CLASSES,
    themeSource: tailwindThemeSource,
    stylesSource: () => `@import 'tailwindcss';\n@import './theme.css';\n\n* { box-sizing: border-box; }\nhtml { color: var(--demo-color-text, #1f2937); background: var(--demo-color-canvas, #f4f6f8); font-family: var(--demo-font-family, system-ui, sans-serif); font-size: var(--demo-font-size, 16px); font-weight: var(--demo-font-body-weight, 400); line-height: var(--demo-line-height, 1.5); }\nbody { min-width: 320px; margin: 0; }\nbutton, input, select, textarea { font: inherit; }\n`,
    rawEntrySource({ imports, styleImports, libraryUses }) {
      return `import { createApp } from 'vue'\nimport App from './App.vue'\nimport { router } from './router'\n${imports.join('\n')}${imports.length ? '\n' : ''}${styleImports.join('\n')}${styleImports.length ? '\n' : ''}import './styles.css'\n\ncreateApp(App)${libraryUses.map(item => `.use(${item})`).join('')}.mount('#app')\n`
    },
    bindingEntrySource(styleImports) {
      return `${styleImports.join('\n')}${styleImports.length ? '\n' : ''}import './styles.css'\nexport type * from './host.ts'\n`
    },
    layoutAttributes(node, resolution) {
      if (resolution.render === 'layout-flex') {
        const direction = node.props.direction === 'column' ? 'flex-col' : 'flex-row'
        const wrap = node.props.wrap === false ? 'flex-nowrap' : 'flex-wrap'
        const alignMap: Record<string, string> = { 'start': 'items-start', 'flex-start': 'items-start', 'end': 'items-end', 'flex-end': 'items-end', 'center': 'items-center', 'stretch': 'items-stretch', 'baseline': 'items-baseline' }
        const justifyMap: Record<string, string> = { 'start': 'justify-start', 'flex-start': 'justify-start', 'end': 'justify-end', 'flex-end': 'justify-end', 'center': 'justify-center', 'space-between': 'justify-between', 'space-around': 'justify-around', 'space-evenly': 'justify-evenly' }
        const align = alignMap[String(node.props.align)] ?? 'items-stretch'
        const justify = justifyMap[String(node.props.justify)] ?? 'justify-start'
        const gap = `gap-[${layoutGap(node.props)}px]`
        return { className: `flex ${direction} ${wrap} ${gap} ${align} ${justify}` }
      }
      if (resolution.render === 'layout-grid') {
        const columns = typeof node.props.columns === 'number' && Number.isInteger(node.props.columns) ? Math.min(12, Math.max(1, node.props.columns)) : 1
        const gap = `gap-[${layoutGap(node.props)}px]`
        return { className: `grid ${gap} grid-cols-${columns}` }
      }
      return {}
    },
    bindingAttributes() {
      return {
        formAttrs: { class: 'w-full' },
        layoutAttrs: { class: 'grid gap-4' },
        cellAttrs: { class: 'min-w-0' },
        fieldAttrs: { class: 'grid gap-1.5' },
      }
    },
  }
}

export function createSourceStyleBackend(options: SourceStyleBackendOptions = {}): SourceStyleBackend {
  if (options.target === 'tailwind-v4')
    return tailwindBackend()
  return cssBackend()
}

export function isSourceStyleTarget(value: unknown): value is SourceStyleTarget {
  return value === 'css' || value === 'tailwind-v4'
}

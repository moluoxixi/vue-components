import type { DefaultTheme, UserConfig } from 'vitepress'
import type { DocsLocale } from './docs-site'
import { defineConfig } from 'vitepress'
import { createComponentAutoLoadPlugins } from './auto-loaders'
import { getDocsMessages, getLocalizedComponentGroups, localePath } from './docs-i18n'
import {
  defaultDocsLocale,
  docsLocales,
  docsRoutePath,
  docsSite,
} from './docs-site'
import { demoPlugin } from './plugins/demo'

function createThemeConfig(locale: DocsLocale): DefaultTheme.Config {
  const messages = getDocsMessages(locale)
  const componentGroups = getLocalizedComponentGroups(locale)
  const localPath = (path: string) => localePath(locale, path)

  return {
    logo: docsSite.logo.src,
    siteTitle: docsSite.siteTitle,
    returnToTopLabel: messages.theme.returnToTop,
    sidebarMenuLabel: messages.theme.menu,
    darkModeSwitchLabel: messages.theme.theme,
    lightModeSwitchTitle: messages.theme.lightMode,
    darkModeSwitchTitle: messages.theme.darkMode,
    langMenuLabel: messages.theme.languageMenu,
    skipToContentLabel: messages.theme.skipToContent,
    notFound: messages.theme.notFound,
    nav: [
      { text: messages.nav.overview, link: localPath('/') },
      { text: messages.nav.guide, link: localPath(docsRoutePath('guide', 'getting-started')), activeMatch: localPath(docsRoutePath('guide')) },
      { text: messages.nav.components, link: localPath(docsRoutePath('components')), activeMatch: localPath(docsRoutePath('components')) },
    ],
    sidebar: {
      [localPath(docsRoutePath('guide'))]: [
        {
          text: messages.nav.guide,
          items: [
            { text: messages.nav.gettingStarted, link: localPath(docsRoutePath('guide', 'getting-started')) },
            { text: messages.nav.customization, link: localPath(docsRoutePath('guide', 'documentation-theme')) },
          ],
        },
      ],
      [localPath(docsRoutePath('components'))]: componentGroups.map((group, index) => ({
        text: group.title,
        items: [
          ...(index === 0 ? [{ text: messages.nav.componentOverview, link: localPath(docsRoutePath('components')) }] : []),
          ...group.items.map(component => ({
            text: component.sidebarText,
            link: localPath(docsRoutePath('components', component.slug)),
          })),
        ],
      })),
    },
    socialLinks: [
      { icon: 'github', link: docsSite.repository.url },
    ],
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: messages.theme.search,
            buttonAriaLabel: messages.theme.searchAria,
          },
          modal: {
            noResultsText: messages.theme.noResults,
            resetButtonTitle: messages.theme.resetSearch,
            footer: {
              selectText: messages.theme.select,
              navigateText: messages.theme.navigate,
              closeText: messages.theme.close,
            },
          },
        },
      },
    },
    outline: {
      level: [2, 3],
      label: messages.theme.outline,
    },
    docFooter: {
      prev: messages.theme.previous,
      next: messages.theme.next,
    },
    lastUpdated: {
      text: messages.theme.lastUpdated,
    },
  }
}

const vitepressLocales = Object.fromEntries(
  (Object.keys(docsLocales) as DocsLocale[]).map((locale) => {
    const configured = docsLocales[locale]
    return [configured.siteKey, {
      label: configured.label,
      lang: configured.lang,
      ...(locale === defaultDocsLocale ? {} : { link: `${configured.pathPrefix}/` }),
      title: docsSite.title,
      description: getDocsMessages(locale).siteDescription,
      themeConfig: createThemeConfig(locale),
    }]
  }),
)

const rewrites = Object.fromEntries(
  (Object.keys(docsLocales) as DocsLocale[]).map((locale) => {
    const configured = docsLocales[locale]
    const target = localePath(locale, docsRoutePath('components')).replace(/^\//, '')
    return [`${configured.sourceDirectory}routes/:slug.md`, `${target}:slug.md`]
  }),
)

// VitePress 1.x exposes Vite 5 types while the workspace unplugins resolve Vite 6.
// Their runtime plugin contract is compatible; keep the version bridge at this boundary.
const componentAutoLoadPlugins = createComponentAutoLoadPlugins() as NonNullable<UserConfig['vite']>['plugins']

export default defineConfig({
  title: docsSite.title,
  description: getDocsMessages(defaultDocsLocale).siteDescription,
  base: '/',
  lastUpdated: true,
  locales: vitepressLocales,
  rewrites,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: docsSite.logo.src }],
  ],
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    config(md) {
      md.use(demoPlugin)
    },
  },
  vite: {
    plugins: componentAutoLoadPlugins,
    resolve: {
      alias: [
        { find: '@docs-components/styles', replacement: docsSite.packageStylesImport },
        { find: '@docs-components', replacement: docsSite.packageName },
      ],
    },
    optimizeDeps: {
      include: ['@lucide/vue', 'element-plus', 'vue3-sfc-loader'],
    },
    ssr: {
      noExternal: ['element-plus', 'vue3-sfc-loader'],
    },
  },
})

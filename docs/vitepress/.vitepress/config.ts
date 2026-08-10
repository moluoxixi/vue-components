import type { DefaultTheme, UserConfig } from 'vitepress'
import type { DocsLocale } from './docs-site'
import process from 'node:process'
import { defineElementPlusDocs } from '@moluoxixi/vitepress-theme-element-plus'
import { elementPlusDocsDemoPlugin } from '@moluoxixi/vitepress-theme-element-plus/markdown'
import { createStableChunksPlugin } from '../../../scripts/vite-chunks'
import { createComponentAutoLoadPlugins } from './auto-loaders'
import { getDocsMessages, getLocalizedComponentGroups, localePath } from './docs-i18n'
import {
  defaultDocsLocale,
  docsLocales,
  docsRoutePath,
  docsSite,
} from './docs-site'
import { createDocsDemoSourceHrefResolver } from './markdown/demo-source-links'

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
      level: [2, 6],
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
    return [locale, {
      siteKey: configured.siteKey,
      label: configured.label,
      lang: configured.lang,
      pathPrefix: configured.pathPrefix,
      description: getDocsMessages(locale).siteDescription,
      themeConfig: createThemeConfig(locale),
    }]
  }),
)

// VitePress 1.x exposes Vite 5 types while the workspace unplugins resolve Vite 6.
// Their runtime plugin contract is compatible; keep the version bridge at this boundary.
type VitePressPlugins = NonNullable<NonNullable<UserConfig['vite']>['plugins']>

const componentAutoLoadPlugins = createComponentAutoLoadPlugins() as VitePressPlugins
const docsBase = process.env.DOCS_BASE ?? '/'
const docsLogoHref = `${docsBase === '/' ? '' : docsBase.replace(/\/$/, '')}${docsSite.logo.src}`

export default defineElementPlusDocs({
  site: {
    title: docsSite.title,
    siteTitle: docsSite.siteTitle,
    description: getDocsMessages(defaultDocsLocale).siteDescription,
    logo: docsSite.logo.src,
    base: docsBase,
    locales: vitepressLocales,
    defaultLocale: defaultDocsLocale,
  },
  repository: {
    ...docsSite.repository,
    editLinks: false,
  },
  components: {
    styles: docsSite.packageStylesImport,
  },
  routes: {
    overview: '/',
    guide: docsSite.routes.guide,
    components: docsSite.routes.components,
  },
  search: 'local',
  vitepress: {
    head: [
      ['link', { rel: 'icon', type: 'image/svg+xml', href: docsLogoHref }],
    ],
    markdown: {
      theme: {
        light: 'github-light',
        dark: 'github-dark',
      },
      config(md) {
        md.use(elementPlusDocsDemoPlugin, {
          resolveSourceHref: createDocsDemoSourceHrefResolver(md),
        })
      },
    },
    vite: {
      plugins: [
        ...componentAutoLoadPlugins,
        createStableChunksPlugin({
          antd: false,
          configForm: false,
          element: false,
          richText: false,
        }),
      ] as VitePressPlugins,
      resolve: {
        conditions: ['source'],
        alias: [
          { find: '@docs-components', replacement: docsSite.packageName },
        ],
      },
      optimizeDeps: {
        include: ['@lucide/vue', 'element-plus'],
      },
      ssr: {
        noExternal: ['element-plus'],
      },
    },
  },
})

import type {
  ElementPlusDocsContentIntegration,
  ElementPlusDocsContentPlugin,
  ElementPlusDocsContentResolverContext,
  ElementPlusDocsContentRuntime,
} from './types'
import { computed, defineComponent, h } from 'vue'
import ElementPlusDocsApiDocs from '../api/ElementPlusDocsApiDocs.vue'
import ElementPlusDocsComponentOverview from '../catalog/ElementPlusDocsComponentOverview.vue'
import ElementPlusDocsOverviewHome from '../catalog/ElementPlusDocsOverviewHome.vue'
import ElementPlusDocsDemo from '../demo'
import ElementPlusDocsComponentMeta from '../meta/ElementPlusDocsComponentMeta.vue'
import ElementPlusDocsContributors from '../meta/ElementPlusDocsContributors.vue'
import ElementPlusDocsPlayground from '../playground/ElementPlusDocsPlayground.vue'
import { createElementPlusDocsPlaygroundActions } from '../playground/registry'

function resolverContext(runtime: ElementPlusDocsContentRuntime): ElementPlusDocsContentResolverContext {
  return {
    link: runtime.link,
    locale: runtime.locale.value,
    messages: runtime.messages.value,
  }
}

export function createElementPlusDocsContent(
  integration: ElementPlusDocsContentIntegration,
): ElementPlusDocsContentPlugin {
  const ApiDocs = defineComponent({
    name: 'ElementPlusDocsIntegratedApiDocs',
    props: {
      name: { type: String, required: true },
    },
    setup(props) {
      const runtime = integration.useLocale()
      const api = computed(() => integration.resolveApi({
        ...resolverContext(runtime),
        name: props.name,
      }))

      return () => h(ElementPlusDocsApiDocs, {
        api: api.value,
        messages: runtime.messages.value.api,
      })
    },
  })

  const Demo = defineComponent({
    name: 'ElementPlusDocsIntegratedDemo',
    props: {
      code: { type: String, required: true },
      demoId: { type: String, required: true },
      externalProjectCode: { type: String, required: false },
      externalProjectJsCode: { type: String, required: false },
      highlighted: { type: String, required: true },
      jsCode: { type: String, required: false },
      jsHighlighted: { type: String, required: false },
      sourceHref: { type: String, required: false },
      title: { type: String, required: false },
    },
    setup(props) {
      const runtime = integration.useLocale()
      const playgroundActions = createElementPlusDocsPlaygroundActions(
        integration.playground,
        {
          asset: runtime.asset,
          assign: url => window.location.assign(url),
          isDark: () => document.documentElement.classList.contains('dark'),
          link: runtime.link,
          location: () => window.location.href,
          open: url => window.open(url, '_blank', 'noopener,noreferrer'),
        },
      )

      return () => h(ElementPlusDocsDemo, {
        code: props.code,
        compile: integration.playground.compile,
        copy: integration.playground.copy,
        demoId: props.demoId,
        externalProjectCode: props.externalProjectCode,
        externalProjectJsCode: props.externalProjectJsCode,
        highlighted: props.highlighted,
        jsCode: props.jsCode,
        jsHighlighted: props.jsHighlighted,
        messages: runtime.messages.value.demo,
        playgroundActions,
        sourceHref: props.sourceHref,
        title: props.title,
      })
    },
  })

  const ComponentOverview = defineComponent({
    name: 'ElementPlusDocsIntegratedComponentOverview',
    setup() {
      const runtime = integration.useLocale()
      const groups = computed(() => integration.resolveCatalog(resolverContext(runtime)))

      return () => h(ElementPlusDocsComponentOverview, {
        groups: groups.value,
        messages: runtime.messages.value.overview,
      })
    },
  })

  const OverviewHome = defineComponent({
    name: 'ElementPlusDocsIntegratedOverviewHome',
    setup() {
      const runtime = integration.useLocale()
      const groups = computed(() => integration.resolveCatalog(resolverContext(runtime)))
      const data = computed(() => ({
        facts: integration.resolveOverviewFacts({
          ...resolverContext(runtime),
          groups: groups.value,
        }),
        gettingStartedHref: runtime.link(integration.overview.gettingStartedPath),
        logo: {
          alt: integration.overview.logo.alt,
          src: runtime.asset(integration.overview.logo.src),
        },
        siteTitle: integration.overview.siteTitle,
      }))

      return () => h(ElementPlusDocsOverviewHome, {
        data: data.value,
        groups: groups.value,
        messages: runtime.messages.value.overview,
      })
    },
  })

  const ComponentDocMeta = defineComponent({
    name: 'ElementPlusDocsIntegratedComponentDocMeta',
    props: {
      hasSourceDoc: { type: Boolean, required: true },
      name: { type: String, required: true },
      slug: { type: String, required: true },
    },
    setup(props) {
      const runtime = integration.useLocale()
      const data = computed(() => integration.resolveComponentMeta({
        ...resolverContext(runtime),
        hasSourceDoc: props.hasSourceDoc,
        name: props.name,
        slug: props.slug,
      }))

      return () => h(ElementPlusDocsComponentMeta, {
        data: data.value,
        locale: runtime.locale.value,
        messages: runtime.messages.value,
      })
    },
  })

  const DocContributors = defineComponent({
    name: 'ElementPlusDocsIntegratedDocContributors',
    props: {
      name: { type: String, required: true },
    },
    setup(props) {
      const runtime = integration.useLocale()
      const contributors = computed(() => integration.resolveContributors({
        ...resolverContext(runtime),
        name: props.name,
      }))

      return () => contributors.value === undefined
        ? null
        : h(ElementPlusDocsContributors, {
            contributors: contributors.value,
            messages: runtime.messages.value,
            name: props.name,
          })
    },
  })

  const Playground = defineComponent({
    name: 'ElementPlusDocsIntegratedPlayground',
    setup() {
      const runtime = integration.useLocale()

      return () => h(ElementPlusDocsPlayground, {
        compile: integration.playground.compile,
        copy: integration.playground.copy,
        messages: runtime.messages.value.playground,
        starterSource: integration.playground.starterSource,
      })
    },
  })

  const components = {
    ApiDocs,
    ComponentDocMeta,
    ComponentOverview,
    Demo,
    DocContributors,
    OverviewHome,
    Playground,
  }

  return {
    components,
    install(app) {
      for (const [name, component] of Object.entries(components))
        app.component(name, component)
    },
  }
}

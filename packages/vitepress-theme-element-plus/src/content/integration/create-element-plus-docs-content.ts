import type {
  ElementPlusDocsContentIntegration,
  ElementPlusDocsContentPlugin,
  ElementPlusDocsContentResolverContext,
  ElementPlusDocsContentRuntime,
} from './types'
import { computed, defineComponent, h } from 'vue'
import ElementPlusDocsComponentOverview from '../catalog/ElementPlusDocsComponentOverview.vue'
import ElementPlusDocsOverviewHome from '../catalog/ElementPlusDocsOverviewHome.vue'
import ElementPlusDocsComponentMeta from '../meta/ElementPlusDocsComponentMeta.vue'
import ElementPlusDocsContributors from '../meta/ElementPlusDocsContributors.vue'

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

      return () => h(ElementPlusDocsContributors, {
        contributors: contributors.value,
        messages: runtime.messages.value,
        name: props.name,
      })
    },
  })

  const components = {
    ComponentDocMeta,
    ComponentOverview,
    DocContributors,
    OverviewHome,
  }

  return {
    components,
    install(app) {
      for (const [name, component] of Object.entries(components))
        app.component(name, component)
    },
  }
}

import { ElConfigProvider, namespaceContextKey } from 'element-plus'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { computed, defineAsyncComponent, defineComponent, h, inject, provide, ref } from 'vue'
import { useLang } from '../upstream/vitepress/composables/lang'
import { docsConsumerNamespaceKey } from './consumer-namespace'

const VPApp = defineAsyncComponent(() => import('../upstream/vitepress/components/vp-app.vue'))

export default defineComponent({
  name: 'ElementPlusDocsLayout',
  setup() {
    // Capture the ancestor provider, not EP's module-global fallback, which
    // the first ConfigProvider can initialize while rendering the theme.
    const consumerNamespace = inject(namespaceContextKey, ref('el'))
    provide(docsConsumerNamespaceKey, consumerNamespace)
    const lang = useLang()
    const locale = computed(() => lang.value.toLowerCase().startsWith('zh') ? zhCn : en)
    return () => h(ElConfigProvider, { namespace: consumerNamespace.value, locale: locale.value }, () => h(VPApp))
  },
})

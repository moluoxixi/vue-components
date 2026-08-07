import { ElConfigProvider } from 'element-plus'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { computed, defineAsyncComponent, defineComponent, h } from 'vue'
import { useLang } from '../upstream/vitepress/composables/lang'

const VPApp = defineAsyncComponent(() => import('../upstream/vitepress/components/vp-app.vue'))

export default defineComponent({
  name: 'ElementPlusDocsLayout',
  setup() {
    const lang = useLang()
    const locale = computed(() => lang.value.toLowerCase().startsWith('zh') ? zhCn : en)
    return () => h(ElConfigProvider, { locale: locale.value }, () => h(VPApp))
  },
})

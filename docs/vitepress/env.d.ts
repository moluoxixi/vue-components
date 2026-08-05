type VueSfcLoadModule = typeof import('vue3-sfc-loader/dist/types/vue3-esm/index').loadModule

declare module 'vue3-sfc-loader' {
  export const loadModule: VueSfcLoadModule
}

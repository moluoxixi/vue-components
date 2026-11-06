// Keep VitePress's private SFC and build-time globals behind this typed bridge.
// Importing its theme barrel here would reintroduce application-wide resets.
export { default } from 'vitepress/dist/client/theme-default/components/VPNavBarSearch.vue'

import type { Component } from 'vue'
import Search from './vitepress-search.js'

// Import the search component directly. The theme barrel also imports base.css
// and vp-doc.css, whose resets leak into consumer components and teleports.
export const VPNavBarSearch: Component = Search

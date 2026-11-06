// VitePress compiles this private SFC with its own virtual modules and define
// constants. Our boundary consumes its component API, not its source types.
import type { Component } from 'vue'

declare const search: Component
export default search

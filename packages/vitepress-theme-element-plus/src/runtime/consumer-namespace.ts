import type { InjectionKey, Ref } from 'vue'

export const docsUiNamespace = 'epd'
export const docsConsumerNamespaceKey: InjectionKey<Readonly<Ref<string>>> = Symbol('docs-consumer-namespace')

import type { InspectorSectionId } from '../../../inspector'
import { nextTick, ref, useId, watch } from 'vue'

interface PropertyTabEntry {
  id: InspectorSectionId
}

interface UseDesignerPropertyTabsOptions {
  identity: () => string
  tabs: () => PropertyTabEntry[]
}

export function useDesignerPropertyTabs(options: UseDesignerPropertyTabsOptions) {
  const activeTab = ref<InspectorSectionId>('properties')
  const propertyPanelRef = ref<HTMLElement>()
  const propertyTabsId = useId()

  function propertyTabId(tab: InspectorSectionId): string {
    return `${propertyTabsId}-tab-${tab}`
  }

  function propertyTabPanelId(tab: InspectorSectionId): string {
    return `${propertyTabsId}-panel-${tab}`
  }

  function propertyTabElement(tab: InspectorSectionId): HTMLButtonElement | undefined {
    return propertyPanelRef.value
      ?.querySelector<HTMLButtonElement>(`[data-property-tab="${tab}"]`) ?? undefined
  }

  function propertyTabPanelElement(tab: InspectorSectionId): HTMLElement | undefined {
    return propertyPanelRef.value
      ?.querySelector<HTMLElement>(`[data-property-panel="${tab}"]`) ?? undefined
  }

  function scrollPropertyTabIntoView(tab: InspectorSectionId): void {
    const element = propertyTabElement(tab)
    if (!element?.scrollIntoView)
      return
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    element.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }

  function selectPropertyTab(tab: InspectorSectionId): void {
    if (!options.tabs().some(candidate => candidate.id === tab))
      return
    activeTab.value = tab
    void nextTick(() => scrollPropertyTabIntoView(tab))
  }

  function handlePropertyTabKeydown(event: KeyboardEvent, tab: InspectorSectionId): void {
    const tabs = options.tabs()
    const index = tabs.findIndex(item => item.id === tab)
    let nextIndex = index
    if (event.key === 'ArrowRight')
      nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft')
      nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home')
      nextIndex = 0
    else if (event.key === 'End')
      nextIndex = tabs.length - 1
    else
      return
    event.preventDefault()
    const nextTab = tabs[nextIndex]!.id
    selectPropertyTab(nextTab)
    void nextTick(() => propertyTabElement(nextTab)?.focus())
  }

  watch(options.identity, async () => {
    const current = options.tabs().find(tab => tab.id === activeTab.value)
    if (current) {
      await nextTick()
      scrollPropertyTabIntoView(current.id)
      return
    }
    const previousTab = activeTab.value
    const previousElement = propertyTabElement(previousTab)
    const previousPanel = propertyTabPanelElement(previousTab)
    const activeElement = typeof document === 'undefined' ? null : document.activeElement
    const shouldRestoreFocus = activeElement !== null
      && (activeElement === previousElement || previousPanel?.contains(activeElement) === true)
    activeTab.value = options.tabs()[0]?.id ?? 'properties'
    await nextTick()
    const fallback = propertyTabElement(activeTab.value)
    if (shouldRestoreFocus)
      fallback?.focus()
    scrollPropertyTabIntoView(activeTab.value)
  })

  return {
    activeTab,
    handlePropertyTabKeydown,
    propertyPanelRef,
    propertyTabId,
    propertyTabPanelId,
    selectPropertyTab,
  }
}

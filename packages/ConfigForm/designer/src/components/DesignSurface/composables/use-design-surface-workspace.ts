import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { DesignSurfaceExpose } from '../types'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

type WorkspaceView = Parameters<DesignSurfaceExpose['selectWorkspaceView']>[0]
type SidePanel = Exclude<WorkspaceView, 'canvas'>

interface UseDesignSurfaceWorkspaceOptions {
  navigation: () => 'external' | 'internal'
}

const workspaceViews = [
  { id: 'palette' as const, label: 'Components' },
  { id: 'canvas' as const, label: 'Canvas' },
  { id: 'properties' as const, label: 'Inspector' },
]

function recommendedBreakpoint(): ConfigFormBreakpoint {
  if (typeof window === 'undefined')
    return 'desktop'
  if (window.innerWidth <= 720)
    return 'mobile'
  if (window.innerWidth <= 1024)
    return 'tablet'
  return 'desktop'
}

export function useDesignSurfaceWorkspace(options: UseDesignSurfaceWorkspaceOptions) {
  const rootRef = ref<HTMLElement>()
  const activeBreakpoint = ref<ConfigFormBreakpoint>(recommendedBreakpoint())
  const activeWorkspaceView = ref<WorkspaceView>('canvas')
  const workspaceWidth = ref<number>()
  const paletteOpen = ref(true)
  const propertiesOpen = ref(true)
  const mediumPanel = ref<SidePanel>()
  const workspaceId = useId()
  let breakpointManuallySelected = false
  let resizeObserver: ResizeObserver | undefined
  let focusedWorkspaceControl: { kind: 'drawer' | 'panel' | 'tab' | 'trigger', view: WorkspaceView } | undefined

  const workspaceMode = computed(() => {
    const width = workspaceWidth.value
    if (!width)
      return 'desktop' as const
    if (width <= 720)
      return 'narrow' as const
    if (width <= 1100)
      return 'medium' as const
    return 'desktop' as const
  })

  function syncBreakpointToViewport(): void {
    if (!breakpointManuallySelected)
      activeBreakpoint.value = recommendedBreakpoint()
  }

  function selectBreakpoint(breakpoint: ConfigFormBreakpoint): void {
    breakpointManuallySelected = true
    activeBreakpoint.value = breakpoint
  }

  function selectWorkspaceView(view: WorkspaceView): void {
    activeWorkspaceView.value = view
    if (workspaceMode.value === 'medium' && view !== 'canvas')
      mediumPanel.value = view
  }

  function measureWorkspace(): void {
    const width = rootRef.value?.getBoundingClientRect().width
    if (width && width > 0)
      workspaceWidth.value = width
  }

  function isSidePanelOpen(view: SidePanel): boolean {
    if (workspaceMode.value === 'medium')
      return mediumPanel.value === view
    return view === 'palette' ? paletteOpen.value : propertiesOpen.value
  }

  function isWorkspacePanelHidden(view: WorkspaceView): boolean {
    if (workspaceMode.value === 'narrow')
      return activeWorkspaceView.value !== view
    if (workspaceMode.value === 'medium')
      return view === 'canvas' ? false : mediumPanel.value !== view
    if (view === 'palette')
      return !paletteOpen.value
    if (view === 'properties')
      return !propertiesOpen.value
    return false
  }

  function toggleWorkspacePanel(view: SidePanel): void {
    if (workspaceMode.value === 'medium') {
      mediumPanel.value = mediumPanel.value === view ? undefined : view
      return
    }
    if (view === 'palette')
      paletteOpen.value = !paletteOpen.value
    else
      propertiesOpen.value = !propertiesOpen.value
  }

  function closeMediumPanel(view: SidePanel): void {
    if (workspaceMode.value !== 'medium' || mediumPanel.value !== view)
      return
    const activeElement = document.activeElement
    const panel = rootRef.value?.querySelector<HTMLElement>(`[data-workspace-panel="${view}"]`)
    const restoreFocus = activeElement === document.body
      || (activeElement instanceof HTMLElement && panel?.contains(activeElement))
    mediumPanel.value = undefined
    if (restoreFocus) {
      void nextTick(() => rootRef.value
        ?.querySelector<HTMLButtonElement>(`[data-sidebar-trigger="${view}"]`)
        ?.focus())
    }
  }

  function handleWorkspaceTabKeydown(event: KeyboardEvent, view: WorkspaceView): void {
    const index = workspaceViews.findIndex(item => item.id === view)
    let nextIndex = index
    if (event.key === 'ArrowRight')
      nextIndex = (index + 1) % workspaceViews.length
    else if (event.key === 'ArrowLeft')
      nextIndex = (index - 1 + workspaceViews.length) % workspaceViews.length
    else if (event.key === 'Home')
      nextIndex = 0
    else if (event.key === 'End')
      nextIndex = workspaceViews.length - 1
    else
      return
    event.preventDefault()
    activeWorkspaceView.value = workspaceViews[nextIndex]!.id
    void nextTick(() => rootRef.value
      ?.querySelector<HTMLButtonElement>(`[data-workspace-tab="${activeWorkspaceView.value}"]`)
      ?.focus())
  }

  function workspaceViewForElement(element: HTMLElement | null): WorkspaceView | undefined {
    const view = element?.dataset.workspaceTab
      ?? element?.dataset.sidebarTrigger
      ?? element?.closest<HTMLElement>('[data-workspace-panel]')?.dataset.workspacePanel
    return workspaceViews.some(item => item.id === view) ? view as WorkspaceView : undefined
  }

  function handleRootFocusin(event: FocusEvent): void {
    const element = event.target instanceof HTMLElement ? event.target : null
    const view = workspaceViewForElement(element)
    if (!view) {
      focusedWorkspaceControl = undefined
      return
    }
    focusedWorkspaceControl = {
      kind: element?.dataset.drawerControl
        ? 'drawer'
        : element?.dataset.workspaceTab
          ? 'tab'
          : element?.dataset.sidebarTrigger
            ? 'trigger'
            : 'panel',
      view,
    }
  }

  watch(workspaceMode, (mode, previousMode) => {
    if (mode === previousMode)
      return
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusedView = workspaceViewForElement(activeElement) ?? focusedWorkspaceControl?.view
    if (mode === 'narrow') {
      if (options.navigation() === 'external') {
        if (focusedView && focusedView !== activeWorkspaceView.value) {
          void nextTick(() => rootRef.value
            ?.querySelector<HTMLElement>(`[data-workspace-panel="${activeWorkspaceView.value}"]`)
            ?.focus())
        }
        return
      }
      activeWorkspaceView.value = focusedView
        ?? (previousMode === 'medium' ? mediumPanel.value : undefined)
        ?? activeWorkspaceView.value
      return
    }
    if (previousMode !== 'narrow')
      return
    const view = activeWorkspaceView.value
    if (mode === 'medium')
      mediumPanel.value = view === 'canvas' ? undefined : view
    else if (view === 'palette')
      paletteOpen.value = true
    else if (view === 'properties')
      propertiesOpen.value = true
  }, { flush: 'sync' })

  onMounted(() => {
    syncBreakpointToViewport()
    window.addEventListener('resize', syncBreakpointToViewport)
    measureWorkspace()
    if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
      resizeObserver = new ResizeObserver(measureWorkspace)
      resizeObserver.observe(rootRef.value)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', syncBreakpointToViewport)
    resizeObserver?.disconnect()
  })

  return {
    activeBreakpoint,
    activeWorkspaceView,
    closeMediumPanel,
    handleRootFocusin,
    handleWorkspaceTabKeydown,
    isSidePanelOpen,
    isWorkspacePanelHidden,
    mediumPanel,
    paletteOpen,
    propertiesOpen,
    rootRef,
    selectBreakpoint,
    selectWorkspaceView,
    toggleWorkspacePanel,
    workspaceId,
    workspaceMode,
    workspaceViews,
  }
}

import type {
  ConfigFormRuntimeEditorBridge,
  ConfigFormRuntimeNodeMetadata,
} from '@moluoxixi/config-form'
import type { CSSProperties, Ref } from 'vue'
import type { RuntimeHostSyncMessage, RuntimeHostToParentPayload } from '../types'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

export function useRuntimeHostDesignGeometry(options: {
  design: Ref<RuntimeHostSyncMessage['design']>
  postMessage: (message: RuntimeHostToParentPayload) => void
  runtimeMode: Ref<'design' | 'preview'>
}) {
  const { design, postMessage, runtimeMode } = options
  const stage = useTemplateRef<HTMLElement>('stage')
  const ghostOffset = ref<{ x: number, y: number }>()
  const registeredNodes = new Map<string, {
    element: HTMLElement
    metadata: ConfigFormRuntimeNodeMetadata<Record<string, unknown>>
    order: number
  }>()
  let geometryFrame: number | undefined
  let nodeOrder = 0
  let geometryObserver: ResizeObserver | undefined

  function rectPayload(rect: DOMRect) {
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
    }
  }

  function scheduleGeometry(): void {
    if (runtimeMode.value !== 'design' || design.value?.variant !== 'canvas' || geometryFrame !== undefined)
      return
    geometryFrame = window.requestAnimationFrame(emitGeometry)
  }

  function flushGeometry(): void {
    if (geometryFrame !== undefined)
      window.cancelAnimationFrame(geometryFrame)
    geometryFrame = undefined
    emitGeometry()
  }

  function emitGeometry(): void {
    geometryFrame = undefined
    const stageElement = stage.value
    if (!stageElement || runtimeMode.value !== 'design')
      return
    const form = stageElement.querySelector<HTMLElement>('form') ?? stageElement
    const layout = stageElement.querySelector<HTMLElement>('[data-config-form-responsive-layout]')
    const nodes = [...registeredNodes.values()]
      .map(registration => ({
        depth: registration.metadata.path.split('.').filter(Boolean).length,
        nodeId: registration.metadata.nodeId,
        order: registration.order,
        path: registration.metadata.path,
        rect: rectPayload(registration.element.getBoundingClientRect()),
        ...(registration.metadata.slot ? { slot: registration.metadata.slot } : {}),
      }))
    postMessage({
      type: 'geometry',
      payload: {
        ...(layout ? { layoutRect: rectPayload(layout.getBoundingClientRect()) } : {}),
        nodes,
        surfaceRect: rectPayload(form.getBoundingClientRect()),
        viewport: {
          height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, form.getBoundingClientRect().bottom),
          width: document.documentElement.clientWidth,
        },
      },
    })
  }

  function registerDesignNode(
    metadata: ConfigFormRuntimeNodeMetadata<Record<string, unknown>>,
    element: HTMLElement,
  ): () => void {
    const key = metadata.nodeId
    const current = registeredNodes.get(key)
    if (current && current.element !== element)
      geometryObserver?.unobserve(current.element)
    const registration = {
      element,
      metadata,
      order: current?.order ?? nodeOrder++,
    }
    registeredNodes.set(key, registration)
    geometryObserver?.observe(element)
    scheduleGeometry()
    return () => {
      if (registeredNodes.get(key) !== registration)
        return
      geometryObserver?.unobserve(element)
      registeredNodes.delete(key)
      scheduleGeometry()
    }
  }

  const designEditor: ConfigFormRuntimeEditorBridge<Record<string, unknown>> = {
    registerNode: registerDesignNode,
    getNodeAttrs: (metadata) => {
      const candidate = design.value?.candidateId === metadata.nodeId
      const states = [
        candidate ? 'candidate' : '',
        candidate && design.value?.candidateUsesFallback ? 'visual-source' : '',
      ].filter(Boolean).join(' ')
      return {
        'data-config-node-state': states || undefined,
        'role': 'presentation',
      }
    },
    interceptEvent: () => true,
  }

  const stageStyle = computed<CSSProperties | undefined>(() => {
    if (runtimeMode.value !== 'design' || design.value?.variant !== 'drag-visual')
      return undefined
    return {
      position: 'absolute',
      top: '0',
      left: '0',
      width: `${Math.max(1, design.value.canvasWidth ?? 1)}px`,
      transform: ghostOffset.value
        ? `translate(${-ghostOffset.value.x}px, ${-ghostOffset.value.y}px)`
        : undefined,
      transformOrigin: 'top left',
    }
  })

  function updateGhostOffset(): void {
    if (runtimeMode.value !== 'design' || design.value?.variant !== 'drag-visual' || !design.value.candidateId)
      return
    const stageElement = stage.value
    const candidate = [...registeredNodes.values()]
      .find(registration => registration.metadata.nodeId === design.value?.candidateId)
      ?.element
    if (!stageElement || !candidate)
      return
    const stageRect = stageElement.getBoundingClientRect()
    const candidateRect = candidate.getBoundingClientRect()
    ghostOffset.value = {
      x: candidateRect.left - stageRect.left,
      y: candidateRect.top - stageRect.top,
    }
  }

  function deepestDesignNode(clientX: number, clientY: number): string | undefined {
    return [...registeredNodes.values()]
      .flatMap((registration) => {
        if (registration.metadata.nodeId === design.value?.candidateId)
          return []
        const rect = registration.element.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0
          || clientX < rect.left || clientX > rect.right
          || clientY < rect.top || clientY > rect.bottom) {
          return []
        }
        return [{
          area: rect.width * rect.height,
          depth: registration.metadata.path.split('.').filter(Boolean).length,
          nodeId: registration.metadata.nodeId,
          order: registration.order,
        }]
      })
      .sort((left, right) => right.depth - left.depth || left.area - right.area || right.order - left.order)[0]
      ?.nodeId
  }

  function postDesignPointer(type: 'designPointerDown' | 'designPointerMove' | 'designPointerUp' | 'designPointerCancel', event: PointerEvent): void {
    if (runtimeMode.value !== 'design' || design.value?.variant !== 'canvas')
      return
    postMessage({
      type,
      payload: {
        button: event.button,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        nodeId: deepestDesignNode(event.clientX, event.clientY),
        pointerId: event.pointerId,
        shiftKey: event.shiftKey,
      },
    })
  }

  function handleDesignPointerDown(event: PointerEvent): void {
    event.preventDefault()
    postDesignPointer('designPointerDown', event)
  }

  async function sync(): Promise<void> {
    if (runtimeMode.value === 'design' && design.value?.variant === 'drag-visual') {
      updateGhostOffset()
      return
    }
    if (stage.value)
      geometryObserver?.observe(stage.value)
    await nextTick()
    flushGeometry()
  }

  function reset(): void {
    ghostOffset.value = undefined
  }

  onMounted(() => {
    window.addEventListener('resize', scheduleGeometry)
    window.addEventListener('scroll', scheduleGeometry, true)
    if (typeof ResizeObserver !== 'undefined') {
      geometryObserver = new ResizeObserver(() => {
        if (design.value?.variant === 'drag-visual')
          updateGhostOffset()
        else
          scheduleGeometry()
      })
      if (stage.value)
        geometryObserver.observe(stage.value)
      registeredNodes.forEach(registration => geometryObserver?.observe(registration.element))
    }
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', scheduleGeometry)
    window.removeEventListener('scroll', scheduleGeometry, true)
    if (geometryFrame !== undefined)
      window.cancelAnimationFrame(geometryFrame)
    geometryObserver?.disconnect()
    registeredNodes.clear()
  })

  return {
    designEditor,
    handleDesignPointerDown,
    postDesignPointer,
    reset,
    stage,
    stageStyle,
    sync,
  }
}

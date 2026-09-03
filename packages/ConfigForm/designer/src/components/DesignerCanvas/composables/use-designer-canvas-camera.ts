import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { CSSProperties, Ref } from 'vue'
import type { DesignerCanvasCamera } from '../types'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

const CANVAS_FRAME_WIDTHS: Record<ConfigFormBreakpoint, number> = {
  desktop: 900,
  tablet: 720,
  mobile: 390,
}
const CANVAS_MIN_SCALE = 0.25
const CANVAS_MAX_SCALE = 2
const CANVAS_MIN_SHEET_HEIGHT = 560
const CANVAS_SCALE_STEPS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2] as const

interface UseDesignerCanvasCameraOptions {
  breakpoint: () => ConfigFormBreakpoint | undefined
  canvasRef: Ref<HTMLElement | undefined>
  cameraViewportRef: Ref<HTMLElement | undefined>
  onGeometryChange: () => void
  onScaleChange: () => void
  sheetRef: Ref<HTMLElement | undefined>
}

export function useDesignerCanvasCamera(options: UseDesignerCanvasCameraOptions) {
  const camera = reactive<DesignerCanvasCamera>({
    mode: 'fit',
    pan: { x: 0, y: 0 },
    scale: 1,
  })
  const sheetHeight = ref(CANVAS_MIN_SHEET_HEIGHT)
  const cameraHovered = ref(false)
  const cameraPanning = ref(false)
  const spacePressed = ref(false)
  let resizeObserver: ResizeObserver | undefined
  let cameraMeasureFrame: number | undefined
  let cameraPanCleanup: (() => void) | undefined

  const intrinsicFrameWidth = computed(() => CANVAS_FRAME_WIDTHS[options.breakpoint() ?? 'desktop'])
  const cameraPercent = computed(() => Math.round(camera.scale * 100))
  const cameraSizerStyle = computed<CSSProperties>(() => ({
    height: `${Math.max(1, sheetHeight.value * camera.scale)}px`,
    width: `${intrinsicFrameWidth.value * camera.scale}px`,
  }))
  const cameraSheetStyle = computed(() => ({
    '--mx-designer-camera-inverse-scale': String(1 / camera.scale),
    'transform': `scale(${camera.scale})`,
    'width': `${intrinsicFrameWidth.value}px`,
  }) satisfies CSSProperties)

  function clampCameraScale(scale: number): number {
    return Math.min(CANVAS_MAX_SCALE, Math.max(CANVAS_MIN_SCALE, scale))
  }

  function canvasFitScale(): number {
    const viewport = options.cameraViewportRef.value
    if (!viewport)
      return 1
    const styles = getComputedStyle(viewport)
    const horizontalPadding = (Number.parseFloat(styles.paddingLeft) || 0)
      + (Number.parseFloat(styles.paddingRight) || 0)
    const availableWidth = Math.max(1, viewport.clientWidth - horizontalPadding)
    return clampCameraScale(Math.min(1, availableWidth / intrinsicFrameWidth.value))
  }

  function measureCanvasCamera(): void {
    cameraMeasureFrame = undefined
    const sheet = options.sheetRef.value
    if (sheet)
      sheetHeight.value = Math.max(CANVAS_MIN_SHEET_HEIGHT, sheet.offsetHeight)
    if (camera.mode === 'fit') {
      camera.scale = canvasFitScale()
      void nextTick(() => {
        const viewport = options.cameraViewportRef.value
        if (!viewport)
          return
        viewport.scrollLeft = 0
        camera.pan.x = 0
      })
    }
  }

  function scheduleCanvasCameraMeasure(): void {
    if (cameraMeasureFrame !== undefined)
      return
    cameraMeasureFrame = window.requestAnimationFrame(measureCanvasCamera)
  }

  function updateCameraPan(): void {
    const viewport = options.cameraViewportRef.value
    if (!viewport)
      return
    camera.pan.x = viewport.scrollLeft
    camera.pan.y = viewport.scrollTop
    options.onGeometryChange()
  }

  function setCameraScale(scale: number): void {
    const viewport = options.cameraViewportRef.value
    const sheet = options.sheetRef.value
    const nextScale = clampCameraScale(scale)
    if (!viewport || !sheet) {
      camera.mode = 'manual'
      camera.scale = nextScale
      return
    }

    const viewportRect = viewport.getBoundingClientRect()
    const sheetRect = sheet.getBoundingClientRect()
    const anchor = {
      x: (viewportRect.left + viewport.clientWidth / 2 - sheetRect.left) / camera.scale,
      y: (viewportRect.top + viewport.clientHeight / 2 - sheetRect.top) / camera.scale,
    }
    camera.mode = 'manual'
    camera.scale = nextScale
    void nextTick(() => {
      const nextSheetRect = sheet.getBoundingClientRect()
      viewport.scrollBy({
        left: nextSheetRect.left + anchor.x * nextScale - (viewportRect.left + viewport.clientWidth / 2),
        top: nextSheetRect.top + anchor.y * nextScale - (viewportRect.top + viewport.clientHeight / 2),
      })
      updateCameraPan()
    })
  }

  function zoomCamera(direction: 'in' | 'out'): void {
    const epsilon = 0.001
    const next = direction === 'in'
      ? CANVAS_SCALE_STEPS.find(scale => scale > camera.scale + epsilon)
      : [...CANVAS_SCALE_STEPS].reverse().find(scale => scale < camera.scale - epsilon)
    if (next !== undefined)
      setCameraScale(next)
  }

  function fitCamera(): void {
    camera.mode = 'fit'
    measureCanvasCamera()
  }

  function resetCamera(): void {
    setCameraScale(1)
  }

  function editableKeyboardTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement
      && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  }

  function cameraShortcutActive(target: EventTarget | null): boolean {
    const canvas = options.canvasRef.value
    return Boolean(cameraHovered.value
      || (target instanceof Node && canvas?.contains(target)))
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    if (!cameraShortcutActive(event.target) || editableKeyboardTarget(event.target))
      return
    if (event.code === 'Space') {
      const target = event.target instanceof Element ? event.target : undefined
      if (target?.closest('[data-designer-editor-control], [data-editor-focus-node-id]'))
        return
      event.preventDefault()
      spacePressed.value = true
      return
    }
    if (event.shiftKey && event.code === 'Digit1') {
      event.preventDefault()
      fitCamera()
    }
    else if (event.code === 'Digit0' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      resetCamera()
    }
    else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomCamera('in')
    }
    else if (event.key === '-') {
      event.preventDefault()
      zoomCamera('out')
    }
  }

  function handleDocumentKeyup(event: KeyboardEvent): void {
    if (event.code === 'Space')
      spacePressed.value = false
  }

  function cancelCameraPan(): void {
    cameraPanCleanup?.()
  }

  function handleWindowBlur(): void {
    spacePressed.value = false
    cancelCameraPan()
  }

  function beginCameraPan(event: PointerEvent): void {
    if (event.button !== 0 || !options.cameraViewportRef.value)
      return
    event.preventDefault()
    event.stopPropagation()
    cameraPanCleanup?.()
    const viewport = options.cameraViewportRef.value
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
    const pointerId = event.pointerId
    const start = {
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      x: event.clientX,
      y: event.clientY,
    }
    cameraPanning.value = true
    target?.setPointerCapture?.(pointerId)
    const move = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== pointerId)
        return
      viewport.scrollLeft = start.scrollLeft - (moveEvent.clientX - start.x)
      viewport.scrollTop = start.scrollTop - (moveEvent.clientY - start.y)
      updateCameraPan()
    }
    const finish = (finishEvent: PointerEvent): void => {
      if (finishEvent.pointerId === pointerId)
        cameraPanCleanup?.()
    }
    cameraPanCleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      target?.removeEventListener('lostpointercapture', finish)
      if (target?.hasPointerCapture?.(pointerId))
        target.releasePointerCapture(pointerId)
      cameraPanCleanup = undefined
      cameraPanning.value = false
      updateCameraPan()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    target?.addEventListener('lostpointercapture', finish)
  }

  function observeRuntimeElement(element: HTMLElement): void {
    resizeObserver?.observe(element)
  }

  function unobserveRuntimeElement(element: HTMLElement): void {
    resizeObserver?.unobserve(element)
  }

  watch(options.breakpoint, () => {
    void nextTick(() => {
      options.onGeometryChange()
      scheduleCanvasCameraMeasure()
    })
  })

  watch(() => camera.scale, () => {
    void nextTick(options.onScaleChange)
  })

  onMounted(() => {
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        options.onGeometryChange()
        scheduleCanvasCameraMeasure()
      })
      if (options.sheetRef.value)
        resizeObserver.observe(options.sheetRef.value)
      if (options.cameraViewportRef.value)
        resizeObserver.observe(options.cameraViewportRef.value)
    }
    scheduleCanvasCameraMeasure()
    document.addEventListener('keydown', handleDocumentKeydown)
    document.addEventListener('keyup', handleDocumentKeyup)
    window.addEventListener('blur', handleWindowBlur)
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    cameraPanCleanup?.()
    if (cameraMeasureFrame !== undefined)
      window.cancelAnimationFrame(cameraMeasureFrame)
    document.removeEventListener('keydown', handleDocumentKeydown)
    document.removeEventListener('keyup', handleDocumentKeyup)
    window.removeEventListener('blur', handleWindowBlur)
  })

  return {
    beginCameraPan,
    camera,
    cameraHovered,
    cameraPanning,
    cameraPercent,
    cameraSheetStyle,
    cameraSizerStyle,
    fitCamera,
    intrinsicFrameWidth,
    maxScale: CANVAS_MAX_SCALE,
    minScale: CANVAS_MIN_SCALE,
    observeRuntimeElement,
    resetCamera,
    scheduleCanvasCameraMeasure,
    spacePressed,
    unobserveRuntimeElement,
    updateCameraPan,
    zoomCamera,
  }
}

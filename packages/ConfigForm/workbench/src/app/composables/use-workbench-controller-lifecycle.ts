import { onBeforeUnmount, onMounted } from 'vue'

interface WorkbenchControllerLifecycleOptions {
  beforeDispose: () => void
  beforeUnloadRequired: () => boolean
  dispose: () => Promise<void>
  handleVisibilityHidden: () => void | Promise<void> | undefined
  initialize: () => Promise<void>
  notify: (error: unknown) => void
  setInitialized: (initialized: boolean) => void
}

export function useWorkbenchControllerLifecycle(options: WorkbenchControllerLifecycleOptions): void {
  let disposePromise: Promise<void> | undefined

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden')
      void options.handleVisibilityHidden()
  }

  function handlePageHide(): void {
    void options.handleVisibilityHidden()
  }

  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!options.beforeUnloadRequired())
      return
    event.preventDefault()
    event.returnValue = ''
  }

  async function disposeWorkbench(): Promise<void> {
    if (disposePromise)
      return await disposePromise
    disposePromise = (async () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      globalThis.removeEventListener('pagehide', handlePageHide)
      globalThis.removeEventListener('beforeunload', handleBeforeUnload)
      await options.dispose()
    })()
    return await disposePromise
  }

  onMounted(async () => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    globalThis.addEventListener('pagehide', handlePageHide)
    globalThis.addEventListener('beforeunload', handleBeforeUnload)
    try {
      await options.initialize()
    }
    catch (error) {
      options.notify(error)
    }
    finally {
      options.setInitialized(true)
    }
  })

  onBeforeUnmount(() => {
    options.beforeDispose()
    void disposeWorkbench()
  })
}

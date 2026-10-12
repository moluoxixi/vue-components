import { ref, watch } from 'vue'

export function useBrowseView(scope: string, initial: 'cards' | 'list' = 'list') {
  const key = `config-form.workbench.browse.${scope}`
  const view = ref(initial)
  try {
    const saved = localStorage.getItem(key)
    if (saved === 'cards' || saved === 'list')
      view.value = saved
  }
  catch {
    // Browsing remains available when the browser restricts storage.
  }
  watch(view, (value) => {
    try {
      localStorage.setItem(key, value)
    }
    catch {
      // Keep the preference for this session.
    }
  })
  return view
}

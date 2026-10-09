import { ref, watch } from 'vue'

const key = 'config-form.studio.material-preferences.v1'

export function useMaterialPreferences() {
  const recent = ref<string[]>([])
  const favorites = ref<string[]>([])
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}')
    recent.value = Array.isArray(value.recent)
      ? value.recent.filter((key: unknown) => typeof key === 'string').slice(0, 16)
      : []
    favorites.value = Array.isArray(value.favorites)
      ? value.favorites.filter((key: unknown) => typeof key === 'string').slice(0, 128)
      : []
  }
  catch {
    /* Optional preferences must not prevent opening the editor. */
  }
  watch([recent, favorites], () => {
    try {
      localStorage.setItem(key, JSON.stringify({ recent: recent.value, favorites: favorites.value }))
    }
    catch {
      /* Keep session preferences when storage is unavailable. */
    }
  })
  function remember(key: string): void {
    recent.value = [key, ...recent.value.filter(item => item !== key)].slice(0, 16)
  }
  function toggleFavorite(key: string): void {
    favorites.value = favorites.value.includes(key)
      ? favorites.value.filter(item => item !== key)
      : [...favorites.value, key]
  }
  return { recent, favorites, remember, toggleFavorite }
}

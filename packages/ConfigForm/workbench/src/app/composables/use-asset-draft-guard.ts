import type { createDesignerLocale } from '@moluoxixi/config-form-designer'
import type { ComputedRef } from 'vue'
import { ElMessageBox } from 'element-plus'
import { onBeforeUnmount, onMounted } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

interface AssetDraftGuardOptions {
  editor: () => { busy: boolean, hasChanges: boolean } | null | undefined
  locale: ComputedRef<ReturnType<typeof createDesignerLocale>>
}

export function useAssetDraftGuard({ editor, locale }: AssetDraftGuardOptions): void {
  async function canLeave(): Promise<boolean> {
    if (editor()?.busy)
      return false
    if (!editor()?.hasChanges)
      return true
    try {
      await ElMessageBox.confirm(
        locale.value.t('data.leaveHint', 'Some data drafts have not been saved. Leave and discard them?'),
        locale.value.t('data.unsaved', 'Unsaved data drafts'),
        {
          confirmButtonText: locale.value.t('data.discardDraft', 'Discard draft'),
          cancelButtonText: locale.value.t('data.keepEditing', 'Keep editing'),
          type: 'warning',
          appendTo: '#workbench-overlays',
          closeOnClickModal: false,
        },
      )
      return true
    }
    catch {
      return false
    }
  }

  function beforeUnload(event: BeforeUnloadEvent): void {
    if (!editor()?.hasChanges && !editor()?.busy)
      return
    event.preventDefault()
    event.returnValue = ''
  }

  onBeforeRouteLeave(canLeave)
  onBeforeRouteUpdate(canLeave)
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
}

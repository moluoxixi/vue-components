import type { DesignSurfaceExpose } from '@moluoxixi/config-form-designer'
import type { Ref } from 'vue'
import type { StudioCommand } from '../types/studio-command'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useWorkbenchController, useWorkbenchDesignSession, useWorkbenchUiStore } from './context'

interface StudioNavigation {
  showDesign: () => void
  experience: () => void
  handoff: () => void
  assets: () => void
  schema: () => void
}

export function useStudioCommands(designer: Readonly<Ref<DesignSurfaceExpose | null>>, navigation: StudioNavigation) {
  const controller = useWorkbenchController()
  const design = useWorkbenchDesignSession()
  const ui = useWorkbenchUiStore()
  const commands = computed<StudioCommand[]>(() => {
    const chinese = ui.localeId.value === 'zh-CN'
    const label = (zh: string, en: string) => (chinese ? zh : en)
    const readonly = controller.busy.value
    const busyReason = label('正在处理项目，请稍候。', 'A project operation is in progress. Please wait.')
    const project = controller.currentProject.value
    if (!project)
      return []
    const history = design.historyControl.value
    const list: StudioCommand[] = [
      {
        id: 'save',
        label: label('保存项目', 'Save project'),
        group: label('项目', 'Project'),
        shortcut: 'Ctrl S',
        disabled: readonly || !controller.dirty.value || Boolean(controller.configError.value),
        disabledReason: readonly
          ? busyReason
          : controller.configError.value
            ? label('请先修复配置问题。', 'Resolve configuration issues before saving.')
            : label('所有更改已保存。', 'All changes are saved.'),
        run: () => {
          void controller.saveProject()
        },
      },
      {
        id: 'undo',
        label: label('撤销', 'Undo'),
        group: label('编辑', 'Edit'),
        shortcut: 'Ctrl Z',
        disabled: readonly || !history.canUndo,
        disabledReason: readonly ? busyReason : label('还没有可以撤销的操作。', 'No changes to undo yet.'),
        run: () => {
          history.undo()
        },
      },
      {
        id: 'redo',
        label: label('重做', 'Redo'),
        group: label('编辑', 'Edit'),
        shortcut: 'Ctrl Shift Z',
        disabled: readonly || !history.canRedo,
        disabledReason: readonly ? busyReason : label('没有可以重做的操作。', 'No changes to redo.'),
        run: () => {
          history.redo()
        },
      },
      {
        id: 'design',
        label: label('切换到设计', 'Switch to design'),
        group: label('工作区', 'Workspace'),
        run: navigation.showDesign,
      },
      {
        id: 'experience',
        label: label('体验原型', 'Experience prototype'),
        group: label('工作区', 'Workspace'),
        run: () => {
          if (!ui.previewOpen.value)
            navigation.experience()
        },
      },
      {
        id: 'handoff',
        label: label('交付与源码', 'Handoff and source'),
        group: label('工作区', 'Workspace'),
        run: navigation.handoff,
      },
      {
        id: 'assets',
        label: label('管理数据与资源', 'Manage data and resources'),
        group: label('项目', 'Project'),
        run: navigation.assets,
      },
      {
        id: 'schema',
        label: label('从 JSON Schema 生成字段', 'Generate fields from JSON Schema'),
        group: label('数据', 'Data'),
        disabled: readonly,
        disabledReason: busyReason,
        run: navigation.schema,
      },
      {
        id: 'issues',
        label: label('查看问题', 'Show issues'),
        group: label('工作区', 'Workspace'),
        run: () => {
          navigation.showDesign()
          ui.editorSession.issuesOpen.value = true
        },
      },
      ...(['desktop', 'tablet', 'mobile'] as const).map((breakpoint, index) => ({
        id: `viewport:${breakpoint}`,
        label: label(['桌面画布', '平板画布', '手机画布'][index]!, `${breakpoint} canvas`),
        group: label('视口', 'Viewport'),
        run: () => {
          navigation.showDesign()
          designer.value?.selectBreakpoint(breakpoint)
        },
      })),
    ]
    for (const material of controller.registry.value.listMaterials()) {
      list.push({
        id: `insert:${material.key}`,
        label: label('插入 ', 'Insert ') + controller.workbenchLocale.value.materialTitle(material),
        group: label('组件', 'Materials'),
        detail: controller.workbenchLocale.value.materialCategory(material),
        disabled: readonly,
        disabledReason: busyReason,
        run: () => {
          navigation.showDesign()
          designer.value?.addMaterial(material.key)
        },
      })
    }
    for (const id of project?.surfaceOrder ?? []) {
      const surface = project?.surfacesById[id]
      if (surface) {
        list.push({
          id: `surface:${id}`,
          label: surface.name,
          group: label('页面与浮层', 'Surfaces'),
          detail: surface.kind === 'page' ? label('页面', 'Page') : surface.kind === 'dialog' ? label('弹窗', 'Dialog') : label('抽屉', 'Drawer'),
          run: () => {
            navigation.showDesign()
            controller.selectSurfaceFromDesigner(id)
          },
        })
      }
    }
    return list
  })

  function shortcut(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || !controller.currentProject.value)
      return
    if (event.key.toLowerCase() === 'k') {
      event.preventDefault()
      ui.editorSession.commandOpen.value = !ui.editorSession.commandOpen.value
    }
    if (event.key.toLowerCase() === 's') {
      event.preventDefault()
      const command = commands.value.find(item => item.id === 'save')
      if (command && !command.disabled)
        command.run()
    }
  }
  onMounted(() => window.addEventListener('keydown', shortcut))
  onBeforeUnmount(() => window.removeEventListener('keydown', shortcut))
  return { studioCommands: commands }
}

import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { StyleValue, VNodeChild } from 'vue'
import type { RendererPipelineContext, RenderNode } from '../types/internal'
import { h } from 'vue'

export function createLayoutRenderer<TValues extends ConfigFormValues>(
  context: RendererPipelineContext<TValues>,
  renderNode: RenderNode<TValues>,
): () => VNodeChild {
  return () => {
    const { activePresentationLayout, bem, props, responsiveLabelWidths, responsiveLayouts } = context
    const layoutAttrs = props.layoutAttrs ?? {}
    const inline = props.inline === true
    const layouts = responsiveLayouts.value
    const labelWidths = responsiveLabelWidths.value
    const style: StyleValue = [
      layoutAttrs.style,
      inline
        ? {
            alignItems: 'flex-start',
            display: 'flex',
            flexWrap: 'wrap',
            gap: props.gap ?? '16px',
          }
        : {
            '--mx-config-form-columns-desktop': layouts.desktop.columns,
            '--mx-config-form-columns-mobile': layouts.mobile.columns,
            '--mx-config-form-columns-tablet': layouts.tablet.columns,
            '--mx-config-form-label-width-desktop': labelWidths.desktop,
            '--mx-config-form-label-width-mobile': labelWidths.mobile,
            '--mx-config-form-label-width-tablet': labelWidths.tablet,
            ...(activePresentationLayout.value
              ? {
                  '--mx-config-form-active-columns': activePresentationLayout.value.columns,
                  '--mx-config-form-active-label-width': labelWidths[props.breakpoint ?? 'desktop'],
                }
              : {}),
            'display': 'grid',
            'gap': props.gap ?? '16px',
            'gridTemplateColumns': 'repeat(var(--mx-config-form-active-columns), minmax(0, 1fr))',
          },
    ]

    return h('div', {
      ...layoutAttrs,
      'class': [bem('row'), bem('row', inline ? 'inline' : 'grid'), layoutAttrs.class],
      'data-config-form-responsive-layout': inline ? undefined : '',
      style,
    }, context.props.fields.map((node, index) => renderNode(node, !inline, `fields.${index}`, new Set())))
  }
}

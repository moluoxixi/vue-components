import { describe, expect, it } from 'vitest'
import {
  createVueTypeScriptMirror,
  findModuleSpecifierContext,
  findNamedImportContext,
  isOffsetInVueScript,
  mergeWorkbenchModules,
  resolveMonacoWorkerKind,
  WORKBENCH_CONFIG_TYPE_DECLARATIONS,
  WORKBENCH_MODULES,
  WORKBENCH_TYPE_DECLARATIONS,
} from '../components'

function cursor(source: string): { offset: number, source: string } {
  const offset = source.indexOf('|')
  if (offset < 0)
    throw new Error('Missing cursor marker')
  return { offset, source: source.replace('|', '') }
}

function moduleDeclaration(moduleName: string): string {
  const escapedModuleName = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return WORKBENCH_TYPE_DECLARATIONS.match(
    new RegExp(`declare module '${escapedModuleName}' \\{([\\s\\S]*?)\\n\\}`),
  )?.[1] ?? ''
}

describe('workspace editor import contexts', () => {
  it.each([
    ['json', 'json'],
    ['typescript', 'typescript'],
    ['javascript', 'typescript'],
    ['html', 'html'],
    ['handlebars', 'html'],
    ['razor', 'html'],
    ['vue', 'html'],
    ['css', 'editor'],
  ] as const)('routes the %s language service to its bundled worker', (label, worker) => {
    expect(resolveMonacoWorkerKind(label)).toBe(worker)
  })

  it('detects module-path completion without treating named imports as module paths', () => {
    const path = cursor('import { ref } from \'@moluoxixi/con|\'')
    expect(findModuleSpecifierContext(path.source, path.offset)).toEqual({
      endOffset: path.offset,
      startOffset: path.offset - '@moluoxixi/con'.length,
      typed: '@moluoxixi/con',
    })

    const named = cursor('import { re|f } from \'vue\'')
    expect(findModuleSpecifierContext(named.source, named.offset)).toBeUndefined()
  })

  it.each([
    ['import { re|f } from \'vue\'', 'vue'],
    ['import { ElementConfig|Form } from \'@moluoxixi/config-form-element\'', '@moluoxixi/config-form-element'],
    ['import {\n  fields,\n  fo|rm,\n} from \'./form.config\'', './form.config'],
    ['import type { DefineField|Factory } from \'@moluoxixi/config-form-headless\'', '@moluoxixi/config-form-headless'],
  ])('binds a named import to only its declared module: %s', (markedSource, moduleName) => {
    const value = cursor(markedSource)
    expect(findNamedImportContext(value.source, value.offset)?.moduleName).toBe(moduleName)
  })

  it('keeps the workbench module list explicit and free of export names', () => {
    expect(WORKBENCH_MODULES).toContain('vue')
    expect(WORKBENCH_MODULES).toContain('@moluoxixi/config-form-element')
    expect(WORKBENCH_MODULES).toContain('./form.config')
    expect(WORKBENCH_MODULES).not.toContain('ref')
  })

  it('merges project manifest packages without duplicating built-ins', () => {
    expect(mergeWorkbenchModules([
      'element-plus',
      '@moluoxixi/config-form-element',
      'element-plus',
    ])).toEqual([
      ...WORKBENCH_MODULES,
      'element-plus',
    ])
  })
})

describe('vue TypeScript mirror', () => {
  const source = `<script setup lang="ts">
import { defineFields } from '@moluoxixi/config-form-headless'
const { defineField } = defineFields<{ name: string }>()
</script>

<template><main>{{ defineField }}</main></template>`

  it('preserves offsets and line breaks while exposing only script content', () => {
    const mirror = createVueTypeScriptMirror(source)
    expect(mirror).toHaveLength(source.length)
    expect(mirror.match(/\n/g)).toHaveLength(source.match(/\n/g)?.length ?? 0)
    expect(mirror).toContain('import { defineFields } from \'@moluoxixi/config-form-headless\'')
    expect(mirror).not.toContain('<script')
    expect(mirror).not.toContain('<template>')
  })

  it('limits semantic TypeScript positions to script blocks', () => {
    expect(isOffsetInVueScript(source, source.indexOf('defineFields'))).toBe(true)
    expect(isOffsetInVueScript(source, source.indexOf('<main>'))).toBe(false)
  })
})

describe('workbench type declarations', () => {
  it('publishes real defineFields and defineField signatures from headless only', () => {
    expect(WORKBENCH_TYPE_DECLARATIONS).toContain('export function defineFields<TValues extends ConfigFormValues = ConfigFormValues>(): DefineConfigFormFieldsResult<TValues>')
    expect(WORKBENCH_TYPE_DECLARATIONS).toContain('export function defineField<TValues extends ConfigFormValues = ConfigFormValues')
    expect(WORKBENCH_TYPE_DECLARATIONS).not.toContain('export function defineConfigFormFields')
    expect(WORKBENCH_TYPE_DECLARATIONS).not.toContain('export function defineConfigFormField')

    const elementDeclaration = moduleDeclaration('@moluoxixi/config-form-element')
    expect(elementDeclaration).toContain('ElementConfigForm')
    expect(elementDeclaration).not.toContain('defineFields')
    expect(elementDeclaration).not.toContain('ref<T>')
  })

  it('keeps Vue, Element and headless exports isolated by module', () => {
    const vueDeclaration = moduleDeclaration('vue')
    const elementDeclaration = moduleDeclaration('@moluoxixi/config-form-element')
    const headlessDeclaration = moduleDeclaration('@moluoxixi/config-form-headless')

    expect(vueDeclaration).toContain('export function ref<T>')
    expect(vueDeclaration).not.toContain('defineFields')
    expect(vueDeclaration).not.toContain('ElementConfigForm')

    expect(elementDeclaration).toContain('ElementConfigFormProps')
    expect(elementDeclaration).not.toContain('computed')
    expect(elementDeclaration).not.toContain('defineFields')

    expect(headlessDeclaration).toContain('export function defineFields')
    expect(headlessDeclaration).toContain('export interface DefineConfigFormFieldFactory')
    expect(headlessDeclaration).toContain('required?: ConfigFormCondition<TValues>')
    expect(headlessDeclaration).toContain('slots?: ConfigFormFieldSlots<TValues, TComponent, TFieldAttrs, TCellAttrs>')
    expect(headlessDeclaration).toContain('slots?: ConfigFormComponentSlots<TValues, TComponent, TFieldAttrs, TCellAttrs>')
    expect(headlessDeclaration).toContain('export type ConfigFormComponentSlot')
    expect(headlessDeclaration).toContain('export type ConfigFormFieldSlot')
    expect(headlessDeclaration).toContain('export type ConfigFormColumnSpan = number')
    expect(headlessDeclaration).toContain('export interface ConfigFormComponentRegistration')
    expect(headlessDeclaration).toContain('export interface ConfigFormErrors')
    expect(headlessDeclaration).toContain('export type ConfigFormReadonlyRender')
    expect(headlessDeclaration).toContain('=> VNodeChild')
    expect(headlessDeclaration).not.toContain('computed')
    expect(headlessDeclaration).not.toContain('ElementConfigForm')
  })

  it('declares the runtime component and adapter entrypoints used by source pages', () => {
    expect(WORKBENCH_TYPE_DECLARATIONS).toContain('export default ElementConfigForm')
    expect(WORKBENCH_TYPE_DECLARATIONS).toContain('export default AntdConfigForm')
    expect(WORKBENCH_TYPE_DECLARATIONS).toContain('export const ConfigForm: ConfigFormComponent')
    expect(WORKBENCH_TYPE_DECLARATIONS).toContain('labelWidth?: string | number')
    expect(WORKBENCH_TYPE_DECLARATIONS).toContain('responsive?: Record<string, unknown>')
  })

  it('limits form.config to the exports emitted by the page template', () => {
    expect(WORKBENCH_CONFIG_TYPE_DECLARATIONS).toContain('export const fields')
    expect(WORKBENCH_CONFIG_TYPE_DECLARATIONS).toContain('export const form')
    expect(WORKBENCH_CONFIG_TYPE_DECLARATIONS).toContain('export const initialValues')
    expect(WORKBENCH_CONFIG_TYPE_DECLARATIONS).not.toContain('computed')
    expect(WORKBENCH_CONFIG_TYPE_DECLARATIONS).not.toContain('defineFields')
  })
})

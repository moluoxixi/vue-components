import type * as PluginApi from '../src/plugins'
import { describe, expectTypeOf, it } from 'vitest'

describe('plugin api', () => {
  it('keeps the simplified plugin and field processing API behind the plugins subpath', () => {
    type HasNormalizeField = 'normalizeField' extends keyof typeof PluginApi ? true : false
    type HasCollectFieldConfigs = 'collectFieldConfigs' extends keyof typeof PluginApi ? true : false
    type HasCreateFormRuntime = 'createFormRuntime' extends keyof typeof PluginApi ? true : false
    type HasCreateRuntimeToken = 'createRuntimeToken' extends keyof typeof PluginApi ? true : false
    type HasIsRuntimeToken = 'isRuntimeToken' extends keyof typeof PluginApi ? true : false
    type HasResolveFieldValueExport = 'resolveField' extends keyof typeof PluginApi ? true : false
    type HasTransformFieldValueExport = 'transformField' extends keyof typeof PluginApi ? true : false
    type HasNormalizeFieldBindingExport = 'normalizeFieldBinding' extends keyof typeof PluginApi ? true : false
    type HasNormalizeNodeExport = 'normalizeNode' extends keyof typeof PluginApi ? true : false

    type HasFormRuntimeOptions = 'plugins' extends keyof PluginApi.FormRuntimeOptions ? true : false
    type HasRuntimeCreateResolveSnap = 'createResolveSnap' extends keyof PluginApi.FormRuntime ? true : false
    type HasRuntimeTransformNode = 'transformNode' extends keyof PluginApi.FormRuntime ? true : false
    type HasRuntimeResolveNode = 'resolveNode' extends keyof PluginApi.FormRuntime ? true : false
    type HasRuntimeResolveSlot = 'resolveSlot' extends keyof PluginApi.FormRuntime ? true : false
    type HasRuntimeResolveVisible = 'resolveVisible' extends keyof PluginApi.FormRuntime ? true : false
    type HasRuntimeResolveDisabled = 'resolveDisabled' extends keyof PluginApi.FormRuntime ? true : false
    type HasRuntimeResolveField = 'resolveField' extends keyof PluginApi.FormRuntime ? true : false
    type HasRuntimeTransformField = 'transformField' extends keyof PluginApi.FormRuntime ? true : false
    type HasRuntimeTransformFields = 'transformFields' extends keyof PluginApi.FormRuntime ? true : false
    type HasPluginTokens = 'tokens' extends keyof PluginApi.FormRuntimePlugin ? true : false
    type HasPluginTransformNode = 'transformNode' extends keyof PluginApi.FormRuntimePlugin ? true : false
    type HasPluginTransformField = 'transformField' extends keyof PluginApi.FormRuntimePlugin ? true : false
    type TransformHookHasContext = Parameters<PluginApi.FormFieldTransform> extends [unknown, unknown, ...unknown[]] ? true : false
    type RuntimeTransformHasContext = Parameters<PluginApi.FormRuntime['transformField']> extends [unknown, unknown, ...unknown[]] ? true : false

    expectTypeOf<HasNormalizeField>().toEqualTypeOf<true>()
    expectTypeOf<HasCollectFieldConfigs>().toEqualTypeOf<true>()
    expectTypeOf<HasCreateFormRuntime>().toEqualTypeOf<true>()
    expectTypeOf<HasCreateRuntimeToken>().toEqualTypeOf<false>()
    expectTypeOf<HasIsRuntimeToken>().toEqualTypeOf<false>()
    expectTypeOf<HasResolveFieldValueExport>().toEqualTypeOf<true>()
    expectTypeOf<HasTransformFieldValueExport>().toEqualTypeOf<true>()
    expectTypeOf<HasNormalizeFieldBindingExport>().toEqualTypeOf<false>()
    expectTypeOf<HasNormalizeNodeExport>().toEqualTypeOf<false>()
    expectTypeOf<HasFormRuntimeOptions>().toEqualTypeOf<true>()
    expectTypeOf<HasRuntimeCreateResolveSnap>().toEqualTypeOf<false>()
    expectTypeOf<HasRuntimeTransformNode>().toEqualTypeOf<false>()
    expectTypeOf<HasRuntimeResolveNode>().toEqualTypeOf<false>()
    expectTypeOf<HasRuntimeResolveSlot>().toEqualTypeOf<false>()
    expectTypeOf<HasRuntimeResolveVisible>().toEqualTypeOf<false>()
    expectTypeOf<HasRuntimeResolveDisabled>().toEqualTypeOf<false>()
    expectTypeOf<HasRuntimeResolveField>().toEqualTypeOf<true>()
    expectTypeOf<HasRuntimeTransformField>().toEqualTypeOf<true>()
    expectTypeOf<HasRuntimeTransformFields>().toEqualTypeOf<false>()
    expectTypeOf<HasPluginTokens>().toEqualTypeOf<false>()
    expectTypeOf<HasPluginTransformNode>().toEqualTypeOf<false>()
    expectTypeOf<HasPluginTransformField>().toEqualTypeOf<true>()
    expectTypeOf<TransformHookHasContext>().toEqualTypeOf<false>()
    expectTypeOf<RuntimeTransformHasContext>().toEqualTypeOf<false>()
  })
})

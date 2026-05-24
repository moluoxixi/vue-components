import { describe, expect, expectTypeOf, it } from 'vitest'
import * as PluginApi from '../src/plugins'

describe('plugin api', () => {
  it('keeps the simplified plugin and field processing API behind the plugins subpath', () => {
    type HasNormalizeField = 'normalizeField' extends keyof typeof PluginApi ? true : false
    type HasNormalizeValidateOn = 'normalizeValidateOn' extends keyof typeof PluginApi ? true : false
    type HasShouldValidateOn = 'shouldValidateOn' extends keyof typeof PluginApi ? true : false
    type HasApplyFieldTransform = 'applyFieldTransform' extends keyof typeof PluginApi ? true : false
    type HasCollectFieldConfigs = 'collectFieldConfigs' extends keyof typeof PluginApi ? true : false
    type HasCreateFormRuntime = 'createFormRuntime' extends keyof typeof PluginApi ? true : false
    type HasCreateRuntimeToken = 'createRuntimeToken' extends keyof typeof PluginApi ? true : false
    type HasIsRuntimeToken = 'isRuntimeToken' extends keyof typeof PluginApi ? true : false
    type HasResolveFieldValueExport = 'resolveField' extends keyof typeof PluginApi ? true : false
    type HasGetFieldDefaultsValueExport = 'getFieldDefaults' extends keyof typeof PluginApi ? true : false
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
    type HasRuntimeGetFieldDefaults = 'getFieldDefaults' extends keyof PluginApi.FormRuntime ? true : false
    type HasRuntimeTransformField = 'transformField' extends keyof PluginApi.FormRuntime ? true : false
    type HasRuntimeTransformFields = 'transformFields' extends keyof PluginApi.FormRuntime ? true : false
    type HasPluginTokens = 'tokens' extends keyof PluginApi.FormRuntimePlugin ? true : false
    type HasPluginGetDefaultField = 'getDefaultField' extends keyof PluginApi.FormRuntimePlugin ? true : false
    type HasPluginTransformNode = 'transformNode' extends keyof PluginApi.FormRuntimePlugin ? true : false
    type HasPluginTransformField = 'transformField' extends keyof PluginApi.FormRuntimePlugin ? true : false
    type TransformHookHasContext = Parameters<PluginApi.FormFieldTransform> extends [unknown, unknown, ...unknown[]] ? true : false
    type RuntimeTransformHasContext = Parameters<PluginApi.FormRuntime['transformField']> extends [unknown, unknown, ...unknown[]] ? true : false

    expect('normalizeField' in PluginApi).toBe(false)
    expect('normalizeValidateOn' in PluginApi).toBe(false)
    expect('shouldValidateOn' in PluginApi).toBe(false)
    expect('applyFieldTransform' in PluginApi).toBe(false)

    expectTypeOf<HasNormalizeField>().toEqualTypeOf<false>()
    expectTypeOf<HasNormalizeValidateOn>().toEqualTypeOf<false>()
    expectTypeOf<HasShouldValidateOn>().toEqualTypeOf<false>()
    expectTypeOf<HasApplyFieldTransform>().toEqualTypeOf<false>()
    expectTypeOf<HasCollectFieldConfigs>().toEqualTypeOf<true>()
    expectTypeOf<HasCreateFormRuntime>().toEqualTypeOf<true>()
    expectTypeOf<HasCreateRuntimeToken>().toEqualTypeOf<false>()
    expectTypeOf<HasIsRuntimeToken>().toEqualTypeOf<false>()
    expectTypeOf<HasResolveFieldValueExport>().toEqualTypeOf<false>()
    expectTypeOf<HasGetFieldDefaultsValueExport>().toEqualTypeOf<true>()
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
    expectTypeOf<HasRuntimeResolveField>().toEqualTypeOf<false>()
    expectTypeOf<HasRuntimeGetFieldDefaults>().toEqualTypeOf<true>()
    expectTypeOf<HasRuntimeTransformField>().toEqualTypeOf<true>()
    expectTypeOf<HasRuntimeTransformFields>().toEqualTypeOf<false>()
    expectTypeOf<HasPluginTokens>().toEqualTypeOf<false>()
    expectTypeOf<HasPluginGetDefaultField>().toEqualTypeOf<true>()
    expectTypeOf<HasPluginTransformNode>().toEqualTypeOf<false>()
    expectTypeOf<HasPluginTransformField>().toEqualTypeOf<true>()
    expectTypeOf<TransformHookHasContext>().toEqualTypeOf<false>()
    expectTypeOf<RuntimeTransformHasContext>().toEqualTypeOf<false>()
  })
})

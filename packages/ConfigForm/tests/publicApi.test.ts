import type * as PublicApi from '../index'
import { describe, expectTypeOf, it } from 'vitest'

describe('public api', () => {
  it('keeps defineField as the only public field factory', () => {
    type HasDefineField = 'defineField' extends keyof typeof PublicApi ? true : false
    type HasDefineFieldFor = 'defineFieldFor' extends keyof typeof PublicApi ? true : false
    type HasFormRuntimeLocale = 'FormRuntimeLocale' extends keyof typeof PublicApi ? true : false
    type HasFormRuntimeDebugEvent = 'FormRuntimeDebugEvent' extends keyof typeof PublicApi ? true : false
    type HasFormRuntimeConflictStrategy = 'FormRuntimeConflictStrategy' extends keyof typeof PublicApi ? true : false
    type HasFormRuntimePluginContext = 'FormRuntimePluginContext' extends keyof typeof PublicApi ? true : false
    type HasFormDevtoolsBridge = 'FormDevtoolsBridge' extends keyof typeof PublicApi ? true : false
    type HasFormRuntimeContext = 'FormRuntimeContext' extends keyof typeof PublicApi ? true : false
    type HasCreateRuntimeContextInput = 'CreateRuntimeContextInput' extends keyof typeof PublicApi ? true : false
    type HasFormRuntimeTransformContext = 'FormRuntimeTransformContext' extends keyof typeof PublicApi ? true : false
    type HasFormRuntimeTransformContextInput = 'FormRuntimeTransformContextInput' extends keyof typeof PublicApi ? true : false
    type HasRuntimeOptionsExtensions = 'extensions' extends keyof PublicApi.FormRuntimeOptions ? true : false
    type HasRuntimeOptionsPlugins = 'plugins' extends keyof PublicApi.FormRuntimeOptions ? true : false
    type HasRuntimeOptionsExpression = 'expression' extends keyof PublicApi.FormRuntimeOptions ? true : false
    type HasFieldConfigPlugins = 'plugins' extends keyof PublicApi.FieldConfig ? true : false
    type HasExpr = 'expr' extends keyof typeof PublicApi ? true : false
    type HasIsExpressionToken = 'isExpressionToken' extends keyof typeof PublicApi ? true : false
    type HasIsFormRuntime = 'isFormRuntime' extends keyof typeof PublicApi ? true : false
    type HasUseBem = 'useBem' extends keyof typeof PublicApi ? true : false
    type HasUseNamespace = 'useNamespace' extends keyof typeof PublicApi ? true : false
    type HasNormalizeField = 'normalizeField' extends keyof typeof PublicApi ? true : false
    type HasNormalizeValidateOn = 'normalizeValidateOn' extends keyof typeof PublicApi ? true : false
    type HasShouldValidateOn = 'shouldValidateOn' extends keyof typeof PublicApi ? true : false
    type HasApplyFieldTransform = 'applyFieldTransform' extends keyof typeof PublicApi ? true : false
    type HasAssertComponentNodeConfig = 'assertComponentNodeConfig' extends keyof typeof PublicApi ? true : false
    type HasCollectFieldConfigs = 'collectFieldConfigs' extends keyof typeof PublicApi ? true : false
    type HasIsFieldConfig = 'isFieldConfig' extends keyof typeof PublicApi ? true : false
    type HasIsFormNodeConfig = 'isFormNodeConfig' extends keyof typeof PublicApi ? true : false
    type HasCreateFormRuntime = 'createFormRuntime' extends keyof typeof PublicApi ? true : false
    type HasCreateRuntimeToken = 'createRuntimeToken' extends keyof typeof PublicApi ? true : false
    type HasIsRuntimeToken = 'isRuntimeToken' extends keyof typeof PublicApi ? true : false
    type HasNormalizeFormRuntime = 'normalizeFormRuntime' extends keyof typeof PublicApi ? true : false
    type HasProvideRuntime = 'provideRuntime' extends keyof typeof PublicApi ? true : false
    type HasUseRuntime = 'useRuntime' extends keyof typeof PublicApi ? true : false
    type RuntimeProp = NonNullable<PublicApi.ConfigFormProps['runtime']>
    type RuntimePropAcceptsOptions = PublicApi.FormRuntimeOptions extends RuntimeProp ? true : false
    type UseFormHasRuntime = 'runtime' extends keyof PublicApi.UseFormOptions ? true : false
    type TokenLikeConditionAllowed = { readonly __configFormToken: 'legacy' } extends PublicApi.FieldCondition ? true : false

    expectTypeOf<HasDefineField>().toEqualTypeOf<true>()
    expectTypeOf<HasDefineFieldFor>().toEqualTypeOf<false>()
    expectTypeOf<HasFormRuntimeLocale>().toEqualTypeOf<false>()
    expectTypeOf<HasFormRuntimeDebugEvent>().toEqualTypeOf<false>()
    expectTypeOf<HasFormRuntimeConflictStrategy>().toEqualTypeOf<false>()
    expectTypeOf<HasFormRuntimePluginContext>().toEqualTypeOf<false>()
    expectTypeOf<HasFormDevtoolsBridge>().toEqualTypeOf<false>()
    expectTypeOf<HasFormRuntimeContext>().toEqualTypeOf<false>()
    expectTypeOf<HasCreateRuntimeContextInput>().toEqualTypeOf<false>()
    expectTypeOf<HasFormRuntimeTransformContext>().toEqualTypeOf<false>()
    expectTypeOf<HasFormRuntimeTransformContextInput>().toEqualTypeOf<false>()
    expectTypeOf<HasRuntimeOptionsExtensions>().toEqualTypeOf<false>()
    expectTypeOf<HasRuntimeOptionsPlugins>().toEqualTypeOf<true>()
    expectTypeOf<HasRuntimeOptionsExpression>().toEqualTypeOf<false>()
    expectTypeOf<HasFieldConfigPlugins>().toEqualTypeOf<false>()
    expectTypeOf<HasExpr>().toEqualTypeOf<false>()
    expectTypeOf<HasIsExpressionToken>().toEqualTypeOf<false>()
    expectTypeOf<HasIsFormRuntime>().toEqualTypeOf<false>()
    expectTypeOf<HasUseBem>().toEqualTypeOf<false>()
    expectTypeOf<HasUseNamespace>().toEqualTypeOf<false>()
    expectTypeOf<HasNormalizeField>().toEqualTypeOf<false>()
    expectTypeOf<HasNormalizeValidateOn>().toEqualTypeOf<false>()
    expectTypeOf<HasShouldValidateOn>().toEqualTypeOf<false>()
    expectTypeOf<HasApplyFieldTransform>().toEqualTypeOf<false>()
    expectTypeOf<HasAssertComponentNodeConfig>().toEqualTypeOf<false>()
    expectTypeOf<HasCollectFieldConfigs>().toEqualTypeOf<false>()
    expectTypeOf<HasIsFieldConfig>().toEqualTypeOf<false>()
    expectTypeOf<HasIsFormNodeConfig>().toEqualTypeOf<false>()
    expectTypeOf<HasCreateFormRuntime>().toEqualTypeOf<false>()
    expectTypeOf<HasCreateRuntimeToken>().toEqualTypeOf<false>()
    expectTypeOf<HasIsRuntimeToken>().toEqualTypeOf<false>()
    expectTypeOf<HasNormalizeFormRuntime>().toEqualTypeOf<false>()
    expectTypeOf<HasProvideRuntime>().toEqualTypeOf<false>()
    expectTypeOf<HasUseRuntime>().toEqualTypeOf<false>()
    expectTypeOf<RuntimePropAcceptsOptions>().toEqualTypeOf<true>()
    expectTypeOf<UseFormHasRuntime>().toEqualTypeOf<false>()
    expectTypeOf<TokenLikeConditionAllowed>().toEqualTypeOf<false>()
  })
})
